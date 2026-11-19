import { useEffect, useId } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * מאזין לשינויים בטבלה עבור בית מסוים ומבטל את ה-cache של השאילתה.
 * שם הערוץ ייחודי לכל מופע (useId): אותו hook יכול להיות מורכב כמה פעמים
 * בו-זמנית (דשבורד + טאב), וערוץ בשם קבוע היה מוחזר כבר-מנוי וגורם ל-.on() לזרוק.
 */
export function useRealtimeInvalidate(table: string, houseId: string | null, queryKey: QueryKey) {
  const qc = useQueryClient();
  const instance = useId();
  const keyStr = JSON.stringify(queryKey);
  useEffect(() => {
    if (!houseId) return;
    const channel = supabase
      .channel(`${table}:${houseId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `house_id=eq.${houseId}` },
        () => { qc.invalidateQueries({ queryKey: JSON.parse(keyStr) }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, houseId, instance, keyStr, qc]);
}
