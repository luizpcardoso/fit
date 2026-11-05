import { Platform, Switch, Text, View, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useWorkoutRun } from './workout-run-provider';
import { useAppTheme } from '@/theme/theme-provider';
import { Type, Radius } from '@/constants/theme';
import { supportsWorkoutNavigation } from '@/utils/workout-run-notification';
export function WorkoutNotificationPreference() {
  const { notificationEnabled, setNotificationEnabled, ready } = useWorkoutRun();
  const { colors: c } = useAppTheme();
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const toggle = async (value: boolean) => {
    if (saving) return;
    setSaving(true); setError('');
    try { await setNotificationEnabled(value); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a preferência.'); } finally { setSaving(false); }
  };
  return <View style={[styles.card, { backgroundColor: c.surfaceSoft }]}>
    <View style={styles.row}><View style={styles.copy}><Text style={[styles.title, { color: c.text }]}>Controlar pela notificação</Text><Text style={[styles.detail, { color: c.textMuted }]}>{Platform.OS === 'android' ? 'Exercício, séries e tempo no card do Android. Expanda para usar os controles.' : 'Disponível no Android. Aqui, use os controles do aplicativo.'}</Text></View><Switch accessibilityLabel="Controlar treino pela notificação" value={notificationEnabled} disabled={saving || !ready || Platform.OS !== 'android'} onValueChange={value => { void toggle(value); }} trackColor={{ false: c.controlTrackOff, true: c.primary }} thumbColor={c.controlThumb}/></View>
    <Text style={[styles.detail, { color: c.textMuted, minHeight: 48 }]}>{notificationEnabled ? 'O exercício pode aparecer com o aparelho desbloqueado. Você pode desligar a qualquer momento.' : 'Desligado: controle apenas pelo aplicativo aberto. Seu progresso continua salvo.'}</Text>
    {Platform.OS === 'android' && notificationEnabled && !supportsWorkoutNavigation ? <Text style={[styles.detail, { color: c.textMuted }]}>Instale a versão mais recente do APK para os controles de séries e navegação.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={[styles.detail, { color: c.danger }]}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 14, borderRadius: Radius.lg, gap: 8 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' }, copy: { flex: 1, gap: 4 }, title: { ...Type.body, fontWeight: '700' }, detail: { ...Type.caption } });
