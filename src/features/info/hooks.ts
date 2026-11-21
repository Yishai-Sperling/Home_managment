import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { HouseInfoItem, HouseInfoKind } from '@/types/database';
import { sortInfoItems } from './helpers';

const key = (houseId: string | null) => ['house-info', houseId] as const;

export function useInfoItems() {
  const houseId = useCurrentHouseId();
  useRealtimeInvalidate('house_info_items', houseId, key(houseId));
  return useQuery({
    queryKey: key(houseId),
    enabled: !!houseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('house_info_items').select('*').eq('house_id', houseId!);
      if (error) throw error;
      return sortInfoItems(data as HouseInfoItem[]);
    },
  });
}

export interface InfoFields { label: string; value: string; kind: HouseInfoKind; is_secret: boolean }
export interface NewInfo extends InfoFields { id: string }

export function useAddInfo() {
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewInfo) => {
      const { error } = await supabase.from('house_info_items').insert({ ...input, house_id: houseId! });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<HouseInfoItem[]>(key(houseId));
      const now = new Date().toISOString();
      const optimistic: HouseInfoItem = { ...input, house_id: houseId!, created_by: session!.user.id, created_at: now, updated_at: now };
      qc.setQueryData<HouseInfoItem[]>(key(houseId), sortInfoItems([...(prev ?? []), optimistic]));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

export function useUpdateInfo() {
  const houseId = useCurrentHouseId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: InfoFields & { id: string }) => {
      const { error } = await supabase.from('house_info_items')
        .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<HouseInfoItem[]>(key(houseId));
      const now = new Date().toISOString();
      qc.setQueryData<HouseInfoItem[]>(key(houseId), sortInfoItems((prev ?? []).map((i) => (i.id === v.id ? { ...i, ...v, updated_at: now } : i))));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

export function useDeleteInfo() {
  const houseId = useCurrentHouseId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('house_info_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<HouseInfoItem[]>(key(houseId));
      qc.setQueryData<HouseInfoItem[]>(key(houseId), (old) => (old ?? []).filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

/** האם המשתמש הנוכחי מנהל בבית (אותו מפתח מטמון כמו בהודעות). */
export function useInfoIsAdmin() {
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const userId = session?.user.id;
  const q = useQuery({
    queryKey: ['is-admin', houseId, userId],
    enabled: !!houseId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('house_members').select('role').eq('house_id', houseId!).eq('user_id', userId!).maybeSingle();
      if (error) throw error;
      return data?.role === 'admin';
    },
  });
  return q.data ?? false;
}
