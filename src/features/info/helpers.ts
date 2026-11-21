import type { HouseInfoItem, HouseInfoKind } from '@/types/database';

export const KIND_LABELS: Record<HouseInfoKind, string> = {
  text: 'טקסט', wifi: 'וויי-פיי', phone: 'טלפון', code: 'קוד', link: 'קישור',
};
export const KIND_ORDER: HouseInfoKind[] = ['text', 'wifi', 'phone', 'code', 'link'];

export const LABEL_MAX = 80;
export const VALUE_MAX = 500;
export const MASK = '••••';

export interface InfoForm { label: string; value: string; kind: HouseInfoKind; is_secret: boolean }
export const emptyInfoForm: InfoForm = { label: '', value: '', kind: 'text', is_secret: false };

export interface InfoErrors { label?: string; value?: string }

export function validateInfo(f: InfoForm): InfoErrors {
  const errors: InfoErrors = {};
  const label = f.label.trim();
  const value = f.value.trim();
  if (label.length < 1) errors.label = 'יש להזין כותרת';
  else if (label.length > LABEL_MAX) errors.label = `הכותרת ארוכה מדי (עד ${LABEL_MAX} תווים)`;
  if (value.length < 1) errors.value = 'יש להזין ערך';
  else if (value.length > VALUE_MAX) errors.value = `הערך ארוך מדי (עד ${VALUE_MAX} תווים)`;
  return errors;
}

/** מוסיף https:// כשחסרה סכימה; מחזיר null אם זה לא http/https תקין. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  let url = raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const scheme = raw.slice(0, raw.indexOf(':')).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return null;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/:]+:\d+(\/|$)/.test(raw)) {
    return null; // mailto:, javascript:, tel: ...
  } else {
    url = `https://${raw.replace(/^\/\//, '')}`;
  }
  const host = /^https?:\/\/([^/?#]+)/i.exec(url)?.[1];
  if (!host || host.startsWith('.')) return null;
  return url;
}

/** ערך להצגה: מוסתר עד לחשיפה. */
export function maskValue(value: string, secret: boolean, revealed: boolean): string {
  return secret && !revealed ? MASK : value;
}

/** מספר טלפון ל-tel: (משאיר ספרות ו-+). */
export function phoneToTel(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

export function relativeTimeText(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'עודכן הרגע';
  if (min < 60) return min === 1 ? 'עודכן לפני דקה' : `עודכן לפני ${min} דקות`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'עודכן לפני שעה' : h === 2 ? 'עודכן לפני שעתיים' : `עודכן לפני ${h} שעות`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? 'עודכן אתמול' : d === 2 ? 'עודכן לפני יומיים' : `עודכן לפני ${d} ימים`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo === 1 ? 'עודכן לפני חודש' : mo === 2 ? 'עודכן לפני חודשיים' : `עודכן לפני ${mo} חודשים`;
  const y = Math.floor(d / 365);
  return y <= 1 ? 'עודכן לפני שנה' : y === 2 ? 'עודכן לפני שנתיים' : `עודכן לפני ${y} שנים`;
}

/** לפי סוג (כסדר KIND_ORDER) ואז לפי כותרת. */
export function sortInfoItems(list: HouseInfoItem[]): HouseInfoItem[] {
  return [...list].sort((a, b) => {
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    return k !== 0 ? k : a.label.localeCompare(b.label, 'he');
  });
}

export function canDeleteInfo(item: HouseInfoItem, userId: string | undefined, isAdmin: boolean): boolean {
  return !!userId && (isAdmin || item.created_by === userId);
}

export interface QuickStart { label: string; kind: HouseInfoKind; is_secret: boolean }
export const QUICK_STARTS: QuickStart[] = [
  { label: 'וויי-פיי', kind: 'wifi', is_secret: true },
  { label: 'שרברב', kind: 'phone', is_secret: false },
  { label: 'חשמלאי', kind: 'phone', is_secret: false },
  { label: 'קוד כניסה', kind: 'code', is_secret: true },
  { label: 'ספק חשמל', kind: 'phone', is_secret: false },
  { label: 'חירום', kind: 'phone', is_secret: false },
];
