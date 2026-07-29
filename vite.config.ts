// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from 'path';
import { pathToFileURL } from 'url';
import fs from 'fs';
import esbuild from 'esbuild';

// Dev-only: intercept /api/* requests and forward them to our server-side handlers
function apiMiddlewarePlugin() {
  return {
    name: 'oligens-api-middleware',
    async configureServer(server: any) {
      const root = server.config.root || process.cwd();
      const authPath = path.resolve(root, 'src/server/auth');
      let authModule: any;
      try {
        // Use esbuild to compile the TS auth module to an ESM .mjs in .temp,
        // then import that file. This avoids requiring ts-node in dev.
        const tempDir = path.resolve(process.cwd(), '.temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const outFile = path.join(tempDir, 'auth.dev.mjs');
        try {
          esbuild.buildSync({
            entryPoints: [path.resolve(process.cwd(), 'src/server/auth.ts')],
            bundle: false,
            platform: 'node',
            format: 'esm',
            outfile: outFile,
            sourcemap: 'inline',
            external: ['dotenv', 'pg', 'bcryptjs', 'crypto', 'path', 'fs'],
          });
          authModule = await import(pathToFileURL(outFile).href + `?t=${Date.now()}`);
        } catch (esErr) {
          console.warn('esbuild compile failed for auth handler', esErr);
        }
      } catch (err) {
        console.warn('Could not import auth handler for dev middleware', err);
      }

      const handler = authModule?.handleAuthApiRequest;
      if (!handler) return;

      server.middlewares.use(async (req: any, res: any, next: any) => {
        try {
          if (!req.url || !req.url.startsWith('/api/')) return next();

          // build a Fetch Request from the incoming Node request
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const body = chunks.length ? Buffer.concat(chunks) : undefined;

          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers || {})) {
            if (Array.isArray(value)) {
              value.forEach((v) => headers.append(name, v as string));
            } else if (value != null) {
              headers.set(name, value as string);
            }
          }

          const port = server.config.server.port || 5173;
          const url = `http://localhost:${port}${req.url}`;
          const request = new Request(url, {
            method: req.method,
            headers,
            body,
          });

          const response: Response = await handler(request);

          // copy status and headers
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            // preserve multiple Set-Cookie headers
            if (key.toLowerCase() === 'set-cookie') {
              // node's setHeader accepts array for multiple cookies
              const prev = res.getHeader('set-cookie');
              if (!prev) res.setHeader('set-cookie', value);
              else if (Array.isArray(prev)) res.setHeader('set-cookie', [...prev, value]);
              else res.setHeader('set-cookie', [prev as string, value]);
            } else {
              res.setHeader(key, value);
            }
          });

          const buf = Buffer.from(await response.arrayBuffer());
          res.setHeader('Content-Length', String(buf.length));
          res.end(buf);
        } catch (err) {
          console.error('api middleware error', err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ message: 'Dev API middleware error' }));
        }
      });
    },
  };
}

export default defineConfig({
  // Do not force a server entry — prefer SPA/static serving for dev/build.
  tanstackStart: {},
  vite: {
    plugins: [apiMiddlewarePlugin()],
    define: {
      "process.env": {},
    },
    server: {
      port: 8080,
      strictPort: true,
      host: true,
      // loosen FS restrictions so Vite can serve files referenced via absolute paths
      fs: {
        allow: [
          process.cwd(),
          path.resolve(process.cwd(), '..'),
          path.resolve(process.cwd(), '..', '..'),
        ],
      },
      hmr: {
        protocol: 'ws',
        host: 'localhost',
      },
    },
    build: {
      target: "es2022",
      outDir: "dist",
    },
  },
});
