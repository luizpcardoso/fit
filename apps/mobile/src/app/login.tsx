import { FormInput as TextInput } from '@/components/form-input';
import { useAppTheme } from '@/theme/theme-provider';
import { ApiClientError } from '@fit/api-client';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { AuthShell, useAuthStyles } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';

type Errors = { email?: string; password?: string };
export default function LoginScreen() {
  const styles = useAuthStyles(); const { colors } = useAppTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const found: Errors = { email: email.trim() ? undefined : 'Informe seu e-mail.', password: password ? undefined : 'Informe sua senha.' };
    setErrors(found);
    if (found.email || found.password) return;
    setBusy(true); setError('');
    try { await login({ email: email.trim(), password }); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Não foi possível conectar. Verifique sua internet e tente novamente.'); }
    finally { setBusy(false); }
  };
  return <AuthShell title="Boas-vindas" subtitle="Entre para acompanhar seus treinos e seu progresso.">
    {error ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{error}</Text></View> : null}
    <View style={styles.field}><Text style={styles.label}>E-mail</Text>
      <TextInput accessibilityLabel="E-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={value => { setEmail(value); setErrors(current => ({ ...current, email: undefined })); }} style={[styles.input, errors.email && styles.inputError]} placeholder="voce@exemplo.com" returnKeyType="next" />
      {errors.email ? <Text accessibilityRole="alert" style={styles.error}>{errors.email}</Text> : null}
    </View>
    <View style={styles.field}><Text style={styles.label}>Senha</Text>
      <PasswordInput accessibilityLabel="Senha" autoComplete="current-password" textContentType="password" value={password} onChangeText={value => { setPassword(value); setErrors(current => ({ ...current, password: undefined })); }} style={[styles.input, errors.password && styles.inputError]} onSubmitEditing={() => void submit()} returnKeyType="go" />
      {errors.password ? <Text accessibilityRole="alert" style={styles.error}>{errors.password}</Text> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Entrar" aria-disabled={busy} aria-busy={busy} disabled={busy} onPress={() => void submit()} style={[styles.button, busy && styles.buttonDisabled]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Entrar</Text>}</Pressable>
    <View style={styles.footer}><Text style={styles.footerText}>Ainda não tem conta?</Text><Link href="/register" style={styles.link}>Criar conta</Link></View>
  </AuthShell>;
}
