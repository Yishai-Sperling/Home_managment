import { describe, expect, it } from '@jest/globals';
import { isMissingAutoParam } from './rpc';

describe('isMissingAutoParam', () => {
  it('detects a missing function signature', () => {
    expect(isMissingAutoParam({ code: 'PGRST202' })).toBe(true);
    expect(isMissingAutoParam({ message: 'Could not find the function public.set_presence(p_auto, ...) in the schema cache' })).toBe(true);
  });
  it('ignores other errors', () => {
    expect(isMissingAutoParam(null)).toBe(false);
    expect(isMissingAutoParam({ code: '42501', message: 'not_member' })).toBe(false);
  });
});
