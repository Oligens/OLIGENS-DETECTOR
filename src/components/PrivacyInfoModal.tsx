import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface PrivacyInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyInfoModal({ open, onOpenChange }: PrivacyInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#070707] border border-[rgba(255,215,0,0.18)] shadow-[0_20px_120px_rgba(255,184,28,0.18)]">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[rgba(255,215,0,0.22)] bg-white/5 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,215,0,0.12)] text-[color:var(--oligens-gold)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <DialogTitle className="text-lg font-semibold tracking-tight text-white">
            En savoir plus sur la confidentialité
          </DialogTitle>
        </div>

        <DialogDescription className="space-y-5 text-sm leading-7 text-white/80 font-mono">
          <p>
            Chez <strong>Oligens Detector</strong>, la protection de vos créations intellectuelles, de vos travaux académiques et de vos documents juridiques constitue le pilier fondamental de notre architecture logicielle. Contrairement aux solutions traditionnelles qui envoient l’intégralité de vos textes sur des serveurs distants, notre plateforme a été conçue selon le principe du <strong>Privacy by Design</strong> (confidentialité dès la conception).
          </p>

          <div className="space-y-3 rounded-3xl border border-[rgba(255,215,0,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--oligens-gold)]">
              1. Traitement 100 % Local & Sans Empreinte Cloud
            </h3>
            <p>
              L’ensemble des analyses statistiques, des calculs de similarité cosinus, de la détection de <em>burstiness</em>, de l’analyse forensique ainsi que la génération des <em>heatmaps</em> s’exécutent <strong>directement au sein de votre navigateur web</strong>. Aucun extrait de votre document n’est transmis, vendu ou conservé sur un serveur tiers à des fins d’entraînement de modèles d’intelligence artificielle.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-[rgba(255,215,0,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--oligens-gold)]">
              2. Base Documentaire Institutionnelle & Indexation Sécurisée
            </h3>
            <p>
              Lorsque vous connectez un dossier local de référence (PDF, DOCX, TXT) pour la vérification du plagiat, les documents originaux ne quittent jamais votre disque dur ou le réseau interne de votre institution. Le moteur extrait le texte localement pour générer des <strong>empreintes cryptographiques anonymisées (hashes)</strong>, stockées de façon strictement confidentielle dans la mémoire locale de votre navigateur (<strong>IndexedDB</strong>).
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-[rgba(255,215,0,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--oligens-gold)]">
              3. Requêtes Académiques Anonymisées (API Crossref)
            </h3>
            <p>
              Lors de la vérification des sources scientifiques et académiques en ligne, seules des signatures textuelles fragmentées (<code className="rounded bg-white/5 px-1 py-[0.1rem] text-[color:var(--oligens-gold)]">n-grammes</code>) sont interrogées de manière sécurisée via le protocole <em>Polite Pool</em> de Crossref. Vos documents complets demeurent totalement opaques pour le réseau externe.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-[rgba(255,215,0,0.16)] bg-white/5 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--oligens-gold)]">
              4. Certificats d’Intégrité Inviolables (SHA-256)
            </h3>
            <p>
              Chaque rapport PDF officiel généré par l’application inclut une empreinte cryptographique unique calculée en local via l’algorithme SHA-256. Cette clé permet de garantir l’authenticité et l’intégrité de vos résultats sans jamais exposer le contenu de vos travaux sur un registre public.
            </p>
          </div>

          <p className="pt-2 text-[0.82rem] text-white/60">
            Vos données vous appartiennent. Votre propriété intellectuelle reste sous votre contrôle exclusif.
          </p>

          <p className="pt-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
            Conception & Développement Architecture System :<br />
            <span className="text-[color:var(--oligens-gold)]">Cleef Oligens JOSEPH</span>
          </p>
        </DialogDescription>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-[rgba(255,215,0,0.35)] bg-[rgba(255,215,0,0.08)] px-4 py-2 text-sm font-semibold tracking-wide text-[color:var(--oligens-gold)] transition hover:bg-[rgba(255,215,0,0.16)]"
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
