import React, { useState } from 'react';
import { Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Input, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { AuthShell, ErrorText } from '@/features/house/AuthShell';
import { authErrorMessage } from '@/features/house/hooks';
import { useTheme } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fail(msg: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setError(msg);
  }

  async function submit() {
    const fullName = name.trim();
    if (fullName.length < 2) return fail('יש להזין שם מלא');
    if (!EMAIL_RE.test(email.trim())) return fail('כתובת אימייל לא תקינה');
    if (password.length < 6) return fail('הסיסמה חייבת להכיל לפחות 6 תווים');
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName } },
    });
    if (err) {
      setLoading(false);
      return fail(authErrorMessage(err.message));
    }
    if (data.session && data.user) {
      // הפרופיל נוצר ע"י טריגר; מבטיחים שהשם נשמר גם אם הטריגר לא קרא את המטא-דאטה.
      await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName });
    } else {
      setNotice('החשבון נוצר. שלחנו אליכם מייל אישור, לאחר האישור אפשר להתחבר.');
    }
    setLoading(false);
  }

  return (
    <AuthShell title="יצירת חשבון" subtitle="כמה פרטים קטנים ואתם בפנים">
      <Input label="שם מלא" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="ישראל ישראלי" />
      <Input label="אימייל" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="name@example.com" />
      <Input label="סיסמה" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="לפחות 6 תווים" onSubmitEditing={submit} returnKeyType="go" />
      <ErrorText message={error} />
      {notice ? <Text style={{ color: colors.success }}>{notice}</Text> : null}
      <Button title="הרשמה" onPress={submit} loading={loading} />
      <Link href="/(auth)/sign-in" replace style={{ textAlign: 'center', paddingVertical: 8 }}>
        <Text style={{ color: colors.primary, textAlign: 'center' }}>כבר יש לכם חשבון? התחברות</Text>
      </Link>
    </AuthShell>
  );
}
