import { describe, expect, it } from '@jest/globals';
import { planReminders } from './reminderPlan';

const now = new Date(2026, 0, 5, 8, 0, 0);
const res = (id: string, start: Date, mins = 60, purpose: string | null = null) => ({
  id, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + mins * 60000).toISOString(), purpose,
});

describe('planReminders', () => {
  it('schedules reservations 30 minutes before start with range and purpose', () => {
    const [p] = planReminders({ reservations: [res('a', new Date(2026, 0, 5, 10, 0), 90, 'קניות')], events: [], now });
    expect(p.id).toBe('reminder:car:a');
    expect(p.at).toEqual(new Date(2026, 0, 5, 9, 30));
    expect(p.title).toBe('הרכב שלך מתחיל בעוד 30 דקות');
    expect(p.body).toBe('10:00–11:30 · קניות');
    expect(p.screen).toBe('car');
  });

  it('skips past reminders (including start within 30 minutes)', () => {
    const plan = planReminders({
      reservations: [res('old', new Date(2026, 0, 4, 10, 0)), res('soon', new Date(2026, 0, 5, 8, 20))],
      events: [{ id: 'e', title: 'x', event_date: new Date(2026, 0, 5, 8, 30).toISOString() }],
      now,
    });
    expect(plan).toEqual([]);
  });

  it('uses 1 hour before for timed events and 09:00 for midnight events', () => {
    const plan = planReminders({
      reservations: [],
      events: [
        { id: 't', title: 'ארוחה', event_date: new Date(2026, 0, 6, 19, 0).toISOString() },
        { id: 'lm', title: 'יום הולדת', event_date: new Date(2026, 0, 7, 0, 0).toISOString() },
        { id: 'um', title: 'מפגש', event_date: '2026-01-08T00:00:00+00:00' },
      ],
      now,
    });
    expect(plan.map((p) => [p.id, p.at])).toEqual([
      ['reminder:event:t', new Date(2026, 0, 6, 18, 0)],
      ['reminder:event:lm', new Date(2026, 0, 7, 9, 0)],
      ['reminder:event:um', new Date(2026, 0, 8, 9, 0)],
    ]);
    expect(plan[0].title).toBe('ארוחה');
    expect(plan[0].body).toBe('האירוע היום');
    expect(plan[0].screen).toBe('announcements');
  });

  it('caps soonest-first', () => {
    const reservations = Array.from({ length: 50 }, (_, i) => res(`r${i}`, new Date(2026, 0, 5, 10, i * 5)));
    const plan = planReminders({ reservations, events: [], now, max: 40 });
    expect(plan).toHaveLength(40);
    expect(plan[0].id).toBe('reminder:car:r0');
    expect(plan[39].id).toBe('reminder:car:r39');
  });

  it('handles recurring occurrences as normal rows and has stable output', () => {
    const rows = [1, 2, 3].map((d) => ({ ...res(`occ${d}`, new Date(2026, 0, 5 + d, 9, 0)), recurring_rule_id: 'rule' }));
    const a = planReminders({ reservations: rows, events: [], now });
    const b = planReminders({ reservations: [...rows].reverse(), events: [], now });
    expect(a.map((p) => p.id)).toEqual(['reminder:car:occ1', 'reminder:car:occ2', 'reminder:car:occ3']);
    expect(b).toEqual(a);
  });
});
