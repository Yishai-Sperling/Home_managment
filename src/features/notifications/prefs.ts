import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProfile, useSession } from '@/lib/session';
import type { NotifyPrefs, Profile } from '@/types/database';
import { mergePrefs } from './mergePrefs';

export { mergePrefs };

export const NOTIFY_PREF_LABELS: { key: keyof NotifyPrefs; label: string }[] = [
  { key: 'shopping', label: 'קניות' },
  { key: 'car', label: 'רכב' },
  { key: 'announcements', label: 'מודעות' },
  { key: 'issues', label: 'תקלות' },
];

/** קריאה/כתיבה של profiles.notify_prefs של המשתמש הנוכחי, עם עדכון אופטימי ורולבק. */
export function useNotifyPrefs() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  const profile = useProfile().data;
  const prefs = mergePrefs(profile?.notify_prefs);

  const mutation = useMutation({
    mutationFn: async (next: NotifyPrefs) => {
      const { error } = await supabase.from('profiles').update({ notify_prefs: next }).eq('id', uid!);
      if (error) throw error;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['profile', uid] });
      const prev = qc.getQueryData<Profile>(['profile', uid]);
      if (prev) qc.setQueryData<Profile>(['profile', uid], { ...prev, notify_prefs: next });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['profile', uid], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['profile'] }); },
  });

  function setPref(key: keyof NotifyPrefs, value: boolean) {
    if (!uid) return;
    // ממזגים מול המצב העדכני בקאש כדי שמעבר מהיר בין מתגים לא ידרוס
    const latest = mergePrefs(qc.getQueryData<Profile>(['profile', uid])?.notify_prefs);
    mutation.mutate({ ...latest, [key]: value });
  }

  return { prefs, setPref, isError: mutation.isError };
}
