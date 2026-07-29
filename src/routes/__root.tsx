import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import '../i18n';
import i18n from 'i18next';
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Oligens Detector — Quantum AI Text Analysis" },
      {
        name: "description",
        content:
          "Detect AI-generated text with perplexity, burstiness and n-gram analysis, then humanize it while preserving semantic meaning.",
      },
      { name: "author", content: "Oligens" },
      { property: "og:title", content: "Oligens Detector — Quantum AI Text Analysis" },
      {
        property: "og:description",
        content:
          "Detect AI-generated text with perplexity, burstiness and n-gram analysis, then humanize it while preserving semantic meaning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Oligens Detector — Quantum AI Text Analysis" },
      { name: "twitter:description", content: "Detect AI-generated text with perplexity, burstiness and n-gram analysis, then humanize it while preserving semantic meaning." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/87dd7a3a-dac1-424e-a361-1203c4a8cc88" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/87dd7a3a-dac1-424e-a361-1203c4a8cc88" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // set initial html lang/dir based on i18n
  const lang = i18n.language || 'fr';
  const dir = i18n.dir ? i18n.dir(lang) : 'ltr';
  return (
    <html lang={lang} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Print the developer signature in console (for audit) — obfuscated lightly
  useEffect(() => {
    try {
      const sig = `\/***************************************************\\\n/*                                                     */\n/* JJJJJJJ    OOOOOOO    CCCCCC                   */\n/* J      O       O  C      C                  */\n/* J      O       O  C                         */\n/* J      O       O  C                         */\n/* J  J      O       O  C      C                  */\n/* JJ        OOOOOOO    CCCCCC                   */\n/*                                                     */\n/* OLIGENS . C.J            */\n\/***************************************************/`;
      console.log('\n%c' + sig, 'color:#0ff;font-weight:bold');
    } catch {}
  }, []);

  // Geo-IP language detection (only if user did not set a preference)
  useEffect(() => {
    try {
      const pref = typeof window !== 'undefined' ? localStorage.getItem('oligens_lang') : null;
      if (pref) return;

      fetch('https://ipapi.co/json/')
        .then((r) => r.json())
        .then((data: any) => {
          const cc = (data.country_code || '').toString().toUpperCase();
          const region = (data.region_code || data.region || '').toString().toUpperCase();
          let lang = '';
          if (cc === 'HT') lang = 'ht';
          else if (cc === 'CA' && region === 'QC') lang = 'fr';
          else if (['US', 'GB', 'AU'].includes(cc)) lang = 'en';
          else if (cc === 'FR') lang = 'fr';
          else if (cc === 'CN') lang = 'zh';
          else if (cc === 'JP') lang = 'ja';
          if (lang) {
            i18n.changeLanguage(lang);
            try {
              document.documentElement.lang = lang;
              document.documentElement.dir = i18n.dir(lang);
            } catch {}
          } else {
            const nav = (navigator.language || navigator.userLanguage || 'fr').split('-')[0];
            i18n.changeLanguage(nav);
          }
        })
        .catch(() => {
          const nav = (navigator.language || navigator.userLanguage || 'fr').split('-')[0];
          i18n.changeLanguage(nav);
        });
    } catch (err) {
      // ignore
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
