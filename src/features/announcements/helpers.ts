import type { Announcement, AnnouncementType, Priority } from '@/types/database';

/** חדש קודם. */
export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function canDeleteAnnouncement(a: Announcement, userId: string | undefined, isAdmin: boolean) {
  return !!userId && (isAdmin || a.created_by === userId);
}

/** עריכה: אותן הרשאות כמו מחיקה (יוצר המודעה או מנהל). */
export const canEditAnnouncement = canDeleteAnnouncement;

export interface AnnouncementForm {
  title: string;
  body: string;
  type: AnnouncementType;
  priority: Priority;
  /** טקסט חופשי בפורמט YYYY-MM-DD (או ריק) */
  dateText: string;
}

export const emptyAnnouncementForm: AnnouncementForm = { title: '', body: '', type: 'general', priority: 'normal', dateText: '' };

/** ממלא את טופס העריכה ממודעה קיימת. */
export function announcementToForm(a: Announcement): AnnouncementForm {
  return { title: a.title, body: a.body ?? '', type: a.type, priority: a.priority, dateText: a.event_date ? a.event_date.slice(0, 10) : '' };
}

/** הופך טופס לשדות לשמירה; null אם הטופס לא תקין. */
export function formToAnnouncementFields(f: AnnouncementForm) {
  const title = f.title.trim();
  const eventDate = f.dateText.trim() === '' ? null : parseEventDate(f.dateText);
  if (!title || (f.dateText.trim() !== '' && !eventDate)) return null;
  return { title, body: f.body.trim() || null, type: f.type, priority: f.priority, event_date: eventDate };
}

/** מקבל YYYY-MM-DD ומחזיר אותו אם תקין, אחרת null. */
export function parseEventDate(input: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return input.trim();
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function formatEventDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
