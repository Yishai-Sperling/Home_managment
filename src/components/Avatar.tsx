import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';

const PALETTE = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'];

/** צבע יציב לכל משתמש לפי המזהה שלו. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** ראשי תיבות: אות ראשונה של המילה הראשונה והאחרונה בשם (עברית ואנגלית). */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '?';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return (first + last).toUpperCase();
}

/** עיגול צבעוני עם ראשי תיבות. `id` קובע את הצבע (user id), `name` את הכיתוב. */
export function Avatar({ name, id, size = 36 }: { name: string | null | undefined; id: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: Math.round(size * 0.4), textAlign: 'center' }}>{initials(name)}</Text>
    </View>
  );
}
