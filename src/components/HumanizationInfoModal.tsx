import { Lightbulb, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface HumanizationInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HumanizationInfoModal({ open, onOpenChange }: HumanizationInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#070707] border border-[rgba(0,240,255,0.18)] shadow-[0_20px_120px_rgba(0,240,255,0.18)]">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[rgba(0,240,255,0.22)] bg-white/5 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(0,240,255,0.12)] text-cyan-300">
            <Lightbulb className="h-5 w-5" />
          </span>
          <DialogTitle className="text-lg font-semibold tracking-tight text-white">
            En savoir plus sur l'humanisation
          </DialogTitle>
        </div>

        <DialogDescription className="space-y-5 text-sm leading-7 text-white/80 font-mono">
          <p>
            Le module d'humanisation reformule votre texte pour réduire l'empreinte IA tout en conservant le sens original. Il agit localement dans le navigateur, sans envoyer votre contenu à un service externe.
          </p>

          <p>
            Notre approche combine des règles linguistiques et des heuristiques statistiques pour détecter et atténuer les marqueurs typiques de génération automatique — phrases trop régulières, enchaînements syntaxiques prévisibles, et choix de vocabulaire standardisés. L'objectif est d'obtenir un texte plus naturel et varié sans altérer les faits et les arguments.
          </p>

          <div className="space-y-3 rounded-3xl border border-[rgba(0,240,255,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Comment ça marche
            </h3>
            <p>
              Le moteur détecte les repères syntaxiques et stylistiques typiques des modèles IA, puis applique des transformations contrôlées pour varier les phrases, simplifier les tournures trop formelles et introduire un style plus naturel.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-[rgba(0,240,255,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Préservation sémantique
            </h3>
            <p>
              La plateforme calcule la similarité sémantique entre le texte d'origine et le texte humanisé pour éviter les dérives de sens. Si l'équilibre n'est pas satisfaisant, le rapport recommande une relecture manuelle.
            </p>

            <p>
              Un score de préservation sémantique est fourni pour chaque transformation afin d'indiquer la confiance dans la conservation des faits. Les utilisateurs peuvent ajuster l'intensité de l'humanisation ou exclure des passages sensibles.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-[rgba(0,240,255,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Registres personnalisés
            </h3>
            <p>
              Choisissez un registre adapté (académique, juridique, professionnel ou créatif) pour voir le texte humanisé s'aligner sur le ton attendu de votre document.
            </p>

            <p>
              Les registres permettent d'orienter les choix lexicaux et rythmiques : par exemple, un registre juridique privilégiera la précision et la terminologie, tandis qu'un registre créatif favorisera des formulations plus imagées.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-[rgba(0,240,255,0.16)] bg-white/5 p-4">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <p className="text-sm text-white/70">
              L'humanisation est conçue comme un assistant, pas comme un remplacement complet : gardez toujours un œil sur l'exactitude et le style final.
            </p>
          </div>
        </DialogDescription>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-[rgba(0,240,255,0.35)] bg-[rgba(0,240,255,0.08)] px-4 py-2 text-sm font-semibold tracking-wide text-cyan-200 transition hover:bg-[rgba(0,240,255,0.16)]"
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
