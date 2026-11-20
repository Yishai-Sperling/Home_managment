import { describe, expect, it } from '@jest/globals';
import { routeForNotification } from './route';

describe('routeForNotification', () => {
  it('maps known screens to routes', () => {
    expect(routeForNotification({ screen: 'shopping' })).toBe('/shopping');
    expect(routeForNotification({ screen: 'car' })).toBe('/car');
  });
  it('ignores unknown or malformed data', () => {
    expect(routeForNotification({ screen: 'admin' })).toBeNull();
    expect(routeForNotification({ screen: 5 })).toBeNull();
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification(undefined)).toBeNull();
  });
});
