const SCREENS = ['shopping', 'car', 'announcements', 'issues'] as const;

/** ממפה את `data.screen` של ההתראה לנתיב באפליקציה (או null אם לא מוכר). */
export function routeForNotification(data: unknown): string | null {
  const screen = (data as { screen?: unknown } | null | undefined)?.screen;
  return typeof screen === 'string' && (SCREENS as readonly string[]).includes(screen) ? `/${screen}` : null;
}
