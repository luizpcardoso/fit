import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { isWorkoutRunOpen } from '@fit/contracts';
import { useWorkoutRun } from './workout-run-provider';
import { WorkoutElapsed } from './workout-timers';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';

export function ActiveWorkoutBanner({ containerStyle }: { containerStyle?: StyleProp<ViewStyle> }) {
  const { run, dirty } = useWorkoutRun(), { colors: c } = useAppTheme();
  if (!run || (!isWorkoutRunOpen(run.progress) && !dirty)) return null;
  const open = isWorkoutRunOpen(run.progress), paused = run.progress.status === 'paused';
  const exercise = run.exercises[run.progress.currentIndex];
  const sets = run.progress.exercises.find(e => e.id === exercise?.id)?.completedSets.length ?? 0;
  const doneSets = run.progress.exercises.reduce((sum, e) => sum + e.completedSets.length, 0);
  const totalSets = run.exercises.reduce((sum, e) => sum + e.sets, 0);
  const status = paused ? 'pausado' : open ? 'em andamento' : run.progress.status === 'discarded' ? 'descartado' : 'finalizado';
  return <View style={containerStyle}>
    <Pressable testID="active-workout-banner" accessibilityRole="button" accessibilityLabel={open ? `Continuar treino ${run.divisionLabel}` : `Ver treino ${run.divisionLabel} salvo no aparelho`} accessibilityHint={open ? `Treino ${status}. ${doneSets} de ${totalSets} séries feitas. Abre a sessão preservando seu progresso.` : 'Abre o resultado salvo que aguarda sincronização.'} onPress={() => router.push('/workout-run')} style={[s.card, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
      <View style={s.row}><Text numberOfLines={1} style={[s.title, s.flex, { color: c.text }]}>Treino {run.divisionLabel} {status}</Text><View style={s.time}><WorkoutElapsed progress={run.progress}/></View></View>
      <Text numberOfLines={1} style={[s.body, { color: c.textMuted }]}>{open ? `${run.progress.currentIndex + 1}/${run.exercises.length} · ${exercise?.name ?? run.divisionName}` : 'Resultado salvo neste aparelho'}</Text>
      <View style={s.row}><Text numberOfLines={1} style={[s.caption, s.flex, { color: c.textMuted }]}>{open ? `${doneSets} de ${totalSets} séries · exercício ${sets}/${exercise?.sets ?? 0}` : 'Sincronização pendente'}</Text><View style={s.action}><Text numberOfLines={1} style={[s.caption, { color: c.link, fontWeight: '800' }]}>{open ? 'Continuar' : 'Ver resultado'}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/></View></View>
      <View style={[s.track, { backgroundColor: c.border }]}><View style={[s.fill, { backgroundColor: c.accent, width: `${doneSets / Math.max(1, totalSets) * 100}%` }]}/></View>
    </Pressable>
  </View>;
}
const s = StyleSheet.create({
  card: { minHeight: 116, padding: 14, gap: 6, borderWidth: 1, borderRadius: Radius.lg }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1, minWidth: 0 }, title: { ...Type.body, fontWeight: '800' },
  body: { ...Type.body }, caption: { ...Type.caption }, time: { width: 72, alignItems: 'flex-end' }, action: { minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 2 }, track: { height: 4, borderRadius: 2, overflow: 'hidden' }, fill: { height: 4 },
});
