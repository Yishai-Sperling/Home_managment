import { expect, test } from '@jest/globals';
import { canDeleteAnnouncement, parseEventDate, shiftDate, sortAnnouncements , announcementToForm, canEditAnnouncement, formToAnnouncementFields } from './helpers';
import type { Announcement } from '@/types/database';


const a = (id: string, created_at: string, created_by = 'u1'): Announcement => ({
  id, house_id: 'h', title: id, body: null, type: 'general', priority: 'normal', event_date: null, created_by, created_at,
});

test('sorts newest first', () => {
  expect(sortAnnouncements([a('1', '2026-01-01'), a('2', '2026-02-01')]).map((x) => x.id)).toEqual(['2', '1']);
});
test('delete permission', () => {
  expect(canDeleteAnnouncement(a('1', 'x'), 'u1', false)).toBe(true);
  expect(canDeleteAnnouncement(a('1', 'x'), 'u2', false)).toBe(false);
  expect(canDeleteAnnouncement(a('1', 'x'), 'u2', true)).toBe(true);
  expect(canDeleteAnnouncement(a('1', 'x'), undefined, true)).toBe(false);
});
test('date parsing and shifting', () => {
  expect(parseEventDate('2026-02-30')).toBeNull();
  expect(parseEventDate('2026-02-28')).toBe('2026-02-28');
  expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01');
  expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
});
const ann: Announcement = { id: '1', house_id: 'h', title: 'T', body: null, type: 'event', priority: 'high', event_date: '2026-01-05', created_by: 'u', created_at: 'x' };
test('edit permissions and form mapping', () => {
  expect(canEditAnnouncement(ann, 'u', false)).toBe(true);
  expect(canEditAnnouncement(ann, 'z', false)).toBe(false);
  const f = announcementToForm(ann);
  expect(f).toEqual({ title: 'T', body: '', type: 'event', priority: 'high', dateText: '2026-01-05' });
  expect(formToAnnouncementFields(f)).toEqual({ title: 'T', body: null, type: 'event', priority: 'high', event_date: '2026-01-05' });
  expect(formToAnnouncementFields({ ...f, dateText: '2026-13-40' })).toBeNull();
  expect(formToAnnouncementFields({ ...f, title: ' ' })).toBeNull();
  expect(formToAnnouncementFields({ ...f, dateText: '' })?.event_date).toBeNull();
});
