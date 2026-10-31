import MaterialCommunityIcons from '@/components/icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/screen-header';
import { ThemeSettings } from '@/components/theme-settings';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { setHomePreference, useHomePreferences } from '@/utils/home-preferences';

export default function Settings() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { showEnergyBalance } = useHomePreferences();
  const [error, setError] = useState('');
  const toggleEnergy = async (value: boolean) => {
    setError('');
    try { await setHomePreference('showEnergyBalance', value); }
    catch { setError('Não foi possível salvar esta preferência. Tente novamente.'); }
  };
  return <SafeAreaView style={s.safe} edges={['top']}>
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader backLabel="Início" showHome={false} />
      <View>
        <Text accessibilityRole="header" style={s.title}>Configurações</Text>
        <Text style={s.subtitle}>Preferências deste aparelho</Text>
      </View>
      <ThemeSettings />
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Tela inicial</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.copy}>
              <Text nativeID="energy-toggle-label" style={s.label}>Mostrar balanço calórico</Text>
              <Text style={s.detail}>Exibe consumo e gasto estimado do dia no Início. Os registros continuam disponíveis na aba Nutrição.</Text>
            </View>
            <Switch accessibilityLabel="Mostrar balanço calórico no Início" accessibilityLabelledBy="energy-toggle-label" value={showEnergyBalance} onValueChange={value => void toggleEnergy(value)}
              trackColor={{ false: c.controlTrackOff, true: c.primary }} thumbColor={c.controlThumb} ios_backgroundColor={c.controlTrackOff} />
          </View>
          <Text style={s.detail}>Preferência salva neste aparelho.</Text>
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        </View>
      </View>
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Privacidade</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/blocked-users')} style={[s.card, s.row]}>
          <MaterialCommunityIcons name="account-cancel-outline" size={22} color={c.link} />
          <View style={s.copy}>
            <Text style={s.label}>Pessoas ocultadas</Text>
            <Text style={s.detail}>Revise quem você ocultou nos grupos e desfaça quando quiser.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, paddingBottom: 110, gap: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { ...Type.display, fontWeight: '800', letterSpacing: -0.6, color: c.text },
  subtitle: { ...Type.label, color: c.textMuted, marginTop: 2 },
  section: { gap: 12 },
  sectionTitle: { ...Type.title, fontWeight: '800', color: c.text },
  card: { borderRadius: Radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  copy: { flex: 1, gap: 4 },
  label: { ...Type.body, fontWeight: '700', color: c.text },
  detail: { ...Type.label, color: c.textMuted },
  error: { ...Type.label, color: c.danger },
});
