import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import { MatrixRain } from "@/components/MatrixRain";
import { CircularGauge } from "@/components/CircularGauge";
import { MetricBar } from "@/components/MetricBar";
import { SoundWave } from "@/components/SoundWave";
import {
  chunkText,
  cosineSimilarity,
  detect,
  type DetectionMetrics,
  type HumanizeResult,
} from "@/lib/detector";
import { TextHumanizer, type HumanizerRapport } from "@/utils/TextHumanizer";
import { detectLanguage, languageLabel, type SupportedLang } from "@/utils/languageDetect";
import {
  clearHistory,
  loadHistory,
  saveRecord,
  deleteRecord,
  type HistoryRecord,
} from "@/utils/historyStorage";
import logoAsset from "@/assets/oligens-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oligens Detector — Quantum AI Text Analysis" },
      {
        name: "description",
        content:
          "Detect AI-generated text with perplexity, burstiness and n-gram analysis, then humanize it while preserving semantic meaning.",
      },
      { property: "og:title", content: "Oligens Detector — Quantum AI Text Analysis" },
      {
        property: "og:description",
        content:
          "Detect AI-generated text with perplexity, burstiness and n-gram analysis, then humanize it while preserving semantic meaning.",
      },
    ],
  }),
  component: OligensPage,
});

const SAMPLE = `In conclusion, artificial intelligence is transforming the modern landscape of technology. Furthermore, it is important to note that machine learning models have demonstrated significant capabilities. Moreover, these systems leverage vast datasets to deliver a plethora of insights. Additionally, they utilize sophisticated algorithms to navigate the complex realm of natural language processing. Consequently, organizations are increasingly adopting these technologies. Therefore, understanding their underlying mechanisms becomes essential.`;

function OligensPage() {
  const [text, setText] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<DetectionMetrics | null>(null);
  const [humanized, setHumanized] = useState<HumanizeResult | null>(null);
  const [humanizing, setHumanizing] = useState(false);
  const [rapport, setRapport] = useState<HumanizerRapport | null>(null);
  const [ollamaBusy, setOllamaBusy] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [cpu, setCpu] = useState(23);
  const [ram, setRam] = useState(41);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tab, setTab] = useState<"original" | "humanized">("original");

  // Simulated system telemetry
  useEffect(() => {
    const id = setInterval(() => {
      setCpu((c) =>
        Math.max(8, Math.min(94, c + (Math.random() - 0.5) * 14)),
      );
      setRam((r) =>
        Math.max(18, Math.min(88, r + (Math.random() - 0.5) * 8)),
      );
    }, 900);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const lines = text.split(/\n/).length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    return { lines, words, chars };
  }, [text]);

  const runAnalysis = useCallback(async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    setHumanized(null);
    setMetrics(null);
    setProgress(0);
    const chunks = chunkText(text, 4000);
    // Aggregate incrementally
    let acc = "";
    for (let i = 0; i < chunks.length; i++) {
      acc += (acc ? " " : "") + chunks[i];
      await new Promise((r) => setTimeout(r, 260));
      setProgress(((i + 1) / chunks.length) * 100);
    }
    const m = detect(acc);
    setMetrics(m);
    setAnalyzing(false);
  }, [text]);

  const runHumanize = useCallback(async () => {
    if (!text.trim()) return;
    setHumanizing(true);
    setOllamaError(null);
    await new Promise((r) => setTimeout(r, 300));
    const before = detect(text);
    const humanizer = new TextHumanizer();
    const { texteFinal, rapport: rap } = humanizer.humanize(text, {
      seuilCible: 0.35,
      iterationsMax: 6,
      intensite: 0.7,
    });
    const after = detect(texteFinal);
    const similarity = cosineSimilarity(text, texteFinal);
    setHumanized({ text: texteFinal, similarity, before, after });
    setRapport(rap);
    setMetrics(after);
    setTab("humanized");
    setHumanizing(false);
  }, [text]);

  const runOllama = useCallback(async () => {
    if (!text.trim()) return;
    setOllamaBusy(true);
    setOllamaError(null);
    try {
      const prompt = `Rewrite the following text to sound naturally human-written. Preserve meaning, structure and language. Vary sentence length, use contractions and casual transitions, avoid AI clichés ("in conclusion", "furthermore", "delve into", "tapestry", "landscape of"). Return ONLY the rewritten text.\n\nTEXT:\n${text}`;
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama3.2:3b", prompt, stream: false }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = (await res.json()) as { response?: string };
      const rewritten = (data.response || "").trim();
      if (!rewritten) throw new Error("Empty response from Ollama");
      const before = detect(text);
      const after = detect(rewritten);
      const similarity = cosineSimilarity(text, rewritten);
      setHumanized({ text: rewritten, similarity, before, after });
      setRapport({
        proba_initiale: before.aiScore,
        proba_finale: after.aiScore,
        reduction_pourcent: (before.aiScore - after.aiScore) * 100,
        iterations_realisees: 1,
        historique: [],
        features_finales: [],
        decision:
          after.aiScore < 0.35
            ? "✅ Ollama rewrite — human-style"
            : "⚠️ Ollama rewrite — threshold not reached",
      });
      setMetrics(after);
      setTab("humanized");
    } catch (e) {
      setOllamaError(
        e instanceof Error
          ? `${e.message} — is Ollama running on localhost:11434 with llama3.2:3b?`
          : "Ollama call failed",
      );
    } finally {
      setOllamaBusy(false);
    }
  }, [text]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".docx")) {
      const buf = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
      setText(value);
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      setText(await file.text());
    } else {
      // Best-effort text read
      setText(await file.text());
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      <MatrixRain />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,rgba(212,175,55,0.15),transparent_60%),radial-gradient(circle_at_80%_100%,rgba(120,200,220,0.08),transparent_60%)]" />

      {/* Top bar */}
      <header className="glass-panel sticky top-3 z-30 mx-3 mt-3 flex items-center justify-between rounded-2xl px-4 py-3 md:mx-6 md:px-6">
        <div className="flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="Oligens"
            className="h-10 w-10 drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]"
          />
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-[0.3em] text-white md:text-xl">
              OLIGENS
              <span className="ml-2 text-[color:var(--oligens-gold)]">
                DETECTOR
              </span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
              Quantum Text Intelligence · v1.0
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-5 font-mono text-[11px] uppercase tracking-widest text-white/70 md:flex">
          <Telemetry label="CPU" value={cpu} />
          <Telemetry label="RAM" value={ram} />
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>System · ONLINE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-24 pt-6 md:px-6">
        {/* Hero */}
        <section className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-5xl">
            Detect the machine.{" "}
            <span className="oligens-gold-text">Restore the human.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/60 md:text-base">
            Real-time mathematical analysis — perplexity, burstiness and
            n-gram density — followed by semantic-preserving humanization.
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Card 1 — Input */}
          <div className="glass-panel rounded-2xl p-5 md:p-6">
            <SectionHeader
              index="01"
              title="Signal Input"
              hint="Paste text or drop a .docx"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`group mb-4 flex cursor-pointer items-center justify-between rounded-xl border border-dashed px-4 py-3 transition-all ${
                dragOver
                  ? "border-[color:var(--oligens-gold)] bg-[rgba(255,215,0,0.06)]"
                  : "border-white/15 hover:border-[color:var(--oligens-gold)]/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-[color:var(--oligens-gold)]">
                  <UploadIcon />
                </div>
                <div className="text-sm">
                  <div className="font-mono uppercase tracking-widest text-white/80">
                    {fileName ?? "Drop .docx / .txt"}
                  </div>
                  <div className="text-[11px] text-white/40">
                    or click to browse — parsed locally, never uploaded
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--oligens-gold)] opacity-80 group-hover:opacity-100">
                Ingest ↴
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>

            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="// Paste any text here to scan for AI signatures…"
                className="min-h-[280px] w-full resize-y rounded-xl border border-white/10 bg-black/40 p-4 pr-16 font-mono text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/25 focus:border-[color:var(--oligens-gold)]/60 focus:shadow-[0_0_0_1px_rgba(255,215,0,0.4),0_0_20px_rgba(255,215,0,0.15)]"
                spellCheck={false}
              />
              <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-0.5 font-mono text-[10px] uppercase tracking-widest text-white/40">
                <span>{stats.words} words</span>
                <span>{stats.chars} chars</span>
                <span>{stats.lines} lines</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={runAnalysis}
                disabled={analyzing || !text.trim()}
                className="oligens-btn-primary"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <BoltIcon />
                  {analyzing ? "SCANNING…" : "RUN QUANTUM ANALYSIS"}
                </span>
              </button>
              <button
                onClick={() => {
                  setText(SAMPLE);
                  setFileName(null);
                }}
                className="oligens-btn-ghost"
              >
                Load AI Sample
              </button>
              <button
                onClick={() => {
                  setText("");
                  setMetrics(null);
                  setHumanized(null);
                  setRapport(null);
                  setOllamaError(null);
                  setFileName(null);
                }}
                className="oligens-btn-ghost"
              >
                Clear
              </button>
              <div className="ml-auto">
                <SoundWave active={analyzing || humanizing} />
              </div>
            </div>

            {analyzing && (
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--oligens-gold)] to-amber-200 transition-all"
                  style={{
                    width: `${progress}%`,
                    boxShadow: "0 0 12px rgba(255,215,0,0.6)",
                  }}
                />
              </div>
            )}
          </div>

          {/* Card 2 — Results */}
          <div className="glass-panel rounded-2xl p-5 md:p-6">
            <SectionHeader
              index="02"
              title="Detection Metrics"
              hint={metrics ? "Live analysis complete" : "Awaiting signal…"}
            />

            {!metrics ? (
              <EmptyState />
            ) : (
              <>
                <div className="mb-6 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-8">
                  <CircularGauge
                    value={metrics.aiScore}
                    label="AI Probability"
                    sublabel={verdict(metrics.aiScore)}
                    size={210}
                  />
                  <div className="flex-1 space-y-4">
                    <MetricBar
                      label="Perplexity (Entropy)"
                      value={metrics.perplexityNorm}
                      raw={metrics.perplexity.toFixed(2) + " bits"}
                      inverted
                    />
                    <MetricBar
                      label="Burstiness (Variance)"
                      value={metrics.burstinessNorm}
                      raw={metrics.burstiness.toFixed(1)}
                      inverted
                    />
                    <MetricBar
                      label="N-Gram AI Density"
                      value={metrics.ngramDensity}
                      raw={`${metrics.ngramHits} markers`}
                    />
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px] uppercase tracking-widest text-white/50">
                      <Stat label="Sentences" value={metrics.sentenceCount} />
                      <Stat label="Words" value={metrics.wordCount} />
                      <Stat
                        label="Avg Len"
                        value={metrics.avgSentenceLength.toFixed(1)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-white/70">
                  <span className="text-[color:var(--oligens-gold)]">
                    S_IA(T) ={" "}
                  </span>
                  σ( 0.5·(1 − P/P_max) + 0.3·(1 − Var/Var_max) + 0.2·(K/N) ) ={" "}
                  <span className="text-white">
                    {(metrics.aiScore * 100).toFixed(2)}%
                  </span>
                </div>

                <button
                  onClick={runHumanize}
                  disabled={humanizing}
                  className="oligens-btn-primary w-full"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <SparkIcon />
                    {humanizing
                      ? "HUMANIZING…"
                      : "HUMANIZE TEXT (OPTIMIZATION)"}
                  </span>
                </button>
                <button
                  onClick={runOllama}
                  disabled={ollamaBusy || !text.trim()}
                  className="oligens-btn-ghost mt-2 w-full"
                  title="Requires Ollama running locally with llama3.2:3b"
                >
                  {ollamaBusy
                    ? "CALLING OLLAMA…"
                    : "FALLBACK · LOCAL OLLAMA (llama3.2:3b)"}
                </button>
                {ollamaError && (
                  <div className="mt-2 rounded-md border border-red-400/30 bg-red-500/5 p-2 font-mono text-[10px] uppercase tracking-widest text-red-300">
                    {ollamaError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {rapport && (
          <section className="glass-panel mt-6 rounded-2xl p-5 md:p-6">
            <SectionHeader
              index="R"
              title="Humanizer Report"
              hint={rapport.decision}
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <RapportStat
                label="Initial AI"
                value={`${(rapport.proba_initiale * 100).toFixed(1)}%`}
              />
              <RapportStat
                label="Final AI"
                value={`${(rapport.proba_finale * 100).toFixed(1)}%`}
                gold
              />
              <RapportStat
                label="Reduction"
                value={`${rapport.reduction_pourcent.toFixed(1)}%`}
              />
              <RapportStat
                label="Iterations"
                value={String(rapport.iterations_realisees)}
              />
              <RapportStat
                label="Status"
                value={
                  rapport.proba_finale < 0.35 ? "NEUTRALIZED" : "PARTIAL"
                }
              />
            </div>
            {rapport.historique.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[10px] uppercase tracking-widest text-white/60">
                <div className="mb-2 text-[color:var(--oligens-gold)]">
                  Iteration Trace
                </div>
                <ul className="space-y-1">
                  {rapport.historique.map((h) => (
                    <li key={h.iteration} className="flex justify-between">
                      <span>#{h.iteration}</span>
                      <span className="text-white/80">
                        AI · {(h.proba * 100).toFixed(1)}%
                      </span>
                      <span className="text-white/40">
                        {h.anomalies.map((a) => a.nom).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Bottom panel — humanized output */}
        {humanized && (
          <section className="glass-panel mt-6 rounded-2xl p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                index="03"
                title="Humanization Output"
                hint="Semantic-preserving rewrite"
              />
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-emerald-300">
                  Cosine Similarity ·{" "}
                  <span className="text-emerald-200">
                    {(humanized.similarity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="rounded-lg border border-[color:var(--oligens-gold)]/40 bg-[rgba(255,215,0,0.05)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[color:var(--oligens-gold)]">
                  AI Score{" "}
                  <span className="text-white/80 line-through">
                    {(humanized.before.aiScore * 100).toFixed(1)}%
                  </span>{" "}
                  →{" "}
                  <span className="text-white">
                    {(humanized.after.aiScore * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-3 flex gap-2 font-mono text-[11px] uppercase tracking-widest">
              <TabBtn
                active={tab === "original"}
                onClick={() => setTab("original")}
              >
                Original
              </TabBtn>
              <TabBtn
                active={tab === "humanized"}
                onClick={() => setTab("humanized")}
              >
                Humanized
              </TabBtn>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ComparePane title="Input" text={text} highlight={tab === "original"} />
              <ComparePane
                title="Optimized Output"
                text={humanized.text}
                highlight={tab === "humanized"}
                gold
                actions={
                  <button
                    onClick={() => navigator.clipboard.writeText(humanized.text)}
                    className="oligens-btn-ghost !py-1 !px-3 text-[10px]"
                  >
                    Copy
                  </button>
                }
              />
            </div>
          </section>
        )}

        <footer className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-white/30">
          Oligens Detector · All computation runs locally in-browser · Zero telemetry
        </footer>
      </main>
    </div>
  );
}

function verdict(aiScore: number): string {
  if (aiScore > 0.85) return "Almost certainly AI";
  if (aiScore > 0.65) return "Likely AI-generated";
  if (aiScore > 0.4) return "Mixed / uncertain";
  if (aiScore > 0.2) return "Likely human";
  return "Very human";
}

function RapportStat({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        gold
          ? "border-[color:var(--oligens-gold)]/50 bg-[rgba(255,215,0,0.06)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-xl font-semibold ${
          gold ? "text-[color:var(--oligens-gold)]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  index,
  title,
  hint,
}: {
  index: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-[color:var(--oligens-gold)]">
          / {index}
        </div>
        <h2 className="mt-0.5 font-display text-xl font-semibold tracking-wide text-white">
          {title}
        </h2>
      </div>
      {hint && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          {hint}
        </span>
      )}
    </div>
  );
}

function Telemetry({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/50">{label}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[color:var(--oligens-gold)] to-amber-200"
          style={{
            width: `${value}%`,
            boxShadow: "0 0 6px rgba(255,215,0,0.5)",
          }}
        />
      </div>
      <span className="w-8 tabular-nums text-white/80">{value.toFixed(0)}%</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
      <div className="text-white/40">{label}</div>
      <div className="mt-0.5 text-sm text-white/90">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-white/10 bg-black/20 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-[color:var(--oligens-gold)]/40 text-[color:var(--oligens-gold)]">
          <ScanIcon />
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/60">
          No signal detected
        </div>
        <div className="mt-1 text-xs text-white/40">
          Provide text and run Quantum Analysis
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 transition-all ${
        active
          ? "border-[color:var(--oligens-gold)] bg-[rgba(255,215,0,0.08)] text-[color:var(--oligens-gold)]"
          : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function ComparePane({
  title,
  text,
  highlight,
  gold,
  actions,
}: {
  title: string;
  text: string;
  highlight?: boolean;
  gold?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 transition-all ${
        highlight
          ? gold
            ? "border-[color:var(--oligens-gold)]/60 bg-[rgba(255,215,0,0.04)] shadow-[0_0_25px_rgba(255,215,0,0.12)]"
            : "border-white/25 bg-white/[0.03]"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]">
        <span className={gold ? "text-[color:var(--oligens-gold)]" : "text-white/50"}>
          {title}
        </span>
        {actions}
      </div>
      <div className="max-h-[360px] overflow-auto whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-white/85">
        {text}
      </div>
    </div>
  );
}

/* ------- Icons ------- */
function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" />
    </svg>
  );
}
