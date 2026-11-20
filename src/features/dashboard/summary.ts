import type { Announcement, CarReservation, Issue, ShoppingItem } from '@/types/database';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (target: Date, now: Date) =>
  Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY);

/** מודעות עם event_date מתחילת היום הנוכחי ועד `days` ימים קדימה, ממוינות לפי תאריך. */
export function upcomingEvents(announcements: Announcement[], now: Date = new Date(), days = 7): Announcement[] {
  const from = startOfDay(now).getTime();
  const to = from + (days + 1) * DAY;
  return announcements
    .filter((a) => {
      if (!a.event_date) return false;
      const t = new Date(a.event_date).getTime();
      return !Number.isNaN(t) && t >= from && t < to;
    })
    .sort((a, b) => +new Date(a.event_date!) - +new Date(b.event_date!));
}

/** היום / מחר / אתמול / שם היום בשבוע (עד שבוע), אחרת תאריך קצר. */
export function relativeDayLabel(iso: string | Date, now: Date = new Date()): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  const diff = dayDiff(d, now);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** "עכשיו", "לפני 5 דק׳", "לפני 3 שעות", "אתמול", "לפני 4 ימים", או תאריך. */
export function relativeTime(iso: string | Date, now: Date = new Date()): string {
  const t = (iso instanceof Date ? iso : new Date(iso)).getTime();
  const diffMs = now.getTime() - t;
  if (diffMs < 60_000) return 'עכשיו';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `לפני ${mins} דק׳`;
  const days = -dayDiff(new Date(t), now);
  if (days <= 0) return `לפני ${Math.floor(mins / 60)} שעות`;
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  const d = new Date(t);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** תקלות דחופות שעדיין לא נסגרו, החדשות קודם. */
export function urgentOpenIssues(issues: Issue[]): Issue[] {
  return issues
    .filter((i) => i.urgency === 'urgent' && i.status !== 'closed')
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export type ActivityKind = 'shopping' | 'car' | 'announcement' | 'issue';
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  actorId: string;
  actorName: string;
  text: string;
  at: string;
}

/** מאחד פעילות אחרונה מכל הפיצ'רים, ממוינת מהחדש לישן. */
export function buildActivity(
  src: { shopping?: ShoppingItem[]; reservations?: CarReservation[]; announcements?: Announcement[]; issues?: Issue[] },
  names: Record<string, string>,
  limit = 6,
): ActivityItem[] {
  const nameOf = (id: string) => names[id] ?? 'דייר';
  const rows: ActivityItem[] = [];
  (src.shopping ?? []).forEach((i) => rows.push({ id: 's' + i.id, kind: 'shopping', actorId: i.added_by, actorName: nameOf(i.added_by), text: `הוסיף/ה לקניות: ${i.name}`, at: i.created_at }));
  (src.reservations ?? []).forEach((r) => rows.push({ id: 'r' + r.id, kind: 'car', actorId: r.user_id, actorName: nameOf(r.user_id), text: 'שריינ/ה את הרכב', at: r.created_at }));
  (src.announcements ?? []).forEach((a) => rows.push({ id: 'a' + a.id, kind: 'announcement', actorId: a.created_by, actorName: nameOf(a.created_by), text: `פרסם/ה מודעה: ${a.title}`, at: a.created_at }));
  (src.issues ?? []).forEach((i) => rows.push({ id: 'i' + i.id, kind: 'issue', actorId: i.created_by, actorName: nameOf(i.created_by), text: `דיווח/ה על תקלה: ${i.title}`, at: i.created_at }));
  return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, limit);
}
