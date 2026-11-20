import type { CarRecurringRule } from '@/types/database';

/** אותיות ימי השבוע לפי JS getDay (0=ראשון). */
export const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;
/** ברירת מחדל כשמפעילים "חוזר": ראשון עד חמישי. */
export const DEFAULT_DAYS = [0, 1, 2, 3, 4];

const pad = (n: number) => String(n).padStart(2, '0');

/** ימים תקינים (0-6), בלי כפילויות, ממוינים. */
export function normalizeDays(days: number[]): number[] {
  return Array.from(new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
}

export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : normalizeDays([...days, day]);
}

/** "א׳–ה׳", "א׳, ג׳, ה׳", "כל יום". רצפים של 3 ימים ומעלה נדחסים לטווח. */
export function formatDays(days: number[]): string {
  const ds = normalizeDays(days);
  if (ds.length === 0) return '';
  if (ds.length === 7) return 'כל יום';
  const parts: string[] = [];
  let i = 0;
  while (i < ds.length) {
    let j = i;
    while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++;
    if (j - i >= 2) parts.push(`${DAY_LETTERS[ds[i]]}–${DAY_LETTERS[ds[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(DAY_LETTERS[ds[k]]);
    i = j + 1;
  }
  return parts.join(', ');
}

/** 'HH:MM:SS' או 'HH:MM' -> 'HH:MM'. */
export function toHHMM(t: string): string {
  return t.slice(0, 5);
}

/** Date -> 'HH:MM' (שעה מקומית). */
export function dateToHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** מחיל שעה 'HH:MM[:SS]' על יום נתון (שעה מקומית). */
export function applyTime(day: Date, time: string): Date {
  const [h, m] = time.split(':').map((x) => parseInt(x, 10));
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0, 0, 0);
}

/** Date -> 'YYYY-MM-DD' (תאריך מקומי). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date מקומי בחצות. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "א׳–ה׳ · 09:00–15:30". */
export function summarizeRule(rule: Pick<CarRecurringRule, 'days' | 'start_time' | 'end_time'>): string {
  return `${formatDays(rule.days)} · ${toHHMM(rule.start_time)}–${toHHMM(rule.end_time)}`;
}

/** הודעת תוצאה אחרי יצירת סדרה. */
export function createResultMessage(created: number, conflicts: number): string {
  const head = created === 1 ? 'נוצר שריון אחד' : `נוצרו ${created} שריונים`;
  if (conflicts <= 0) return head;
  const skipped = conflicts === 1 ? 'יום אחד דולג' : `${conflicts} ימים דולגו`;
  return `${head}\n${skipped} כי הרכב כבר תפוס`;
}

/** מספר התנגשויות מתוך תוצאת ה-RPC (מספר או מערך). */
export function conflictCount(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  return typeof v === 'number' ? v : 0;
}

const ERRORS: [string, string][] = [
  ['forbidden', 'אין לך הרשאה לפעולה הזו'],
  ['invalid_days', 'יש לבחור לפחות יום אחד בשבוע'],
  ['invalid_time', 'שעות לא תקינות: הסיום חייב להיות אחרי ההתחלה באותו יום'],
  ['not_found', 'השריון כבר לא קיים'],
  ['not_member', 'אינך חבר/ה בבית הזה'],
];

/** קוד שגיאה של ה-RPC -> הודעה בעברית. */
export function mapRpcError(message: string | null | undefined): string {
  const m = message ?? '';
  const hit = ERRORS.find(([code]) => m.includes(code));
  return hit ? hit[1] : 'הפעולה נכשלה, נסו שוב';
}
