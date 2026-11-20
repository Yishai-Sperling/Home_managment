import { describe, expect, it } from '@jest/globals';
import type { Announcement, Issue, ShoppingItem } from '@/types/database';
import { buildActivity, relativeDayLabel, relativeTime, upcomingEvents, urgentOpenIssues } from './summary';

const now = new Date(2026, 10, 20, 12, 0); // יום שישי
const ann = (id: string, event_date: string | null): Announcement => ({
  id, house_id: 'h', title: id, body: null, type: 'event', priority: 'normal', event_date, created_by: 'u', created_at: now.toISOString(),
});
const item = (id: string, by: string, at: string): ShoppingItem => ({
  id, house_id: 'h', name: 'x', quantity: null, category: 'other', status: 'pending', added_by: by, created_at: at,
});

describe('upcomingEvents', () => {
  it('keeps events within 7 days, sorted, drops past/none', () => {
    const list = [
      ann('later', new Date(2026, 10, 25, 9).toISOString()),
      ann('past', new Date(2026, 10, 19, 9).toISOString()),
      ann('none', null),
      ann('far', new Date(2026, 11, 5, 9).toISOString()),
      ann('today-earlier', new Date(2026, 10, 20, 8).toISOString()),
    ];
    expect(upcomingEvents(list, now).map((a) => a.id)).toEqual(['today-earlier', 'later']);
  });
});

describe('relativeDayLabel', () => {
  it('labels days', () => {
    expect(relativeDayLabel(new Date(2026, 10, 20, 23), now)).toBe('היום');
    expect(relativeDayLabel(new Date(2026, 10, 21, 1), now)).toBe('מחר');
    expect(relativeDayLabel(new Date(2026, 10, 24, 1), now)).toBe('יום שלישי');
    expect(relativeDayLabel(new Date(2026, 11, 2, 1), now)).toBe('2/12');
  });
});

describe('relativeTime', () => {
  it('formats', () => {
    expect(relativeTime(new Date(now.getTime() - 30_000), now)).toBe('עכשיו');
    expect(relativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe('לפני 5 דק׳');
    expect(relativeTime(new Date(now.getTime() - 3 * 3600_000), now)).toBe('לפני 3 שעות');
    expect(relativeTime(new Date(2026, 10, 19, 20), now)).toBe('אתמול');
    expect(relativeTime(new Date(2026, 10, 16, 20), now)).toBe('לפני 4 ימים');
  });
});

describe('urgentOpenIssues', () => {
  it('filters urgent non-closed', () => {
    const mk = (id: string, urgency: Issue['urgency'], status: Issue['status']): Issue => ({
      id, house_id: 'h', title: id, description: null, category: 'general', urgency, status, image_path: null, assignee_id: null, created_by: 'u', created_at: now.toISOString(),
    });
    const r = urgentOpenIssues([mk('a', 'urgent', 'open'), mk('b', 'urgent', 'closed'), mk('c', 'normal', 'open'), mk('d', 'urgent', 'in_progress')]);
    expect(r.map((i) => i.id).sort()).toEqual(['a', 'd']);
  });
});

describe('buildActivity', () => {
  it('merges, names actors, sorts and limits', () => {
    const a = buildActivity(
      {
        shopping: [item('1', 'u1', '2026-11-20T10:00:00Z')],
        reservations: [{ id: '2', house_id: 'h', user_id: 'u2', starts_at: '', ends_at: '', purpose: null, notes: null, recurring_rule_id: null, occurrence_date: null, created_at: '2026-11-20T11:00:00Z' }],
      },
      { u1: 'דנה' },
    );
    expect(a.map((x) => x.id)).toEqual(['r2', 's1']);
    expect(a[0].actorName).toBe('דייר');
    expect(a[1].actorName).toBe('דנה');
    const many = Array.from({ length: 10 }, (_, i) => item(String(i), 'u', '2026-11-20T10:00:00Z'));
    expect(buildActivity({ shopping: many }, {})).toHaveLength(6);
  });
});
