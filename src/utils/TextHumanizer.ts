// ============================================================
// HUMANIZER_V1 - NEUTRALISATION DES TRACES IA
// Pure TypeScript - Aucune dépendance externe
// ============================================================

import { cosineSimilarity, detect, splitSentences } from "@/lib/detector";

export type Register = "juridique" | "academique" | "professionnel" | "creatif";

// Terms whose meaning must be preserved verbatim per register.
const PROTECTED_TERMS_BY_REGISTER: Record<Register, Set<string>> = {
  juridique: new Set([
    "nullité","acte","exploit","partie","parties","jugement","procédure","requête",
    "demandeur","défendeur","tribunal","article","alinéa","clause","préjudice",
    "obligation","contrat","contractuel","responsabilité","dommages","intérêts",
    "arrêt","cassation","pourvoi","appel","instance","juridiction","code civil",
    "code pénal","statut","loi","décret","ordonnance","règlement",
  ]),
  academique: new Set([
    "hypothèse","méthodologie","corpus","échantillon","variable","corrélation",
    "significatif","p-value","résultat","résultats","analyse","données",
    "hypothesis","methodology","sample","variable","correlation","significant",
  ]),
  professionnel: new Set([
    "kpi","roi","stakeholder","livrable","milestone","budget","scope",
  ]),
  creatif: new Set(),
};

const SENTENCE_SIMILARITY_MIN = 0.9;

interface HeuristicResult {
  probabilite_IA: number;
  intervalle_confiance_95: [number, number];
  confiance_analyse: "Faible" | "Moyenne" | "Élevée";
  genre_detecte: string;
  rapport_detaille: Array<{ nom: string; z_score: number; contribution: number }>;
  decision_precaution: string;
}

// Adapter around the existing Oligens detector so the humanizer can iterate.
class IAHeuristicDetector {
  analyze(text: string): HeuristicResult {
    const m = detect(text);
    const contribPerp = 0.5 * (1 - m.perplexityNorm);
    const contribBurst = 0.3 * (1 - m.burstinessNorm);
    const contribNgram = 0.2 * m.ngramDensity;
    return {
      probabilite_IA: m.aiScore,
      intervalle_confiance_95: [
        Math.max(0, m.aiScore - 0.05),
        Math.min(1, m.aiScore + 0.05),
      ],
      confiance_analyse: m.wordCount > 120 ? "Élevée" : m.wordCount > 40 ? "Moyenne" : "Faible",
      genre_detecte: "generique",
      rapport_detaille: [
        { nom: "f1_perplexity", z_score: 1 - m.perplexityNorm, contribution: contribPerp },
        { nom: "f2_burstiness", z_score: 1 - m.burstinessNorm, contribution: contribBurst },
        { nom: "f17_ngram_ia_phrases", z_score: m.ngramDensity, contribution: contribNgram },
      ],
      decision_precaution:
        m.aiScore > 0.65 ? "Fort indice IA" : m.aiScore > 0.4 ? "Zone grise" : "Style humain probable",
    };
  }
}

interface HumanizerConfig {
  seuilCible: number;
  iterationsMax: number;
  intensite: number;
  langue: SupportedLang | "AUTO" | "mixte";
  register: Register;
}


const SYNONYM_MAP: Record<string, string[]> = {
  therefore: ["so", "thus", "hence", "as a result"],
  however: ["but", "yet", "though", "still"],
  consequently: ["so", "as a result", "because of that"],
  moreover: ["besides", "also", "furthermore", "what's more"],
  nevertheless: ["yet", "still", "however", "even so"],
  "in conclusion": ["to sum up", "finally", "all in all", "in short"],
  additionally: ["also", "too", "plus", "as well"],
  utilize: ["use", "employ", "apply"],
  implement: ["carry out", "put in place", "apply", "use"],
  significant: ["big", "major", "notable", "key"],
  numerous: ["many", "several", "lots of", "countless"],
  demonstrate: ["show", "prove", "display", "reveal"],
  obtain: ["get", "gain", "secure", "achieve"],
  purchase: ["buy", "get", "acquire"],
  assist: ["help", "aid", "support"],
  attempt: ["try", "seek", "undertake"],
  sufficient: ["enough", "ample", "adequate"],
  cependant: ["mais", "pourtant", "toutefois", "néanmoins"],
  "par conséquent": ["donc", "ainsi", "de ce fait", "si bien que"],
  "en effet": ["effectivement", "certes", "vraiment", "en réalité"],
  "d'ailleurs": ["de plus", "aussi", "en plus", "du reste"],
  "par ailleurs": ["d'un autre côté", "en outre", "de surcroît"],
  "en conclusion": ["pour finir", "finalement", "en résumé", "bref"],
  utiliser: ["employer", "se servir de", "recourir à"],
  "mettre en œuvre": ["appliquer", "réaliser", "exécuter", "faire"],
  significatif: ["important", "grand", "notable", "majeur"],
  nombreux: ["beaucoup de", "plein de", "quantité de", "moult"],
  démontrer: ["montrer", "prouver", "établir", "révéler"],
  obtenir: ["avoir", "recevoir", "décrocher", "se procurer"],
  acheter: ["acquérir", "prendre", "se procurer"],
  aider: ["secourir", "soutenir", "épauler"],
  tenter: ["essayer", "chercher à", "s'efforcer de"],
  suffisant: ["assez", "ample", "correct", "bon"],
  // Spanish
  "sin embargo": ["pero", "aunque", "no obstante", "aun así"],
  "por lo tanto": ["así que", "por eso", "de modo que"],
  "en conclusión": ["para terminar", "en resumen", "al final", "en fin"],
  además: ["también", "aparte", "encima", "y de paso"],
  utilizar: ["usar", "emplear", "aplicar"],
  implementar: ["aplicar", "poner en marcha", "llevar a cabo"],
  significativo: ["importante", "grande", "clave", "notable"],
  numerosos: ["muchos", "varios", "un montón de"],
  demostrar: ["mostrar", "probar", "revelar"],
  obtener: ["conseguir", "lograr", "sacar"],
  // Haitian Creole
  poutan: ["men", "malgre sa", "kanmenm"],
  "an konklizyon": ["pou fini", "an rezime", "nan fen jounen an", "finalman"],
  "li enpòtan": ["li gen anpil enpòtans", "nou dwe sonje", "fòk nou sonje"],
  itilize: ["sèvi ak", "aplike", "pran"],
  jwenn: ["gen", "resevwa", "dekwoche"],
  montre: ["fè wè", "pwouve", "revele"],
};

import { detectLanguage, type SupportedLang } from "./languageDetect";

const IA_PHRASE_LIST_BY_LANG: Record<SupportedLang, string[]> = {
  FR: [
    "il est important de noter",
    "il convient de souligner",
    "il faut garder à l'esprit",
    "dans le paysage actuel",
    "il s'agit d'un enjeu majeur",
    "cette approche permet",
    "il est essentiel de comprendre",
    "cela dit",
    "d'un point de vue",
    "il est également important",
    "il est à noter que",
    "il faut souligner que",
    "il est intéressant de constater",
    "en ce qui concerne",
    "dans ce contexte",
    "de manière générale",
    "il est possible de",
    "il est nécessaire de",
    "il est recommandé de",
    "il est préférable de",
  ],
  EN: [
    "it is important to note",
    "it should be noted",
    "it is worth noting that",
    "it is worth noting",
    "in the current landscape",
    "in today's digital landscape",
    "this approach allows",
    "it is crucial to understand",
    "that being said",
    "from a perspective",
    "plays a crucial role",
    "plays a pivotal role",
    "delve into",
    "testament to",
    "furthermore",
    "moreover",
    "a rich tapestry of",
  ],
  ES: [
    "es importante destacar que",
    "es importante mencionar que",
    "en el panorama actual",
    "cabe mencionar que",
    "cabe destacar que",
    "por lo tanto",
    "en conclusión",
    "en resumen",
    "sin embargo",
    "no obstante",
    "juega un papel crucial",
    "juega un papel fundamental",
  ],
  HT: [
    "li enpòtan pou nou note",
    "li enpòtan pou note",
    "nan kad sa a",
    "poutan",
    "an konklizyon",
    "pou fini",
    "li klè ke",
    "li nesesè pou",
    "an rezime",
    "nan kontèks sa a",
    "jwe yon wòl enpòtan",
  ],
};

// Merged fallback (used when language is "mixte" or unknown)
const IA_PHRASE_LIST = Object.values(IA_PHRASE_LIST_BY_LANG).flat();

const HUMAN_FILLERS_BY_LANG: Record<SupportedLang, { start: string[]; emotional: string[]; hesitation: string[] }> = {
  FR: {
    start: ["Bon,", "Eh bien,", "Alors,", "Bref,", "Tiens,", "En fait,"],
    emotional: ["franchement", "vraiment", "absolument", "totalement", "clairement", "honnêtement"],
    hesitation: ["en quelque sorte", "pour ainsi dire", "en fait", "en réalité"],
  },
  EN: {
    start: ["You know,", "Well,", "Honestly,", "Actually,", "Look,", "So,"],
    emotional: ["truly", "really", "absolutely", "honestly", "genuinely"],
    hesitation: ["sort of", "kind of", "in a way", "pretty much"],
  },
  ES: {
    start: ["Bueno,", "Mira,", "Sinceramente,", "La verdad,", "Vaya,"],
    emotional: ["realmente", "verdaderamente", "absolutamente", "honestamente", "sinceramente"],
    hesitation: ["más o menos", "en cierto modo", "por así decirlo", "en realidad"],
  },
  HT: {
    start: ["Ebyen,", "Gade,", "An verite,", "Franchman,", "Tande,"],
    emotional: ["vrèman", "toutbon", "absoliman", "onètman", "reyèlman"],
    hesitation: ["yon jan", "kon si", "yon fason", "an reyalite"],
  },
};

// Legacy alias retained for callers that don't pass a language.
const HUMAN_FILLERS = {
  start: [...HUMAN_FILLERS_BY_LANG.FR.start, ...HUMAN_FILLERS_BY_LANG.EN.start],
  emotional: [...HUMAN_FILLERS_BY_LANG.FR.emotional, ...HUMAN_FILLERS_BY_LANG.EN.emotional],
  hesitation: [...HUMAN_FILLERS_BY_LANG.FR.hesitation, ...HUMAN_FILLERS_BY_LANG.EN.hesitation],
};


const CONTRACTIONS: Record<string, string> = {
  "do not": "don't",
  "does not": "doesn't",
  "did not": "didn't",
  "is not": "isn't",
  "are not": "aren't",
  "was not": "wasn't",
  "were not": "weren't",
  "have not": "haven't",
  "has not": "hasn't",
  "had not": "hadn't",
  "will not": "won't",
  "would not": "wouldn't",
  "could not": "couldn't",
  "should not": "shouldn't",
  cannot: "can't",
  "it is": "it's",
  "that is": "that's",
  "i am": "i'm",
  "you are": "you're",
};

class TextMutator {
  private config: HumanizerConfig;
  private rng: () => number;

  constructor(config: HumanizerConfig, seed?: number) {
    this.config = config;
    this.rng = seed ? this.seededRandom(seed) : Math.random;
  }

  private seededRandom(seed: number): () => number {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }

  private splitSentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }

  private activePhraseList(): string[] {
    const lg = this.config.langue;
    if (lg === "FR" || lg === "EN" || lg === "ES" || lg === "HT") {
      return IA_PHRASE_LIST_BY_LANG[lg];
    }
    return IA_PHRASE_LIST;
  }

  private activeFillers() {
    const lg = this.config.langue;
    if (lg === "FR" || lg === "EN" || lg === "ES" || lg === "HT") {
      return HUMAN_FILLERS_BY_LANG[lg];
    }
    return HUMAN_FILLERS;
  }

  private protectedTerms(): Set<string> {
    return PROTECTED_TERMS_BY_REGISTER[this.config.register] ?? new Set();
  }

  private touchesProtected(text: string): boolean {
    const prot = this.protectedTerms();
    if (prot.size === 0) return false;
    const lower = text.toLowerCase();
    for (const t of prot) {
      if (lower.includes(t)) return true;
    }
    return false;
  }

  mutatePhrases(text: string, intensity: number): string {
    let result = text;
    let replaced = 0;
    const list = this.activePhraseList();
    const maxReplace = Math.floor(list.length * intensity * 0.6);
    for (const phrase of list) {
      if (replaced >= maxReplace) break;
      if (this.touchesProtected(phrase)) continue;
      const regex = new RegExp(
        "\\b" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        "gi",
      );
      if (regex.test(result) && this.rng() < intensity * 0.5) {
        const humanAlt = this.generateHumanAlternative(phrase);
        result = result.replace(regex, humanAlt);
        replaced++;
      }
    }
    return result;
  }

  private generateHumanAlternative(iaPhrase: string): string {
    const lower = iaPhrase.toLowerCase();
    if (lower.includes("important") || lower.includes("crucial")) {
      return this.pickRandom([
        "on doit retenir",
        "c'est essentiel",
        "il ne faut pas oublier",
        "faut vraiment noter",
      ]);
    }
    if (lower.includes("noter") || lower.includes("note")) {
      return this.pickRandom(["on remarque", "on voit", "il est clair", "c'est évident"]);
    }
    if (lower.includes("conclusion") || lower.includes("sum")) {
      return this.pickRandom(["pour finir", "finalement", "au final", "en définitive"]);
    }
    if (lower.includes("cependant") || lower.includes("however")) {
      return this.pickRandom(["mais", "pourtant", "néanmoins", "tout de même"]);
    }
    if (lower.includes("en effet") || lower.includes("indeed")) {
      return this.pickRandom(["effectivement", "c'est vrai", "en réalité", "c'est un fait"]);
    }
    if (lower.includes("dans le paysage") || lower.includes("current landscape")) {
      return this.pickRandom(["actuellement", "dans ce contexte", "aujourd'hui", "pour l'instant"]);
    }
    return (
      this.pickRandom(this.activeFillers().start) +
      " " +
      this.pickRandom(["on peut dire", "c'est à dire", "autrement dit"])
    );
  }

  mutateBurstiness(text: string, intensity: number): string {
    const sentences = this.splitSentences(text);
    if (sentences.length < 3) return text;
    const newSentences: string[] = [];
    let i = 0;
    while (i < sentences.length) {
      const current = sentences[i];
      const wordCount = current.split(/\s+/).length;
      if (wordCount < 5 && i > 0 && this.rng() < intensity * 0.6) {
        const prev = newSentences.pop() || "";
        newSentences.push(prev.trim() + " " + current.trim());
        i++;
        continue;
      }
      if (wordCount > 25 && this.rng() < intensity * 0.5) {
        const words = current.split(/\s+/);
        const mid = Math.floor(words.length / 2);
        let cutIndex = mid;
        for (let j = mid; j < words.length - 1; j++) {
          if (
            ["and", "but", "or", "so", "because", "mais", "et", "donc", "car", "alors"].includes(
              words[j].toLowerCase(),
            )
          ) {
            cutIndex = j;
            break;
          }
        }
        const firstPart = words.slice(0, cutIndex).join(" ");
        const secondPart = words.slice(cutIndex).join(" ");
        newSentences.push(firstPart + ". ");
        const connect = this.pickRandom(["Alors,", "Ensuite,", "Et puis,", "Puis,", "Well,", "So,"]);
        const secondLower = secondPart.charAt(0).toLowerCase() + secondPart.slice(1);
        newSentences.push(connect + " " + secondLower);
        i++;
        continue;
      }
      newSentences.push(current);
      i++;
    }
    return newSentences.join(" ");
  }

  mutateSynonyms(text: string, intensity: number): string {
    const words = text.split(/\s+/);
    const newWords: string[] = [];
    let substituted = 0;
    const maxSubs = Math.floor(words.length * intensity * 0.15);
    for (const word of words) {
      const lower = word.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿæœ-]/g, "");
      if (SYNONYM_MAP[lower] && !this.protectedTerms().has(lower) && substituted < maxSubs && this.rng() < intensity * 0.4) {
        const syns = SYNONYM_MAP[lower];
        const chosen = this.pickRandom(syns);
        let replacement = chosen;
        if (word[0] === word[0].toUpperCase()) {
          replacement = chosen.charAt(0).toUpperCase() + chosen.slice(1);
        }
        newWords.push(replacement);
        substituted++;
      } else {
        newWords.push(word);
      }
    }
    return newWords.join(" ");
  }

  mutateSentenceStarts(text: string, intensity: number): string {
    const sentences = this.splitSentences(text);
    if (sentences.length < 2) return text;
    const newSentences = sentences.map((s, idx) => {
      if (idx < 2 || this.rng() > intensity * 0.5) return s;
      const trimmed = s.trim();
      const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() || "";
      if (
        [
          "cependant",
          "par conséquent",
          "en effet",
          "de plus",
          "moreover",
          "therefore",
          "consequently",
          "however",
        ].includes(firstWord)
      ) {
        const filler = this.pickRandom(this.activeFillers().start);
        const rest = trimmed.split(/\s+/).slice(1).join(" ");
        const restLower = rest.charAt(0).toLowerCase() + rest.slice(1);
        return filler + " " + restLower;
      }
      return s;
    });
    return newSentences.join(" ");
  }

  mutateTransitionsAndFillers(text: string, intensity: number): string {
    const sentences = this.splitSentences(text);
    const newSentences = sentences.map((s) => {
      if (this.rng() > intensity * 0.3) return s;
      const words = s.split(/\s+/);
      if (words.length < 6) return s;
      const pos = Math.floor(this.rng() * 3) + 1;
      if (pos >= words.length) return s;
      const filler = this.pickRandom(this.activeFillers().emotional);
      words.splice(pos, 0, filler);
      return words.join(" ");
    });
    return newSentences.join(" ");
  }

  mutateContractions(text: string, intensity: number): string {
    let result = text;
    for (const [formal, contracted] of Object.entries(CONTRACTIONS)) {
      if (this.rng() < intensity * 0.5) {
        const regex = new RegExp(
          "\\b" + formal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
          "gi",
        );
        result = result.replace(regex, (match) => {
          if (match[0] === match[0].toUpperCase()) {
            return contracted.charAt(0).toUpperCase() + contracted.slice(1);
          }
          return contracted;
        });
      }
    }
    return result;
  }

  mutateEmotion(text: string, intensity: number): string {
    const sentences = this.splitSentences(text);
    const newSentences = sentences.map((s) => {
      if (this.rng() > intensity * 0.2) return s;
      const words = s.split(/\s+/);
      if (words.length < 4) return s;
      const pos = Math.floor(this.rng() * (words.length - 2));
      const strongAdv = this.pickRandom([
        "très",
        "vraiment",
        "absolument",
        "extrêmement",
        "terriblement",
        "very",
        "really",
        "absolutely",
        "extremely",
      ]);
      words.splice(pos, 0, strongAdv);
      return words.join(" ");
    });
    return newSentences.join(" ");
  }

  private lisser_texte(text: string): string {
    let cleaned = text
      .replace(/\s+/g, " ")
      .replace(/\s([,.;!?:])/g, "$1")
      .replace(/([.!?])\s*([a-z])/g, (_m, p1, p2) => p1 + " " + p2.toUpperCase())
      .replace(/([,.]) ([a-z])/g, (_m, p1, p2) => p1 + " " + p2)
      .replace(/ ([A-Z])\./g, " $1.")
      .replace(/([.!?])$/, "$1 ")
      .trim();

    cleaned = cleaned.replace(/(,|\.|\?|!)\s+([A-Z])/g, (match, p1, p2) => {
      const nextWord = p2.toLowerCase();
      const commonWords = new Set([
        "le","la","les","un","une","ce","cet","cette","mon","ton","son","notre","votre","leur",
        "je","tu","il","elle","on","nous","vous","ils","elles","a","est","sont","était","étaient",
      ]);
      if (commonWords.has(nextWord)) {
        return p1 + " " + p2.toLowerCase();
      }
      return match;
    });

    return cleaned;
  }

  applyAllMutations(text: string, intensity: number): string {
    let mutated = text;
    mutated = this.mutatePhrases(mutated, intensity);

    const mutations = [
      this.mutateBurstiness.bind(this),
      this.mutateSynonyms.bind(this),
      this.mutateSentenceStarts.bind(this),
      this.mutateTransitionsAndFillers.bind(this),
      this.mutateContractions.bind(this),
      this.mutateEmotion.bind(this),
    ];

    for (let i = mutations.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [mutations[i], mutations[j]] = [mutations[j], mutations[i]];
    }

    for (const mut of mutations) {
      mutated = mut(mutated, intensity);
    }

    mutated = this.lisser_texte(mutated);
    return mutated;
  }
}

export interface HumanizerRapport {
  proba_initiale: number;
  proba_finale: number;
  reduction_pourcent: number;
  iterations_realisees: number;
  historique: { iteration: number; proba: number; anomalies: any[] }[];
  features_finales: Array<{ nom: string; z_score: number; contribution: number }>;
  decision: string;
  langue: SupportedLang;
}

export class TextHumanizer {
  private detector: IAHeuristicDetector;

  constructor() {
    this.detector = new IAHeuristicDetector();
  }

  humanize(
    text: string,
    config: Partial<HumanizerConfig> = {},
  ): { texteFinal: string; rapport: HumanizerRapport } {
    const requested = config.langue ?? "AUTO";
    const langue: SupportedLang =
      requested === "AUTO" || requested === "mixte"
        ? detectLanguage(text)
        : (requested as SupportedLang);
    const cfg: HumanizerConfig = {
      seuilCible: 0.35,
      iterationsMax: 6,
      intensite: 0.7,
      ...config,
      langue,
    };

    const mutator = new TextMutator(cfg);
    let currentText = text;
    const history: { iteration: number; proba: number; anomalies: any[] }[] = [];
    let finalIteration = 0;

    const initialAnalysis = this.detector.analyze(currentText);
    let currentAnalysis = initialAnalysis;
    let currentProba = currentAnalysis.probabilite_IA;

    for (let iter = 1; iter <= cfg.iterationsMax; iter++) {
      if (currentProba < cfg.seuilCible) {
        finalIteration = iter;
        break;
      }
      const anomalies = (currentAnalysis.rapport_detaille || [])
        .filter((f) => f.contribution > 0.05)
        .sort((a, b) => b.contribution - a.contribution);

      history.push({ iteration: iter, proba: currentProba, anomalies: anomalies.slice(0, 3) });

      const dynamicIntensity = cfg.intensite * (1 + (currentProba - cfg.seuilCible) * 0.5);
      currentText = mutator.applyAllMutations(currentText, Math.min(1, dynamicIntensity));

      currentAnalysis = this.detector.analyze(currentText);
      currentProba = currentAnalysis.probabilite_IA;

      if (currentProba < cfg.seuilCible) {
        finalIteration = iter;
        break;
      }
    }

    const finalAnalysis = this.detector.analyze(currentText);
    const finalProba = finalAnalysis.probabilite_IA;

    let finalText = currentText
      .replace(/\s+/g, " ")
      .replace(/\s([,.!?:;])/g, "$1")
      .replace(/([.!?])\s*([A-Z])/g, (_m, p1, p2) => p1 + " " + p2)
      .trim();

    if (!/[.!?]$/.test(finalText) && finalText.length > 0) {
      finalText += ".";
    }

    const rapport: HumanizerRapport = {
      proba_initiale: initialAnalysis.probabilite_IA,
      proba_finale: finalProba,
      reduction_pourcent: (initialAnalysis.probabilite_IA - finalProba) * 100,
      iterations_realisees: finalIteration || cfg.iterationsMax,
      historique: history,
      features_finales: finalAnalysis.rapport_detaille,
      decision:
        finalProba < 0.35
          ? "✅ Texte neutralisé (style humain)"
          : "⚠️ Seuil non atteint, révision manuelle conseillée",
      langue,
    };

    return { texteFinal: finalText, rapport };
  }
}
