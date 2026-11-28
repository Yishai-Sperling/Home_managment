import type { PresenceStatus } from '@/types/database';

/** אחרי כמה זמן סימון ידני נחשב לא עדכני. עדכון אוטומטי (גיאופנסינג) לא פג: הוא נשאר נכון עד לאירוע הבא. */
export const PRESENCE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PresenceLike {
  presence?: PresenceStatus | null;
  presence_eta?: string | null;
  presence_updated_at?: string | null;
  presence_auto?: boolean | null;
}

/** הסטטוס בפועל: null אם לא עודכן או שעבר התוקף. */
export function effectivePresence(m: PresenceLike, now: Date = new Date()): PresenceStatus | null {
  if (!m.presence) return null;
  if (m.presence_auto && m.presence !== 'soon') return m.presence;
  if (!m.presence_updated_at) return m.presence;
  const t = new Date(m.presence_updated_at).getTime();
  if (Number.isNaN(t)) return m.presence;
  return now.getTime() - t > PRESENCE_TTL_MS ? null : m.presence;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** טקסט קצר לסטטוס. */
export function presenceText(m: PresenceLike, now: Date = new Date()): string {
  const s = effectivePresence(m, now);
  if (s === 'home') return 'בבית';
  if (s === 'away') return 'בחוץ';
  if (s === 'soon') {
    if (m.presence_eta) {
      const d = new Date(m.presence_eta);
      if (!Number.isNaN(d.getTime())) return `חוזר ב-${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return 'חוזר עוד מעט';
  }
  return 'לא עודכן';
}

const ORDER: Record<string, number> = { home: 0, soon: 1, away: 2, none: 3 };

/** מיון: בבית, חוזר עוד מעט, בחוץ, לא עודכן. יציב (שומר סדר מקורי בתוך קבוצה). */
export function sortByPresence<T extends PresenceLike>(members: T[], now: Date = new Date()): T[] {
  return members
    .map((m, i) => ({ m, i, k: ORDER[effectivePresence(m, now) ?? 'none'] }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.m);
}

export const ETA_OPTIONS = [
  { label: '15 דק׳', minutes: 15 },
  { label: '30 דק׳', minutes: 30 },
  { label: 'שעה', minutes: 60 },
  { label: 'שעתיים', minutes: 120 },
  { label: '3 שעות', minutes: 180 },
] as const;

export function etaFromNow(minutes: number, now: Date = new Date()): string {
  return new Date(now.getTime() + minutes * 60000).toISOString();
}
