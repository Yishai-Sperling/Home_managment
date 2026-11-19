import { describe, expect, it } from '@jest/globals';
import { blockRect, dayLabel, minutesInDay, nextQuarter, nowOffset } from './timeline';

const day = new Date(2026, 10, 19);
const at = (h: number, m = 0, d = 19) => new Date(2026, 10, d, h, m).toISOString();

describe('timeline', () => {
  it('positions a block by minutes from the start of the day', () => {
    expect(blockRect({ starts_at: at(9), ends_at: at(10, 30) }, day, 60)).toEqual({ top: 540, height: 90 });
  });
  it('clips reservations that cross midnight', () => {
    expect(blockRect({ starts_at: at(23), ends_at: at(2, 0, 20) }, day, 60)).toEqual({ top: 1380, height: 60 });
    expect(blockRect({ starts_at: at(22, 0, 18), ends_at: at(1) }, day, 60)).toEqual({ top: 0, height: 60 });
  });
  it('returns null for reservations outside the day', () => {
    expect(blockRect({ starts_at: at(9, 0, 20), ends_at: at(10, 0, 20) }, day, 60)).toBeNull();
  });
  it('now line only exists on the selected day when it is today', () => {
    expect(nowOffset(new Date(2026, 10, 19, 12, 30), day, 60)).toBe(750);
    expect(nowOffset(new Date(2026, 10, 20, 12, 30), day, 60)).toBeNull();
  });
  it('rounds up to the next quarter hour', () => {
    expect(nextQuarter(new Date(2026, 10, 19, 14, 2)).getMinutes()).toBe(15);
    expect(nextQuarter(new Date(2026, 10, 19, 14, 45)).getMinutes()).toBe(45);
    expect(nextQuarter(new Date(2026, 10, 19, 14, 50)).getHours()).toBe(15);
  });
  it('labels relative days', () => {
    expect(dayLabel(day, day)).toBe('היום');
    expect(dayLabel(new Date(2026, 10, 20), day)).toBe('מחר');
    expect(minutesInDay(at(1), day)).toBe(60);
  });
});
