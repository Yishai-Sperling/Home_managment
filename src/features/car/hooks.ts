import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { CarReservation, Role } from '@/types/database';
import { hasOverlap } from './overlap';

const key = (houseId: string | null) => ['car', houseId] as const;

export const OVERLAP_MESSAGE = 'הרכב כבר תפוס בחלון הזמן הזה';

export function useReservations(houseId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!houseId) return;
    const channel = supabase
      .channel(`car:${houseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'car_reservations', filter: `house_id=eq.${houseId}` },
        () => { qc.invalidateQueries({ queryKey: key(houseId) }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [houseId, qc]);

  return useQuery({
    queryKey: key(houseId),
    enabled: !!houseId,
    queryFn: async () => {
      // רק הזמנות שלא הסתיימו
      const { data, error } = await supabase.from('car_reservations').select('*')
        .eq('house_id', houseId!).gt('ends_at', new Date().toISOString()).order('starts_at', { ascending: true });
      if (error) throw error;
      return data as CarReservation[];
    },
  });
}

export interface NewReservation { starts_at: Date; ends_at: Date; purpose?: string; notes?: string }

export function useCreateReservation() {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (v: NewReservation) => {
      if (!houseId || !session) throw new Error('אין בית פעיל');
      if (v.ends_at <= v.starts_at) throw new Error('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      const existing = qc.getQueryData<CarReservation[]>(key(houseId)) ?? [];
      if (hasOverlap(existing, v.starts_at, v.ends_at)) throw new Error(OVERLAP_MESSAGE);
      const { error } = await supabase.from('car_reservations').insert({
        house_id: houseId, user_id: session.user.id,
        starts_at: v.starts_at.toISOString(), ends_at: v.ends_at.toISOString(),
        purpose: v.purpose?.trim() || null, notes: v.notes?.trim() || null,
      });
      if (error) {
        if (error.code === '23P01') throw new Error(OVERLAP_MESSAGE);
        throw new Error('שמירת ההזמנה נכשלה, נסו שוב');
      }
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: key(houseId) }); },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('car_reservations').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<CarReservation[]>(key(houseId));
      qc.setQueryData<CarReservation[]>(key(houseId), (old) => old?.filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { qc.setQueryData(key(houseId), ctx?.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: key(houseId) }); },
  });
}

/** תפקיד המשתמש בבית + מפה של שמות חברי הבית. */
export function useHouseDirectory(houseId: string | null) {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ['car-directory', houseId, uid],
    enabled: !!houseId && !!uid,
    queryFn: async () => {
      const { data: members, error } = await supabase.from('house_members').select('user_id, role').eq('house_id', houseId!);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id as string);
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        (profiles ?? []).forEach((p) => { if (p.full_name) names[p.id as string] = p.full_name as string; });
      }
      const me = (members ?? []).find((m) => m.user_id === uid);
      return { isAdmin: (me?.role as Role | undefined) === 'admin', names };
    },
  });
}
