import { describe, expect, it } from '@jest/globals';
import { mergePrefs } from './mergePrefs';

describe('mergePrefs', () => {
  it('returns defaults for null/undefined/empty', () => {
    const all = { shopping: true, car: true, announcements: true, issues: true };
    expect(mergePrefs(null)).toEqual(all);
    expect(mergePrefs(undefined)).toEqual(all);
    expect(mergePrefs({})).toEqual(all);
  });
  it('keeps explicit false and fills missing keys', () => {
    expect(mergePrefs({ car: false })).toEqual({ shopping: true, car: false, announcements: true, issues: true });
  });
  it('ignores non-boolean values and unknown keys', () => {
    const r = mergePrefs({ shopping: 'no', issues: false, extra: 1 } as never);
    expect(r).toEqual({ shopping: true, car: true, announcements: true, issues: false });
  });
});
