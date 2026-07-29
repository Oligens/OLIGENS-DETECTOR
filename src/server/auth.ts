import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import { createHmac, randomUUID } from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return {};
    const raw = fs.readFileSync(envPath, "utf8");
    return dotenv.parse(raw);
  } catch {
    return {};
  }
}

function resolveEnvVar(name: string) {
  return process.env[name] ?? loadEnvFile()[name] ?? undefined;
}

const DATABASE_URL = resolveEnvVar("DATABASE_URL");
const JWT_SECRET = process.env.JWT_SECRET ?? "please-change-this-secret";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:4173";
const COOKIE_NAME = "oligens_session";
const STATE_COOKIE_NAME = "oligens_oauth_state";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// create pool lazily so module import doesn't throw when env isn't set
let pool: any = null;
function getPool() {
  if (!pool) {
    if (!DATABASE_URL) return null;
    pool = new (Pool as any)({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

let tablesInitialized = false;
async function ensureTables() {
  if (tablesInitialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role_institution TEXT NOT NULL DEFAULT 'Étudiant',
      plan_type TEXT NOT NULL DEFAULT 'FREE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(provider, provider_account_id)
    );
  `);

  tablesInitialized = true;
}

// Simple in-memory rate limiter. For production, replace with a distributed store.
const RATE_LIMIT_STORE: Map<string, { count: number; resetAt: number }> = new Map();
function checkRateLimit(key: string, limit = 10, windowMs = 60 * 1000) {
  const now = Date.now();
  const entry = RATE_LIMIT_STORE.get(key);
  if (!entry || entry.resetAt < now) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  RATE_LIMIT_STORE.set(key, entry);
  return { ok: true };
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function signJwt(payload: Record<string, unknown>, expiresInSeconds = SESSION_MAX_AGE_SECONDS) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = base64UrlEncode(
    createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string) {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const expected = base64UrlEncode(
      createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest(),
    );
    if (!cryptoTimingSafeEqual(signature, expected)) return null;
    const payload = JSON.parse(base64UrlDecode(body)) as { exp?: number } & Record<string, unknown>;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cryptoTimingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return createHmac("sha256", JWT_SECRET).update(aBuf).digest("hex") === createHmac("sha256", JWT_SECRET).update(bBuf).digest("hex");
}

function parseCookies(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, cookiePart) => {
    const [name, ...rest] = cookiePart.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function createCookieHeader(name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearCookieHeader(name: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json;charset=utf-8",
      ...extraHeaders,
    },
  });
}

function getGoogleClientId() {
  return resolveEnvVar("VITE_GOOGLE_CLIENT_ID") ?? resolveEnvVar("GOOGLE_CLIENT_ID") ?? undefined;
}

function getGoogleClientSecret() {
  return resolveEnvVar("VITE_GOOGLE_CLIENT_SECRET") ?? resolveEnvVar("GOOGLE_CLIENT_SECRET") ?? undefined;
}

function getRequestOrigin(request: Request) {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const host = request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || request.headers.get("x-forwarded-protocol");
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim() : "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:8080";
}

function redirectResponse(location: string, status = 302, cookies: string[] = []) {
  const headers = new Headers({ location });
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status, headers });
}

async function createSession(userId: string) {
  const token = signJwt({ sub: userId });
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await pool.query(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), userId, token, expiresAt.toISOString()],
  );
  return token;
}

async function findUserByEmail(email: string) {
  const { rows } = await pool.query(
    "SELECT id, email, password_hash, name, avatar_url, role_institution, plan_type, extract(epoch from created_at)::int AS created_at FROM users WHERE email = $1",
    [email.toLowerCase()],
  );
  return rows[0] || null;
}

async function findUserById(id: string) {
  const { rows } = await pool.query(
    "SELECT id, email, name, avatar_url, role_institution, plan_type, extract(epoch from created_at)::int AS created_at FROM users WHERE id = $1",
    [id],
  );
  return rows[0] || null;
}

async function getCurrentUser(request: Request) {
  try {
    const p = getPool();
    if (!p) return null;

    const cookies = parseCookies(request);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    const payload = verifyJwt(token);
    if (!payload || typeof payload.sub !== "string") return null;

    const { rows } = await p.query(
      "SELECT token FROM sessions WHERE token = $1 AND expires_at > now()",
      [token],
    );
    if (rows.length === 0) return null;

    const user = await findUserById(payload.sub);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.name,
      roleInstitution: user.role_institution,
      avatarUrl: user.avatar_url || undefined,
      planType: user.plan_type,
      createdAt: Number(user.created_at),
    };
  } catch (err) {
    console.warn('getCurrentUser error', err);
    return null;
  }
}

async function destroySession(request: Request) {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];
  if (!token) return;
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
}

async function createUserProfile(options: {
  email: string;
  passwordHash: string | null;
  name: string;
  avatarUrl?: string | null;
  roleInstitution: string;
  planType?: string;
}) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO users (id, email, password_hash, name, avatar_url, role_institution, plan_type) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      id,
      options.email.toLowerCase(),
      options.passwordHash,
      options.name,
      options.avatarUrl,
      options.roleInstitution,
      options.planType ?? "FREE",
    ],
  );
  return id;
}

async function upsertOAuthAccount(userId: string, provider: string, providerAccountId: string, accessToken: string, refreshToken?: string) {
  await pool.query(
    `INSERT INTO accounts (id, user_id, provider, provider_account_id, access_token, refresh_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, provider_account_id)
     DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, user_id = EXCLUDED.user_id`,
    [randomUUID(), userId, provider, providerAccountId, accessToken, refreshToken ?? null],
  );
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  return response.json();
}

export async function handleAuthApiRequest(request: Request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown').toString();

    // ensure DB available before proceeding with endpoints that require it
    if (!DATABASE_URL) {
      // If client asks for current user, return no user instead of 500
      if (pathname === '/api/auth/user' && request.method === 'GET') {
        return jsonResponse({ user: null }, 200);
      }
      // allow /api/auth/google endpoints to still initiate if configured
      if (pathname.startsWith('/api/auth') && pathname !== '/api/auth/google' && pathname !== '/api/auth/google/callback') {
        return jsonResponse({ message: 'DATABASE_URL not configured on server' }, 500);
      }
    }

    // initialize tables when pool is available
    const p = getPool();
    if (p) {
      await ensureTables();
    }

    if (pathname === "/api/auth/user" && request.method === "GET") {
      try {
        const user = await getCurrentUser(request);
        if (!user) {
          return jsonResponse({ user: null }, 200);
        }
        return jsonResponse({ user });
      } catch (err) {
        console.warn('/api/auth/user handler error', err);
        return jsonResponse({ user: null }, 200);
      }
    }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    await destroySession(request);
    const headers = new Headers({});
    headers.append("Set-Cookie", clearCookieHeader(COOKIE_NAME));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json;charset=utf-8", "Set-Cookie": clearCookieHeader(COOKIE_NAME) } });
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    // Rate limit by IP for login attempts
    const rl = checkRateLimit(`login:${ip}`, 10, 60 * 1000);
    if (!rl.ok) return jsonResponse({ message: 'Trop de tentatives, réessayez plus tard.' }, 429);

    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").toString().trim();
    const password = (body.password || "").toString();

    if (!email || !password) {
      return jsonResponse({ message: "Email et mot de passe sont requis." }, 400);
    }

    const existing = await findUserByEmail(email);
    if (!existing) {
      return jsonResponse({ message: "Aucun compte trouvé." }, 401);
    }

    if (!existing.password_hash) {
      return jsonResponse({ message: "Merci de vous connecter avec Google." }, 401);
    }

    const valid = await bcrypt.compare(password, existing.password_hash);
    if (!valid) {
      return jsonResponse({ message: "Mot de passe incorrect." }, 401);
    }

    const token = await createSession(existing.id);
    const user = await findUserById(existing.id);
    if (!user) {
      return jsonResponse({ message: "Impossible de charger le profil." }, 500);
    }

    const headers = new Headers({});
    headers.append("Set-Cookie", createCookieHeader(COOKIE_NAME, token, SESSION_MAX_AGE_SECONDS));
    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          roleInstitution: user.role_institution,
          avatarUrl: user.avatar_url || undefined,
          planType: user.plan_type,
          createdAt: Number(user.created_at),
        },
        token,
      }),
      { status: 200, headers },
    );
  }

  if (pathname === "/api/auth/signup" && request.method === "POST") {
    // Rate limit signups to avoid abuse
    const rl = checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.ok) return jsonResponse({ message: 'Trop de tentatives, réessayez plus tard.' }, 429);

    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").toString().trim();
    const password = (body.password || "").toString();
    const fullName = (body.fullName || "").toString().trim();
    const roleInstitution = (body.roleInstitution || body.role || "Étudiant").toString().trim() || "Étudiant";

    if (!email || !password || !fullName) {
      return jsonResponse({ message: "Tous les champs obligatoires doivent être remplis." }, 400);
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return jsonResponse({ message: "Un compte existe déjà avec cet email." }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = await createUserProfile({
      email,
      passwordHash,
      name: fullName,
      avatarUrl: null,
      roleInstitution,
      planType: "FREE",
    });

    const token = await createSession(userId);
    const user = await findUserById(userId);
    if (!user) {
      return jsonResponse({ message: "Impossible de charger le profil." }, 500);
    }

    const headers = new Headers({});
    headers.append("Set-Cookie", createCookieHeader(COOKIE_NAME, token, SESSION_MAX_AGE_SECONDS));
    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          roleInstitution: user.role_institution,
          avatarUrl: user.avatar_url || undefined,
          planType: user.plan_type,
          createdAt: Number(user.created_at),
        },
        token,
      }),
      { status: 201, headers },
    );
  }

  if (pathname === "/api/auth/google" && request.method === "GET") {
    const googleClientId = getGoogleClientId();
    if (!googleClientId) {
      return jsonResponse({ configured: false, message: "Google OAuth non configuré" }, 400);
    }

    // Rate limit OAuth initiation per IP
    const rl = checkRateLimit(`oauth_init:${ip}`, 10, 60 * 60 * 1000);
    if (!rl.ok) return jsonResponse({ message: 'Trop de tentatives OAuth, réessayez plus tard.' }, 429);

    const state = randomUUID();
    const origin = getRequestOrigin(request);
    const redirectUri = `${origin}/api/auth/google/callback`;

    // Build the official Google OAuth2 authorization URL and redirect with 302
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
      access_type: "offline",
      state,
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const headers = new Headers();
    headers.append("Set-Cookie", createCookieHeader(STATE_COOKIE_NAME, state, 600));
    headers.append("Location", googleAuthUrl);
    return new Response(null, { status: 302, headers });
  }

  if (pathname === "/api/auth/google/callback" && request.method === "GET") {
    const googleClientId = getGoogleClientId();
    const googleClientSecret = getGoogleClientSecret();
    if (!googleClientId || !googleClientSecret) {
      return jsonResponse({ configured: false, message: "Google OAuth non configuré" }, 400);
    }

    const cookies = parseCookies(request);
    const stateCookie = cookies[STATE_COOKIE_NAME];
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";

    // Basic CSRF/state validation: ensure state matches cookie and has reasonable length
    if (!code || !state || state !== stateCookie || typeof state !== 'string' || state.length < 8) {
      return jsonResponse({ message: "Échec de la validation Google OAuth." }, 400);
    }

    const redirectUri = `${getRequestOrigin(request)}/api/auth/google/callback`;
    const tokenResponse = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const accessToken = tokenResponse.access_token?.toString();
    if (!accessToken) {
      return jsonResponse({ message: "Impossible de récupérer le token Google." }, 500);
    }

    const profileResponse = await fetchJson("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const email = profileResponse.email?.toString();
    const name = profileResponse.name?.toString() || "Utilisateur Google";
    const avatarUrl = profileResponse.picture?.toString() || null;
    const providerAccountId = profileResponse.sub?.toString() || "";

    if (!email || !providerAccountId) {
      return jsonResponse({ message: "Impossible de récupérer les informations de profil Google." }, 500);
    }

    let user = await findUserByEmail(email);
    let userId: string;
    if (user) {
      userId = user.id;
      await pool.query(
        "UPDATE users SET name = $1, avatar_url = $2 WHERE id = $3",
        [name, avatarUrl, userId],
      );
    } else {
      userId = await createUserProfile({
        email,
        passwordHash: null,
        name,
        avatarUrl,
        roleInstitution: "Étudiant",
        planType: "FREE",
      });
    }

    await upsertOAuthAccount(userId, "google", providerAccountId, accessToken, tokenResponse.refresh_token?.toString() ?? null);
    const token = await createSession(userId);

    const headers = new Headers();
    const redirectTarget = new URL(request.url).origin;
    headers.append("Set-Cookie", createCookieHeader(COOKIE_NAME, token, SESSION_MAX_AGE_SECONDS));
    headers.append("Set-Cookie", clearCookieHeader(STATE_COOKIE_NAME));
    headers.append("Location", redirectTarget);
    return new Response(null, { status: 302, headers });
  }

    return jsonResponse({ message: "Point d'API introuvable." }, 404);
  } catch (err: any) {
    console.error('auth handler error', err);
    const message = err && err.message ? err.message : 'Internal server error';
    return jsonResponse({ message }, 500);
  }
}
