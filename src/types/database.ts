// חוזה הטיפוסים המשותף לכל הישויות. שינויים כאן — רק דרך הסוכן הראשי.

export type Role = 'admin' | 'member';

/** העדפות התראות Push לפי סוג (שדה profiles.notify_prefs). חסר/true = מקבלים. */
export interface NotifyPrefs {
  shopping: boolean;
  car: boolean;
  announcements: boolean;
  issues: boolean;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = { shopping: true, car: true, announcements: true, issues: true };

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  current_house_id: string | null;
  notify_prefs: NotifyPrefs | null;
  /** צבע מברשת השיניים (#RRGGBB), או null אם לא נבחר */
  toothbrush_color: string | null;
  created_at: string;
}

export interface House {
  id: string;
  name: string;
  join_code: string;
  admin_email: string;
  created_by: string;
  created_at: string;
}

export interface HouseMember {
  house_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'full_name' | 'phone'> & { toothbrush_color?: string | null };
}

export type ShoppingCategory = 'groceries' | 'cleaning' | 'pharmacy' | 'other';
export type ShoppingStatus = 'pending' | 'bought';
export interface ShoppingItem {
  id: string;
  house_id: string;
  name: string;
  quantity: string | null;
  category: ShoppingCategory;
  status: ShoppingStatus;
  added_by: string;
  created_at: string;
}

export interface CarReservation {
  id: string;
  house_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  purpose: string | null;
  notes: string | null;
  /** אם השריון נוצר מסדרה חוזרת: מזהה הסדרה והתאריך (YYYY-MM-DD) של המופע */
  recurring_rule_id: string | null;
  occurrence_date: string | null;
  created_at: string;
}

/** סדרת שריון חוזר (למשל כל יום א׳–ה׳ 09:00–15:30). המופעים נוצרים כשורות ב-car_reservations. */
export interface CarRecurringRule {
  id: string;
  house_id: string;
  user_id: string;
  /** ימי השבוע בסגנון JS: 0=ראשון … 6=שבת */
  days: number[];
  /** שעות מקומיות בפורמט HH:MM:SS (בלי חצייה של חצות) */
  start_time: string;
  end_time: string;
  tz: string;
  purpose: string | null;
  /** YYYY-MM-DD */
  starts_on: string;
  ends_on: string | null;
  created_at: string;
}

export type AnnouncementType = 'general' | 'event' | 'reminder' | 'visit';
export type Priority = 'low' | 'normal' | 'high';
export interface Announcement {
  id: string;
  house_id: string;
  title: string;
  body: string | null;
  type: AnnouncementType;
  priority: Priority;
  event_date: string | null;
  created_by: string;
  created_at: string;
}

export type IssueCategory = 'plumbing' | 'electric' | 'heating' | 'appliances' | 'general';
export type IssueUrgency = 'low' | 'normal' | 'urgent';
export type IssueStatus = 'open' | 'in_progress' | 'closed';
export interface Issue {
  id: string;
  house_id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  urgency: IssueUrgency;
  status: IssueStatus;
  image_path: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
}
