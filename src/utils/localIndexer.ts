import { db, type LocalDocument } from "./dbStorage";
import mammoth from "mammoth";

// Helper: Generate 5-grams from text
export function generateNgrams(text: string, n: number = 5): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u017F]/g, "") // Keep alphanumeric + extended latin (FR/ES)
    .split(/\s+/)
    .filter(Boolean);

  const ngrams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }
  return Array.from(ngrams);
}

// Extract text from File object based on extension
async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "txt") {
    return await file.text();
  }

  if (ext === "pdf") {
    if (typeof window === "undefined") {
      return "";
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }
      return fullText;
    } catch (e) {
      console.error(`Failed to parse PDF ${file.name}:`, e);
      return "";
    }
  }

  if (ext === "docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (e) {
      console.error(`Failed to parse DOCX ${file.name}:`, e);
      return "";
    }
  }

  return "";
}

// Recursively traverse directory and process valid files
export async function syncLocalDirectory(dirHandle: FileSystemDirectoryHandle, onProgress?: (msg: string) => void) {
  const allowedExtensions = ["txt", "pdf", "docx"];
  let processed = 0;

  async function traverse(handle: FileSystemDirectoryHandle, path: string = "") {
    // @ts-ignore (FileSystemDirectoryHandle.values() is async iterable but TS might complain)
    for await (const entry of handle.values()) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;
      
      if (entry.kind === "file") {
        const ext = entry.name.split(".").pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          
          // Check if it already exists and is up-to-date
          const existing = await db.localDocuments.get(fullPath);
          if (existing && existing.lastModified === file.lastModified) {
            continue; // Skip, hasn't changed
          }

          if (onProgress) onProgress(`Indexing ${fullPath}...`);
          
          const text = await extractTextFromFile(file);
          if (text.trim().length > 0) {
            const ngrams = generateNgrams(text, 5);
            const doc: LocalDocument = {
              id: fullPath,
              filename: file.name,
              content: text,
              ngrams,
              lastModified: file.lastModified,
            };
            await db.localDocuments.put(doc);
            processed++;
          }
        }
      } else if (entry.kind === "directory") {
        await traverse(entry as FileSystemDirectoryHandle, fullPath);
      }
    }
  }

  await traverse(dirHandle);
  if (onProgress) onProgress(`Sync complete. Indexed ${processed} new/updated files.`);
  return processed;
}

// Helper to quickly search ngrams in the local DB
export async function searchLocalNgrams(queryNgrams: string[]): Promise<Map<string, { matches: number, filename: string }>> {
  const results = new Map<string, { matches: number, filename: string }>();
  
  await db.localDocuments.each((doc) => {
    let matchCount = 0;
    const docSet = new Set(doc.ngrams);
    
    for (const qGram of queryNgrams) {
      if (docSet.has(qGram)) {
        matchCount++;
      }
    }
    
    if (matchCount > 0) {
      results.set(doc.id, { matches: matchCount, filename: doc.filename });
    }
  });

  return results;
}
