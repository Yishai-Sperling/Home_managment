import React from 'react';
import { Screen, Text, EmptyState, useScreenPadding } from '@/components/ui';

export default function IndexScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">דשבורד</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
