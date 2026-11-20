import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import type { CarRecurringRule, CarReservation, Role } from '@/types/database';
import { hasOverlap } from './overlap';
import { conflictCount, mapRpcError, parseISODate, toISODate } from './recurrence';
import { addDays, startOfDay } from './timeline';

const key = (houseId: string | null) => ['car', houseId] as const;

export const OVERLAP_MESSAGE = 'הרכב כבר תפוס בחלון הזמן הזה';

export function useReservations(houseId: string | null) {

  useRealtimeInvalidate('car_reservations', houseId, key(houseId));

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

/** שריונים שנוגעים ביום מסוים (כולל כאלה שהסתיימו), ללוח היום. */
export function useReservationsForDay(houseId: string | null, day: Date) {
  const from = startOfDay(day);
  const to = addDays(day, 1);
  return useQuery({
    queryKey: [...key(houseId), 'day', from.getTime()] as const,
    enabled: !!houseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('car_reservations').select('*')
        .eq('house_id', houseId!).lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString())
        .order('starts_at', { ascending: true });
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

export interface EditReservation { id: string; starts_at: Date; ends_at: Date; purpose?: string; notes?: string }

/** עריכת שריון חד-פעמי (שעות, מטרה, הערות). */
export function useUpdateReservation() {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  return useMutation({
    mutationFn: async (v: EditReservation) => {
      if (v.ends_at <= v.starts_at) throw new Error('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      const existing = qc.getQueryData<CarReservation[]>(key(houseId)) ?? [];
      if (hasOverlap(existing, v.starts_at, v.ends_at, v.id)) throw new Error(OVERLAP_MESSAGE);
      const { error } = await supabase.from('car_reservations').update({
        starts_at: v.starts_at.toISOString(), ends_at: v.ends_at.toISOString(),
        purpose: v.purpose?.trim() || null, notes: v.notes?.trim() || null,
      }).eq('id', v.id);
      if (error) {
        if (error.code === '23P01') throw new Error(OVERLAP_MESSAGE);
        throw new Error('שמירת השינויים נכשלה, נסו שוב');
      }
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: key(houseId) }); },
  });
}

/** סדרות השריון החוזר של הבית (שלא הסתיימו). */
export function useRecurringRules(houseId: string | null) {
  useRealtimeInvalidate('car_recurring_rules', houseId, ['car', houseId, 'rules']);
  return useQuery({
    queryKey: ['car', houseId, 'rules'] as const,
    enabled: !!houseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('car_recurring_rules').select('*')
        .eq('house_id', houseId!).order('created_at', { ascending: true });
      if (error) throw error;
      const today = toISODate(new Date());
      return (data as CarRecurringRule[]).filter((r) => !r.ends_on || r.ends_on >= today);
    },
  });
}

export interface RuleInput {
  days: number[];
  /** HH:MM */
  start: string;
  end: string;
  purpose: string;
  /** null = ללא הגבלה */
  endsOn: Date | null;
}
export interface RuleResult { created: number; conflicts: number }

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(mapRpcError(error.message));
  return data as T;
}

const toResult = (d: { created?: number; conflicts?: unknown } | null): RuleResult =>
  ({ created: d?.created ?? 0, conflicts: conflictCount(d?.conflicts) });

function useCarInvalidate() {
  const qc = useQueryClient();
  const houseId = useCurrentHouseId();
  return () => qc.invalidateQueries({ queryKey: key(houseId) });
}

export function useCreateRule() {
  const houseId = useCurrentHouseId();
  const invalidate = useCarInvalidate();
  return useMutation({
    mutationFn: async (v: RuleInput) => {
      if (!houseId) throw new Error('אין בית פעיל');
      const d = await callRpc<{ created?: number; conflicts?: unknown } | null>('create_recurring_rule', {
        p_house: houseId, p_days: v.days, p_start: v.start, p_end: v.end,
        p_purpose: v.purpose.trim() || null, p_ends_on: v.endsOn ? toISODate(v.endsOn) : null,
      });
      return toResult(d);
    },
    onSettled: invalidate,
  });
}

export function useUpdateRule() {
  const invalidate = useCarInvalidate();
  return useMutation({
    mutationFn: async (v: RuleInput & { ruleId: string }) => {
      const d = await callRpc<{ created?: number; conflicts?: unknown } | null>('update_recurring_rule', {
        p_rule: v.ruleId, p_days: v.days, p_start: v.start, p_end: v.end,
        p_purpose: v.purpose.trim() || null, p_ends_on: v.endsOn ? toISODate(v.endsOn) : null,
      });
      return toResult(d);
    },
    onSettled: invalidate,
  });
}

/** ביטול מופע בודד מתוך סדרה. */
export function useSkipOccurrence() {
  const invalidate = useCarInvalidate();
  return useMutation({
    mutationFn: async (reservationId: string) => { await callRpc('skip_occurrence', { p_reservation: reservationId }); },
    onSettled: invalidate,
  });
}

/** מחיקת סדרה שלמה (והמופעים העתידיים שלה). */
export function useDeleteRule() {
  const invalidate = useCarInvalidate();
  return useMutation({
    mutationFn: async (ruleId: string) => { await callRpc('delete_recurring_rule', { p_rule: ruleId }); },
    onSettled: invalidate,
  });
}

export const ruleEndsOnDate = (r: CarRecurringRule) => (r.ends_on ? parseISODate(r.ends_on) : null);

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
