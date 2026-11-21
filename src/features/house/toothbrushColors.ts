// פלטת צבעי מברשות שיניים ועזרים טהורים (בלי תלות ב-React Native, כדי שיהיו ניתנים לבדיקה).

export interface BrushColor { hex: string; name: string }

export const TOOTHBRUSH_COLORS: BrushColor[] = [
  { hex: '#EF4444', name: 'אדום' },
  { hex: '#F97316', name: 'כתום' },
  { hex: '#EAB308', name: 'צהוב' },
  { hex: '#84CC16', name: 'ירוק בהיר' },
  { hex: '#22C55E', name: 'ירוק' },
  { hex: '#14B8A6', name: 'טורקיז' },
  { hex: '#0EA5E9', name: 'תכלת' },
  { hex: '#3B82F6', name: 'כחול' },
  { hex: '#8B5CF6', name: 'סגול' },
  { hex: '#EC4899', name: 'ורוד' },
  { hex: '#92400E', name: 'חום' },
  { hex: '#6B7280', name: 'אפור' },
  { hex: '#111827', name: 'שחור' },
  { hex: '#FFFFFF', name: 'לבן' },
];

export const byHex = new Map(TOOTHBRUSH_COLORS.map((c) => [c.hex.toLowerCase(), c]));

export const isBrushColor = (hex: string | null | undefined): hex is string => !!hex && byHex.has(hex.toLowerCase());

export const brushColorName = (hex: string | null | undefined) => (isBrushColor(hex) ? byHex.get(hex.toLowerCase())!.name : null);

/** צבעים שדיירים אחרים בבית כבר בחרו: hex (באותיות קטנות) -> שם הדייר. */
export function takenByOthers(
  members: { user_id: string; profile?: { full_name: string | null; toothbrush_color?: string | null } }[],
  myId: string | undefined,
): Map<string, string> {
  const taken = new Map<string, string>();
  for (const m of members) {
    const hex = m.profile?.toothbrush_color;
    if (m.user_id !== myId && isBrushColor(hex)) taken.set(hex.toLowerCase(), m.profile?.full_name?.trim().split(/\s+/)[0] || 'דייר');
  }
  return taken;
}
