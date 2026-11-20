import { Redirect } from 'expo-router';

/** כל כתובת לא מוכרת (למשל מקישור חיצוני) מחזירה למסך הבית במקום לתקוע את האפליקציה. */
export default function NotFound() {
  return <Redirect href="/" />;
}
