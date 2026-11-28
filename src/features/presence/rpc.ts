import { supabase } from '@/lib/supabase';
import type { PresenceStatus } from '@/types/database';

export interface SetPresenceArgs {
  houseId: string;
  status: PresenceStatus | null;
  eta?: string | null;
  /** true כשהעדכון מגיע מהזיהוי האוטומטי (גיאופנסינג) */
  auto?: boolean;
}

/** האם השרת עוד לא מכיר את הפרמטר p_auto (מיגרציה 0014 עוד לא הורצה). */
export function isMissingAutoParam(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '');
}

/** קורא ל-set_presence; אם המיגרציה החדשה עוד לא רצה בשרת, חוזר לחתימה הישנה (בלי p_auto). */
export async function callSetPresence({ houseId, status, eta = null, auto = false }: SetPresenceArgs) {
  const base = { p_house: houseId, p_status: status, p_eta: eta };
  const first = await supabase.rpc('set_presence', { ...base, p_auto: auto });
  if (!isMissingAutoParam(first.error)) return first;
  return supabase.rpc('set_presence', base);
}
