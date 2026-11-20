import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * יוצר את מופעי השריון החוזר ל-4 השבועות הקרובים (RPC materialize_recurring, אידמפוטנטי)
 * ומרענן את שאילתות הרכב. קוראים לו כשמסך שמציג מצב רכב נפתח (רכב, דשבורד).
 */
export function useMaterializeRecurring(houseId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!houseId) return;
    let cancelled = false;
    supabase.rpc('materialize_recurring', { p_house: houseId, p_days: 28 }).then(({ error }) => {
      if (!error && !cancelled) qc.invalidateQueries({ queryKey: ['car', houseId] });
    });
    return () => { cancelled = true; };
  }, [houseId, qc]);
}
