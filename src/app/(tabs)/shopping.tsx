import React from 'react';
import { Screen, Text, EmptyState, useScreenPadding } from '@/components/ui';

export default function ShoppingScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">קניות</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
