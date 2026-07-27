import { db, type HistoryRecord } from "./dbStorage";
export type { HistoryRecord };

export async function loadHistory(): Promise<HistoryRecord[]> {
  try {
    const arr = await db.history.orderBy("timestamp").reverse().limit(50).toArray();
    return arr;
  } catch {
    return [];
  }
}

export async function saveRecord(rec: Omit<HistoryRecord, "id" | "timestamp"> & { id?: string; timestamp?: number }): Promise<HistoryRecord> {
  const record: HistoryRecord = {
    id: rec.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: rec.timestamp ?? Date.now(),
    ...rec,
    documentTitle: rec.documentTitle || "Untitled Document",
  } as HistoryRecord;

  try {
    await db.history.add(record);
    // Keep only last 50
    const count = await db.history.count();
    if (count > 50) {
      const oldest = await db.history.orderBy("timestamp").limit(count - 50).toArray();
      const oldestIds = oldest.map(r => r.id);
      await db.history.bulkDelete(oldestIds);
    }
  } catch (err) {
    console.error("Failed to save record:", err);
  }
  return record;
}

export async function deleteRecord(id: string): Promise<HistoryRecord[]> {
  await db.history.delete(id);
  return await loadHistory();
}

export async function clearHistory(): Promise<void> {
  await db.history.clear();
}
