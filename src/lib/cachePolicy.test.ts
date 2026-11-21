import { describe, expect, it } from '@jest/globals';
import { shouldPersistQuery } from './cachePolicy';

describe('shouldPersistQuery', () => {
  it('persists successful data queries', () => {
    expect(shouldPersistQuery(['shopping', 'h1', 'all'], 'success')).toBe(true);
    expect(shouldPersistQuery(['car', 'h1'], 'success')).toBe(true);
  });
  it('skips failed or pending queries and signed image urls', () => {
    expect(shouldPersistQuery(['shopping', 'h1'], 'error')).toBe(false);
    expect(shouldPersistQuery(['car', 'h1'], 'pending')).toBe(false);
    expect(shouldPersistQuery(['issue-image', 'a/b.jpg'], 'success')).toBe(false);
  });
});
