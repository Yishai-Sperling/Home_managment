import React, { useState } from 'react';
import { Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Input, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { AuthShell, ErrorText } from '@/features/house/AuthShell';
import { authErrorMessage } from '@/features/house/hooks';
import { useTheme } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!EMAIL_RE.test(email.trim())) return fail('כתובת אימייל לא תקינה');
    if (!password) return fail('יש להזין סיסמה');
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) fail(authErrorMessage(err.message));
    // בהצלחה: ה-session מתעדכן והשער מנווט אוטומטית
  }
  function fail(msg: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setError(msg);
  }

  return (
    <AuthShell title="ברוכים השבים" subtitle="התחברו כדי להמשיך לבית שלכם">
      <Input label="אימייל" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="name@example.com" />
      <Input label="סיסמה" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" placeholder="••••••••" onSubmitEditing={submit} returnKeyType="go" />
      <ErrorText message={error} />
      <Button title="התחברות" onPress={submit} loading={loading} />
      <Link href="/(auth)/sign-up" replace style={{ textAlign: 'center', color: colors.primary, fontWeight: '600', paddingVertical: 8 }}>
        <Text style={{ color: colors.primary, textAlign: 'center' }}>אין לכם חשבון? הרשמה</Text>
      </Link>
    </AuthShell>
  );
}
