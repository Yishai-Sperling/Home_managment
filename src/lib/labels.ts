import type * as T from '@/types/database';

export const shoppingCategoryLabels: Record<T.ShoppingCategory, string> = {
  groceries: 'מצרכים', cleaning: 'ניקיון', pharmacy: 'פארמה', other: 'אחר',
};
export const shoppingStatusLabels: Record<T.ShoppingStatus, string> = { pending: 'ממתין', bought: 'נקנה' };
export const announcementTypeLabels: Record<T.AnnouncementType, string> = {
  general: 'כללי', event: 'אירוע', reminder: 'תזכורת', visit: 'ביקור',
};
export const priorityLabels: Record<T.Priority, string> = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה' };
export const issueCategoryLabels: Record<T.IssueCategory, string> = {
  plumbing: 'אינסטלציה', electric: 'חשמל', heating: 'חימום', appliances: 'מכשירים', general: 'כללי',
};
export const issueUrgencyLabels: Record<T.IssueUrgency, string> = { low: 'נמוכה', normal: 'רגילה', urgent: 'דחוף' };
export const issueStatusLabels: Record<T.IssueStatus, string> = { open: 'פתוח', in_progress: 'בטיפול', closed: 'נסגר' };
export const roleLabels: Record<T.Role, string> = { admin: 'מנהל', member: 'דייר' };
