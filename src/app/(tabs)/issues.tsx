import React from 'react';
import { Screen, Text, EmptyState, useScreenPadding } from '@/components/ui';

export default function IssuesScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">תקלות</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
