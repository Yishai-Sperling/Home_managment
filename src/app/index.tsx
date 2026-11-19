import { Redirect } from 'expo-router';
import { useProfile, useSession } from '@/lib/session';

/** נקודת כניסה: מפנה לפי מצב ההתחברות והבית (השער עצמו ב-RootGate). */
export default function Index() {
  const { session } = useSession();
  const profile = useProfile();
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile.data?.current_house_id) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
