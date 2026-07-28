import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(0,240,255,0.12),transparent_26%)]" />
      <div className="relative mx-auto max-w-5xl px-5 py-10">
        <div className="glass-panel rounded-[32px] border-white/10 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Offres et abonnements</h1>
            <p className="mt-3 text-sm text-white/70">Choisissez le plan qui correspond le mieux à vos besoins de détection et d'export.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-[#04060A]/90 p-5">
              <h2 className="text-xl font-semibold text-white">Freemium</h2>
              <p className="mt-3 text-sm text-white/70">Analyse locale jusqu'à 2 000 mots, export PDF standard et crédits limités.</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-[#04060A]/90 p-5">
              <h2 className="text-xl font-semibold text-white">Pro</h2>
              <p className="mt-3 text-sm text-white/70">Accès prioritaire, rapports détaillés, et intégrations avec dossiers locaux.</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-[#04060A]/90 p-5">
              <h2 className="text-xl font-semibold text-white">Entreprise</h2>
              <p className="mt-3 text-sm text-white/70">Support dédié, audit avancé et règles de conformité personnalisées.</p>
            </div>
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
