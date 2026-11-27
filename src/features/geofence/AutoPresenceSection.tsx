import React, { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Card, Chip, Text } from '@/components/ui';
import { useCurrentHouse } from '@/features/house/hooks';
import { spacing, useTheme } from '@/theme';
import { RADIUS_OPTIONS, radiusLabel } from './geo';
import { useAutoPresenceEnabled, useHomeLocation, useSetHomeLocation } from './hooks';
import { disableAutoPresence, enableAutoPresence, geofenceSupported, getCurrentLatLng } from './service';

/** הגדרות "עדכון אוטומטי של מי בבית": מיקום הבית (מנהל) ומתג הפעלה לכל דייר, בהתאם למכשיר. */
export function AutoPresenceSection() {
  const { colors } = useTheme();
  const { houseId, isAdmin } = useCurrentHouse();
  const home = useHomeLocation();
  const { enabled, setEnabled } = useAutoPresenceEnabled(houseId);
  const setHome = useSetHomeLocation();
  const [radius, setRadius] = useState<number>(home?.radius ?? 150);
  const [busy, setBusy] = useState(false);
  const supported = geofenceSupported();

  const saveHere = () => {
    Alert.alert('קביעת מיקום הבית', 'ודא שאתה נמצא בבית עכשיו. המיקום הנוכחי שלך יישמר כמיקום הבית.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'קבע כאן',
        onPress: async () => {
          setBusy(true);
          try {
            const pos = await getCurrentLatLng();
            if (pos === 'denied') { Alert.alert('אין הרשאה', 'כדי לקבוע את מיקום הבית צריך לאפשר גישה למיקום.'); return; }
            await setHome.mutateAsync({ lat: pos.lat, lng: pos.lng, radius });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch {
            Alert.alert('שגיאה', 'לא הצלחנו לקבוע את המיקום. בדוק שה-GPS פועל ונסה שוב.');
          } finally { setBusy(false); }
        },
      },
    ]);
  };

  const clearHome = () => {
    Alert.alert('ניקוי מיקום הבית', 'העדכון האוטומטי יפסיק לעבוד לכל הדיירים עד שייקבע מיקום חדש.', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'נקה', style: 'destructive', onPress: async () => {
        try { await setHome.mutateAsync(null); await disableAutoPresence(); setEnabled(false); }
        catch { Alert.alert('שגיאה', 'הניקוי נכשל, נסה שוב.'); }
      } },
    ]);
  };

  const toggle = async (next: boolean) => {
    if (!houseId) return;
    if (!next) { await disableAutoPresence(); setEnabled(false); return; }
    if (!home) return;
    setBusy(true);
    try {
      const result = await enableAutoPresence(houseId, home);
      if (result === 'ok') { setEnabled(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); return; }
      setEnabled(false);
      Alert.alert(
        result === 'foreground_denied' ? 'אין הרשאת מיקום' : 'נדרשת הרשאת "תמיד"',
        result === 'foreground_denied'
          ? 'כדי לזהות מתי אתה בבית צריך לאפשר גישה למיקום.'
          : 'בהגדרות האפליקציה, תחת "מיקום", בחר "אפשר תמיד", כדי שהזיהוי יעבוד גם כשהאפליקציה סגורה.',
        [{ text: 'ביטול', style: 'cancel' }, { text: 'פתח הגדרות', onPress: () => Linking.openSettings() }],
      );
    } catch {
      setEnabled(false);
      Alert.alert('שגיאה', 'לא הצלחנו להפעיל את הזיהוי האוטומטי.');
    } finally { setBusy(false); }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      {!supported ? (
        <Text variant="small" style={{ color: colors.warning }}>זיהוי אוטומטי עובד רק באפליקציה המותקנת במכשיר (לא ב-Expo Go).</Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '600' }}>עדכן אוטומטית כשאני נכנס או יוצא מהבית</Text>
          <Text variant="small" muted>
            {home ? `מיקום הבית נקבע (רדיוס ${radiusLabel(home.radius)})` : 'קודם צריך שמנהל הבית יקבע את מיקום הבית'}
          </Text>
        </View>
        <Switch value={enabled} onValueChange={toggle} disabled={!home || !supported || busy} />
      </View>

      <Text variant="small" muted>{'המיקום שלך נשאר על הטלפון. לשרת נשלח רק "בבית" או "בחוץ".'}</Text>

      {isAdmin ? (
        <View style={{ gap: spacing.sm, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md }}>
          <Text variant="label" muted>מיקום הבית (מנהל)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {RADIUS_OPTIONS.map((r) => (
              <Chip key={r} label={radiusLabel(r)} selected={radius === r} onPress={() => setRadius(r)} />
            ))}
          </View>
          <Button title={home ? 'עדכן לפי המיקום הנוכחי שלי' : 'קבע לפי המיקום הנוכחי שלי'} variant="secondary" onPress={saveHere} loading={busy || setHome.isPending} />
          {home ? <Button title="נקה מיקום הבית" variant="ghost" onPress={clearHome} /> : null}
        </View>
      ) : null}
    </Card>
  );
}
