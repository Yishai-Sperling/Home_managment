import { describe, expect, it } from '@jest/globals';
import { effectivePresence, etaFromNow, presenceText, sortByPresence } from './helpers';

const now = new Date(2026, 10, 20, 12, 0);
const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

describe('effectivePresence', () => {
  it('returns status when fresh', () => {
    expect(effectivePresence({ presence: 'home', presence_updated_at: ago(2) }, now)).toBe('home');
  });
  it('expires after 16h', () => {
    expect(effectivePresence({ presence: 'home', presence_updated_at: ago(17) }, now)).toBeNull();
  });
  it('null stays null', () => {
    expect(effectivePresence({ presence: null }, now)).toBeNull();
    expect(effectivePresence({}, now)).toBeNull();
  });
});

describe('presenceText', () => {
  it('texts', () => {
    expect(presenceText({ presence: 'home', presence_updated_at: ago(1) }, now)).toBe('בבית');
    expect(presenceText({ presence: 'away', presence_updated_at: ago(1) }, now)).toBe('בחוץ');
    expect(presenceText({ presence: null }, now)).toBe('לא עודכן');
    expect(presenceText({ presence: 'home', presence_updated_at: ago(20) }, now)).toBe('לא עודכן');
  });
  it('soon with eta shows HH:MM', () => {
    const eta = new Date(2026, 10, 20, 13, 5).toISOString();
    expect(presenceText({ presence: 'soon', presence_eta: eta, presence_updated_at: ago(1) }, now)).toBe('חוזר ב-13:05');
    expect(presenceText({ presence: 'soon', presence_updated_at: ago(1) }, now)).toBe('חוזר עוד מעט');
  });
});

describe('sortByPresence', () => {
  it('orders home, soon, away, unknown', () => {
    const f = ago(1);
    const list = [
      { id: 'n', presence: null },
      { id: 'a', presence: 'away' as const, presence_updated_at: f },
      { id: 's', presence: 'soon' as const, presence_updated_at: f },
      { id: 'h', presence: 'home' as const, presence_updated_at: f },
      { id: 'old', presence: 'home' as const, presence_updated_at: ago(30) },
    ];
    expect(sortByPresence(list, now).map((x) => x.id)).toEqual(['h', 's', 'a', 'n', 'old']);
  });
});

describe('etaFromNow', () => {
  it('adds minutes', () => {
    expect(new Date(etaFromNow(30, now)).getTime() - now.getTime()).toBe(30 * 60000);
  });
});
