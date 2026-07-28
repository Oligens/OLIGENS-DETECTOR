import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(255,184,0,0.14),transparent_26%)]" />
      <div className="relative mx-auto max-w-5xl px-5 py-10">
        <div className="glass-panel rounded-[32px] border-white/10 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Historique des analyses</h1>
            <p className="mt-3 text-sm text-white/70">Consultez vos analyses précédentes et retrouvez votre activité récente.</p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#04060A]/90 p-5 text-sm text-white/80">
            <p className="text-white/70">Aucune donnée historique à afficher pour le moment.</p>
            <p className="mt-3 text-white/70">Commencez une nouvelle analyse depuis la page d'accueil pour enregistrer vos résultats.</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:border-cyan-400/50 hover:text-cyan-200"
            >
              Retour à l'analyse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
