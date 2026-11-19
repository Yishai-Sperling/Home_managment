import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { HouseMember, Issue, IssueCategory, IssueStatus, IssueUrgency } from '@/types/database';
import { filterIssues, issueImagePath, sortIssues, type IssueFilter } from './helpers';

const key = (houseId: string | null) => ['issues', houseId] as const;
const BUCKET = 'issue-images';
const MAX_WIDTH = 1600;

export function useIssues(filter: IssueFilter = 'all') {
  const houseId = useCurrentHouseId();

  useRealtimeInvalidate('issues', houseId, key(houseId));

  return useQuery({
    queryKey: key(houseId),
    enabled: !!houseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('issues').select('*').eq('house_id', houseId!);
      if (error) throw error;
      return data as Issue[];
    },
    select: (all) => sortIssues(filterIssues(all, filter)),
  });
}

export interface NewIssue {
  id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  urgency: IssueUrgency;
  assignee_id: string | null;
  /** URI מקומי של תמונה (אופציונלי) */
  imageUri?: string | null;
}

/** מקטין לרוחב מקסימלי, ממיר ל-JPEG (גם HEIC) ומעלה כ-ArrayBuffer מ-base64. */
async function uploadImage(houseId: string, uri: string): Promise<string> {
  const path = issueImagePath(houseId);
  const loaded = await ImageManipulator.manipulate(uri).renderAsync();
  const ref = loaded.width > MAX_WIDTH
    ? await ImageManipulator.manipulate(loaded).resize({ width: MAX_WIDTH }).renderAsync()
    : loaded;
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('המרת התמונה נכשלה');
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(saved.base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export function useReportIssue() {
  const houseId = useCurrentHouseId();
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ imageUri, ...input }: NewIssue) => {
      const image_path = imageUri ? await uploadImage(houseId!, imageUri) : null;
      const { data, error } = await supabase
        .from('issues')
        .insert({ ...input, image_path, house_id: houseId!, created_by: session!.user.id, status: 'open' })
        .select().single();
      if (error) {
        if (image_path) await supabase.storage.from(BUCKET).remove([image_path]);
        throw error;
      }
      return data as Issue;
    },
    onMutate: async ({ imageUri: _img, ...input }) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<Issue[]>(key(houseId));
      const optimistic: Issue = {
        ...input, house_id: houseId!, status: 'open', image_path: null,
        created_by: session!.user.id, created_at: new Date().toISOString(),
      };
      qc.setQueryData<Issue[]>(key(houseId), (old) => [optimistic, ...(old ?? [])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

function usePatchIssue<V extends { id: string }>(patchOf: (v: V) => Partial<Issue>) {
  const houseId = useCurrentHouseId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await supabase.from('issues').update(patchOf(v)).eq('id', v.id);
      if (error) throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<Issue[]>(key(houseId));
      qc.setQueryData<Issue[]>(key(houseId), (old) => (old ?? []).map((i) => (i.id === v.id ? { ...i, ...patchOf(v) } : i)));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

export const useUpdateIssueStatus = () =>
  usePatchIssue<{ id: string; status: IssueStatus }>((v) => ({ status: v.status }));

export const useAssignIssue = () =>
  usePatchIssue<{ id: string; assignee_id: string | null }>((v) => ({ assignee_id: v.assignee_id }));

export function useDeleteIssue() {
  const houseId = useCurrentHouseId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (issue: Issue) => {
      const { error } = await supabase.from('issues').delete().eq('id', issue.id);
      if (error) throw error;
      if (issue.image_path) await supabase.storage.from(BUCKET).remove([issue.image_path]);
    },
    onMutate: async (issue) => {
      await qc.cancelQueries({ queryKey: key(houseId) });
      const prev = qc.getQueryData<Issue[]>(key(houseId));
      qc.setQueryData<Issue[]>(key(houseId), (old) => (old ?? []).filter((i) => i.id !== issue.id));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key(houseId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(houseId) }),
  });
}

/** כתובת חתומה לתמונת תקלה. */
export function useIssueImageUrl(path: string | null) {
  return useQuery({
    queryKey: ['issue-image', path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** חברי הבית עם שמות (שתי שאילתות, בלי תלות ב-FK). */
export function useIssueHouseMembers() {
  const houseId = useCurrentHouseId();
  return useQuery({
    queryKey: ['issue-house-members', houseId],
    enabled: !!houseId,
    queryFn: async () => {
      const { data: members, error } = await supabase.from('house_members').select('*').eq('house_id', houseId!);
      if (error) throw error;
      const ids = (members as HouseMember[]).map((m) => m.user_id);
      const { data: profiles, error: e2 } = await supabase.from('profiles').select('id, full_name, phone').in('id', ids);
      if (e2) throw e2;
      return (members as HouseMember[]).map((m) => ({ ...m, profile: profiles?.find((p) => p.id === m.user_id) }));
    },
  });
}

export const memberName = (m?: HouseMember | null) => m?.profile?.full_name || 'דייר';
