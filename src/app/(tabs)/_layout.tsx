import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

const tabs = [
  { name: 'index', title: 'בית', icon: 'home' },
  { name: 'shopping', title: 'קניות', icon: 'cart' },
  { name: 'car', title: 'רכב', icon: 'car' },
  { name: 'announcements', title: 'מודעות', icon: 'megaphone' },
  { name: 'issues', title: 'תקלות', icon: 'construct' },
] as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarAllowFontScaling: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border } }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ color, size }) => <Ionicons name={t.icon as any} color={color as string} size={size} /> }} />
      ))}
    </Tabs>
  );
}
