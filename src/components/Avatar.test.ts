import { describe, expect, it } from '@jest/globals';
import { avatarColor, initials } from './Avatar';

describe('avatar helpers', () => {
  it('builds initials from first and last word', () => {
    expect(initials('ישי ספרלינג')).toBe('יס');
    expect(initials('דנה')).toBe('ד');
    expect(initials('  ')).toBe('?');
    expect(initials(null)).toBe('?');
  });
  it('gives a stable color per id', () => {
    expect(avatarColor('abc')).toBe(avatarColor('abc'));
    expect(avatarColor('abc')).toMatch(/^#[0-9A-F]{6}$/);
  });
});
