// Local persistence for Oligens analysis / humanization runs.
import type { SupportedLang } from "./languageDetect";

export interface HistoryRecord {
  id: string;
  timestamp: number;
  originalText: string;
  humanizedText?: string;
  initialScore: number;
  finalScore?: number;
  language: SupportedLang | string;
  type: "DETECTION" | "HUMANIZATION";
}

const KEY = "oligens.history.v1";
const MAX_ITEMS = 50;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadHistory(): HistoryRecord[] {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveRecord(rec: Omit<HistoryRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }): HistoryRecord {
  const s = safeStorage();
  const record: HistoryRecord = {
    id: rec.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: rec.timestamp ?? Date.now(),
    ...rec,
  } as HistoryRecord;
  if (!s) return record;
  const list = loadHistory();
  list.unshift(record);
  const trimmed = list.slice(0, MAX_ITEMS);
  try {
    s.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — ignore */
  }
  return record;
}

export function deleteRecord(id: string): HistoryRecord[] {
  const s = safeStorage();
  const list = loadHistory().filter((r) => r.id !== id);
  if (s) s.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory(): void {
  const s = safeStorage();
  if (s) s.removeItem(KEY);
}
