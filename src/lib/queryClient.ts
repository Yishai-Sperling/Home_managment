import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { CACHE_MAX_AGE_MS } from '@/lib/cachePolicy';

// gcTime חייב להיות לפחות maxAge של המטמון השמור, אחרת הנתונים נמחקים מהזיכרון לפני שנשמרו
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, gcTime: CACHE_MAX_AGE_MS } },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'home-query-cache',
  throttleTime: 1000,
});

/** בהתנתקות: מנקים את הזיכרון ואת העותק השמור, כדי שהנתונים לא יישארו במכשיר. */
export async function clearPersistedCache() {
  queryClient.clear();
  try { await persister.removeClient(); } catch { /* לא קריטי */ }
}
