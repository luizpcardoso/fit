import MaterialCommunityIcons from '@/components/icon';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme, type ThemePreference } from '@/theme/theme-provider';
import type { AppPalette } from '@/constants/theme';

const options: { value: ThemePreference; label: string; detail: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', detail: 'Acompanhar a aparência do aparelho', icon: 'theme-light-dark' },
  { value: 'light', label: 'Claro', detail: 'Fundo claro, ideal em ambientes iluminados', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Escuro', detail: 'Fundo escuro, mais confortável à noite', icon: 'moon-waning-crescent' },
];
export function ThemeSettings() {
  const { colors: c, preference, setPreference, saving, ready, error } = useAppTheme();
  const s = styles(c);
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>Aparência</Text>
    <View style={s.card}>{saving ? <View style={s.heading}><ActivityIndicator color={c.link} accessibilityLabel="Salvando tema" /></View> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Tema do aplicativo">{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`Tema ${option.label.toLowerCase()}`} aria-checked={preference === option.value} aria-disabled={saving || !ready} disabled={saving || !ready} onPress={() => void setPreference(option.value)} style={[s.option, preference === option.value && s.selected]}>
        <MaterialCommunityIcons name={option.icon} size={23} color={c.link} /><View style={s.copy}><Text style={s.label}>{option.label}</Text><Text style={s.detail}>{option.detail}</Text></View><MaterialCommunityIcons name={preference === option.value ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={preference === option.value ? c.link : c.textMuted} />
      </Pressable>)}</View>
      <Text style={s.detail}>Preferência salva neste aparelho.</Text>{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </View>
  </View>;
}
const styles = (c: AppPalette) => StyleSheet.create({ section: { gap: 12 }, title: { fontSize: 20, fontWeight: '800', color: c.text }, card: { borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, label: { color: c.text, fontWeight: '700', fontSize: 14 }, detail: { color: c.textMuted, fontSize: 12, lineHeight: 18 }, option: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 16, marginBottom: 6, minHeight: 64 }, selected: { backgroundColor: c.primarySoft }, copy: { flex: 1, gap: 3 }, error: { color: c.danger, fontSize: 13 } });
