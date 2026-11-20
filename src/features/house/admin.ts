import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Role } from '@/types/database';
import type { MemberWithProfile } from './hooks';

/** ממפה שגיאות DB של ניהול בית להודעה בעברית. */
export function houseAdminErrorMessage(e: unknown, fallback = 'הפעולה נכשלה, נסו שוב'): string {
  const msg = String((e as { message?: string } | null)?.message ?? '');
  if (msg.includes('last_admin')) return 'חייב להישאר לפחות מנהל אחד בבית';
  if (/permission|row-level|policy|not allowed/i.test(msg)) return 'אין לך הרשאה לבצע את הפעולה';
  if (/network|fetch/i.test(msg)) return 'בעיית תקשורת, בדקו את החיבור לאינטרנט';
  return fallback;
}

/** שינוי תפקיד דייר (מנהל/דייר). עדכון אופטימי עם רולבק; ה-DB אוכף את כלל "מנהל אחרון". */
export function useSetMemberRole(houseId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { data, error } = await supabase.from('house_members').update({ role }).eq('house_id', houseId!).eq('user_id', userId).select('user_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('permission denied');
    },
    onMutate: async ({ userId, role }) => {
      await qc.cancelQueries({ queryKey: ['house-members', houseId] });
      const prev = qc.getQueryData<MemberWithProfile[]>(['house-members', houseId]);
      qc.setQueryData<MemberWithProfile[]>(['house-members', houseId], (old) => old?.map((m) => (m.user_id === userId ? { ...m, role } : m)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(['house-members', houseId], ctx?.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['house-members', houseId] });
      qc.invalidateQueries({ queryKey: ['houses'] });
    },
  });
}

/** מחיקת בית (מנהל בלבד). אחר כך עוברים לבית אחר אם יש, אחרת מנקים את הבית הנוכחי. */
export function useDeleteHouse() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async ({ houseId, nextHouseId }: { houseId: string; nextHouseId: string | null }) => {
      const { data, error } = await supabase.from('houses').delete().eq('id', houseId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('permission denied');
      // ה-DB מאפס current_house_id; אם יש בית אחר — מעבירים אליו
      if (nextHouseId) {
        const { error: pErr } = await supabase.from('profiles').update({ current_house_id: nextHouseId }).eq('id', uid!);
        if (pErr) throw pErr;
      }
    },
    // מחזירים promise כדי שהמסך ימתין לנתונים המעודכנים לפני ניווט
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: ['houses'] }),
      qc.invalidateQueries({ queryKey: ['house-members'] }),
    ]),
  });
}
