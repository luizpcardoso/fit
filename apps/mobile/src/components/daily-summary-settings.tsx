import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useDailySummary } from './daily-summary-provider';
import { dailySummaryContent } from '@/utils/daily-summary-content';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';

export function DailySummarySettings() {
  const { colors: c } = useAppTheme();
  const { ready, enabled, busy, error, summary, setEnabled, refresh } = useDailySummary();
  if (Platform.OS !== 'android') return null;
  const s = styles(c);
  const preview = summary ? dailySummaryContent(summary) : null;
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.title}>Resumo nas notificações</Text>
    <View style={s.card}>
      <View style={s.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text nativeID="daily-summary-label" style={s.label}>Manter resumo do dia</Text>
          <Text style={s.detail}>Checks concluídos, calorias e uma pendência, sem som ou vibração.</Text>
        </View>
        <Switch accessibilityLabel="Manter resumo do dia nas notificações" accessibilityLabelledBy="daily-summary-label"
          disabled={!ready || busy} value={enabled} onValueChange={value => void setEnabled(value)}
          trackColor={{ false: c.controlTrackOff, true: c.primary }} thumbColor={c.controlThumb} />
      </View>
      <Text style={s.detail}>Ao ativar, checks e calorias poderão aparecer na tela bloqueada. Nomes de medicamentos e detalhes pessoais ficam ocultos.</Text>
      <Text style={s.detail}>Atualiza após seus registros e ao abrir o app. Com o app fechado, mostra a última atualização. A preferência vale para esta conta neste aparelho.</Text>
      {busy ? <ActivityIndicator accessibilityLabel="Atualizando resumo nas notificações" color={c.link} /> : null}
      {enabled && preview ? <View style={s.preview}>
        <Text style={s.label}>{preview.title}</Text>
        <Text style={s.detail}>{preview.body}</Text>
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text> : null}
      {enabled ? <Pressable accessibilityRole="button" disabled={busy || !ready} onPress={() => void refresh()} style={s.button}>
        <Text style={{ color: c.link, fontWeight: '700' }}>{summary ? 'Atualizar card' : 'Tentar carregar resumo'}</Text>
      </Pressable> : null}
      {error.includes('notificaç') ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={s.button}>
        <Text style={{ color: c.link, fontWeight: '700' }}>Abrir ajustes do Android</Text>
      </Pressable> : null}
      {enabled ? <Text style={s.detail}>O Android pode permitir dispensar o card. Use “Atualizar card” para exibi-lo novamente.</Text> : null}
    </View>
  </View>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  title: { ...Type.title, fontWeight: '800', color: c.text },
  label: { ...Type.body, fontWeight: '700', color: c.text },
  detail: { ...Type.label, color: c.textMuted, lineHeight: 20 },
  card: { borderRadius: Radius.xl, padding: 16, gap: 12, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48 },
  preview: { backgroundColor: c.surfaceSoft, borderRadius: Radius.lg, padding: 14, gap: 8 },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
