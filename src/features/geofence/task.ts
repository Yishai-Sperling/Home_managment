import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { callSetPresence } from '@/features/presence/rpc';
import { supabase } from '@/lib/supabase';
import { shouldApplyPresence, type LastApplied } from './geo';

export const GEOFENCE_TASK = 'home-geofence';
export const CONFIG_KEY = 'geofence:config';
const LAST_KEY = 'geofence:last';

export interface GeofenceConfig { enabled: boolean; houseId: string }

export async function readConfig(): Promise<GeofenceConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as GeofenceConfig) : null;
  } catch {
    return null;
  }
}

export async function writeConfig(cfg: GeofenceConfig | null) {
  try {
    if (cfg) await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else await AsyncStorage.removeItem(CONFIG_KEY);
  } catch { /* לא קריטי */ }
}

/** שולח "בבית"/"בחוץ" לשרת (עם הגנה מפני ריצוד). רץ גם ברקע, כשהאפליקציה סגורה. */
export async function applyAutoPresence(houseId: string, status: 'home' | 'away', force = false) {
  try {
    const now = Date.now();
    let last: LastApplied | null = null;
    try {
      const raw = await AsyncStorage.getItem(LAST_KEY);
      last = raw ? (JSON.parse(raw) as LastApplied) : null;
    } catch { /* אין היסטוריה */ }
    if (!force && !shouldApplyPresence(status, last, now)) return;

    const { data } = await supabase.auth.getSession(); // מרענן טוקן שפג אם צריך
    if (!data.session) return;
    const { error } = await callSetPresence({ houseId, status, eta: null, auto: true });
    if (!error) await AsyncStorage.setItem(LAST_KEY, JSON.stringify({ status, at: now }));
  } catch { /* ברקע: לא להפיל את המשימה */ }
}

// חייב להיות מוגדר בטעינת האפליקציה (גם כשהמערכת מעירה אותה ברקע): מיובא מ-index.js
TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
  GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data) return;
    const cfg = await readConfig();
    if (!cfg?.enabled) return;
    const status = data.eventType === Location.GeofencingEventType.Enter ? 'home' : 'away';
    await applyAutoPresence(cfg.houseId, status);
  },
);
