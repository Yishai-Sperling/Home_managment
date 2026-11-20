import { describe, expect, it } from '@jest/globals';
import {
  applyTime, conflictCount, createResultMessage, dateToHHMM, formatDays, mapRpcError, normalizeDays,
  parseISODate, summarizeRule, toggleDay, toHHMM, toISODate,
} from './recurrence';

describe('formatDays', () => {
  it('compresses consecutive runs', () => {
    expect(formatDays([0, 1, 2, 3, 4])).toBe('א׳–ה׳');
    expect(formatDays([4, 3, 2, 1, 0])).toBe('א׳–ה׳');
  });
  it('lists non-consecutive days', () => { expect(formatDays([0, 2, 4])).toBe('א׳, ג׳, ה׳'); });
  it('lists pairs without a range', () => { expect(formatDays([0, 1])).toBe('א׳, ב׳'); });
  it('handles every day and empty', () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('כל יום');
    expect(formatDays([])).toBe('');
  });
  it('mixes ranges and singles', () => { expect(formatDays([0, 1, 2, 4, 6])).toBe('א׳–ג׳, ה׳, ש׳'); });
  it('ignores invalid and duplicate values', () => { expect(normalizeDays([2, 2, 9, -1, 1])).toEqual([1, 2]); });
});

describe('toggleDay', () => {
  it('adds and removes', () => {
    expect(toggleDay([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleDay([0, 1, 2], 1)).toEqual([0, 2]);
  });
});

describe('time helpers', () => {
  it('converts HH:MM:SS to HH:MM', () => { expect(toHHMM('09:00:00')).toBe('09:00'); expect(toHHMM('15:30')).toBe('15:30'); });
  it('applies a time to a day', () => {
    const d = applyTime(new Date(2026, 10, 22, 3, 3), '15:30:00');
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([22, 15, 30]);
    expect(dateToHHMM(d)).toBe('15:30');
  });
  it('round-trips ISO dates', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(parseISODate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('summaries and messages', () => {
  it('summarizes a rule', () => {
    expect(summarizeRule({ days: [0, 1, 2, 3, 4], start_time: '09:00:00', end_time: '15:30:00' })).toBe('א׳–ה׳ · 09:00–15:30');
  });
  it('builds result messages', () => {
    expect(createResultMessage(12, 0)).toBe('נוצרו 12 שריונים');
    expect(createResultMessage(1, 0)).toBe('נוצר שריון אחד');
    expect(createResultMessage(10, 2)).toBe('נוצרו 10 שריונים\n2 ימים דולגו כי הרכב כבר תפוס');
  });
  it('counts conflicts', () => { expect(conflictCount(3)).toBe(3); expect(conflictCount([1, 2])).toBe(2); expect(conflictCount(null)).toBe(0); });
  it('maps rpc errors', () => {
    expect(mapRpcError('forbidden')).toContain('הרשאה');
    expect(mapRpcError('ERROR: invalid_days')).toContain('יום');
    expect(mapRpcError('boom')).toBe('הפעולה נכשלה, נסו שוב');
  });
});
