import type { HouseMember, Issue, IssueCategory, IssueStatus, IssueUrgency } from '@/types/database';

export type IssueFilter = IssueStatus | 'all';

const urgencyRank: Record<IssueUrgency, number> = { urgent: 0, normal: 1, low: 2 };
const statusRank: Record<IssueStatus, number> = { open: 0, in_progress: 1, closed: 2 };

export function filterIssues(list: Issue[], filter: IssueFilter): Issue[] {
  return filter === 'all' ? list : list.filter((i) => i.status === filter);
}

/** פתוחות קודם, אחר כך לפי דחיפות, ואז חדש קודם. */
export function sortIssues(list: Issue[]): Issue[] {
  return [...list].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      urgencyRank[a.urgency] - urgencyRank[b.urgency] ||
      b.created_at.localeCompare(a.created_at),
  );
}

export function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function issueImagePath(houseId: string, id = randomId()) {
  return `${houseId}/${id}.jpg`;
}

/** עריכת תקלה: יוצר התקלה או מנהל. */
export function canEditIssue(i: Issue, userId: string | undefined, isAdmin: boolean) {
  return !!userId && (isAdmin || i.created_by === userId);
}

export interface IssueForm {
  title: string;
  description: string;
  category: IssueCategory;
  urgency: IssueUrgency;
}

export function issueToForm(i: Issue): IssueForm {
  return { title: i.title, description: i.description ?? '', category: i.category, urgency: i.urgency };
}

/** שדות לשמירה, או null אם הכותרת ריקה. */
export function formToIssueFields(f: IssueForm) {
  const title = f.title.trim();
  if (!title) return null;
  return { title, description: f.description.trim() || null, category: f.category, urgency: f.urgency };
}

/** מפה user_id -> שם מלא (ברירת מחדל 'דייר'). */
export function memberNameMap(members: Pick<HouseMember, 'user_id' | 'profile'>[]): Map<string, string> {
  return new Map(members.map((m) => [m.user_id, m.profile?.full_name || 'דייר']));
}
