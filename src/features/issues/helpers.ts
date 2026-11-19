import type { Issue, IssueStatus, IssueUrgency } from '@/types/database';

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
