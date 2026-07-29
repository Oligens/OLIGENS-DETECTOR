import Dexie, { type Table } from "dexie";
import type { SupportedLang } from "./languageDetect";
import type { Register, RegisterPreference } from "./TextHumanizer";

export interface UserProfile {
  userId: string;
  email?: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
  preferredRegister: RegisterPreference;
  passwordHash?: string;
  createdAt: number;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  documentTitle: string;
  originalText: string;
  processedText?: string;
  humanizedText?: string; // Kept for backward compat with UI
  language: SupportedLang | string;
  type: "DETECTION" | "HUMANIZATION";
  initialScore: number;
  finalScore?: number;
  semanticPreservationScore?: number;
  llmSignature?: string;
  factDensityScore?: number;
  plagiarismScore?: number;
  sha256Hash?: string;
  metricsBreakdown?: any; 
}

export interface LocalDocument {
  id: string;
  filename: string;
  content: string;
  ngrams: string[];
  lastModified: number;
}

export class OligensDatabase extends Dexie {
  users!: Table<UserProfile, string>;
  history!: Table<HistoryRecord, string>;
  localDocuments!: Table<LocalDocument, string>;

  constructor() {
    super("OligensDB");
    this.version(1).stores({
      users: "userId, fullName, role",
      history: "id, timestamp, type, language, documentTitle",
      localDocuments: "id, filename",
    });
  }
}

export const db = new OligensDatabase();
