import type { CarReservation } from '@/types/database';

type Range = Pick<CarReservation, 'starts_at' | 'ends_at'>;

export const DAY_MINUTES = 24 * 60;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** דקות מתחילת היום הנבחר, חסומות לטווח [0, 1440] (שריון שחוצה חצות נחתך לגבולות היום). */
export function minutesInDay(t: Date | string, day: Date) {
  const diff = (new Date(t).getTime() - startOfDay(day).getTime()) / 60000;
  return Math.min(DAY_MINUTES, Math.max(0, diff));
}

/** מיקום וגובה של בלוק בלוח היום, או null אם השריון לא נוגע ביום. */
export function blockRect(r: Range, day: Date, hourHeight: number) {
  const top = minutesInDay(r.starts_at, day);
  const bottom = minutesInDay(r.ends_at, day);
  if (bottom <= top) return null;
  return { top: (top / 60) * hourHeight, height: ((bottom - top) / 60) * hourHeight };
}

/** מיקום קו "עכשיו", או null אם היום הנבחר אינו היום. */
export function nowOffset(now: Date, day: Date, hourHeight: number) {
  if (!isSameDay(now, day)) return null;
  return (minutesInDay(now, day) / 60) * hourHeight;
}

/** רבע השעה הקרוב (עיגול כלפי מעלה). */
export function nextQuarter(now: Date) {
  const d = new Date(now);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export function dayLabel(day: Date, now: Date) {
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  return day.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
}
