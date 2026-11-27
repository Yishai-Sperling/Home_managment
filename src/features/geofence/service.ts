import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { isInsideRadius } from './geo';
import { GEOFENCE_TASK, applyAutoPresence, readConfig, writeConfig } from './task';

export interface HomeLocation { lat: number; lng: number; radius: number }

/** גיאופנסינג ברקע לא נתמך ב-Expo Go ובסימולטור. */
export function geofenceSupported(): boolean {
  return Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export type PermissionResult = 'granted' | 'foreground_denied' | 'background_denied';

/** קודם הרשאת מיקום בזמן שימוש, ואז "תמיד" (באנדרואיד 11+ נפתחות הגדרות המערכת). */
export async function ensureGeofencePermissions(): Promise<PermissionResult> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'foreground_denied';
  let bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'granted' : 'background_denied';
}

async function startGeofence(home: HomeLocation) {
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    { identifier: 'home', latitude: home.lat, longitude: home.lng, radius: home.radius, notifyOnEnter: true, notifyOnExit: true },
  ]);
}

export async function stopGeofence() {
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  } catch { /* לא קריטי */ }
}

/** המיקום הנוכחי (בזמן שימוש), לקביעת מיקום הבית. */
export async function getCurrentLatLng(): Promise<{ lat: number; lng: number } | 'denied'> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/** מפעיל עדכון אוטומטי: הרשאות, רישום האזור, וקביעת המצב הנוכחי (בבית/בחוץ) מיד. */
export async function enableAutoPresence(houseId: string, home: HomeLocation): Promise<PermissionResult | 'ok'> {
  const perm = await ensureGeofencePermissions();
  if (perm !== 'granted') return perm;
  await writeConfig({ enabled: true, houseId });
  await startGeofence(home);
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const inside = isInsideRadius(
      { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
      { latitude: home.lat, longitude: home.lng },
      home.radius,
    );
    await applyAutoPresence(houseId, inside ? 'home' : 'away', true);
  } catch { /* המצב יתעדכן באירוע הכניסה/יציאה הבא */ }
  return 'ok';
}

export async function disableAutoPresence() {
  await writeConfig(null);
  await stopGeofence();
}

/** בפתיחת האפליקציה ובשינוי מיקום הבית: רושם מחדש את האזור (אם הפיצ'ר מופעל על המכשיר הזה). */
export async function syncGeofence(houseId: string, home: HomeLocation | null) {
  try {
    const cfg = await readConfig();
    if (!cfg?.enabled || cfg.houseId !== houseId) return;
    if (!home) { await stopGeofence(); return; }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) return;
    await startGeofence(home);
  } catch { /* לא קריטי */ }
}
