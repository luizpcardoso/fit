import { FormInput as TextInput } from '@/components/form-input';
import { useAppTheme } from '@/theme/theme-provider';
import { ApiClientError } from '@fit/api-client';
import { registerInputSchema } from '@fit/contracts';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type TextInputProps } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { AuthShell, useAuthStyles } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { formatPhoneInput } from '@/utils/input-format';

type Fields = { email: string; password: string; phone: string; firstName: string; lastName: string };
const initial: Fields = { email: '', password: '', phone: '', firstName: '', lastName: '' };
const hints: Partial<Record<keyof Fields, string>> = {
  phone: 'Privado: não aparece para outras pessoas.',
  password: 'Use pelo menos 8 caracteres.',
};
export default function RegisterScreen() {
  const styles = useAuthStyles(); const { colors } = useAppTheme();
  const { register } = useAuth(); const [form, setForm] = useState(initial); const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({}); const [general, setGeneral] = useState(''); const [busy, setBusy] = useState(false);
  const field = (key: keyof Fields, value: string) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const submit = async () => {
    const parsed = registerInputSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Partial<Record<keyof Fields, string[]>>;
      // Empty fields get a plain "required" message instead of the length rule.
      setErrors(Object.fromEntries((Object.keys(initial) as (keyof Fields)[]).filter(key => flat[key]?.length).map(key => [key, form[key].trim() ? flat[key]![0] : 'Preencha este campo.'])));
      return;
    }
    setBusy(true); setGeneral('');
    try { await register(parsed.data); }
    catch (cause) {
      if (cause instanceof ApiClientError) { setGeneral(cause.message); const emailError = cause.details.fieldErrors?.email?.[0]; if (emailError) setErrors((current) => ({ ...current, email: emailError })); }
      else setGeneral('Não foi possível conectar. Verifique sua internet e tente novamente.');
    } finally { setBusy(false); }
  };
  const message = (key: keyof Fields) => errors[key] ? <Text accessibilityRole="alert" style={styles.error}>{errors[key]}</Text> : hints[key] ? <Text style={styles.hint}>{hints[key]}</Text> : null;
  const input = (key: keyof Fields, label: string, props: TextInputProps = {}) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={form[key]} onChangeText={(value) => field(key, value)} style={[styles.input, errors[key] && styles.inputError]} {...props} />{message(key)}</View>;
  return <AuthShell title="Crie sua conta" subtitle="Seus dados de perfil são privados e usados para identificar sua conta.">
    {general ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{general}</Text></View> : null}
    <View style={styles.row}><View style={styles.grow}>{input('firstName', 'Nome', { autoComplete: 'given-name', placeholder: 'Ex.: Luiz' })}</View><View style={styles.grow}>{input('lastName', 'Sobrenome', { autoComplete: 'family-name', placeholder: 'Ex.: Silva' })}</View></View>
    {input('phone', 'Telefone', { autoComplete: 'tel', keyboardType: 'phone-pad', placeholder: '(71) 99999-9999', maxLength: 15, onChangeText: value => field('phone', formatPhoneInput(value)) })}
    {input('email', 'E-mail', { autoCapitalize: 'none', autoComplete: 'email', keyboardType: 'email-address', placeholder: 'voce@exemplo.com' })}
    <View style={styles.field}><Text style={styles.label}>Senha</Text>
      <PasswordInput accessibilityLabel="Senha" autoComplete="new-password" textContentType="newPassword" value={form.password} onChangeText={value => field('password', value)} style={[styles.input, errors.password && styles.inputError]} onSubmitEditing={() => void submit()} />
      {message('password')}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Criar conta" aria-disabled={busy} aria-busy={busy} disabled={busy} onPress={() => void submit()} style={[styles.button, busy && styles.buttonDisabled]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Criar conta</Text>}</Pressable>
    <View style={styles.footer}><Text style={styles.footerText}>Já tem uma conta?</Text><Link href="/login" style={styles.link}>Entrar</Link></View>
  </AuthShell>;
}
