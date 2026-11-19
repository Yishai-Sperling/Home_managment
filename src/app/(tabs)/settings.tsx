import React from 'react';
import { Screen, Text, EmptyState, useScreenPadding } from '@/components/ui';

export default function SettingsScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">הגדרות</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
