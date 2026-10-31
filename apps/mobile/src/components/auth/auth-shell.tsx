import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme-provider';
import type { AppPalette } from '@/constants/theme';
export function useAuthStyles() { const { colors } = useAppTheme(); return createAuthStyles(colors); }
export function AuthShell({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { colors: theme } = useAppTheme(); const colors = { ...theme, muted: theme.textMuted }; const shell = createShell(theme);
  return <SafeAreaView style={[shell.safe, { backgroundColor: colors.background }]}><View style={shell.safe}><ScrollView keyboardLayout="layout" keyboardShouldPersistTaps="handled" contentContainerStyle={shell.scroll}>
    <View style={shell.brand}><View style={shell.logo}><Text style={shell.logoText}>F</Text></View><Text style={[shell.brandName, { color: colors.text }]}>Fit</Text></View>
    <View style={[shell.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[shell.title, { color: colors.text }]}>{title}</Text><Text style={[shell.subtitle, { color: colors.muted }]}>{subtitle}</Text><View style={shell.form}>{children}</View></View>
  </ScrollView></View></SafeAreaView>;
}
const createAuthStyles = (c: AppPalette) => StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 16, color: c.textMuted, marginTop: 6 }, passwordWrap: { position: 'relative', justifyContent: 'center' }, passwordInput: { paddingRight: 52 }, reveal: { position: 'absolute', right: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  label: { fontSize: 13, fontWeight: '700', color: c.textMuted, marginBottom: 7 }, input: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 15, color: c.text, fontSize: 16 }, inputError: { borderColor: c.danger }, error: { color: c.danger, fontSize: 12, marginTop: 5 }, field: { gap: 0 }, button: { minHeight: 52, borderRadius: 16, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center', marginTop: 4 }, buttonDisabled: { opacity: 0.55 }, buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' }, footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 }, footerText: { color: c.textMuted, fontSize: 14 }, link: { color: c.link, fontSize: 14, fontWeight: '800' }, alert: { backgroundColor: c.dangerSoft, borderRadius: 12, padding: 12 }, alertText: { color: c.danger, fontSize: 13 }, row: { flexDirection: 'row', gap: 10 }, grow: { flex: 1 },
});
const createShell = (c: AppPalette) => StyleSheet.create({ safe: { flex: 1 }, scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 28 }, brand: { alignItems: 'center', gap: 8 }, logo: { width: 56, height: 56, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' }, brandName: { fontSize: 24, fontWeight: '800' }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 22 }, title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { fontSize: 14, lineHeight: 20, marginTop: 7 }, form: { gap: 15, marginTop: 24 } });
