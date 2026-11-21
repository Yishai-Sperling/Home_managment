import { expect, test } from '@jest/globals';
import {
  canDeleteInfo, emptyInfoForm, maskValue, normalizeUrl, phoneToTel, relativeTimeText, sortInfoItems, validateInfo,
} from './helpers';
import type { HouseInfoItem } from '@/types/database';

const item = (id: string, label: string, kind: HouseInfoItem['kind'], by = 'u1'): HouseInfoItem => ({
  id, house_id: 'h', label, value: 'v', kind, is_secret: false, created_by: by, created_at: 'x', updated_at: 'x',
});

test('validation', () => {
  expect(validateInfo(emptyInfoForm)).toEqual({ label: 'יש להזין כותרת', value: 'יש להזין ערך' });
  expect(validateInfo({ ...emptyInfoForm, label: ' a ', value: 'b' })).toEqual({});
  expect(validateInfo({ ...emptyInfoForm, label: 'a'.repeat(81), value: 'b' }).label).toBeDefined();
  expect(validateInfo({ ...emptyInfoForm, label: 'a', value: 'b'.repeat(501) }).value).toBeDefined();
  expect(validateInfo({ ...emptyInfoForm, label: 'a'.repeat(80), value: 'b'.repeat(500) })).toEqual({});
});
test('normalizeUrl', () => {
  expect(normalizeUrl('example.com')).toBe('https://example.com');
  expect(normalizeUrl(' http://a.co/x ')).toBe('http://a.co/x');
  expect(normalizeUrl('HTTPS://a.co')).toBe('HTTPS://a.co');
  expect(normalizeUrl('localhost:8080/x')).toBe('https://localhost:8080/x');
  expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  expect(normalizeUrl('mailto:a@b.c')).toBeNull();
  expect(normalizeUrl('ftp://a.co')).toBeNull();
  expect(normalizeUrl('two words')).toBeNull();
  expect(normalizeUrl('')).toBeNull();
});
test('maskValue', () => {
  expect(maskValue('abc', true, false)).toBe('••••');
  expect(maskValue('abc', true, true)).toBe('abc');
  expect(maskValue('abc', false, false)).toBe('abc');
});
test('phoneToTel', () => { expect(phoneToTel('050-123 4567')).toBe('0501234567'); });
test('relative time', () => {
  const now = new Date('2026-06-10T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  expect(relativeTimeText(ago(10_000), now)).toBe('עודכן הרגע');
  expect(relativeTimeText(ago(5 * 60_000), now)).toBe('עודכן לפני 5 דקות');
  expect(relativeTimeText(ago(3 * 3600_000), now)).toBe('עודכן לפני 3 שעות');
  expect(relativeTimeText(ago(86400_000), now)).toBe('עודכן אתמול');
  expect(relativeTimeText(ago(5 * 86400_000), now)).toBe('עודכן לפני 5 ימים');
  expect(relativeTimeText(ago(70 * 86400_000), now)).toBe('עודכן לפני חודשיים');
  expect(relativeTimeText('bad', now)).toBe('');
});
test('sorting by kind then label', () => {
  const s = sortInfoItems([item('1', 'ב', 'phone'), item('2', 'א', 'phone'), item('3', 'z', 'text')]);
  expect(s.map((x) => x.id)).toEqual(['3', '2', '1']);
});
test('delete permission', () => {
  expect(canDeleteInfo(item('1', 'a', 'text'), 'u1', false)).toBe(true);
  expect(canDeleteInfo(item('1', 'a', 'text'), 'u2', false)).toBe(false);
  expect(canDeleteInfo(item('1', 'a', 'text'), 'u2', true)).toBe(true);
});
