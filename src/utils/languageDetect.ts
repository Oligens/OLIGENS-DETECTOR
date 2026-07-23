// Lightweight stop-word based language detection for FR / EN / ES / HT (Kreyòl)
export type SupportedLang = "FR" | "EN" | "ES" | "HT";

const STOPS: Record<SupportedLang, string[]> = {
  FR: [
    "le","la","les","un","une","des","de","du","et","ou","mais","donc","car",
    "que","qui","quoi","dont","où","est","sont","était","être","avoir","dans",
    "pour","avec","sur","sans","pas","ne","ce","cette","ces","son","sa","ses",
    "nous","vous","ils","elles","je","tu","il","elle","on","au","aux","par",
  ],
  EN: [
    "the","a","an","and","or","but","of","in","on","for","with","to","from",
    "is","are","was","were","be","been","being","this","that","these","those",
    "it","its","he","she","they","we","you","i","have","has","had","do","does",
    "did","not","as","at","by","if","so","than","then","which","who","whom",
  ],
  ES: [
    "el","la","los","las","un","una","unos","unas","y","o","pero","de","del",
    "en","para","por","con","sin","que","qué","es","son","era","eran","ser",
    "estar","está","están","este","esta","estos","estas","su","sus","le","les",
    "lo","al","como","más","también","porque","cuando","donde","muy",
  ],
  HT: [
    "yo","li","nou","mwen","ou","ak","nan","pou","sou","san","men","epi","oswa",
    "se","te","pa","ki","kote","kilès","paske","lè","tout","tou","yon","yon lòt",
    "sa","sa a","konsa","tankou","fè","gen","ap","pral","ta","kounye a","kounyeya",
    "menm","anpil","toujou","jodi a","yèske","èske","poutèt","poutan","kidonk",
  ],
};

export function detectLanguage(text: string): SupportedLang {
  const tokens = (text.toLowerCase().match(/\b[\p{L}]+(?:\s[\p{L}]+)?\b/gu) ?? [])
    .slice(0, 4000);
  if (tokens.length === 0) return "EN";
  const scores: Record<SupportedLang, number> = { FR: 0, EN: 0, ES: 0, HT: 0 };
  for (const lang of Object.keys(STOPS) as SupportedLang[]) {
    const set = new Set(STOPS[lang]);
    for (const t of tokens) if (set.has(t)) scores[lang]++;
  }
  // HT signature bigrams / distinctive tokens boost (avoids collision with FR)
  const raw = " " + text.toLowerCase() + " ";
  const htMarkers = [" mwen ", " nou ", " ki ", " pa gen ", " kounye a ", " tankou ", " se ", " ap "];
  for (const m of htMarkers) if (raw.includes(m)) scores.HT += 2;
  const esMarkers = [" que ", " porque ", " también ", " está ", " años ", " más "];
  for (const m of esMarkers) if (raw.includes(m)) scores.ES += 2;

  let best: SupportedLang = "EN";
  let bestScore = -1;
  (Object.keys(scores) as SupportedLang[]).forEach((l) => {
    if (scores[l] > bestScore) {
      best = l;
      bestScore = scores[l];
    }
  });
  return best;
}

export function languageLabel(lang: SupportedLang): string {
  return { FR: "Français", EN: "English", ES: "Español", HT: "Kreyòl Ayisyen" }[lang];
}
