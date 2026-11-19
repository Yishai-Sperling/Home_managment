import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { Announcement, AnnouncementType, Priority } from '@/types/database';
import { sortAnnouncements } from './helpers';

const key = (houseId: string | null) => ['announcements', houseId] as const;

export function useAnnouncements() {
  const houseId = useCurrentHouseId();
  const qc = useQueryClient();

  useEffect(() => {
    if (!houseId) return;
    const channel = supabase
      .channel(`announcements:${houseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements', filter: `house_id=eq.${houseId}` },
        () => qc.invalidateQueries({ queryKey: key(houseId) }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [houseId, qc]);

  return useQuery({
    queryKey: key(houseId),
    enabled: !!houseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements').select('*').eq('house_id', houseId!).order('created_at', { ascending: false });
      if (error) throw error;
      return sortAnnouncements(data as Announcement[]);
    },
  });
}

export interface NewAnnouncement {
  title: string;
  body: string | null;
  type: AnnouncementType;
  priority: Priority;
  event_date: string | null;
}

export function useAddAnnouncement() {
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewAnnouncement) => {
      const { data, error } = await supabase
        .from('announcements')
        .insert({ ...input, house_id: houseId!, created_by: session!.user.id })
        .select().single();
      if (error) throw error;
      return data as Announcement;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<Announcement[]>(key(houseId));
      const optimistic: Announcement = {
        ...input, id: `tmp-${Date.now()}`, house_id: houseId!, created_by: session!.user.id, created_at: new Date().toISOString(),
      };
      qc.setQueryData<Announcement[]>(key(houseId), (old) => [optimistic, ...(old ?? [])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

export function useDeleteAnnouncement() {
  const houseId = useCurrentHouseId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<Announcement[]>(key(houseId));
      qc.setQueryData<Announcement[]>(key(houseId), (old) => (old ?? []).filter((a) => a.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

/** האם המשתמש הנוכחי מנהל בבית הנוכחי. */
export function useIsAdmin() {
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
