import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useProfile, useSession } from '@/lib/session';
import type { House, HouseMember, Profile, Role } from '@/types/database';

export type HouseWithRole = House & { role: Role };

/** כל הבתים שהמשתמש חבר בהם. */
export function useHouses() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ['houses', uid],
    enabled: !!uid,
    queryFn: async (): Promise<HouseWithRole[]> => {
      const { data, error } = await supabase
        .from('house_members')
        .select('role, joined_at, house:houses(*)')
        .eq('user_id', uid!)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as { role: Role; house: House | null }[])
        .filter((r) => r.house)
        .map((r) => ({ ...(r.house as House), role: r.role }));
    },
  });
}

/** הבית הנוכחי (לפי profiles.current_house_id). */
export function useCurrentHouse() {
  const houseId = useCurrentHouseId();
  const houses = useHouses();
  const house = houses.data?.find((h) => h.id === houseId) ?? null;
  return { house, role: house?.role ?? null, isAdmin: house?.role === 'admin', isLoading: houses.isLoading, houseId };
}

export function useSwitchHouse() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (houseId: string) => {
      const { error } = await supabase.from('profiles').update({ current_house_id: houseId }).eq('id', uid!);
      if (error) throw error;
    },
    onMutate: async (houseId) => {
      await qc.cancelQueries({ queryKey: ['profile', uid] });
      const prev = qc.getQueryData<Profile>(['profile', uid]);
      if (prev) qc.setQueryData<Profile>(['profile', uid], { ...prev, current_house_id: houseId });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['profile', uid], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['profile'] }); },
  });
}

export type MemberWithProfile = HouseMember & { profile?: Pick<Profile, 'id' | 'full_name' | 'phone'> & { toothbrush_color?: string | null } };

export function useHouseMembers() {
  const houseId = useCurrentHouseId();
  return useQuery({
    queryKey: ['house-members', houseId],
    enabled: !!houseId,
    queryFn: async (): Promise<MemberWithProfile[]> => {
      const { data, error } = await supabase.from('house_members').select('*').eq('house_id', houseId!).order('joined_at');
      if (error) throw error;
      const members = (data ?? []) as HouseMember[];
      const ids = members.map((m) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('*').in('id', ids)
        : { data: [] };
      const byId = new Map(((profs ?? []) as (Pick<Profile, 'id' | 'full_name' | 'phone'> & { toothbrush_color?: string | null })[]).map((p) => [p.id, p]));
      return members.map((m) => ({ ...m, profile: byId.get(m.user_id) }));
    },
  });
}

/** הסרת דייר (מנהל בלבד, נאכף ע"י RLS). עדכון אופטימי של הרשימה. */
export function useRemoveMember() {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('house_members').delete().eq('house_id', houseId!).eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ['house-members', houseId] });
      const prev = qc.getQueryData<MemberWithProfile[]>(['house-members', houseId]);
      qc.setQueryData<MemberWithProfile[]>(['house-members', houseId], (old) => old?.filter((m) => m.user_id !== userId));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(['house-members', houseId], ctx?.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['house-members', houseId] }); },
  });
}

/**
 * עזיבת הבית הנוכחי. כלל פשוט: מנהל יחיד שנשארו אחריו דיירים אחרים לא יכול לעזוב
 * (קודם צריך להסיר אותם / למנות מנהל אחר). אם הוא האחרון בבית — מותר.
 * אחרי העזיבה עוברים לבית אחר, או לאונבורדינג אם אין.
 */
export function useLeaveHouse() {
  const qc = useQueryClient();
  const { session } = useSession();
  const profile = useProfile().data;
  const houses = useHouses().data;
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async () => {
      const houseId = profile?.current_house_id;
      if (!houseId || !uid) throw new Error('אין בית נוכחי');
      const { data: members, error: mErr } = await supabase.from('house_members').select('user_id, role').eq('house_id', houseId);
      if (mErr) throw mErr;
      const list = (members ?? []) as { user_id: string; role: Role }[];
      const others = list.filter((m) => m.user_id !== uid);
      const me = list.find((m) => m.user_id === uid);
      if (me?.role === 'admin' && others.length > 0 && !others.some((m) => m.role === 'admin')) {
        throw new Error('אתה המנהל היחיד. הסר את הדיירים האחרים לפני העזיבה.');
      }
      const { error } = await supabase.from('house_members').delete().eq('house_id', houseId).eq('user_id', uid);
      if (error) throw error;
      const next = houses?.find((h) => h.id !== houseId)?.id ?? null;
      const { error: pErr } = await supabase.from('profiles').update({ current_house_id: next }).eq('id', uid);
      if (pErr) throw pErr;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['houses'] });
      qc.invalidateQueries({ queryKey: ['house-members'] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (patch: { full_name: string; phone: string | null }) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', uid!);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      const prev = qc.getQueryData<Profile>(['profile', uid]);
      if (prev) qc.setQueryData<Profile>(['profile', uid], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['profile', uid], ctx.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['house-members'] });
    },
  });
}

/** יצירת בית / הצטרפות לפי קוד. ה-RPCs מעדכנים את profiles.current_house_id. */
export function useCreateHouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_house', { p_name: name });
      if (error) throw error;
      return data as House;
    },
    // מחזירים את ה-promise כדי שהמסך ימתין לפרופיל המעודכן לפני ניווט
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: ['houses'] }),
    ]),
  });
}

export function useJoinHouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_house', { p_code: code });
      if (error) throw error;
      return data as House;
    },
    // מחזירים את ה-promise כדי שהמסך ימתין לפרופיל המעודכן לפני ניווט
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: ['houses'] }),
    ]),
  });
}

export function authErrorMessage(message?: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'אימייל או סיסמה שגויים';
  if (m.includes('already registered') || m.includes('already been registered')) return 'כתובת האימייל כבר רשומה';
  if (m.includes('email not confirmed')) return 'יש לאשר את כתובת האימייל לפני ההתחברות';
  if (m.includes('password') && m.includes('characters')) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
  if (m.includes('rate limit') || m.includes('too many')) return 'יותר מדי ניסיונות, נסו שוב בעוד רגע';
  if (m.includes('network') || m.includes('fetch')) return 'בעיית תקשורת, בדקו את החיבור לאינטרנט';
  if (m.includes('not found') || m.includes('invalid')) return 'הבית לא נמצא. בדקו את הקוד';
  return message || 'אירעה שגיאה, נסו שוב';
}
