import { DEFAULT_NOTIFY_PREFS, type NotifyPrefs } from '@/types/database';

/** ממזג העדפות חלקיות/ריקות עם ברירות המחדל (מפתח חסר או לא בוליאני = מופעל). */
export function mergePrefs(raw: Partial<Record<keyof NotifyPrefs, unknown>> | null | undefined): NotifyPrefs {
  const out: NotifyPrefs = { ...DEFAULT_NOTIFY_PREFS };
  if (!raw || typeof raw !== 'object') return out;
  (Object.keys(DEFAULT_NOTIFY_PREFS) as (keyof NotifyPrefs)[]).forEach((k) => {
    if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean;
  });
  return out;
}
