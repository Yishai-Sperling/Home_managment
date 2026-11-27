export interface LatLng { latitude: number; longitude: number }

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** מרחק במטרים בין שתי נקודות (נוסחת haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInsideRadius(pos: LatLng, home: LatLng, radiusM: number): boolean {
  return distanceMeters(pos, home) <= radiusM;
}

export const RADIUS_OPTIONS = [100, 150, 250, 400] as const;
export const MIN_GAP_MS = 2 * 60_000;

export interface LastApplied { status: 'home' | 'away'; at: number }

/** מדלגים על עדכון זהה לאחרון שנשלח לפני פחות מ-MIN_GAP_MS, כדי למנוע ריצוד בגבול האזור. */
export function shouldApplyPresence(next: 'home' | 'away', last: LastApplied | null, now: number, minGapMs = MIN_GAP_MS): boolean {
  if (!last) return true;
  if (last.status !== next) return true;
  return now - last.at >= minGapMs;
}

export function radiusLabel(m: number): string {
  return `${m} מ׳`;
}
