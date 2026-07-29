import * as React from "react";
import { useState, useEffect } from "react";
import { db, type UserProfile } from "../utils/dbStorage";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onUserUpdated?: (profile: UserProfile | null) => void;
  initialTab?: "login" | "signup";
}

const getInitials = (name: string, email?: string) => {
  if (name) return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
};

const buildAvatarUrl = (fullName: string) => {
  const initials = encodeURIComponent(getInitials(fullName));
  return `https://ui-avatars.com/api/?name=${initials}&background=0D111A&color=E0F2FE&size=128`;
};

export default function ProfileModal({ open, onClose, onUserUpdated, initialTab }: ProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab ?? "login");

    let mounted = true;

    (async () => {
      try {
        // Prefer server-side session
        if (typeof window !== "undefined") {
          const res = await fetch('/api/auth/user', { method: 'GET', credentials: 'same-origin' });
          if (res.ok) {
            const payload = await res.json();
            const stored = payload.user as any;
            if (mounted && stored) {
              const mapped: UserProfile = {
                userId: stored.id,
                email: stored.email,
                fullName: stored.fullName,
                role: stored.roleInstitution || stored.role || "",
                avatarUrl: stored.avatarUrl,
                preferredRegister: { tone: "professionnel", preserveFacts: true } as any,
                passwordHash: "",
                createdAt: stored.createdAt || Date.now(),
              };
              setProfile(mapped);
              setEmail(mapped.email ?? "");
              setFullName(mapped.fullName ?? "");
              setRole(mapped.role ?? "");
              return;
            }
          }
        }

        // Fallback to local DB if no server session
        const users = await db.users.toArray();
        if (!mounted) return;
        if (users.length > 0) {
          setProfile(users[0]);
          setEmail(users[0].email ?? "");
          setFullName(users[0].fullName || "");
          setRole(users[0].role || "");
        }
      } catch (err) {
        console.warn('Impossible de charger le profil utilisateur', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, initialTab]);

  const persistUser = async (user: UserProfile) => {
    const filledUser = {
      ...user,
      avatarUrl: user.avatarUrl ?? buildAvatarUrl(user.fullName || user.email || "Utilisateur"),
    };
    await db.users.put(filledUser);
    window.localStorage.setItem("oligens_current_user", JSON.stringify(filledUser));
    setProfile(filledUser);
    onUserUpdated?.(filledUser);
    return filledUser;
  };

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Veuillez renseigner un email et un mot de passe.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.message || 'Erreur de connexion');
        setIsSaving(false);
        return;
      }
      const u = payload.user;
      const mapped: UserProfile = {
        userId: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.roleInstitution || u.role || "",
        avatarUrl: u.avatarUrl,
        preferredRegister: { tone: "professionnel", preserveFacts: true } as any,
        passwordHash: "",
        createdAt: u.createdAt || Date.now(),
      };
      await persistUser(mapped);
      setIsSaving(false);
      onClose();
    } catch (err) {
      setError('Erreur réseau');
      setIsSaving(false);
    }
  };

  const handleSignup = async () => {
    setError(null);
    if (!email || !password || !fullName || !role) {
      setError("Complétez tous les champs pour créer un compte.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, fullName, roleInstitution: role }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.message || 'Erreur création compte');
        setIsSaving(false);
        return;
      }
      const u = payload.user;
      const mapped: UserProfile = {
        userId: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.roleInstitution || u.role || "",
        avatarUrl: u.avatarUrl,
        preferredRegister: { tone: "professionnel", preserveFacts: true } as any,
        passwordHash: "",
        createdAt: u.createdAt || Date.now(),
      };
      await persistUser(mapped);
      setIsSaving(false);
      onClose();
    } catch (err) {
      setError('Erreur réseau');
      setIsSaving(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError(null);
    window.location.href = '/api/auth/google';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[32px] border border-cyan-400/20 bg-[#0D111A]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[#070A11]/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Connexion utilisateur</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Profil et accès sécurisé</h2>
              <p className="mt-2 text-sm text-white/70">Connectez-vous, créez un compte ou utilisez Google pour accéder à Oligens Detector.</p>
            </div>
            <button onClick={onClose} className="text-white/60 transition hover:text-white">✕</button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex overflow-hidden rounded-full border border-cyan-500/20 bg-white/5 text-[0.7rem] uppercase tracking-[0.35em] text-white/70 shadow-sm">
              {(["login", "signup"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`min-w-[150px] px-4 py-2 text-left transition ${activeTab === tab ? "bg-cyan-400/15 text-white" : "text-white/60 hover:bg-white/5"}`}
                >
                  {tab === "login" ? "Se Connecter" : "Créer un Compte"}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="rounded-full border border-cyan-500/30 bg-cyan-400/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-cyan-100 hover:bg-cyan-400/10"
              onClick={handleGoogleSignIn}
              disabled={isSaving}
            >
              Continuer avec Google
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {error ? <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div> : null}

          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-[#05070B]/80 p-5">
            <div className="grid gap-3">
              <label className="text-sm font-semibold tracking-[0.03em] text-cyan-100">Adresse email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                className="bg-[#05070B] border border-white/10 text-white placeholder:text-white/40"
                placeholder="exemple@oligens.com"
              />
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-semibold tracking-[0.03em] text-cyan-100">Mot de passe</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="bg-[#05070B] border border-white/10 text-white placeholder:text-white/40"
                placeholder="********"
              />
            </div>

            {activeTab === "signup" ? (
              <>
                <div className="grid gap-3">
                  <label className="text-sm font-semibold tracking-[0.03em] text-cyan-100">Nom complet</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName((e.target as HTMLInputElement).value)}
                    className="bg-[#05070B] border border-white/10 text-white placeholder:text-white/40"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="grid gap-3">
                  <label className="text-sm font-semibold tracking-[0.03em] text-cyan-100">Rôle / Institution</label>
                  <Input
                    value={role}
                    onChange={(e) => setRole((e.target as HTMLInputElement).value)}
                    className="bg-[#05070B] border border-white/10 text-white placeholder:text-white/40"
                    placeholder="Chercheur, Juriste, Étudiant..."
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              {profile?.email ? `Connecté : ${profile.email}` : "Aucun compte actif"}
            </div>
            <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/80 hover:border-cyan-500/40 hover:text-cyan-100"
                  onClick={onClose}
                >
                  Fermer
                </Button>
                {profile ? (
                  <Button
                    variant="ghost"
                    className="rounded-full border border-rose-400/30 bg-rose-500/5 px-5 py-2 text-sm text-white/80 hover:border-rose-400/50 hover:text-rose-200"
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                      } catch (err) {
                        console.warn('Logout failed', err);
                      }
                      await db.users.clear();
                      window.localStorage.removeItem('oligens_current_user');
                      setProfile(null);
                      onUserUpdated?.(null as any);
                      onClose();
                    }}
                  >
                    Déconnexion
                  </Button>
                ) : null}
                <Button
                  className="rounded-full bg-cyan-400/10 text-cyan-100 shadow-lg shadow-cyan-500/10 hover:bg-cyan-400/20"
                  onClick={activeTab === "login" ? handleLogin : handleSignup}
                  disabled={isSaving}
                >
                  {activeTab === "login" ? "Connexion" : "Créer un compte"}
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
