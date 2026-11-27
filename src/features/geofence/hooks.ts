import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCurrentHouse } from '@/features/house/hooks';
import type { HomeLocation } from './service';
import { geofenceSupported, syncGeofence } from './service';
import { readConfig } from './task';

/** מיקום הבית של הבית הנוכחי (או null אם עוד לא נקבע). */
export function useHomeLocation(): HomeLocation | null {
  const { house } = useCurrentHouse();
  if (!house || house.home_lat == null || house.home_lng == null) return null;
  return { lat: house.home_lat, lng: house.home_lng, radius: house.home_radius_m ?? 150 };
}

/** האם העדכון האוטומטי מופעל במכשיר הזה עבור הבית הנוכחי. */
export function useAutoPresenceEnabled(houseId: string | null) {
  const [enabled, setEnabledState] = useState(false);
  useEffect(() => {
    let alive = true;
    readConfig().then((cfg) => { if (alive) setEnabledState(!!cfg?.enabled && cfg.houseId === houseId); });
    return () => { alive = false; };
  }, [houseId]);
  const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);
  return { enabled, setEnabled };
}

/** קביעת (או ניקוי) מיקום הבית, למנהל בלבד. */
export function useSetHomeLocation() {
  const qc = useQueryClient();
  const { houseId } = useCurrentHouse();
  return useMutation({
    mutationFn: async (v: { lat: number; lng: number; radius: number } | null) => {
      const { error } = await supabase.rpc('set_house_location', {
        p_house: houseId,
        p_lat: v?.lat ?? null,
        p_lng: v?.lng ?? null,
        p_radius_m: v?.radius ?? 150,
      });
      if (error) throw error;
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['houses'] }); },
  });
}

/** נקרא מ-RootGate: רושם מחדש את אזור הבית בפתיחה ובשינוי המיקום. */
export function useGeofenceSync(enabled: boolean) {
  const { houseId } = useCurrentHouse();
  const home = useHomeLocation();
  const lat = home?.lat;
  const lng = home?.lng;
  const radius = home?.radius;
  useEffect(() => {
    if (!enabled || !houseId || !geofenceSupported()) return;
    syncGeofence(houseId, lat != null && lng != null ? { lat, lng, radius: radius ?? 150 } : null);
  }, [enabled, houseId, lat, lng, radius]);
}
