import React from 'react';
import { Screen, Text, EmptyState, useScreenPadding } from '@/components/ui';

export default function CarScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">רכב</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
