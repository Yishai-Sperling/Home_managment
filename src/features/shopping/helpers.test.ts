import { describe, expect, it } from '@jest/globals';
import { groupByCategory, mergeHistory, suggestNames, type HistoryRow } from './helpers';
import type { ShoppingItem } from '@/types/database';

const h = (name: string, created_at: string, status: 'pending' | 'bought' = 'bought', category: HistoryRow['category'] = 'groceries'): HistoryRow =>
  ({ name, created_at, status, category });

describe('suggestNames', () => {
  it('returns nothing for empty text', () => {
    expect(suggestNames([h('חלב', '2026-01-01')], '  ')).toEqual([]);
  });
  it('dedupes case-insensitively and uses latest category', () => {
    const r = suggestNames([h('Milk', '2026-01-01', 'bought', 'groceries'), h('milk', '2026-02-01', 'bought', 'other')], 'mi');
    expect(r).toEqual([{ name: 'milk', category: 'other' }]);
  });
  it('excludes names currently pending', () => {
    const r = suggestNames([h('חלב', '2026-01-01'), h('חלב', '2026-02-01', 'pending'), h('חלה', '2026-01-02')], 'חל');
    expect(r.map((s) => s.name)).toEqual(['חלה']);
  });
  it('orders by frequency then recency and caps', () => {
    const rows = [h('אבטיח', '2026-01-01'), h('אבוקדו', '2026-03-01'), h('אבוקדו', '2026-03-02'), h('אבקה', '2026-04-01')];
    expect(suggestNames(rows, 'אב').map((s) => s.name)).toEqual(['אבוקדו', 'אבקה', 'אבטיח']);
    expect(suggestNames(rows, 'אב', 2)).toHaveLength(2);
  });
  it('excludes exact match of typed text', () => {
    expect(suggestNames([h('חלב', '2026-01-01')], 'חלב')).toEqual([]);
  });
});

describe('groupByCategory', () => {
  const mk = (id: string, category: ShoppingItem['category']): ShoppingItem => ({
    id, house_id: 'h', name: id, quantity: null, category, status: 'pending', added_by: 'u', created_at: '',
  });
  it('groups in fixed order with headers and skips empty categories', () => {
    const rows = groupByCategory([mk('a', 'other'), mk('b', 'groceries'), mk('c', 'other')]);
    expect(rows.map((r) => r.key)).toEqual(['h:groceries', 'b', 'h:other', 'a', 'c']);
  });
  it('returns empty for no items', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe('mergeHistory', () => {
  const row = (name: string, created_at: string, status: HistoryRow['status'] = 'bought'): HistoryRow => ({ name, category: 'groceries', status, created_at });
  it('keeps stored rows that no longer exist on the server and removes duplicates', () => {
    const server = [row('חלב', '2026-11-02', 'pending')];
    const stored = [row('חלב', '2026-11-02'), row('לחם', '2026-11-01')];
    const merged = mergeHistory(server, stored);
    expect(merged.map((r) => r.name)).toEqual(['חלב', 'לחם']);
    expect(merged[0].status).toBe('pending');
  });
  it('caps the list size, newest first', () => {
    const many = Array.from({ length: 10 }, (_, i) => row(`p${i}`, `2026-11-${String(10 + i)}`));
    expect(mergeHistory(many, [], 3).map((r) => r.name)).toEqual(['p9', 'p8', 'p7']);
  });
});
