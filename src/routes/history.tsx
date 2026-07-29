import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadHistory, type HistoryRecord } from "@/utils/historyStorage";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    void (async () => {
      const records = await loadHistory();
      setHistory(records);
    })();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(255,184,0,0.14),transparent_26%)]" />
      <div className="relative mx-auto max-w-5xl px-5 py-10">
        <div className="glass-panel rounded-[32px] border-white/10 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Historique des analyses</h1>
            <p className="mt-3 text-sm text-white/70">Consultez vos analyses précédentes et retrouvez votre activité récente.</p>
          </div>

          {history.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#04060A]/90 p-5 text-sm text-white/80">
              <p className="text-white/70">Aucune donnée historique à afficher pour le moment.</p>
              <p className="mt-3 text-white/70">Commencez une nouvelle analyse depuis la page d'accueil pour enregistrer vos résultats.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div key={record.id} className="rounded-[28px] border border-white/10 bg-[#04060A]/90 p-5 text-sm text-white/80">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.35em] text-white/50">{record.type}</div>
                      <div className="mt-2 text-lg font-semibold text-white">{record.documentTitle}</div>
                    </div>
                    <div className="text-right text-xs text-white/60">{new Date(record.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-3 text-[11px] uppercase tracking-[0.35em] text-white/80">
                      Score initial
                      <div className="mt-2 text-xl font-semibold text-white">{Math.round(record.initialScore * 100)}%</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-3 text-[11px] uppercase tracking-[0.35em] text-white/80">
                      Score final
                      <div className="mt-2 text-xl font-semibold text-white">{record.finalScore ? `${Math.round(record.finalScore * 100)}%` : "-"}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-3 text-[11px] uppercase tracking-[0.35em] text-white/80">
                      Plagiat
                      <div className="mt-2 text-xl font-semibold text-[color:var(--oligens-gold)]">{record.plagiarismScore ? `${Math.round(record.plagiarismScore * 100)}%` : "-"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
