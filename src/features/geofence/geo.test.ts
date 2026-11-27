import { describe, expect, it } from '@jest/globals';
import { distanceMeters, isInsideRadius, shouldApplyPresence } from './geo';

const home = { latitude: 32.0853, longitude: 34.7818 };

describe('geo helpers', () => {
  it('measures distance in meters', () => {
    expect(distanceMeters(home, home)).toBe(0);
    // ~111 meters per 0.001 degree of latitude
    const d = distanceMeters(home, { latitude: 32.0863, longitude: 34.7818 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
  it('checks whether a point is inside the radius', () => {
    expect(isInsideRadius({ latitude: 32.0858, longitude: 34.7818 }, home, 150)).toBe(true);
    expect(isInsideRadius({ latitude: 32.0953, longitude: 34.7818 }, home, 150)).toBe(false);
  });
  it('debounces repeated identical presence updates', () => {
    const now = 1_000_000;
    expect(shouldApplyPresence('home', null, now)).toBe(true);
    expect(shouldApplyPresence('home', { status: 'home', at: now - 30_000 }, now)).toBe(false);
    expect(shouldApplyPresence('home', { status: 'home', at: now - 3 * 60_000 }, now)).toBe(true);
    expect(shouldApplyPresence('away', { status: 'home', at: now - 1_000 }, now)).toBe(true);
  });
});
