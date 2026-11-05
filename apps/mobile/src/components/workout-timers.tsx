import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { workoutRunElapsed, type WorkoutRunProgress } from '@fit/contracts';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type } from '@/constants/theme';
export function formatWorkoutTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export function WorkoutTimers({ progress: p }: { progress: WorkoutRunProgress }) {
  const { colors: c } = useAppTheme(), [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', value => { if (value === 'active') setNow(Date.now()); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  const rest = p.status === 'paused' ? p.restRemainingMs : p.restEndsAt === null ? null : Math.max(0, p.restEndsAt - now);
  return <View style={s.row}>
    <View style={[s.clock, { backgroundColor: c.primarySoft }]}><Text style={[s.label, { color: c.textMuted }]}>TEMPO TOTAL</Text><Text numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Tempo total do treino ${formatWorkoutTime(workoutRunElapsed(p, now))}`} style={[s.digits, { color: c.text }]}>{formatWorkoutTime(workoutRunElapsed(p, now))}</Text><Text numberOfLines={2} style={[s.caption, { color: c.textMuted }]}>{p.status === 'paused' ? 'Pausado' : p.finishedAt ? 'Tempo registrado' : 'Treino em andamento'}</Text></View>
    <View style={[s.clock, { backgroundColor: c.surfaceSoft }]}><Text style={[s.label, { color: c.textMuted }]}>DESCANSO</Text><Text numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={rest === null ? 'Descanso não iniciado' : `Descanso ${formatWorkoutTime(rest)}`} style={[s.digits, { color: c.text }]}>{rest === null ? '—:—' : formatWorkoutTime(rest).slice(3)}</Text><Text numberOfLines={2} style={[s.caption, { color: c.textMuted }]}>{rest === null ? 'Inicie quando precisar' : p.status === 'paused' ? 'Pausado com o treino' : rest > 0 ? 'Respire e recupere' : 'Pode continuar'}</Text></View>
  </View>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', gap: 10 }, clock: { flex: 1, padding: 12, minHeight: 112, borderRadius: Radius.lg, justifyContent: 'space-between' }, label: { ...Type.caption, fontWeight: '700', letterSpacing: .6 }, digits: { ...Type.headline, fontWeight: '800', fontVariant: ['tabular-nums'] }, caption: { ...Type.caption, minHeight: 36 } });

export function WorkoutElapsed({ progress }: { progress: WorkoutRunProgress }) {
  const { colors: c } = useAppTheme(), [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...Type.caption, fontVariant: ['tabular-nums'], color: c.textMuted }}>{formatWorkoutTime(workoutRunElapsed(progress, now))}</Text>;
}
