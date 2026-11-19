import React from 'react';
import { Screen, Text, EmptyState, useScreenPadding } from '@/components/ui';

export default function AnnouncementsScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">מודעות</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
