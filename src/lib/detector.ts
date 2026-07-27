// Oligens Detector — mathematical AI detection & humanization engine

export interface DetectionMetrics {
  perplexity: number;
  perplexityNorm: number; // 0..1 (higher = more human)
  burstiness: number;
  burstinessNorm: number; // 0..1 (higher = more human)
  ngramHits: number;
  ngramDensity: number; // 0..1 (higher = more AI)
  aiScore: number; // 0..1 (higher = more AI)
  humanScore: number; // 0..1
  sentenceCount: number;
  wordCount: number;
  avgSentenceLength: number;
  llmSignature?: string;
}

const AI_TRANSITION_MARKERS = [
  "in conclusion",
  "furthermore",
  "moreover",
  "it is important to note",
  "it's important to note",
  "additionally",
  "however",
  "therefore",
  "consequently",
  "in summary",
  "to summarize",
  "notably",
  "essentially",
  "fundamentally",
  "in essence",
  "as a result",
  "for instance",
  "for example",
  "on the other hand",
  "in other words",
  "it should be noted",
  "delve into",
  "navigate the",
  "tapestry",
  "landscape of",
  "realm of",
  "plethora",
  "myriad",
  "underscore",
  "leverage",
  "utilize",
  "in today's world",
  "in the modern era",
  // French LLM transition phrases
  "voici la marche à suivre",
  "étape par étape",
  "est régie principalement par",
  "est régi principalement par",
  "il est essentiel de",
  "il est important de",
  "il convient de",
  "il convient de souligner",
  "dans le cadre de",
  "afin de garantir",
  "afin d'assurer",
  "il est à noter",
  "il est nécessaire de",
  "il est recommandé de",
  "en effet",
  "par ailleurs",
  "par conséquent",
  "de plus",
  "en outre",
  "dans un premier temps",
  "dans un second temps",
  "en résumé",
  "en conclusion",
  "il s'agit de",
  "joue un rôle",
  "joue un rôle crucial",
  "dans le paysage actuel",
  // Extra EN LLM tells
  "it is worth noting that",
  "in today's digital landscape",
  "plays a pivotal role",
  "plays a crucial role",
  "testament to",
  "a rich tapestry of",
  "navigating the complexities",
  // Spanish LLM transition phrases
  "es importante destacar que",
  "es importante mencionar que",
  "en el panorama actual",
  "cabe mencionar que",
  "cabe destacar que",
  "por lo tanto",
  "en conclusión",
  "en resumen",
  "sin embargo",
  "además",
  "no obstante",
  "juega un papel crucial",
  "juega un papel fundamental",
  // Haitian Creole LLM transition phrases
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
];

const P_MAX = 8; // upper bound of "good" entropy
const VAR_MAX = 120; // upper bound for sentence-length variance
const BURSTINESS_NORM_CAP = 0.7; // cap so high variance alone can't zero the AI score
const W1 = 0.5;
const W2 = 0.3;
const W3 = 0.2;


const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'\(])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Shannon entropy over unigrams + bigrams as a stand-in for perplexity. */
export function computePerplexity(text: string): number {
  const tokens = tokenize(text);
  if (tokens.length < 2) return 0;
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    uni.set(tokens[i], (uni.get(tokens[i]) ?? 0) + 1);
    if (i < tokens.length - 1) {
      const b = tokens[i] + " " + tokens[i + 1];
      bi.set(b, (bi.get(b) ?? 0) + 1);
    }
  }
  const H = (m: Map<string, number>, total: number) => {
    let h = 0;
    for (const v of m.values()) {
      const p = v / total;
      h -= p * Math.log2(p);
    }
    return h;
  };
  const uniH = H(uni, tokens.length);
  const biH = H(bi, Math.max(1, tokens.length - 1));
  return 0.5 * uniH + 0.5 * biH;
}

export function computeBurstiness(sentences: string[]): {
  variance: number;
  avg: number;
} {
  if (sentences.length === 0) return { variance: 0, avg: 0 };
  const lens = sentences.map((s) => tokenize(s).length);
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance =
    lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length;
  return { variance, avg };
}

export function countNgramMarkers(text: string): number {
  const lower = " " + text.toLowerCase() + " ";
  let hits = 0;
  for (const m of AI_TRANSITION_MARKERS) {
    const re = new RegExp("\\b" + m.replace(/'/g, "'?") + "\\b", "g");
    const found = lower.match(re);
    if (found) hits += found.length;
  }
  return hits;
}

/** Drop structural titles/headers (short lines w/o terminal punctuation, numbered headings). */
export function filterContentSentences(sentences: string[]): string[] {
  return sentences.filter((s) => {
    const trimmed = s.trim();
    if (!trimmed) return false;
    const wordCount = trimmed.split(/\s+/).length;
    const hasTerminal = /[.!?]$/.test(trimmed);
    // Short lines are likely layout fragments or headers, exclude from variance calculation
    if (wordCount < 5) return false;
    
    // Numbered headings like "1.", "1)", "I.", "A." optionally followed by a short title
    if (/^([0-9]+|[IVX]+|[A-Z])[.)]\s+\S/.test(trimmed) && wordCount < 10 && !hasTerminal) {
      return false;
    }
    return true;
  });
}

export function detect(text: string): DetectionMetrics {
  const sentences = splitSentences(text);
  const contentSentences = filterContentSentences(sentences);
  const words = tokenize(text);
  const perplexity = computePerplexity(text);
  const { variance, avg } = computeBurstiness(
    contentSentences.length >= 2 ? contentSentences : sentences,
  );
  const ngramHits = countNgramMarkers(text);
  const nTotal = Math.max(1, contentSentences.length || sentences.length);

  const perplexityNorm = Math.min(1, perplexity / P_MAX);
  // Cap so a single very long/short sentence can't push burstiness contribution to 0
  const burstinessNorm = Math.min(BURSTINESS_NORM_CAP, variance / VAR_MAX);
  const ngramDensity = Math.min(1, ngramHits / nTotal);

  // Contribution: higher when text looks AI
  const raw =
    W1 * (1 - perplexityNorm) +
    W2 * (1 - burstinessNorm) +
    W3 * ngramDensity;

  // Center around 0.5 → map [-0.5, 0.5] → sigmoid stretch
  let aiScore = sigmoid((raw - 0.5) * 6);

  // Dynamic thresholding: saturated N-gram markers or very low perplexity
  // are strong AI signals — enforce a minimum baseline probability.
  if (ngramDensity >= 1 || perplexity <= 10.0) {
    aiScore = Math.min(1, aiScore + 0.35);
  }

  return {
    perplexity,
    perplexityNorm,
    burstiness: variance,
    burstinessNorm,
    ngramHits,
    ngramDensity,
    aiScore,
    humanScore: 1 - aiScore,
    sentenceCount: sentences.length,
    wordCount: words.length,
    avgSentenceLength: avg,
    llmSignature: determineLLMSignature(text, aiScore, variance, ngramDensity),
  };
}

function determineLLMSignature(text: string, aiScore: number, burstiness: number, ngramDensity: number): string {
  if (aiScore < 0.4) return "None";
  const lower = text.toLowerCase();
  
  // GPT-4o indicators: high formality, bullet points/numbered lists, specific transition markers
  let gpt4Score = 0;
  if (ngramDensity > 0.4) gpt4Score += 2;
  const gptMarkers = ["in conclusion", "furthermore", "it is important to note", "en outre", "dans ce contexte"];
  for (const m of gptMarkers) {
    if (lower.includes(m)) gpt4Score += 1;
  }
  
  // Claude 3.5 indicators: high burstiness (variance), organic flow with subtle academic hedging
  let claudeScore = 0;
  if (burstiness > 80) claudeScore += 2;
  const claudeMarkers = ["il convient néanmoins", "en nuance", "that being said", "it is worth noting", "from a perspective"];
  for (const m of claudeMarkers) {
    if (lower.includes(m)) claudeScore += 1;
  }
  
  // Llama-3 indicators: high rep-score, rhythmic clause balance (often lots of 'and', 'or', repetitive sentence structures)
  let llamaScore = 0;
  const llamaMarkers = ["delve into", "testament to", "rich tapestry", "navigating the complexities"];
  for (const m of llamaMarkers) {
    if (lower.includes(m)) llamaScore += 1;
  }
  
  const scores = [
    { name: "GPT-4o", score: gpt4Score },
    { name: "Claude 3.5", score: claudeScore },
    { name: "Llama-3", score: llamaScore },
  ];
  scores.sort((a, b) => b.score - a.score);
  
  if (scores[0].score === 0) {
    return "Generic AI";
  }
  
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  const topProb = Math.round((scores[0].score / total) * 100);
  let sig = `${scores[0].name} (${topProb}%)`;
  if (scores[1].score > 0) {
    const secondProb = Math.round((scores[1].score / total) * 100);
    sig += ` | ${scores[1].name} (${secondProb}%)`;
  }
  return sig;
}


// -------- Humanization Engine --------

const REPLACEMENTS: Array<[RegExp, string[]]> = [
  [/\bin conclusion\b/gi, ["To wrap up", "All told", "So in the end"]],
  [/\bfurthermore\b/gi, ["Also", "On top of that", "Plus"]],
  [/\bmoreover\b/gi, ["And", "Beyond that", "What's more"]],
  [/\bit is important to note that\b/gi, ["Keep in mind", "Worth noting"]],
  [/\bit's important to note that\b/gi, ["Keep in mind", "Worth noting"]],
  [/\badditionally\b/gi, ["Also", "Plus"]],
  [/\bhowever\b/gi, ["But", "Still", "That said"]],
  [/\btherefore\b/gi, ["So", "Which means"]],
  [/\bconsequently\b/gi, ["So", "As a result"]],
  [/\bin summary\b/gi, ["To sum up", "In short"]],
  [/\bnotably\b/gi, ["Interestingly", "Worth pointing out"]],
  [/\bessentially\b/gi, ["Basically", "At its core"]],
  [/\bfundamentally\b/gi, ["Basically", "At the core"]],
  [/\bfor instance\b/gi, ["For example", "Say"]],
  [/\bon the other hand\b/gi, ["Then again", "But conversely"]],
  [/\bin other words\b/gi, ["Put simply", "That is"]],
  [/\bdelve into\b/gi, ["dig into", "look at"]],
  [/\bnavigate the\b/gi, ["work through the", "get through the"]],
  [/\btapestry\b/gi, ["mix", "blend"]],
  [/\blandscape of\b/gi, ["world of", "space of"]],
  [/\brealm of\b/gi, ["world of", "area of"]],
  [/\bplethora\b/gi, ["lot", "bunch"]],
  [/\bmyriad\b/gi, ["many", "countless"]],
  [/\bunderscore[sd]?\b/gi, ["highlight", "show"]],
  [/\bleverage[sd]?\b/gi, ["use", "tap into"]],
  [/\butilize[sd]?\b/gi, ["use"]],
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function varySentence(sentence: string, idx: number): string {
  let s = sentence;
  let seed = idx + 1;
  for (const [re, options] of REPLACEMENTS) {
    s = s.replace(re, () => {
      seed = (seed * 9301 + 49297) % 233280;
      const rep = pick(options, seed);
      return rep;
    });
  }
  return s;
}

/** Merge/split sentences to increase burstiness. */
function reshapeSentences(sentences: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const words = s.split(/\s+/);
    // Split very long sentences on comma-and / semicolon
    if (words.length > 28) {
      const parts = s.split(/,\s+(?=(?:and|but|so|which|because)\b)/i);
      if (parts.length > 1) {
        for (const p of parts) {
          const t = p.trim().replace(/^,\s*/, "");
          if (t) out.push(t.endsWith(".") ? t : t + ".");
        }
        continue;
      }
    }
    // Merge two consecutive short sentences occasionally
    if (
      words.length < 7 &&
      i + 1 < sentences.length &&
      sentences[i + 1].split(/\s+/).length < 9 &&
      i % 3 === 0
    ) {
      const next = sentences[i + 1];
      const merged =
        s.replace(/[.!?]+$/, "") + " — " + next.charAt(0).toLowerCase() + next.slice(1);
      out.push(merged);
      i++;
      continue;
    }
    out.push(s);
  }
  return out;
}

function termFreq(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

export function cosineSimilarity(a: string, b: string): number {
  const A = termFreq(a);
  const B = termFreq(b);
  const keys = new Set([...A.keys(), ...B.keys()]);
  let dot = 0;
  let nA = 0;
  let nB = 0;
  for (const k of keys) {
    const x = A.get(k) ?? 0;
    const y = B.get(k) ?? 0;
    dot += x * y;
    nA += x * x;
    nB += y * y;
  }
  if (nA === 0 || nB === 0) return 0;
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

export interface HumanizeResult {
  text: string;
  similarity: number; // 0..1
  before: DetectionMetrics;
  after: DetectionMetrics;
}

export function humanize(text: string): HumanizeResult {
  const before = detect(text);
  const sentences = splitSentences(text);
  const reshaped = reshapeSentences(sentences);
  const varied = reshaped.map((s, i) => varySentence(s, i));
  const rebuilt = varied.join(" ");
  const after = detect(rebuilt);
  const similarity = cosineSimilarity(text, rebuilt);
  return { text: rebuilt, similarity, before, after };
}

/** Split large text into chunks for progressive processing. */
export function chunkText(text: string, maxChars = 4000): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > maxChars && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += " " + s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}
