import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { ShoppingCategory, ShoppingItem, ShoppingStatus } from '@/types/database';
import { mergeHistory, type HistoryRow } from './helpers';

export type ShoppingFilter = 'all' | ShoppingStatus;

const baseKey = (houseId: string | null) => ['shopping', houseId] as const;
const listKey = (houseId: string | null, filter: ShoppingFilter) => ['shopping', houseId, filter] as const;

export function useShoppingItems(houseId: string | null, filter: ShoppingFilter = 'all') {

  useRealtimeInvalidate('shopping_items', houseId, baseKey(houseId));

  return useQuery({
    queryKey: listKey(houseId, filter),
    enabled: !!houseId,
    queryFn: async () => {
      let q = supabase.from('shopping_items').select('*').eq('house_id', houseId!);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data as ShoppingItem[];
    },
  });
}

type Snapshot = [readonly unknown[], ShoppingItem[] | undefined][];

function useOptimistic<V>(patch: (items: ShoppingItem[], v: V) => ShoppingItem[]) {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  return {
    async onMutate(v: V) {
      await qc.cancelQueries({ queryKey: baseKey(houseId) });
      const prev = qc.getQueriesData<ShoppingItem[]>({ queryKey: baseKey(houseId) }) as Snapshot;
      qc.setQueriesData<ShoppingItem[]>({ queryKey: baseKey(houseId) }, (old) => (old ? patch(old, v) : old));
      return { prev };
    },
    onError(_e: unknown, _v: V, ctx?: { prev: Snapshot }) {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled() { qc.invalidateQueries({ queryKey: baseKey(houseId) }); },
  };
}

export interface NewItem { id: string; name: string; quantity?: string; category: ShoppingCategory }

export function useAddItem() {
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const userId = session?.user.id;
  const opt = useOptimistic<NewItem>((items, v) => [
    {
      id: v.id, house_id: houseId ?? '', name: v.name, quantity: v.quantity?.trim() || null,
      category: v.category, status: 'pending', added_by: userId ?? '', created_at: new Date().toISOString(),
    },
    ...items,
  ]);
  return useMutation({
    mutationFn: async (v: NewItem) => {
      if (!houseId || !userId) throw new Error('אין בית פעיל');
      const { error } = await supabase.from('shopping_items').insert({
        id: v.id, house_id: houseId, name: v.name.trim(), quantity: v.quantity?.trim() || null,
        category: v.category, status: 'pending', added_by: userId,
      });
      if (error) throw error;
    },
    ...opt,
  });
}

export function useToggleBought() {
  const opt = useOptimistic<ShoppingItem>((items, it) =>
    items.map((x) => (x.id === it.id ? { ...x, status: it.status === 'bought' ? 'pending' : 'bought' } : x)));
  return useMutation({
    mutationFn: async (it: ShoppingItem) => {
      const { error } = await supabase.from('shopping_items')
        .update({ status: it.status === 'bought' ? 'pending' : 'bought' }).eq('id', it.id);
      if (error) throw error;
    },
    ...opt,
  });
}

export interface ItemPatch { id: string; name: string; quantity: string | null; category: ShoppingCategory }

export function useUpdateItem() {
  const opt = useOptimistic<ItemPatch>((items, p) =>
    items.map((x) => (x.id === p.id ? { ...x, name: p.name, quantity: p.quantity, category: p.category } : x)));
  return useMutation({
    mutationFn: async (p: ItemPatch) => {
      const { error } = await supabase.from('shopping_items')
        .update({ name: p.name, quantity: p.quantity, category: p.category }).eq('id', p.id);
      if (error) throw error;
    },
    ...opt,
  });
}

/** מוחק את כל הפריטים שנקנו בבית (שאילתה אחת). */
export function useClearBought() {
  const houseId = useCurrentHouseId();
  const opt = useOptimistic<void>((items) => items.filter((x) => x.status !== 'bought'));
  return useMutation({
    mutationFn: async () => {
      if (!houseId) throw new Error('אין בית פעיל');
      const { error } = await supabase.from('shopping_items').delete().eq('house_id', houseId).eq('status', 'bought');
      if (error) throw error;
    },
    ...opt,
  });
}

/** היסטוריית פריטים (300 אחרונים, כולל שנקנו) להצעות שמות. מפתח נפרד כדי שמחיקה אופטימית של הרשימה לא תשפיע עליו. */
const historyKey = (houseId: string) => `shopping-history:${houseId}`;

export function useShoppingHistory(houseId: string | null) {
  useRealtimeInvalidate('shopping_items', houseId, ['shopping-history', houseId]);
  return useQuery({
    queryKey: ['shopping-history', houseId],
    enabled: !!houseId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('shopping_items')
        .select('name, category, status, created_at').eq('house_id', houseId!)
        .order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      const server = data as HistoryRow[];
      let stored: HistoryRow[] = [];
      try {
        const raw = await AsyncStorage.getItem(historyKey(houseId!));
        if (raw) stored = (JSON.parse(raw) as HistoryRow[]).map((r) => ({ ...r, status: 'bought' as const }));
      } catch { /* אין עותק שמור */ }
      // פריטים שנמחקו מהשרת נשארים רק כהיסטוריה (status bought), כך שלא ייחשבו ממתינים
      const merged = mergeHistory(server, stored);
      try { await AsyncStorage.setItem(historyKey(houseId!), JSON.stringify(merged)); } catch { /* לא קריטי */ }
      return merged;
    },
  });
}

/** מפה userId -> שם מלא לחברי הבית. */
export function useMemberNames(houseId: string | null) {
  return useQuery({
    queryKey: ['shopping-members', houseId],
    enabled: !!houseId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: members, error } = await supabase.from('house_members').select('user_id').eq('house_id', houseId!);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id as string);
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        (profiles ?? []).forEach((p) => { if (p.full_name) names[p.id as string] = p.full_name as string; });
      }
      return names;
    },
  });
}

export function useDeleteItem() {
  const opt = useOptimistic<string>((items, id) => items.filter((x) => x.id !== id));
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shopping_items').delete().eq('id', id);
      if (error) throw error;
    },
    ...opt,
  });
}
