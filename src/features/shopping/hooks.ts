import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { ShoppingCategory, ShoppingItem, ShoppingStatus } from '@/types/database';

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
