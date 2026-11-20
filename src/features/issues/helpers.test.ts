import { expect, test } from '@jest/globals';
import { canEditIssue, filterIssues, formToIssueFields, issueImagePath, issueToForm, memberNameMap, sortIssues } from './helpers';
import type { Issue } from '@/types/database';

const i = (id: string, status: Issue['status'], urgency: Issue['urgency'], created_at: string): Issue => ({
  id, house_id: 'h', title: id, description: null, category: 'general', urgency, status, image_path: null, assignee_id: null, created_by: 'u', created_at,
});

test('filters by status', () => {
  const l = [i('1', 'open', 'low', 'a'), i('2', 'closed', 'low', 'b')];
  expect(filterIssues(l, 'all')).toHaveLength(2);
  expect(filterIssues(l, 'closed').map((x) => x.id)).toEqual(['2']);
});
test('sorts open first, urgent first, newest first', () => {
  const l = [i('c', 'closed', 'urgent', '3'), i('o1', 'open', 'low', '1'), i('o2', 'open', 'urgent', '0'), i('o3', 'open', 'low', '2')];
  expect(sortIssues(l).map((x) => x.id)).toEqual(['o2', 'o3', 'o1', 'c']);
});
test('image path', () => {
  expect(issueImagePath('house', 'abc')).toBe('house/abc.jpg');
  expect(issueImagePath('house')).toMatch(/^house\/[0-9a-f-]{36}\.jpg$/);
});

test('canEditIssue: creator or admin', () => {
  const x = i('1', 'open', 'low', 'a');
  expect(canEditIssue(x, 'u', false)).toBe(true);
  expect(canEditIssue(x, 'other', false)).toBe(false);
  expect(canEditIssue(x, 'other', true)).toBe(true);
  expect(canEditIssue(x, undefined, true)).toBe(false);
});
test('issue form round trip and validation', () => {
  const x = i('1', 'open', 'low', 'a');
  expect(issueToForm(x).description).toBe('');
  expect(formToIssueFields({ ...issueToForm(x), title: '  new ', description: ' ' })).toEqual({ title: 'new', description: null, category: 'general', urgency: 'low' });
  expect(formToIssueFields({ ...issueToForm(x), title: ' ' })).toBeNull();
});
test('memberNameMap', () => {
  const m = memberNameMap([{ user_id: 'a', profile: { id: 'a', full_name: 'דנה', phone: null } }, { user_id: 'b' }]);
  expect(m.get('a')).toBe('דנה');
  expect(m.get('b')).toBe('דייר');
});
