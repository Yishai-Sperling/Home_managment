import { describe, expect, it } from '@jest/globals';
import { currentReservation, hasOverlap, reservationsToday } from './overlap';

const r = (id: string, s: string, e: string) => ({ id, starts_at: s, ends_at: e });
const list = [r('a', '2026-11-19T10:00:00Z', '2026-11-19T12:00:00Z')];

describe('hasOverlap', () => {
  it('detects partial and contained overlap', () => {
    expect(hasOverlap(list, '2026-11-19T11:00:00Z', '2026-11-19T13:00:00Z')).toBe(true);
    expect(hasOverlap(list, '2026-11-19T09:00:00Z', '2026-11-19T10:30:00Z')).toBe(true);
    expect(hasOverlap(list, '2026-11-19T10:30:00Z', '2026-11-19T11:00:00Z')).toBe(true);
    expect(hasOverlap(list, '2026-11-19T09:00:00Z', '2026-11-19T13:00:00Z')).toBe(true);
  });
  it('allows touching edges and disjoint', () => {
    expect(hasOverlap(list, '2026-11-19T12:00:00Z', '2026-11-19T13:00:00Z')).toBe(false);
    expect(hasOverlap(list, '2026-11-19T08:00:00Z', '2026-11-19T10:00:00Z')).toBe(false);
    expect(hasOverlap([], '2026-11-19T08:00:00Z', '2026-11-19T10:00:00Z')).toBe(false);
  });
  it('ignores given id', () => {
    expect(hasOverlap(list, '2026-11-19T11:00:00Z', '2026-11-19T13:00:00Z', 'a')).toBe(false);
  });
});

describe('currentReservation', () => {
  it('finds active one, end exclusive', () => {
    expect(currentReservation(list, new Date('2026-11-19T10:00:00Z'))?.id).toBe('a');
    expect(currentReservation(list, new Date('2026-11-19T12:00:00Z'))).toBeNull();
    expect(currentReservation(list, new Date('2026-11-19T09:59:00Z'))).toBeNull();
  });
});

describe('reservationsToday', () => {
  it('filters to today and sorts', () => {
    const now = new Date(2026, 10, 19, 12, 0);
    const mk = (id: string, s: Date, e: Date) => r(id, s.toISOString(), e.toISOString());
    const res = reservationsToday(
      [
        mk('late', new Date(2026, 10, 19, 18), new Date(2026, 10, 19, 20)),
        mk('early', new Date(2026, 10, 19, 8), new Date(2026, 10, 19, 9)),
        mk('tomorrow', new Date(2026, 10, 20, 8), new Date(2026, 10, 20, 9)),
        mk('yesterday', new Date(2026, 10, 18, 8), new Date(2026, 10, 18, 9)),
        mk('overnight', new Date(2026, 10, 18, 22), new Date(2026, 10, 19, 1)),
      ],
      now,
    );
    expect(res.map((x) => x.id)).toEqual(['overnight', 'early', 'late']);
  });
});
