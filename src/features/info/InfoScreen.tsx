import React from 'react';
import { EmptyState, Screen, Text, useScreenPadding } from '@/components/ui';

/** מסך "מידע על הבית". שלד: מומש על ידי סוכן המידע. */
export default function InfoScreen() {
  const pad = useScreenPadding();
  return (
    <Screen style={pad}>
      <Text variant="title">מידע על הבית</Text>
      <EmptyState title="בקרוב" />
    </Screen>
  );
}
