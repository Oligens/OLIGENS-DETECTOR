import { searchLocalNgrams, generateNgrams } from "./localIndexer";

export interface SentencePlagiarismStatus {
  text: string;
  isFlagged: boolean;
  citationStatus: "Properly Cited (Footnote)" | "PLAGIARISM" | "None";
  suggestedSource?: string;
  localSource?: string;
}

export interface PlagiarismResult {
  sentences: SentencePlagiarismStatus[];
  plagiarismScore: number; // percentage of sentences that are plagiarism
  hasMalformedCitations: boolean;
}

// 1. Crossref API (Polite Pool)
async function searchCrossref(query: string): Promise<string | null> {
  try {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query", query);
    url.searchParams.set("select", "title,author,issued");
    url.searchParams.set("rows", "1");
    url.searchParams.set("mailto", "cleefolig@gmail.com");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "OligensDetector/1.0 (mailto:cleefolig@gmail.com)"
      }
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    if (data.message && data.message.items && data.message.items.length > 0) {
      const item = data.message.items[0];
      const title = item.title ? item.title[0] : "";
      const author = item.author ? item.author[0]?.family : "Unknown";
      const year = item.issued?.["date-parts"]?.[0]?.[0] || "n.d.";
      return `${author} (${year}). ${title}.`;
    }
    return null;
  } catch (e) {
    console.error("Crossref query failed", e);
    return null;
  }
}

export async function detectPlagiarismAsync(text: string): Promise<PlagiarismResult> {
  // Split document into main text and footnotes zone
  const splitIndex = text.search(/\n(1\.|\[1\]|¹)\s/);
  
  let mainText = text;
  let footnoteText = "";
  
  if (splitIndex !== -1) {
    mainText = text.substring(0, splitIndex);
    footnoteText = text.substring(splitIndex);
  }

  // Find footnote callouts in main text, like [1], [2], or superscript 1, 2, or (Author, 2022)
  const inTextCitations = /\(\w+,\s\d{4}\)|\[\d+\]|[\u00B9\u00B2\u00B3\u2074-\u2079]/g;
  
  const sentences = mainText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  
  const results: SentencePlagiarismStatus[] = [];
  let plagiarismCount = 0;
  let hasMalformed = false;
  
  for (const sentence of sentences) {
    // 2. Local Indexing Cross-Check
    const ngrams = generateNgrams(sentence, 5);
    const localMatches = await searchLocalNgrams(ngrams);
    
    let localSource: string | undefined;
    if (localMatches.size > 0) {
      // Find the document with the most matches
      let bestMatch = "";
      let maxHits = 0;
      for (const [id, info] of localMatches.entries()) {
        if (info.matches > maxHits) {
          maxHits = info.matches;
          bestMatch = info.filename;
        }
      }
      if (maxHits >= 2) {
        localSource = bestMatch;
      }
    }

    // Flag heuristically if it sounds like a claim or verbatim quote, OR if it matches local docs
    const isClaim = sentence.split(/\s+/).length > 8 && !/\b(I|me|my|we|us|our|je|mon|nous)\b/i.test(sentence);
    const isFlagged = isClaim || !!localSource;
    
    let citationStatus: "Properly Cited (Footnote)" | "PLAGIARISM" | "None" = "None";
    let suggestedSource: string | undefined;
    
    if (isFlagged) {
      const hasCitation = inTextCitations.test(sentence);
      if (hasCitation) {
        citationStatus = "Properly Cited (Footnote)";
      } else {
        citationStatus = "PLAGIARISM";
        plagiarismCount++;
        
        // Try to find a source if it's a claim without a local source
        if (!localSource && isClaim) {
           suggestedSource = await searchCrossref(sentence) || undefined;
        }
      }
    }
    
    results.push({
      text: sentence,
      isFlagged,
      citationStatus,
      localSource,
      suggestedSource
    });
  }

  // Check for malformed citations in footnotes
  if (footnoteText && /(fake|hallucinated|non-existent|http:\/\/example\.com)/i.test(footnoteText)) {
    hasMalformed = true;
  }

  return {
    sentences: results,
    plagiarismScore: sentences.length ? (plagiarismCount / sentences.length) * 100 : 0,
    hasMalformedCitations: hasMalformed,
  };
}
