import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import { useRealtimeInvalidate } from '@/lib/realtime';
import type { PresenceStatus } from '@/types/database';
import type { MemberWithProfile } from '@/features/house/hooks';

type ProfileLite = NonNullable<MemberWithProfile['profile']>;

/** דיירי הבית עם מצב "מי בבית". מתעדכן בזמן אמת. */
export function useMembersPresence() {
  const houseId = useCurrentHouseId();
  useRealtimeInvalidate('house_members', houseId, ['presence', houseId]);
  return useQuery({
    queryKey: ['presence', houseId],
    enabled: !!houseId,
    queryFn: async (): Promise<MemberWithProfile[]> => {
      const { data, error } = await supabase.from('house_members').select('*').eq('house_id', houseId!).order('joined_at');
      if (error) throw error;
      const members = (data ?? []) as MemberWithProfile[];
      const ids = members.map((m) => m.user_id);
      const { data: profs } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
      const byId = new Map(((profs ?? []) as ProfileLite[]).map((p) => [p.id, p]));
      return members.map((m) => ({ ...m, profile: byId.get(m.user_id) }));
    },
  });
}

/** עדכון הסטטוס של המשתמש הנוכחי (null = ניקוי). אופטימי עם rollback. */
export function useSetPresence() {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (v: { status: PresenceStatus | null; eta?: string | null }) => {
      const { error } = await supabase.rpc('set_presence', { p_house: houseId, p_status: v.status, p_eta: v.eta ?? null });
      if (error) throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['presence', houseId] });
      const prev = qc.getQueryData<MemberWithProfile[]>(['presence', houseId]);
      qc.setQueryData<MemberWithProfile[]>(['presence', houseId], (old) => old?.map((m) => m.user_id === uid
        ? { ...m, presence: v.status, presence_eta: v.status === 'soon' ? v.eta ?? null : null, presence_updated_at: new Date().toISOString() }
        : m));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(['presence', houseId], ctx?.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['presence', houseId] }); },
  });
}
