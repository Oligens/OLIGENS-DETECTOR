// Sentence-level heatmap and word-level diff helpers used by the UI.
import { detect, splitSentences } from "@/lib/detector";

export interface SentenceHeat {
  text: string;
  score: number; // 0..1 AI probability
  markers: string[];
}

const MARKER_PATTERNS = [
  "in conclusion","furthermore","moreover","it is important to note","delve into",
  "tapestry","landscape of","plethora","myriad","leverage","utilize",
  "il est important de","il est essentiel de","voici la marche à suivre",
  "étape par étape","dans le cadre de","par conséquent","en conclusion",
  "es importante destacar","en el panorama actual","por lo tanto","en conclusión",
  "li enpòtan pou","an konklizyon","nan kad sa a",
];

export function analyzeSentences(text: string): SentenceHeat[] {
  const sentences = splitSentences(text);
  return sentences.map((s) => {
    const lower = s.toLowerCase();
    const markers = MARKER_PATTERNS.filter((m) => lower.includes(m));
    // Very short sentences aren't reliable — use dampened score.
    const wc = s.trim().split(/\s+/).length;
    let score = detect(s).aiScore;
    if (wc < 6) score = Math.min(score, 0.35);
    return { text: s.trim(), score, markers };
  });
}

export type DiffOp = "eq" | "add" | "del";
export interface DiffToken {
  op: DiffOp;
  text: string;
}

// Word-level LCS diff. Not the fastest, but fine for typical page-sized texts.
export function diffWords(a: string, b: string): DiffToken[] {
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const n = aw.length;
  const m = bw.length;
  // Build LCS length table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aw[i] === bw[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aw[i] === bw[j]) {
      out.push({ op: "eq", text: aw[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: "del", text: aw[i] });
      i++;
    } else {
      out.push({ op: "add", text: bw[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "del", text: aw[i++] });
  while (j < m) out.push({ op: "add", text: bw[j++] });
  return out;
}
