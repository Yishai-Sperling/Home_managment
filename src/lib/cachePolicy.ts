/** כתובות חתומות לתמונות פגות תוקף ולכן לא נשמרות; כל השאר נשמר רק אם נטען בהצלחה. */
const NOT_PERSISTED = new Set(['issue-image']);

export function shouldPersistQuery(queryKey: readonly unknown[], status: string): boolean {
  return status === 'success' && !NOT_PERSISTED.has(String(queryKey[0]));
}

/** משנים את המחרוזת כדי להתעלם ממטמון ישן אחרי שינוי במבנה הנתונים. */
export const CACHE_BUSTER = 'v1';
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
