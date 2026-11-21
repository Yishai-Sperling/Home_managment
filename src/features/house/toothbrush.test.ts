import { describe, expect, it } from '@jest/globals';
import { brushColorName, isBrushColor, takenByOthers, TOOTHBRUSH_COLORS } from './toothbrushColors';

describe('toothbrush colors', () => {
  it('has unique valid hex colors with Hebrew names', () => {
    const hexes = TOOTHBRUSH_COLORS.map((c) => c.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(hexes.length);
    TOOTHBRUSH_COLORS.forEach((c) => {
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.name.length).toBeGreaterThan(0);
    });
  });
  it('recognizes palette colors case-insensitively and names them', () => {
    expect(isBrushColor('#ef4444')).toBe(true);
    expect(isBrushColor('#123456')).toBe(false);
    expect(isBrushColor(null)).toBe(false);
    expect(brushColorName('#EF4444')).toBe('אדום');
    expect(brushColorName('#000000')).toBeNull();
  });
  it('lists colors taken by other members only', () => {
    const members = [
      { user_id: 'me', profile: { full_name: 'ישי ספרלינג', toothbrush_color: '#EF4444' } },
      { user_id: 'a', profile: { full_name: 'דנה כהן', toothbrush_color: '#3B82F6' } },
      { user_id: 'b', profile: { full_name: 'גיל', toothbrush_color: null } },
      { user_id: 'c' },
    ];
    const taken = takenByOthers(members, 'me');
    expect([...taken.entries()]).toEqual([['#3b82f6', 'דנה']]);
  });
});
