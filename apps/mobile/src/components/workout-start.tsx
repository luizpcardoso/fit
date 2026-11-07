import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { WorkoutGoalSummary, WorkoutSession } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { useWorkoutRun } from './workout-run-provider';
import { FixedScreenHeader } from './screen-header';
import { confirmAction } from './app-dialog';
import { supportsWorkoutControls } from '@/utils/workout-run-notification';
import { WorkoutIllustration } from './workout-illustration';
import { ExerciseThumbnail } from './exercise-thumbnail';
import { formatMeasure } from '@/utils/numbers';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type, Scrim } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';
import { localDate } from '@/utils/dates';
import { workoutStartChoices } from '@/utils/workout-start-choice';

export function WorkoutStart({ planId, divisionId, suggestedDivisionId }: { planId?: string; divisionId?: string; suggestedDivisionId?: string }) {
  const session = useWorkoutRun(), { api } = useAuth(), { colors: c } = useAppTheme();
  const [goal, setGoal] = useState<WorkoutGoalSummary | null>(null), [history, setHistory] = useState<WorkoutSession[]>([]), [suggesting, setSuggesting] = useState(true);
  const [choice, setChoice] = useState<string | null>(null), [choosing, setChoosing] = useState(false), [showExercises, setShowExercises] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const fallback = new Promise<[PromiseSettledResult<WorkoutGoalSummary>, PromiseSettledResult<WorkoutSession[]>]>(resolve => {
      timer = setTimeout(() => resolve([{ status: 'rejected', reason: 'offline' }, { status: 'rejected', reason: 'offline' }]), 5000);
    });
    void Promise.race([Promise.allSettled([api.getWorkoutGoal(localDate()), api.listWorkoutSessions()]), fallback]).then(([g, h]) => {
      clearTimeout(timer);
      if (!active) return;
      if (g.status === 'fulfilled') setGoal(g.value);
      if (h.status === 'fulfilled') setHistory(h.value);
      setSuggesting(false);
    });
    return () => { active = false; clearTimeout(timer); };
  }, [api]);
  const { choices, planned, suggested } = workoutStartChoices(session.plans, goal, history, localDate(), planId, divisionId, suggestedDivisionId);
  const selected = choices.find(x => x.division.id === choice) ?? suggested;
  const start = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await session.start(selected.plan, selected.division.id);
      // Offered once, at the moment it is useful, instead of a permanent switch on this screen.
      if (supportsWorkoutControls && !session.notificationEnabled && !session.notificationOffered) {
        if (await confirmAction({ title: 'Controlar pela tela de bloqueio?', message: 'Mostramos a série atual e o horário de fim do descanso numa notificação, com botões para concluir a série e pular o descanso. O nome do exercício pode aparecer com o celular desbloqueado.', confirmLabel: 'Ativar controle', cancelLabel: 'Agora não' })) await session.setNotificationEnabled(true).catch(() => {});
        else await session.declineNotificationOffer();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar. Tente novamente.'); } finally { setBusy(false); }
  };
  if (!session.ready || (session.plansLoading && !choices.length)) return <ActivityIndicator accessibilityLabel="Preparando seus treinos" color={c.link}/>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><FixedScreenHeader backLabel="Fitness" showHome/><ScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>Qual treino vamos fazer?</Text>
    <Text style={[s.body, { color: c.textMuted }]}>{planned ? `Planejado para hoje: Treino ${planned.division.label} · ${planned.division.name}. Você pode escolher outro.` : 'Confirme o treino antes de começar. Você pode escolher qualquer treino disponível.'}</Text>
    {selected ? <>
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={s.row}>{selected.division.illustrationId ? <WorkoutIllustration id={selected.division.illustrationId} style={{ width: 96 }}/> : <View style={[s.badge, { backgroundColor: c.primarySoft }]}><Text style={[s.letter, { color: c.link }]}>{selected.division.label}</Text></View>}<View style={s.flex}><Text accessibilityRole="header" numberOfLines={2} style={[s.heading, { color: c.text, minHeight: 48 }]}>Treino {selected.division.label} · {selected.division.name}</Text><Text numberOfLines={1} style={[s.body, { color: c.textMuted }]}>{selected.plan.name}</Text></View></View>
        <Text style={[s.body, { color: c.textMuted }]}>{selected.division.exercises.length} {selected.division.exercises.length === 1 ? 'exercício' : 'exercícios'} · {selected.division.exercises.reduce((n, e) => n + e.sets, 0)} séries</Text>
        <Pressable accessibilityRole="button" aria-expanded={showExercises} onPress={() => setShowExercises(value => !value)} style={s.previewToggle}><Text style={[s.actionText, { color: c.link }]}>{showExercises ? 'Ocultar exercícios' : 'Ver exercícios'}</Text><MaterialCommunityIcons name={showExercises ? 'chevron-up' : 'chevron-down'} size={20} color={c.link}/></Pressable>
        {showExercises ? <View style={[s.preview, { borderColor: c.border }]}>{selected.division.exercises.map((exercise, index) => <View key={exercise.id} style={[s.previewRow, index > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}><ExerciseThumbnail name={exercise.name} uri={exercise.imageUrl} size={60}/><View style={s.flex}><Text numberOfLines={2} style={[s.body, { color: c.text, fontWeight: '700' }]}>{exercise.name}</Text><Text style={[s.caption, { color: c.textMuted }]}>{exercise.sets} × {exercise.reps.replace(/(\d)\s*-\s*(\d)/g, '$1–$2')}{exercise.load != null ? ` · ${formatMeasure(exercise.load, 'kg', 2)}` : ''}</Text></View></View>)}</View> : null}
        <Pressable accessibilityRole="button" onPress={() => setChoosing(true)} style={[s.change, { backgroundColor: c.surfaceSoft }]}><MaterialCommunityIcons name="swap-horizontal" size={22} color={c.link}/><Text style={[s.actionText, { color: c.link }]}>Escolher outro treino</Text></Pressable>
      </View>
      <View style={[s.notice, { backgroundColor: c.primarySoft }]}><MaterialCommunityIcons name="timer-outline" size={25} color={c.link}/><View style={s.flex}><Text style={[s.heading, { color: c.text }]}>O cronômetro começa ao iniciar</Text><Text style={[s.body, { color: c.textMuted }]}>Toque em cada série ao terminá-la. Sair da tela não perde o treino.</Text></View></View>

    </> : <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}><Text style={[s.heading, { color: c.text }]}>Você ainda não tem treinos disponíveis</Text><Text style={[s.body, { color: c.textMuted }]}>Crie uma ficha para organizar seus exercícios. Fichas carregadas neste aparelho também ficam disponíveis sem conexão.</Text><Pressable accessibilityRole="button" onPress={() => router.dismissTo({ pathname: '/workouts', params: { section: 'plans' } })} style={s.change}><Text style={[s.actionText, { color: c.link }]}>Ver minhas fichas</Text></Pressable></View>}
    </ScrollView>
    {selected ? <View style={[s.startFooter, { backgroundColor: c.surface, borderColor: c.border }]}>
      {error ? <View style={s.feedback}><Text accessibilityLiveRegion="polite" style={[s.body, { color: c.danger }]}>{error}</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Iniciar treino ${selected.division.label}`} disabled={busy || suggesting || !!session.conflict} aria-disabled={busy || suggesting || !!session.conflict} aria-busy={busy} onPress={() => { void start(); }} style={[s.start, { backgroundColor: c.primary, opacity: busy || suggesting || !!session.conflict ? .55 : 1 }]}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <MaterialCommunityIcons name="play" size={24} color={c.onPrimary}/>}<Text style={[s.actionText, { color: c.onPrimary }]}>Iniciar treino {selected.division.label}</Text></Pressable>
    </View> : null}
    <Modal visible={choosing} transparent animationType="fade" onRequestClose={() => setChoosing(false)}><View style={s.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Fechar escolha de treino" onPress={() => setChoosing(false)} style={StyleSheet.absoluteFill}/><SafeAreaView style={[s.sheet, { backgroundColor: c.surface }]}><Text accessibilityRole="header" style={[s.title, { color: c.text }]}>Escolha seu treino</Text><Text style={[s.body, { color: c.textMuted }]}>A escolha vale para esta sessão. Sua programação continua a mesma.</Text><ScrollView contentContainerStyle={{ gap: 10 }}>
      {[...choices].sort((a, b) => Number(b.plan.isActive) - Number(a.plan.isActive)).map((item, index, list) => <View key={item.division.id} style={{ gap: 8 }}>{index === 0 || list[index - 1].plan.id !== item.plan.id ? <Text style={[s.groupTitle, { color: c.textMuted }]}>{item.plan.isActive ? `Ficha ativa · ${item.plan.name}` : item.plan.name}</Text> : null}<Pressable accessibilityRole="radio" aria-checked={item.division.id === selected?.division.id} accessibilityLabel={`Treino ${item.division.label}, ${item.division.name}, ${item.plan.name}`} onPress={() => { setChoice(item.division.id); setChoosing(false); }} style={[s.option, { borderColor: item.division.id === selected?.division.id ? c.primary : c.border, backgroundColor: c.surfaceSoft }]}><WorkoutIllustration id={item.division.illustrationId} style={{ width: 64 }}/><View style={s.flex}><Text style={[s.heading, { color: c.text }]}>Treino {item.division.label} · {item.division.name}</Text><Text style={[s.body, { color: c.textMuted }]}>{item.plan.name} · {item.division.exercises.length} exercícios{item.division.id === planned?.division.id ? ' · Planejado para hoje' : ''}</Text></View><MaterialCommunityIcons name={item.division.id === selected?.division.id ? 'radiobox-marked' : 'radiobox-blank'} size={23} color={c.link}/></Pressable></View>)}
    </ScrollView><Pressable accessibilityRole="button" onPress={() => setChoosing(false)} style={s.change}><Text style={[s.actionText, { color: c.link }]}>Voltar</Text></Pressable></SafeAreaView></View></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({ groupTitle: { ...Type.caption, fontWeight: '800', letterSpacing: .4, textTransform: 'uppercase', marginTop: 4 }, previewToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, preview: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 12 }, previewRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, caption: { ...Type.caption }, content: { padding: 16, gap: 14, paddingBottom: 24, maxWidth: 680, width: '100%', alignSelf: 'center' }, startFooter: { padding: 12, gap: 8, borderTopWidth: 1 }, title: { ...Type.headline, fontWeight: '800' }, heading: { ...Type.bodyLarge, fontWeight: '700' }, body: { ...Type.body }, card: { borderWidth: 1, borderRadius: Radius.xl, padding: 20, gap: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14 }, flex: { flex: 1 }, badge: { width: 96, height: 72, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' }, letter: { ...Type.headline, fontWeight: '800' }, change: { minHeight: 48, padding: 12, borderRadius: Radius.md, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, actionText: { ...Type.body, fontWeight: '800', textAlign: 'center' }, notice: { borderRadius: Radius.lg, padding: 16, flexDirection: 'row', gap: 12 }, start: { minHeight: 56, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, feedback: { minHeight: 22, justifyContent: 'center' }, overlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'center', padding: 16 }, sheet: { maxHeight: '90%', padding: 20, borderRadius: Radius.xl, gap: 16 }, option: { minHeight: 76, padding: 14, borderRadius: Radius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 } });
