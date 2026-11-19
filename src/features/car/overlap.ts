import type { CarReservation } from '@/types/database';

type Range = Pick<CarReservation, 'starts_at' | 'ends_at'>;
type WithId = Range & { id?: string };

const ms = (iso: string | Date) => (iso instanceof Date ? iso.getTime() : new Date(iso).getTime());

/** חפיפה בין טווחים חצי-פתוחים [start, end): נגיעה בקצה אינה חפיפה. */
export function hasOverlap(
  existing: WithId[],
  start: Date | string,
  end: Date | string,
  ignoreId?: string,
): boolean {
  const s = ms(start);
  const e = ms(end);
  return existing.some((r) => {
    if (ignoreId && r.id === ignoreId) return false;
    return s < ms(r.ends_at) && ms(r.starts_at) < e;
  });
}

/** ההזמנה הפעילה כרגע (starts <= now < ends), או null. */
export function currentReservation<T extends Range>(list: T[], now: Date = new Date()): T | null {
  const n = now.getTime();
  return list.find((r) => ms(r.starts_at) <= n && n < ms(r.ends_at)) ?? null;
}

/** הזמנות שנוגעות ביום הקלנדרי של `now`, ממוינות לפי התחלה. */
export function reservationsToday<T extends Range>(list: T[], now: Date = new Date()): T[] {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return list
    .filter((r) => ms(r.starts_at) < dayEnd && ms(r.ends_at) > dayStart)
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
}
