import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useCurrentHouseId, useSession } from '@/lib/session';
import { spacing, useTheme } from '@/theme';
import { TOOTHBRUSH_COLORS, byHex, isBrushColor } from './toothbrushColors';

/** מברשת שיניים בצבע שנבחר (לבן מקבל מסגרת כהה כדי שייראה). */
export { TOOTHBRUSH_COLORS, brushColorName, isBrushColor, takenByOthers } from './toothbrushColors';

export function ToothbrushIcon({ color, size = 22 }: { color: string; size?: number }) {
  const { colors } = useTheme();
  const isLight = color.toLowerCase() === '#ffffff';
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: isLight ? colors.surfaceAlt : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name="toothbrush" size={size} color={isLight ? '#9CA3AF' : color} />
    </View>
  );
}

/** בורר צבע: עיגולים; צבע שדייר אחר בחר מעומעם ולא ניתן לבחירה; לחיצה על הצבע שנבחר מנקה אותו. */
export function ToothbrushPicker({ value, taken, onChange, disabled }: {
  value: string | null;
  taken: Map<string, string>;
  onChange: (hex: string | null) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const current = isBrushColor(value) ? value.toLowerCase() : null;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {TOOTHBRUSH_COLORS.map((c) => {
          const hex = c.hex.toLowerCase();
          const selected = hex === current;
          const takenBy = taken.get(hex);
          const isOut = !!takenBy && !selected;
          return (
            <Pressable
              key={c.hex}
              disabled={disabled || isOut}
              accessibilityLabel={isOut ? `${c.name}, תפוס על ידי ${takenBy}` : c.name}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(selected ? null : c.hex); }}
              style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: c.hex, alignItems: 'center', justifyContent: 'center',
                borderWidth: selected ? 3 : 1, borderColor: selected ? colors.primary : colors.border, opacity: isOut ? 0.25 : 1,
              }}>
              {selected ? <MaterialCommunityIcons name="check" size={22} color={hex === '#ffffff' || hex === '#eab308' || hex === '#84cc16' ? '#111827' : '#FFFFFF'} /> : null}
              {isOut ? <MaterialCommunityIcons name="lock" size={16} color={hex === '#ffffff' ? '#6B7280' : '#FFFFFF'} /> : null}
            </Pressable>
          );
        })}
      </View>
      {taken.size > 0 ? (
        <Text variant="small" muted>
          תפוסים: {[...taken.entries()].map(([hex, who]) => `${byHex.get(hex)?.name ?? ''} (${who})`).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

/** שמירת צבע המברשת של המשתמש הנוכחי, עם עדכון אופטימי של הפרופיל ורשימת הדיירים. */
export function useSetToothbrushColor() {
  const qc = useQueryClient();
  const { session } = useSession();
  const houseId = useCurrentHouseId();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (hex: string | null) => {
      if (!uid) throw new Error('not_authenticated');
      const { error } = await supabase.from('profiles').update({ toothbrush_color: hex }).eq('id', uid);
      if (error) throw error;
    },
    onMutate: async (hex) => {
      await qc.cancelQueries({ queryKey: ['house-members', houseId] });
      const prevMembers = qc.getQueryData(['house-members', houseId]);
      const prevProfile = qc.getQueryData(['profile', uid]);
      qc.setQueryData(['house-members', houseId], (old: any) =>
        old?.map((m: any) => (m.user_id === uid ? { ...m, profile: { ...m.profile, toothbrush_color: hex } } : m)));
      qc.setQueryData(['profile', uid], (old: any) => (old ? { ...old, toothbrush_color: hex } : old));
      return { prevMembers, prevProfile };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(['house-members', houseId], ctx?.prevMembers);
      qc.setQueryData(['profile', uid], ctx?.prevProfile);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['house-members', houseId] });
      qc.invalidateQueries({ queryKey: ['profile', uid] });
    },
  });
}
