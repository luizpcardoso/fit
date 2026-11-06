import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { isWorkoutRunOpen } from '@fit/contracts';
import { useWorkoutRun } from './workout-run-provider';
import { WorkoutElapsed } from './workout-timers';
import { useAppTheme } from '@/theme/theme-provider';
import { CardShadow, Radius, Type } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';

/** Compact "now playing" capsule above the dock: an open (or unsynced) workout stays one tap away from every tab. */
export function WorkoutMiniPlayer() {
  const { run, dirty } = useWorkoutRun(), { colors: c } = useAppTheme();
  if (!run || (!isWorkoutRunOpen(run.progress) && !dirty)) return null;
  const open = isWorkoutRunOpen(run.progress), paused = run.progress.status === 'paused';
  const exercise = run.exercises[run.progress.currentIndex];
  const doneSets = run.progress.exercises.reduce((sum, e) => sum + e.completedSets.length, 0);
  const totalSets = run.exercises.reduce((sum, e) => sum + e.sets, 0);
  const status = paused ? 'pausado' : open ? 'em andamento' : run.progress.status === 'discarded' ? 'descartado' : 'finalizado';
  const detail = open ? `${doneSets} de ${totalSets} séries · ${exercise?.name ?? run.divisionName}` : 'Salvo neste aparelho · sincronização pendente';
  return <Pressable testID="workout-mini-player" accessibilityRole="button" accessibilityLabel={open ? `Continuar treino ${run.divisionLabel}` : `Ver treino ${run.divisionLabel} salvo no aparelho`} accessibilityHint={open ? `Treino ${status}. ${doneSets} de ${totalSets} séries feitas. Abre a sessão preservando seu progresso.` : 'Abre o resultado salvo que aguarda sincronização.'} onPress={() => router.push('/workout-run')} style={({ pressed }) => [s.card, CardShadow, { backgroundColor: c.primarySoft, borderColor: c.primary }, pressed && s.pressed]}>
    <View style={[s.icon, { backgroundColor: c.primary }]}><MaterialCommunityIcons name={paused ? 'pause' : open ? 'dumbbell' : 'cloud-upload-outline'} size={19} color={c.onPrimary}/></View>
    <View style={s.copy}>
      <Text numberOfLines={1} style={[s.title, { color: c.text }]}>Treino {run.divisionLabel} {status}</Text>
      <Text numberOfLines={1} style={[s.caption, { color: c.textMuted }]}>{detail}</Text>
    </View>
    {open ? <View style={s.time}><WorkoutElapsed progress={run.progress}/></View> : null}
    <MaterialCommunityIcons name="chevron-right" size={22} color={c.link}/>
    <View style={[s.track, { backgroundColor: c.border }]}><View style={[s.fill, { backgroundColor: c.accent, width: `${doneSets / Math.max(1, totalSets) * 100}%` }]}/></View>
  </Pressable>;
}
const s = StyleSheet.create({
  card: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 9, paddingRight: 8, borderWidth: 1, borderRadius: Radius.xl, overflow: 'hidden' },
  pressed: { transform: [{ scale: .985 }] }, icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 }, title: { ...Type.label, fontWeight: '800' }, caption: { ...Type.caption }, time: { maxWidth: 64, alignItems: 'flex-end' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 }, fill: { height: 3 },
});
