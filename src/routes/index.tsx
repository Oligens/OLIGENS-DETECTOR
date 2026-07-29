import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";

import { detect, splitSentences, type DetectionMetrics } from "@/lib/detector";
import { TextHumanizer, type HumanizerRapport, type Register } from "@/utils/TextHumanizer";
import { generateAuditReport } from "@/utils/pdfGenerator";
import { analyzeFactDensity } from "@/utils/factDensityAnalyzer";
import { extractTextFromFile, syncLocalDirectory } from "@/utils/localIndexer";
import { ActionButton } from "@/components/ActionButton";
import { SidebarButton } from "@/components/SidebarButton";
import { TabButton } from "@/components/TabButton";
import { BIStatusBlock } from "@/components/BIStatusBlock";
import { HeatmapText, type HeatmapSegment } from "@/components/HeatmapText";
import { MetricBar } from "@/components/MetricBar";
import { PrivacyInfoModal } from "@/components/PrivacyInfoModal";
import { HumanizationInfoModal } from "@/components/HumanizationInfoModal";
import ProfileModal from "@/components/ProfileModal";
import { LanguageSelector } from '@/components/LanguageSelector';
import { saveRecord } from "@/utils/historyStorage";
import { db, type UserProfile } from "@/utils/dbStorage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oligens Detector — Quantum AI Text Analysis" },
      {
        name: "description",
        content:
          "Detect AI-generated text with luxury sci-fi UI, heatmap overlay, perplexity and plagiarism metrics.",
      },
    ],
  }),
  component: OligensDetectorPage,
});

const HUMANIZATION_MODES = [
  { value: "academique", label: "Académique" },
  { value: "juridique", label: "Juridique" },
  { value: "professionnel", label: "Professionnel" },
  { value: "creatif", label: "Créatif" },
];

const PLAGIARISM_SOURCES = [
  {
    label: "quantum-linguistics.net",
    url: "https://quantum-linguistics.net/whitepaper/ai-syntax",
  },
  {
    label: "orbital-ethics.org",
    url: "https://orbital-ethics.org/reports/2025/similarity-analysis",
  },
  {
    label: "research.ai-systems",
    url: "https://research.ai-systems/privacy/traceability",
  },
];

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function OligensDetectorPage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("professionnel");
  const [analysisResult, setAnalysisResult] = useState<DetectionMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "heatmap">("editor");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [humanizeReport, setHumanizeReport] = useState<HumanizerRapport | null>(null);
  const [systemStatus, setSystemStatus] = useState("OPÉRATIONNEL");
  const [wordLimit] = useState(2000);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [humanizationOpen, setHumanizationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDefaultTab, setProfileDefaultTab] = useState<"login" | "signup">("login");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaInstallable, setIsPwaInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showPwaHelp, setShowPwaHelp] = useState(false);
  const [pwaHelpMessage, setPwaHelpMessage] = useState(
    "Pour installer l'application sur votre bureau, utilisez le menu 'Installer l'application' de votre navigateur.",
  );
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [localSyncMessage, setLocalSyncMessage] = useState("Aucun dossier local indexé.");
  const [connectedFolder, setConnectedFolder] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const humanizer = useMemo(() => new TextHumanizer(), []);

  const globalScore = analysisResult?.aiScore ?? 0;
  const burstiness = analysisResult?.burstinessNorm ?? 0;
  const perplexity = analysisResult?.perplexityNorm ?? 0;
  const plagiarismScore = analysisResult?.ngramDensity ?? 0;
  const signature = analysisResult?.llmSignature ?? "Aucune signature détectée";

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text.split(/\n/).length;
    return { words, chars, lines };
  }, [text]);

  const heatmapSegments = useMemo(() => {
    const sentences = splitSentences(text);

    return sentences.map((sentence, index): HeatmapSegment => {
      const sentenceMetrics = detect(sentence);
      const score = sentenceMetrics.aiScore;
      return {
        id: `${index}-${score.toFixed(2)}`,
        text: sentence,
        score,
        variant: score > 0.65 ? "ai" : score > 0.4 ? "mixed" : "human",
      };
    });
  }, [text]);

  const loadUserProfile = async () => {
    try {
      if (typeof window !== "undefined") {
        const res = await fetch('/api/auth/user', { method: 'GET', credentials: 'same-origin' });
        if (res.status === 401) {
          setUserProfile(null);
          return;
        }
        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          const user = payload?.user;
          if (user) {
            setUserProfile({
              userId: user.id,
              email: user.email,
              fullName: user.fullName,
              role: user.roleInstitution || user.role || "",
              avatarUrl: user.avatarUrl,
              preferredRegister: { tone: "professionnel", preserveFacts: true } as any,
              passwordHash: "",
              createdAt: user.createdAt || Date.now(),
            });
            return;
          }
          // explicit null user from server: treat as not authenticated
          if (payload && payload.user == null) {
            setUserProfile(null);
            return;
          }
        }
      }

      const storedSession = typeof window !== "undefined" ? window.localStorage.getItem("oligens_current_user") : null;
      if (storedSession) {
        setUserProfile(JSON.parse(storedSession));
        return;
      }

      const users = await db.users.toArray();
      if (users.length > 0) {
        setUserProfile(users[0]);
      }
    } catch (error) {
      console.warn("Impossible de charger le profil utilisateur", error);
    }
  };

  useEffect(() => {
    loadUserProfile();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsPwaInstallable(true);
    };

    const onAppInstalled = () => setIsAppInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (isAppInstalled) {
      setPwaHelpMessage("L'application est déjà installée.");
      setShowPwaHelp(true);
      return;
    }

    if (!deferredPrompt) {
      setPwaHelpMessage(
        "Pour installer l'application sur votre bureau, utilisez le menu 'Installer l'application' de votre navigateur.",
      );
      setShowPwaHelp(true);
      return;
    }

    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsAppInstalled(true);
      }
    } catch (error) {
      console.warn("Erreur lors de la demande d'installation PWA", error);
      setPwaHelpMessage(
        "L'installation native a échoué. Utilisez le menu 'Installer l'application' de votre navigateur.",
      );
      setShowPwaHelp(true);
    } finally {
      setDeferredPrompt(null);
      setIsPwaInstallable(false);
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const result = detect(text);
    setAnalysisResult(result);
    setHumanizeReport(null);
    setActiveTab("heatmap");
    const factDensity = analyzeFactDensity(text).factDensityIndex;

    await saveRecord({
      documentTitle: "Analyse de texte",
      originalText: text,
      language: "fr",
      type: "DETECTION",
      initialScore: result.aiScore,
      finalScore: result.aiScore,
      llmSignature: result.llmSignature,
      factDensityScore: factDensity,
      plagiarismScore: result.ngramDensity,
      metricsBreakdown: result,
    });

    setIsAnalyzing(false);
  };

  const handleHumanize = async () => {
    if (!text.trim()) return;
    setIsHumanizing(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const initialResult = detect(text);
    const { texteFinal, rapport } = humanizer.humanize(text, {
      register: mode as Register,
    });
    const finalResult = detect(texteFinal);
    const factDensity = analyzeFactDensity(text).factDensityIndex;
    setText(texteFinal);
    setHumanizeReport(rapport);
    setAnalysisResult(finalResult);

    await saveRecord({
      documentTitle: "Humanisation de texte",
      originalText: text,
      processedText: texteFinal,
      humanizedText: texteFinal,
      language: "fr",
      type: "HUMANIZATION",
      initialScore: initialResult.aiScore,
      finalScore: finalResult.aiScore,
      semanticPreservationScore: rapport.semanticIntegrityScore,
      llmSignature: finalResult.llmSignature,
      factDensityScore: factDensity,
      plagiarismScore: finalResult.ngramDensity,
      metricsBreakdown: finalResult,
    });

    setIsHumanizing(false);
    setActiveTab("editor");
  };

  const handleClear = () => {
    setText("");
    setAnalysisResult(null);
    setHumanizeReport(null);
    setActiveTab("editor");
    setConnectedFolder(null);
    setLocalSyncMessage("Aucun dossier local indexé.");
  };

  const handleFileDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const extractedText = await extractTextFromFile(file);
    setText(extractedText);
    setAnalysisResult(null);
    setActiveTab("editor");
  };

  const handleFolderConnect = async () => {
    try {
      const directoryHandle = await (window as any).showDirectoryPicker();
      const folderName = directoryHandle.name;
      setConnectedFolder(folderName);
      setLocalSyncMessage(`Dossier local connecté : ${folderName}`);
      await syncLocalDirectory(directoryHandle, setLocalSyncMessage);
    } catch (error) {
      console.warn("Dossier local non connecté", error);
      setLocalSyncMessage("Connexion de dossier local annulée ou non supportée.");
    }
  };

  const handleExportReport = async () => {
    if (!analysisResult) return;
    await generateAuditReport({
      documentTitle: "Oligens Detector Report",
      userName: "Utilisateur Anonyme",
      userRole: "Freemium",
      originalText: text,
      initialMetrics: analysisResult,
      llmSignature: analysisResult.llmSignature || "Aucune signature détectée",
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(255,184,0,0.11),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" />

      <div className="relative mx-auto flex min-h-screen max-w-[1780px] flex-col gap-6 px-5 py-5 lg:px-8">
        <header className="glass-panel sticky top-4 z-20 flex flex-col gap-4 rounded-[32px] border-white/10 px-5 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 text-white">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white/5 text-[color:var(--oligens-gold)] shadow-[0_0_24px_rgba(255,184,0,0.25)] ring-1 ring-white/10">
              <span className="text-2xl">⟳</span>
            </div>
            <div>
              <div className="font-display text-xl font-semibold uppercase tracking-[0.35em] text-white">
                OLIGENS DETECTOR
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.45em] text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">PLAN GRATUIT</span>
                <span> </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleInstallApp}
              className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-cyan-100 transition hover:bg-cyan-400/20"
            >
              ⬇️ Télécharger l&apos;app
            </button>
            <LanguageSelector />

            {userProfile ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="oligens-btn-ghost flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/80 transition hover:border-cyan-400/60 hover:text-cyan-300"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-400/20">
                  {userProfile.fullName?.[0] ?? userProfile.email?.[0] ?? "U"}
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.35em] text-white/80">
                  Profil
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDefaultTab("login");
                    setProfileOpen(true);
                    loadUserProfile();
                  }}
                  className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.35em] text-white bg-cyan-500 hover:bg-cyan-600 transition"
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDefaultTab("signup");
                    setProfileOpen(true);
                    loadUserProfile();
                  }}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/80 bg-white/5 hover:bg-white/10 transition"
                >
                  S&apos;inscrire
                </button>
              </>
            )}
            <Link
              to="/history"
              className="oligens-btn-ghost rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/80 transition hover:border-cyan-400/60 hover:text-cyan-300"
            >
              Historique
            </Link>
            <Link
              to="/pricing"
              className="oligens-btn-ghost rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/80 transition hover:border-lime-400/60 hover:text-lime-300"
            >
              Pricing
            </Link>
          </div>
        </header>

        {showPwaHelp ? (
          <div className="glass-panel rounded-[32px] border border-cyan-400/10 bg-[#02040A]/95 px-5 py-4 text-sm text-cyan-100 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
            {pwaHelpMessage}
            <button
              type="button"
              onClick={() => setShowPwaHelp(false)}
              className="ml-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-white/80 hover:bg-white/10"
            >
              Fermer
            </button>
          </div>
        ) : null}
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_380px]">

          <aside className="glass-panel rounded-[32px] border-white/10 p-5 text-white/90 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-[color:var(--oligens-gold)]">
                Contrôle
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">
                Navigation système
              </h2>
            </div>

            <div className="space-y-3">
              <SidebarButton label="📁 CONNECTER DOSSIER LOCAL" accent="cyan" onClick={handleFolderConnect} />
              <SidebarButton
                label="🛡️ CONFIDENTIALITÉ (EN SAVOIR PLUS)"
                accent="gold"
                onClick={() => setPrivacyOpen(true)}
              />
              <SidebarButton
                label="💡 HUMANISATION (EN SAVOIR PLUS)"
                accent="cyan"
                onClick={() => setHumanizationOpen(true)}
              />
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-[#05070B]/80 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
                Statut du dossier local
              </div>
              <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <div className="font-semibold text-white">{connectedFolder || "Aucun dossier connecté"}</div>
                <div className="mt-2 text-xs text-white/60">{localSyncMessage}</div>
              </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-[#05070B]/80 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
                Mode d'humanisation
              </div>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                className="mt-3 w-full rounded-3xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--oligens-gold)]/60 focus:ring-[0.5px] focus:ring-[color:var(--oligens-gold)]/20"
              >
                {HUMANIZATION_MODES.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#05070B] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </aside>

          <main className="glass-panel rounded-[36px] border-white/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
                  QUANTUM TERMINAL
                </div>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Analyse de texte
                </h1>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 shadow-[0_0_20px_rgba(0,0,0,0.15)]">
                {stats.words.toLocaleString()} / {wordLimit.toLocaleString()} mots
                <span className="ml-2 text-[color:var(--oligens-gold)]">LIMITE FREEMIUM</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_280px]">
              <div className="flex flex-col gap-4">
                <HeatmapText
                  text={text}
                  onTextChange={setText}
                  segments={heatmapSegments}
                  showHeatmap={activeTab === "heatmap"}
                  rows={12}
                  placeholder="Collez votre texte ici pour déceler l'empreinte IA..."
                />

                <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white/80 transition hover:border-cyan-300/50 hover:bg-white/10"
                    >
                      📥 IMPORTER FICHIER
                    </button>
                    <ActionButton
                      label={`🔥 ${isAnalyzing ? "ANALYSE EN COURS" : "ANALYSER / DÉTECTER"}`}
                      variant="gold"
                      fullWidth
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !text.trim()}
                    />
                    <ActionButton
                      label="📄 EXPORTER RAPPORT"
                      variant="ghost"
                      fullWidth
                      onClick={handleExportReport}
                      disabled={!analysisResult}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <ActionButton
                      label={`✨ ${isHumanizing ? "HUMANISATION…" : "HUMANISER / HUMANIZE"}`}
                      variant="cyan"
                      fullWidth
                      onClick={handleHumanize}
                      disabled={isHumanizing || !text.trim()}
                    />
                    <ActionButton label="🗑️ EFFACER / CLEAR" variant="ghost" fullWidth onClick={handleClear} />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,.xlsx"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const extractedText = await extractTextFromFile(file);
                      setText(extractedText);
                      setAnalysisResult(null);
                      setActiveTab("editor");
                      event.target.value = "";
                    }}
                  />
                {humanizeReport ? (
                  <div className="mt-4 rounded-[28px] border border-white/10 bg-[#04060A]/80 p-4 text-sm text-white/80">
                    <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
                      Rapport d'humanisation
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">IA avant</div>
                        <div className="mt-1 text-lg font-semibold text-white">{Math.round(humanizeReport.proba_initiale * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">IA après</div>
                        <div className="mt-1 text-lg font-semibold text-white">{Math.round(humanizeReport.proba_finale * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">Conservation</div>
                        <div className="mt-1 text-lg font-semibold text-white">{Math.round(humanizeReport.semanticIntegrityScore * 100)}%</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-white/60">{humanizeReport.decision}</div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-[32px] border border-white/10 bg-[#04060A]/90 p-5 text-center">
                  <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-full bg-[#05070B]/80 shadow-[0_0_45px_rgba(255,184,0,0.16)]" style={{ backgroundImage: `conic-gradient(rgba(255,184,0,0.95) 0deg, rgba(255,184,0,0.95) ${globalScore * 360}deg, rgba(255,255,255,0.06) 0deg)` }}>
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#05070B] text-[2.5rem] font-semibold text-[color:var(--oligens-gold)]">
                      {Math.round(globalScore * 100)}%
                    </div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/50">
                    SCORE GLOBAL IA
                  </div>
                  <div className="mt-3 text-sm text-white/80">
                    {Math.round(globalScore * 100)}% IA • {Math.max(0, 100 - Math.round(globalScore * 100))}% HUMAIN
                  </div>
                  <div className="mt-2 text-xs text-white/60">Signature LLM détectée : {signature}</div>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-[#04060A]/90 p-5">
                  <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
                    <span>BURSTINESS</span>
                    <span>{Math.round(burstiness * 100)}%</span>
                  </div>
                  <MetricBar value={burstiness} accent="cyan" />
                  <div className="mt-5 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
                    <span>PERPLEXITÉ</span>
                    <span>{Math.round(perplexity * 100)}%</span>
                  </div>
                  <MetricBar value={perplexity} accent="gold" />
                </div>

                <div className="rounded-[32px] border border-white/10 bg-[#04060A]/90 p-5">
                  <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
                    <span>SCORE PLAGIAT</span>
                    <span className="text-[color:var(--oligens-gold)]">{Math.round(plagiarismScore * 100)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#FFB800] via-[#FFCF5C] to-[#00F0FF] shadow-[0_0_18px_rgba(255,184,0,0.35)]" style={{ width: `${plagiarismScore * 100}%` }} />
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    {PLAGIARISM_SOURCES.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-100 transition hover:border-cyan-400/50 hover:text-cyan-200"
                      >
                        {source.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[32px] border border-white/10 bg-[#04060A]/85 p-5">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/50">
                <span>Visualisation Heatmap</span>
                <div className="flex items-center gap-2">
                  <TabButton active={activeTab === "editor"} onClick={() => setActiveTab("editor")}>
                    Éditeur
                  </TabButton>
                  <TabButton active={activeTab === "heatmap"} onClick={() => setActiveTab("heatmap")}>Heatmap</TabButton>
                </div>
              </div>

              {activeTab === "editor" ? (
                <div className="min-h-[240px] rounded-[28px] border border-white/10 bg-black/50 p-4 text-sm text-white/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]">
                  <pre className="whitespace-pre-wrap break-words font-mono leading-7">{text || "Votre texte apparaîtra ici après saisie."}</pre>
                </div>
              ) : (
                <div className="min-h-[240px] rounded-[28px] border border-white/10 bg-black/50 p-4 text-sm text-white/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]">
                  <div className="flex flex-wrap gap-2">
                    {heatmapSegments.map((segment) => (
                      <span
                        key={segment.id}
                        className={`inline-flex max-w-full items-center rounded-full border px-3 py-2 text-sm font-medium leading-6 transition ${
                          segment.variant === "ai"
                            ? "border-[#FFB800]/30 bg-[#FFB800]/15 text-[#FFF0B2]"
                            : segment.variant === "human"
                            ? "border-cyan-400/25 bg-cyan-400/12 text-cyan-100"
                            : "border-white/10 bg-white/5 text-white/75"
                        }`}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>

          <aside className="glass-panel rounded-[32px] border-white/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <div className="mb-6 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-white/50">
              <span>Business Intelligence</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/70">Dashboard</span>
            </div>

            <div className="space-y-5">
              <BIStatusBlock label="Score Global IA" value={`${Math.round(globalScore * 100)}%`} />
              <div className="rounded-[32px] border border-white/10 bg-[#04060A]/90 p-5">
                <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
                  <span>BURSTINESS</span>
                  <span>{Math.round(burstiness * 100)}%</span>
                </div>
                <MetricBar value={burstiness} accent="cyan" hideLabel />
              </div>
              <div className="rounded-[32px] border border-white/10 bg-[#04060A]/90 p-5">
                <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
                  <span>PERPLEXITÉ</span>
                  <span>{Math.round(perplexity * 100)}%</span>
                </div>
                <MetricBar value={perplexity} accent="gold" hideLabel />
              </div>
            </div>
          </aside>
        </div>

        <PrivacyInfoModal open={privacyOpen} onOpenChange={setPrivacyOpen} />
        <HumanizationInfoModal open={humanizationOpen} onOpenChange={setHumanizationOpen} />
<ProfileModal
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            onUserUpdated={(user) => setUserProfile(user)}
            initialTab={profileDefaultTab}
          />

        <footer className="glass-panel rounded-[32px] border-white/10 px-5 py-4 text-sm text-white/80 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.45)]" />
              <span className="uppercase tracking-[0.35em] text-white/80">SYSTÈME QUANTIQUE : {systemStatus}</span>
            </div>
            <div className="text-xs uppercase tracking-[0.35em] text-white/50">
              Mode : {mode.toUpperCase()} • Analyse prête à exécuter
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

