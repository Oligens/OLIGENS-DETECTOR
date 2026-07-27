export interface FactDensityResult {
  factDensityIndex: number;
  entitiesFound: number;
  totalWords: number;
  status: "High Substance" | "Moderate" | "AI Fluff";
}

export function analyzeFactDensity(text: string): FactDensityResult {
  const words = text.trim().split(/\s+/);
  const totalWords = words.length;
  if (totalWords === 0) return { factDensityIndex: 0, entitiesFound: 0, totalWords: 0, status: "AI Fluff" };

  let entitiesFound = 0;

  // Regex patterns for detecting concrete facts
  // Dates (e.g. 2023, 1990s, January 5, 5/10/2020)
  const datePattern = /\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s\d{1,2}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i;
  // Numbers & Currency (e.g. 500, $1M, 3.14, 50%)
  const numberPattern = /\b\d+(\.\d+)?\b|\b\$\d+|\b\d+%/;
  // Law/Technical references (e.g. Art. 120, Code Civ., Section 5)
  const lawPattern = /\b(art\.|article|code|section|loi|décret)\s+\d*\w*\b/i;
  // Proper nouns (very heuristic: words starting with capital letters, excluding first word of sentence)
  // To keep it simple, we just look for capitalized words that aren't at the start of the string or right after a period.
  
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const sWords = sentence.trim().split(/\s+/);
    for (let i = 0; i < sWords.length; i++) {
      const w = sWords[i];
      if (datePattern.test(w) || numberPattern.test(w) || lawPattern.test(w)) {
        entitiesFound++;
        continue;
      }
      
      // Proper noun heuristic
      if (i > 0 && /^[A-Z][a-z]+/.test(w)) {
        entitiesFound++;
      }
    }
  }

  const factDensityIndex = (entitiesFound / totalWords) * 100;
  
  let status: "High Substance" | "Moderate" | "AI Fluff" = "Moderate";
  // If >70% generic filler => < 30% fact density. Let's say < 10% is Fluff, > 25% is High.
  if (factDensityIndex < 8) {
    status = "AI Fluff";
  } else if (factDensityIndex > 20) {
    status = "High Substance";
  }

  return {
    factDensityIndex,
    entitiesFound,
    totalWords,
    status
  };
}
