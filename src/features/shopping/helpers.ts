import type { ShoppingCategory, ShoppingItem } from '@/types/database';

export const CATEGORY_ORDER: ShoppingCategory[] = ['groceries', 'cleaning', 'pharmacy', 'other'];

export interface HistoryRow {
  name: string;
  category: ShoppingCategory;
  status: ShoppingItem['status'];
  created_at: string;
}

export interface NameSuggestion { name: string; category: ShoppingCategory }

const norm = (s: string) => s.trim().toLocaleLowerCase();

/**
 * הצעות שמות מההיסטוריה: שמות ייחודיים (בלי הבדל אותיות), בלי פריטים שממתינים כרגע,
 * מסוננים לפי הטקסט שהוקלד; הנפוצים ואז האחרונים קודם. הקטגוריה היא של השימוש האחרון.
 */
export function suggestNames(history: HistoryRow[], typed: string, max = 8): NameSuggestion[] {
  const q = norm(typed);
  if (!q) return [];
  const pending = new Set(history.filter((h) => h.status === 'pending').map((h) => norm(h.name)));
  const map = new Map<string, { name: string; category: ShoppingCategory; last: string; count: number }>();
  for (const h of history) {
    const key = norm(h.name);
    if (!key || pending.has(key) || key === q || !key.includes(q)) continue;
    const cur = map.get(key);
    if (!cur) map.set(key, { name: h.name.trim(), category: h.category, last: h.created_at, count: 1 });
    else {
      cur.count += 1;
      if (h.created_at > cur.last) { cur.last = h.created_at; cur.category = h.category; cur.name = h.name.trim(); }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
    .slice(0, max)
    .map(({ name, category }) => ({ name, category }));
}

export type ShoppingRow =
  | { type: 'header'; key: string; category: ShoppingCategory }
  | { type: 'item'; key: string; item: ShoppingItem };

/** מקבץ לפי קטגוריה (סדר קבוע), משמר את סדר הפריטים בתוך כל קבוצה. מפתחות יציבים. */
export function groupByCategory(items: ShoppingItem[]): ShoppingRow[] {
  const rows: ShoppingRow[] = [];
  for (const category of CATEGORY_ORDER) {
    const inCat = items.filter((i) => i.category === category);
    if (!inCat.length) continue;
    rows.push({ type: 'header', key: `h:${category}`, category });
    for (const item of inCat) rows.push({ type: 'item', key: item.id, item });
  }
  return rows;
}

export function flatRows(items: ShoppingItem[]): ShoppingRow[] {
  return items.map((item) => ({ type: 'item' as const, key: item.id, item }));
}
