import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { clearPersistedCache } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface SessionState { session: Session | null; loading: boolean }
const Ctx = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearPersistedCache();
      setState({ session, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

export function useProfile() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session!.user.id).single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

/** מזהה הבית הנוכחי (או null אם אין). כל ה-hooks של הפיצ'רים משתמשים בו. */
export function useCurrentHouseId() {
  return useProfile().data?.current_house_id ?? null;
}
