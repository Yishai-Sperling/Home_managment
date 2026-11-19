import { describe, expect, it } from '@jest/globals';
import { uuid } from './uuid';

describe('uuid', () => {
  it('returns a valid v4 uuid', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('is unique across calls', () => {
    expect(new Set(Array.from({ length: 200 }, uuid)).size).toBe(200);
  });
});
