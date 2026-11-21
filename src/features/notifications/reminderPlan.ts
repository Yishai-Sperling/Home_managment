export type ReminderScreen = 'car' | 'announcements';

export interface PlannedReminder {
  id: string;
  at: Date;
  title: string;
  body: string;
  screen: ReminderScreen;
}

export interface ReminderReservation {
  id: string;
  starts_at: string;
  ends_at: string;
  purpose: string | null;
}

export interface ReminderEvent {
  id: string;
  title: string;
  event_date: string | null;
}

export const RESERVATION_LEAD_MS = 30 * 60 * 1000;
export const EVENT_LEAD_MS = 60 * 60 * 1000;
export const EVENT_ALL_DAY_HOUR = 9;
export const MAX_REMINDERS = 40;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * זמן התזכורת לאירוע. אירוע בלי שעה (חצות מקומית, או חצות UTC כפי שנשמר מתאריך בלבד)
 * מקבל תזכורת ב-09:00 באותו יום; אחרת שעה לפני.
 */
function eventReminderTime(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const localMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  if (localMidnight) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), EVENT_ALL_DAY_HOUR, 0, 0, 0);
  if (utcMidnight) return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), EVENT_ALL_DAY_HOUR, 0, 0, 0);
  return new Date(d.getTime() - EVENT_LEAD_MS);
}

/** תוכנית תזכורות דטרמיניסטית: ללא עבר, הקרוב ראשון, עד `max`. */
export function planReminders(input: {
  reservations: ReminderReservation[];
  events: ReminderEvent[];
  now: Date;
  max?: number;
}): PlannedReminder[] {
  const { reservations, events, now, max = MAX_REMINDERS } = input;
  const out: PlannedReminder[] = [];

  for (const r of reservations) {
    const start = new Date(r.starts_at);
    const end = new Date(r.ends_at);
    if (Number.isNaN(start.getTime())) continue;
    const at = new Date(start.getTime() - RESERVATION_LEAD_MS);
    if (at.getTime() <= now.getTime()) continue;
    const range = Number.isNaN(end.getTime()) ? hhmm(start) : `${hhmm(start)}–${hhmm(end)}`;
    const purpose = r.purpose?.trim();
    out.push({
      id: `reminder:car:${r.id}`,
      at,
      title: 'הרכב שלך מתחיל בעוד 30 דקות',
      body: purpose ? `${range} · ${purpose}` : range,
      screen: 'car',
    });
  }

  for (const e of events) {
    if (!e.event_date) continue;
    const at = eventReminderTime(e.event_date);
    if (!at || at.getTime() <= now.getTime()) continue;
    out.push({ id: `reminder:event:${e.id}`, at, title: e.title, body: 'האירוע היום', screen: 'announcements' });
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
  return out.slice(0, Math.max(0, max));
}
