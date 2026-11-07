import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { completeWorkoutRunExercise, isWorkoutRunOpen, moveWorkoutRunExercise, toggleWorkoutRunPause, toggleWorkoutRunSet, updateWorkoutRunSetValues, workoutRunElapsed, workoutRunVolume, type PerformedSet, type WorkoutExercise, type WorkoutGoalSummary, type WorkoutRunPrevious, type WorkoutRunProgress } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { useWorkoutRun } from '@/components/workout-run-provider';
import { WorkoutStart } from '@/components/workout-start';
import { ExerciseThumbnail } from '@/components/exercise-thumbnail';
import { formatWorkoutTime } from '@/components/workout-timers';
import { WorkoutNotificationPreference } from '@/components/workout-notification-preference';
import { useAppTheme } from '@/theme/theme-provider';
import { Type, Radius, Scrim, type AppPalette } from '@/constants/theme';
import { FixedScreenHeader } from '@/components/screen-header';
import { confirmAction } from '@/components/app-dialog';
import { ShareActivityModal } from '@/components/share-activity-modal';
import MaterialCommunityIcons from '@/components/icon';
import { formatDecimalInput, formatDecimalValue } from '@/utils/input-format';
import { formatMeasure } from '@/utils/numbers';
import { localDate } from '@/utils/dates';

type ExerciseCompletionUndo = { runId: string; exerciseId: string; completedSets: number[]; skipped: boolean; performed?: PerformedSet[] };
type Panel = 'exercises' | 'exercise' | 'image' | 'options' | 'instructions' | null;
type SetValues = Omit<PerformedSet, 'set'>;

/** "8-10" → "8–10" so ranges read as ranges, not as a subtraction. */
const repsLabel = (reps: string) => reps.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
const parseLoad = (value: string) => { const number = Number(value.replace(',', '.')); return value.trim() && Number.isFinite(number) && number >= 0 && number <= 2000 ? Math.round(number * 100) / 100 : null; };
const setsTotal = (exercises: WorkoutExercise[]) => exercises.reduce((sum, exercise) => sum + exercise.sets, 0);

/** Ticks every second while visible; derived from timestamps, so it never drifts in background. */
function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', value => { if (value === 'active') setNow(Date.now()); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [active]);
  return now;
}

export default function WorkoutRunScreen() {
  const { colors: c } = useAppTheme(), s = styles(c), session = useWorkoutRun(), { api } = useAuth();
  const params = useLocalSearchParams<{ planId?: string; divisionId?: string; suggestedDivisionId?: string }>();
  const [panel, setPanel] = useState<Panel>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [finishedHere, setFinishedHere] = useState<string | null>(null), [sharing, setSharing] = useState<false | 'auto' | 'manual'>(false);
  const [completionUndo, setCompletionUndo] = useState<ExerciseCompletionUndo | null>(null);
  const [previous, setPrevious] = useState<{ divisionId: string; values: WorkoutRunPrevious } | null>(null);
  const [loadDrafts, setLoadDrafts] = useState<Record<string, string>>({});
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const run = session.run, p = run?.progress, open = Boolean(p && isWorkoutRunOpen(p));
  const result = Boolean(run && !open && (finishedHere === run.id || session.dirty));
  // Offer posting right after a workout finished on this screen; the result card can reopen it.
  const sharePrompted = useRef<string | null>(null);
  const historySessionId = run?.historySessionId ?? null;
  useEffect(() => {
    if (!result || !run || finishedHere !== run.id || !historySessionId || sharePrompted.current === historySessionId) return;
    sharePrompted.current = historySessionId;
    setSharing('auto');
  }, [result, run, finishedHere, historySessionId]);
  const exercise = run?.exercises[p?.currentIndex ?? 0], item = p?.exercises.find(x => x.id === exercise?.id);
  const done = run?.exercises.filter(e => p?.exercises.find(x => x.id === e.id)?.completedSets.length === e.sets).length ?? 0;
  const performed = p?.exercises.filter(e => e.completedSets.length > 0).length ?? 0;
  const doneSets = p?.exercises.reduce((sum, e) => sum + e.completedSets.length, 0) ?? 0;
  const totalSets = run ? setsTotal(run.exercises) : 0;
  const disabled = busy || !!session.conflict;
  const running = p?.status === 'running';
  const divisionId = run?.divisionId;

  // Previous values come from the account; offline the prescription is used instead.
  useEffect(() => {
    if (!divisionId) return;
    let active = true;
    api.getPreviousWorkoutValues(divisionId).then(values => { if (active) setPrevious({ divisionId, values }); }, () => {});
    return () => { active = false; };
  }, [api, divisionId]);

  const previousFor = (exerciseId: string, set: number) => { const list = previous?.divisionId === divisionId ? previous?.values[exerciseId] : undefined; return list?.find(entry => entry.set === set) ?? list?.[list.length - 1] ?? null; };
  const prefill = (target: WorkoutExercise, set: number): SetValues => {
    const last = previousFor(target.id, set);
    if (last) return { loadKg: last.loadKg, reps: last.reps };
    return { loadKg: target.load ?? null, reps: /^\d+$/.test(target.reps.trim()) ? Number(target.reps) : null };
  };
  // Simple logging: one load per exercise (keys include the run, so a previous session never leaks in); reps are taken from the last time or the prescription.
  const loadKey = (exerciseId: string) => `${run?.id}:${exerciseId}`;
  const recordedFor = (exerciseId: string, set: number) => p?.exercises.find(e => e.id === exerciseId)?.performed?.find(entry => entry.set === set);
  const shownLoad = (target: WorkoutExercise) => {
    const draft = loadDrafts[loadKey(target.id)];
    if (draft !== undefined) return draft;
    const recorded = [...(p?.exercises.find(e => e.id === target.id)?.performed ?? [])].reverse().find(entry => entry.loadKg != null);
    return formatDecimalValue(recorded ? recorded.loadKg : prefill(target, 0).loadKg);
  };
  const valuesOf = (target: WorkoutExercise, set: number): SetValues => ({ loadKg: parseLoad(shownLoad(target)), reps: recordedFor(target.id, set)?.reps ?? prefill(target, set).reps });
  const clearLoadDraft = (target: WorkoutExercise) => setLoadDrafts(current => { const next = { ...current }; delete next[loadKey(target.id)]; return next; });

  const act = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.'); } finally { setBusy(false); }
  };
  const update = (change: (value: WorkoutRunProgress) => WorkoutRunProgress) => { if (busy) return; setCompletionUndo(null); void act(() => session.update(change)); };
  const toggleSet = (set: number) => {
    if (!run || !exercise) return;
    const values = valuesOf(exercise, set);
    clearLoadDraft(exercise);
    update(value => toggleWorkoutRunSet(value, run.exercises, set, values, Date.now()));
  };
  /** A new load applies to the sets already checked in this exercise, keeping their reps. */
  const commitLoad = (target: WorkoutExercise) => {
    const draft = loadDrafts[loadKey(target.id)];
    if (draft === undefined) return;
    const loadKg = parseLoad(draft), sets = p?.exercises.find(e => e.id === target.id)?.completedSets ?? [];
    if (!sets.length) return; // kept as a draft until the first set is checked
    clearLoadDraft(target);
    update(value => sets.reduce((next, set) => updateWorkoutRunSetValues(next, target.id, set, { loadKg, reps: recordedFor(target.id, set)?.reps ?? prefill(target, set).reps }), value));
  };
  const canUndoCompletion = Boolean(run && exercise && item && completionUndo?.runId === run.id && completionUndo.exerciseId === exercise.id && item.completedSets.length === exercise.sets);
  const completeExercise = () => { setPanel(null); void act(async () => {
    if (!run || !exercise) return;
    let undo: ExerciseCompletionUndo | null = null;
    const target = exercise;
    await session.update(value => {
      if (run.exercises[value.currentIndex]?.id !== target.id) return value;
      const before = value.exercises.find(e => e.id === target.id);
      const next = completeWorkoutRunExercise(value, run.exercises, set => valuesOf(target, set));
      if (next !== value && before) undo = { runId: run.id, exerciseId: target.id, completedSets: [...before.completedSets], skipped: before.skipped, performed: before.performed };
      return next;
    });
    setCompletionUndo(undo);
  }); };
  const undoCompletedExercise = () => { const undo = completionUndo; if (!undo) return; setPanel(null); void act(async () => {
    await session.update(value => {
      const current = value.exercises.find(e => e.id === undo.exerciseId);
      if (!run || run.id !== undo.runId || value.status !== 'running' || run.exercises[value.currentIndex]?.id !== undo.exerciseId || current?.completedSets.length !== exercise?.sets) return value;
      return { ...value, restEndsAt: null, restRemainingMs: null, exercises: value.exercises.map(e => e.id === undo.exerciseId ? { ...e, completedSets: [...undo.completedSets], skipped: undo.skipped, ...(undo.performed ? { performed: undo.performed } : {}) } : e) };
    });
    setCompletionUndo(null);
  }); };
  const finish = async (discard = false) => {
    if (!run || !p || disabled) return;
    const missing = run.exercises.filter(e => !p.exercises.find(x => x.id === e.id)?.completedSets.length).map(e => e.name);
    const missingText = missing.length ? ` Sem séries: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` e mais ${missing.length - 3}` : ''}.` : '';
    if (!await confirmAction({ title: discard ? 'Descartar treino?' : done === run.exercises.length ? 'Finalizar treino completo?' : 'Finalizar treino parcial?', message: discard ? 'A sessão será encerrada sem contar para sua meta.' : `${doneSets} de ${totalSets} séries feitas em ${performed} de ${run.exercises.length} exercícios.${missingText} O cronômetro para e as séries feitas ficam no histórico.`, confirmLabel: discard ? 'Descartar treino' : 'Finalizar treino', cancelLabel: 'Continuar treinando', destructive: discard })) return;
    setFinishedHere(run.id); setPanel(null);
    await act(() => session.update(value => ({ ...value, status: discard ? 'discarded' : 'completed', finishedAt: Date.now(), pausedMs: value.pausedMs + (value.pausedAt !== null ? Math.max(0, Date.now() - value.pausedAt) : 0), pausedAt: null, restEndsAt: null, restRemainingMs: null })));
  };

  const currentIndex = p?.currentIndex ?? 0;
  useEffect(() => { strip.current?.scrollTo({ x: Math.max(0, (currentIndex - 1) * 68), animated: true }); }, [currentIndex]);

  if (!open && !result && !session.conflict) return <WorkoutStart {...params}/>;
  const nextSet = exercise && item ? Array.from({ length: exercise.sets }, (_, index) => index).find(index => !item.completedSets.includes(index)) : undefined;
  const last = run ? (p?.currentIndex ?? 0) >= run.exercises.length - 1 : false;
  const upcoming = run && p ? run.exercises[p.currentIndex + 1] : undefined;
  const primaryLabel = !exercise ? '' : nextSet !== undefined ? `Concluir série ${nextSet + 1} de ${exercise.sets}` : last ? 'Finalizar treino' : 'Próximo exercício';
  const primaryAction = () => { if (nextSet !== undefined) toggleSet(nextSet); else if (!last && run) update(value => moveWorkoutRunExercise(value, run.exercises.length, 1)); else void finish(); };
  const syncLabel = session.saving ? 'Sincronizando…' : session.dirty ? 'Salvo neste celular; envio pendente para a conta.' : 'Sincronizado com sua conta.';
  const problem = error || session.error;

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <FixedScreenHeader backLabel="Fitness" right={open ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Finalizar treino agora" aria-disabled={disabled || !performed} disabled={disabled || !performed} onPress={() => { void finish(); }} style={[s.headerAction, !performed && s.disabled]}><Text style={s.link}>Finalizar</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Opções do treino" onPress={() => setPanel('options')} style={s.iconButton}><MaterialCommunityIcons name="dots-horizontal" size={24} color={c.link}/></Pressable>
    </> : null}/>
    {run && p && open ? <SessionBar progress={p} label={`Treino ${run.divisionLabel}`} detail={run.divisionName} done={done} total={run.exercises.length} c={c}/> : null}
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {session.conflict ? <View style={s.card}><Text style={s.heading}>Sessão atualizada em outro aparelho</Text><Text style={s.muted}>Seu progresso local está preservado. Revise a sessão da conta para continuar.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => { void act(async () => { if (await confirmAction({ title: 'Usar sessão da conta?', message: 'O progresso local será substituído pela versão mais recente da conta.', confirmLabel: 'Usar sessão da conta', cancelLabel: 'Manter progresso local' })) { await session.useRemote(); setCompletionUndo(null); } }); }} style={s.button}><Text style={s.link}>Usar sessão da conta</Text></Pressable></View> : null}
      {problem ? <Pressable accessibilityRole="alert" onPress={() => setPanel('options')} style={s.problem}><MaterialCommunityIcons name="cloud-alert-outline" size={20} color={c.danger}/><Text style={[s.caption, s.flex, { color: c.danger }]}>{problem} Seu treino continua salvo neste celular.</Text></Pressable> : null}
      {run && p && open && exercise && item ? <>
        <View style={s.stripHead}>
          <Text style={s.selectorText}>Exercício {p.currentIndex + 1} de {run.exercises.length}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver lista de exercícios" onPress={() => setPanel('exercises')} style={s.iconButton}><MaterialCommunityIcons name="format-list-bulleted" size={20} color={c.link}/></Pressable>
        </View>
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
          {run.exercises.map((e, i) => { const sets = p.exercises.find(x => x.id === e.id)?.completedSets.length ?? 0, complete = sets === e.sets, current = i === p.currentIndex;
            return <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${e.name}, ${complete ? 'concluído' : `${sets} de ${e.sets} séries`}`} aria-selected={current} disabled={disabled} onPress={() => update(value => ({ ...value, currentIndex: i }))} style={[s.chip, current && s.chipCurrent]}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ExerciseThumbnail name={e.name} uri={e.imageUrl} size={48}/></View>
              {sets ? <View style={[s.chipBadge, !complete && s.chipBadgePartial]}><MaterialCommunityIcons name={complete ? 'check' : 'circle-half-full'} size={13} color={c.onPrimary}/></View> : null}
              <Text style={[s.chipIndex, current && { color: c.link }]}>{i + 1}</Text>
            </Pressable>; })}
        </ScrollView>
        <View style={s.exerciseCard} testID="workout-exercise-card">
          <ExerciseThumbnail key={exercise.id} name={exercise.name} uri={exercise.imageUrl} fill onPreview={() => setPanel('image')}/>
          <View style={s.exerciseHeader}>
            <View style={s.flex}>
              <Text accessibilityRole="header" numberOfLines={2} style={s.exerciseName}>{exercise.name}</Text>
              <Text style={s.prescription}>{exercise.sets} × {repsLabel(exercise.reps)}{exercise.restSeconds ? ` · descanso ${exercise.restSeconds} s` : ''}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mais ações para ${exercise.name}`} onPress={() => setPanel('exercise')} style={s.iconButton}><MaterialCommunityIcons name="dots-vertical" size={22} color={c.link}/></Pressable>
          </View>
          {item.skipped ? <View style={s.skipped}><Text style={[s.caption, s.flex]}>Exercício pulado por enquanto. Marque uma série para voltar a fazê-lo.</Text></View> : null}
          <View style={s.bubbles}>
            {Array.from({ length: exercise.sets }, (_, set) => { const checked = item.completedSets.includes(set), isNext = set === nextSet && running;
              return <Pressable key={set} accessibilityRole="checkbox" aria-checked={checked} aria-disabled={disabled || !running} accessibilityLabel={`Série ${set + 1} ${checked ? 'concluída' : 'pendente'}`} disabled={disabled || !running} onPress={() => toggleSet(set)} style={[s.bubble, isNext && s.bubbleNext, checked && s.bubbleDone, (disabled || !running) && !checked && s.disabled]}>
                {checked ? <MaterialCommunityIcons name="check" size={24} color={c.onPrimary}/> : <Text style={[s.bubbleText, isNext && { color: c.link }]}>{set + 1}</Text>}
              </Pressable>; })}
          </View>
          <View style={s.loadRow}>
            <Text style={[s.heading, s.flex]}>Carga <Text style={s.caption}>{previousFor(exercise.id, 0)?.loadKg != null ? `· última vez ${formatMeasure(previousFor(exercise.id, 0)!.loadKg!, 'kg', 2)}` : '· opcional'}</Text></Text>
            <TextInput accessibilityLabel={`Carga de ${exercise.name}, em quilos`} editable={!disabled && open} value={shownLoad(exercise)} onChangeText={text => setLoadDrafts(current => ({ ...current, [loadKey(exercise.id)]: formatDecimalInput(text, 4, 2) }))} onEndEditing={() => commitLoad(exercise)} onBlur={() => commitLoad(exercise)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={c.textMuted} selectTextOnFocus style={s.input}/>
            <Text style={s.caption}>kg</Text>
          </View>
          <Text accessibilityLiveRegion="polite" accessibilityLabel={`${item.completedSets.length} de ${exercise.sets} séries concluídas`} style={[s.caption, s.reserved]}>{p.status === 'paused' ? 'Treino pausado. Retome para marcar séries.' : nextSet === undefined ? 'Exercício concluído.' : `${item.completedSets.length} de ${exercise.sets} séries · toque numa série para marcar ou desmarcar.`}</Text>
          {exercise.notes ? <Pressable accessibilityRole="button" accessibilityLabel="Ver orientações do exercício" onPress={() => setPanel('instructions')} style={s.instructions}><MaterialCommunityIcons name="information-outline" size={20} color={c.link}/><Text numberOfLines={2} style={[s.caption, s.flex]}>{exercise.notes}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/></Pressable> : null}
        </View>
        {upcoming ? <Text style={s.upcoming}>A seguir: <Text style={s.upcomingName}>{upcoming.name}</Text> · {upcoming.sets} × {repsLabel(upcoming.reps)}{upcoming.load != null ? ` · ${formatMeasure(upcoming.load, 'kg', 2)}` : ''}</Text> : <Text style={s.upcoming}>Este é o último exercício do treino.</Text>}
      </> : null}
      {run && p && result ? <WorkoutResult run={run} progress={p} dirty={session.dirty} busy={busy} onShare={() => setSharing('manual')} onDone={() => { setFinishedHere(null); void act(async () => { await session.dismiss(); router.dismissTo('/'); }); }} onAnother={() => { setFinishedHere(null); void act(session.dismiss); }} onHistory={() => router.dismissTo({ pathname: '/workouts', params: { section: 'training' } })}/> : null}
      {run ? <ShareActivityModal auto={sharing === 'auto'} activity={sharing && run.historySessionId ? { eventType: 'workout_completed', sourceType: 'workout_session', sourceId: run.historySessionId } : null} onClose={() => setSharing(false)}/> : null}
    </ScrollView>
    {open && p && run && exercise && item ? <View style={s.footer}>
      <RestBar progress={p} restSeconds={exercise.restSeconds ?? 60} disabled={disabled} onChange={update} c={c}/>
      <View style={s.footerRow}>
        {running ? <Pressable accessibilityRole="button" accessibilityLabel="Pausar treino" disabled={disabled} onPress={() => update(value => toggleWorkoutRunPause(value, Date.now()))} style={[s.pauseButton, disabled && s.disabled]}><MaterialCommunityIcons name="pause" size={24} color={c.link}/></Pressable> : null}
        {running ? <Pressable testID="complete-exercise-button" accessibilityRole="button" accessibilityLabel={primaryLabel} aria-disabled={disabled} disabled={disabled} onPress={primaryAction} style={[s.primaryButton, s.flex, disabled && s.disabled]}><MaterialCommunityIcons name={nextSet !== undefined ? 'check' : last ? 'flag-checkered' : 'arrow-right'} size={22} color={c.onPrimary}/><Text numberOfLines={1} style={s.primaryText}>{primaryLabel}</Text></Pressable>
          : <Pressable testID="complete-exercise-button" accessibilityRole="button" accessibilityLabel="Retomar treino" disabled={disabled} onPress={() => update(value => toggleWorkoutRunPause(value, Date.now()))} style={[s.primaryButton, s.flex, disabled && s.disabled]}><MaterialCommunityIcons name="play" size={22} color={c.onPrimary}/><Text style={s.primaryText}>Retomar treino</Text></Pressable>}
      </View>
    </View> : null}
    <Sheet visible={panel !== null} onClose={() => setPanel(null)} title={panel === 'exercises' ? 'Exercícios do treino' : panel === 'exercise' ? exercise?.name ?? '' : panel === 'options' ? 'Opções do treino' : panel === 'instructions' ? exercise?.name ?? '' : ''} c={c}>
      {panel === 'image' && exercise?.imageUrl ? <Image source={{ uri: exercise.imageUrl }} contentFit="contain" style={{ width: '100%', aspectRatio: 3 / 2, maxHeight: 420, backgroundColor: c.white, borderRadius: 16 }}/> : null}
      {panel === 'exercises' && run && p ? run.exercises.map((e, i) => { const state = p.exercises.find(x => x.id === e.id)!; return <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${e.name}`} aria-selected={i === p.currentIndex} disabled={disabled} onPress={() => { update(value => ({ ...value, currentIndex: i })); setPanel(null); }} style={[s.exerciseOption, i === p.currentIndex && s.exerciseOptionCurrent]}><View style={s.flex}><Text style={s.heading}>{i + 1}. {e.name}</Text><Text style={s.muted}>{state.skipped ? 'Pulado por enquanto' : `${state.completedSets.length} de ${e.sets} séries`}</Text></View><MaterialCommunityIcons name={state.completedSets.length === e.sets ? 'check-circle' : 'chevron-right'} size={22} color={c.link}/></Pressable>; }) : null}
      {panel === 'exercise' && exercise && item && p ? <>
        {item.completedSets.length < exercise.sets ? <SheetAction icon="check-all" label="Concluir todas as séries" detail="Marca as séries que faltam neste exercício." disabled={disabled || !running} onPress={completeExercise} c={c}/> : null}
        {canUndoCompletion ? <SheetAction icon="undo-variant" label="Desfazer conclusão do exercício" detail="Volta às séries que estavam marcadas antes." disabled={disabled} onPress={undoCompletedExercise} c={c}/> : null}
        <SheetAction icon="timer-outline" label={`Iniciar descanso de ${exercise.restSeconds || 60} s`} disabled={disabled || !running} onPress={() => { setPanel(null); update(value => ({ ...value, restEndsAt: Date.now() + (exercise.restSeconds || 60) * 1000, restRemainingMs: null })); }} c={c}/>
        {!item.completedSets.length ? <SheetAction icon={item.skipped ? 'play-circle-outline' : 'skip-next-circle-outline'} label={item.skipped ? 'Voltar a fazer este exercício' : 'Pular por enquanto'} detail={item.skipped ? undefined : 'Você pode voltar a ele pela lista de exercícios.'} disabled={disabled || !running} onPress={() => { setPanel(null); update(value => ({ ...value, exercises: value.exercises.map(e => e.id === exercise.id ? { ...e, skipped: !e.skipped } : e) })); }} c={c}/> : null}
        {exercise.notes ? <SheetAction icon="information-outline" label="Ver orientações" onPress={() => setPanel('instructions')} c={c}/> : null}
      </> : null}
      {panel === 'options' ? <>
        <WorkoutNotificationPreference/>
        <View style={s.syncBox}><Text style={s.heading}>Salvamento</Text><Text style={s.muted}>{problem || syncLabel}</Text><Text style={s.caption}>Cada série é salva neste celular na hora. O envio para a conta acontece em blocos, ao sair e ao finalizar.</Text><Pressable accessibilityRole="button" disabled={busy || session.saving} onPress={() => { void act(session.sync); }} style={s.button}><Text style={s.link}>Sincronizar agora</Text></Pressable></View>
        <SheetAction icon="delete-outline" label="Descartar treino" detail="Encerra sem contar para a meta." destructive disabled={disabled} onPress={() => { void finish(true); }} c={c}/>
      </> : null}
      {panel === 'instructions' && exercise ? <><Text style={s.muted}>{exercise.sets} séries × {repsLabel(exercise.reps)} repetições{exercise.load != null ? ` · ${formatMeasure(exercise.load, 'kg', 2)}` : ''}</Text><Text style={s.muted}>Descanso previsto: {exercise.restSeconds ?? 60} segundos</Text><Text style={s.body}>{exercise.notes || 'Sem orientações adicionais na ficha.'}</Text></> : null}
    </Sheet>
  </SafeAreaView>;
}

/** Workout name, live time and exercise progress, pinned under the header. */
function SessionBar({ progress, label, detail, done, total, c }: { progress: WorkoutRunProgress; label: string; detail: string; done: number; total: number; c: AppPalette }) {
  const s = styles(c), now = useNow(progress.status === 'running'), paused = progress.status === 'paused';
  const elapsed = formatWorkoutTime(workoutRunElapsed(progress, now));
  return <View style={s.sessionBar}>
    <View style={s.sessionRow}>
      <Text numberOfLines={1} style={[s.sessionTitle, s.flex]}>{label} <Text style={s.sessionDetail}>· {detail}</Text></Text>
      {paused ? <View style={s.pausedChip}><MaterialCommunityIcons name="pause" size={14} color={c.warning}/><Text style={s.pausedText}>Pausado</Text></View> : null}
      <Text accessibilityLabel={`Tempo total do treino ${elapsed}${paused ? ', pausado' : ''}`} style={[s.sessionTime, paused && { color: c.warning }]}>{elapsed}</Text>
    </View>
    <View style={s.sessionRow}>
      <View style={[s.track, s.flex]}><View style={[s.fill, { width: `${done / Math.max(1, total) * 100}%` }]}/></View>
      <Text style={s.caption}>{done} de {total} exercícios</Text>
    </View>
  </View>;
}

/** Rest countdown with its controls, kept in the fixed footer so it is visible from anywhere in the screen. */
function RestBar({ progress: p, restSeconds, disabled, onChange, c }: { progress: WorkoutRunProgress; restSeconds: number; disabled: boolean; onChange(change: (value: WorkoutRunProgress) => WorkoutRunProgress): void; c: AppPalette }) {
  const s = styles(c), active = p.restEndsAt !== null || p.restRemainingMs !== null;
  const now = useNow(active && p.status === 'running');
  const remaining = p.status === 'paused' ? p.restRemainingMs : p.restEndsAt === null ? null : Math.max(0, p.restEndsAt - now);
  const alerted = useRef<number | null>(null);
  // One short vibration when the countdown ends with the app open; the notification covers the background.
  useEffect(() => { if (remaining === 0 && p.restEndsAt !== null && alerted.current !== p.restEndsAt) { alerted.current = p.restEndsAt; Vibration.vibrate(400); } }, [remaining, p.restEndsAt]);
  if (remaining === null) return null;
  const total = Math.max(restSeconds * 1000, remaining), finished = remaining === 0;
  const adjust = (deltaMs: number) => onChange(value => value.restEndsAt === null ? value : { ...value, restEndsAt: Math.max(Date.now(), Math.min(Date.now() + 3_600_000, value.restEndsAt + deltaMs)) });
  return <View style={[s.restBar, finished && s.restBarDone]}>
    <View style={[s.restFill, { width: `${(1 - remaining / total) * 100}%` }]}/>
    <View style={s.restContent}>
      <View style={s.flex}><Text style={s.restLabel}>{finished ? 'Descanso concluído' : p.status === 'paused' ? 'Descanso pausado' : 'Descanso'}</Text><Text accessibilityLiveRegion={finished ? 'polite' : 'none'} accessibilityLabel={finished ? 'Descanso concluído. Pode fazer a próxima série.' : `Descanso: faltam ${formatWorkoutTime(remaining).slice(3)}`} style={s.restTime}>{finished ? 'Pode continuar' : formatWorkoutTime(remaining).slice(3)}</Text></View>
      {!finished && p.status === 'running' ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Diminuir descanso em 15 segundos" disabled={disabled} onPress={() => adjust(-15_000)} style={s.restButton}><Text style={s.restButtonText}>−15 s</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Aumentar descanso em 15 segundos" disabled={disabled} onPress={() => adjust(15_000)} style={s.restButton}><Text style={s.restButtonText}>+15 s</Text></Pressable>
      </> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={finished ? 'Fechar aviso de descanso' : 'Pular descanso'} disabled={disabled} onPress={() => onChange(value => ({ ...value, restEndsAt: null, restRemainingMs: null }))} style={s.restButton}><Text style={s.restButtonText}>{finished ? 'OK' : 'Pular'}</Text></Pressable>
    </View>
  </View>;
}

/** End-of-workout summary: what was done, what was left, and what it meant for the week. */
function WorkoutResult({ run, progress: p, dirty, busy, onShare, onDone, onAnother, onHistory }: { run: NonNullable<ReturnType<typeof useWorkoutRun>['run']>; progress: WorkoutRunProgress; dirty: boolean; busy: boolean; onShare(): void; onDone(): void; onAnother(): void; onHistory(): void }) {
  const { colors: c } = useAppTheme(), s = styles(c), { api } = useAuth();
  const [goal, setGoal] = useState<WorkoutGoalSummary | null>(null);
  useEffect(() => { if (dirty || p.status !== 'completed') return; let active = true; api.getWorkoutGoal(localDate()).then(value => { if (active) setGoal(value); }, () => {}); return () => { active = false; }; }, [api, dirty, p.status]);
  const state = (e: WorkoutExercise) => p.exercises.find(x => x.id === e.id)!;
  const complete = run.exercises.filter(e => state(e).completedSets.length === e.sets);
  const partial = run.exercises.filter(e => state(e).completedSets.length > 0 && state(e).completedSets.length < e.sets);
  const skipped = run.exercises.filter(e => !state(e).completedSets.length);
  const doneSets = p.exercises.reduce((sum, e) => sum + e.completedSets.length, 0), volume = workoutRunVolume(p);
  const discarded = p.status === 'discarded';
  const stat = (value: string, label: string) => <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.caption}>{label}</Text></View>;
  const group = (title: string, items: WorkoutExercise[], icon: 'check-circle' | 'circle-half-full' | 'circle-outline') => items.length ? <View style={s.resultGroup}><Text style={s.columnLabel}>{title}</Text>{items.map(e => <View key={e.id} style={s.resultRow}><MaterialCommunityIcons name={icon} size={18} color={icon === 'circle-outline' ? c.textMuted : c.success}/><Text style={[s.body, s.flex]}>{e.name}</Text><Text style={s.caption}>{state(e).completedSets.length}/{e.sets}</Text></View>)}</View> : null;
  return <View style={s.resultCard}>
    <View style={s.resultHeader}><MaterialCommunityIcons name={discarded ? 'close-circle-outline' : complete.length === run.exercises.length ? 'trophy-outline' : 'flag-checkered'} size={32} color={discarded ? c.textMuted : c.accent}/><View style={s.flex}><Text accessibilityRole="header" style={s.title}>{discarded ? 'Treino descartado' : complete.length === run.exercises.length ? 'Treino completo!' : 'Treino finalizado'}</Text><Text style={s.muted}>Treino {run.divisionLabel} · {run.divisionName}</Text></View></View>
    {!discarded ? <View style={s.stats}>{stat(formatWorkoutTime(workoutRunElapsed(p, p.finishedAt ?? p.startedAt)), 'duração')}{stat(`${doneSets}`, doneSets === 1 ? 'série' : 'séries')}{stat(`${complete.length}/${run.exercises.length}`, 'exercícios completos')}{volume > 0 ? stat(formatMeasure(volume, 'kg', 0), 'volume') : null}</View> : <Text style={s.muted}>Este treino não conta para sua meta.</Text>}
    {!discarded && goal?.configured ? <View style={s.goalBox}><MaterialCommunityIcons name="calendar-check-outline" size={20} color={c.link}/><Text style={[s.body, s.flex]}>Meta da semana: <Text style={s.heading}>{goal.completed} de {goal.weeklyTarget}</Text>{goal.remaining ? ` · faltam ${goal.remaining}` : ' · concluída'}</Text></View> : null}
    {dirty ? <Text style={s.caption}>Resultado salvo neste celular. O histórico e a meta atualizam quando a conexão voltar.</Text> : null}
    {!discarded ? <>{group('Completos', complete, 'check-circle')}{group('Parciais', partial, 'circle-half-full')}{group('Não feitos', skipped, 'circle-outline')}</> : null}
    <Pressable accessibilityRole="button" disabled={busy || dirty} onPress={onDone} style={[s.primaryButton, (busy || dirty) && s.disabled]}><Text style={s.primaryText}>Concluir</Text></Pressable>
    {run.historySessionId ? <Pressable accessibilityRole="button" onPress={onShare} style={s.button}><Text style={s.link}>Postar nos grupos</Text></Pressable> : null}
    <View style={s.resultLinks}><Pressable accessibilityRole="button" onPress={onHistory} style={s.textButton}><Text style={s.link}>Ver histórico</Text></Pressable><Pressable accessibilityRole="button" disabled={busy || dirty} onPress={onAnother} style={[s.textButton, (busy || dirty) && s.disabled]}><Text style={s.link}>Iniciar outro treino</Text></Pressable></View>
  </View>;
}

function Sheet({ visible, title, onClose, children, c }: { visible: boolean; title: string; onClose(): void; children: ReactNode; c: AppPalette }) {
  const s = styles(c);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={s.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Fechar painel" onPress={onClose} style={StyleSheet.absoluteFill}/><SafeAreaView edges={['bottom']} style={s.sheet}>
    <View style={s.handle}/>
    <View style={s.sheetHeader}><Text accessibilityRole="header" numberOfLines={2} style={[s.title, s.flex]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={s.iconButton}><MaterialCommunityIcons name="close" size={22} color={c.link}/></Pressable></View>
    <ScrollView contentContainerStyle={s.sheetContent}>{children}</ScrollView>
  </SafeAreaView></View></Modal>;
}
function SheetAction({ icon, label, detail, onPress, disabled, destructive, c }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; detail?: string; onPress(): void; disabled?: boolean; destructive?: boolean; c: AppPalette }) {
  const s = styles(c), color = destructive ? c.danger : c.link;
  return <Pressable accessibilityRole="button" disabled={disabled} aria-disabled={disabled} onPress={onPress} style={[s.sheetAction, destructive && s.sheetActionDanger, disabled && s.disabled]}><MaterialCommunityIcons name={icon} size={22} color={color}/><View style={s.flex}><Text style={[s.heading, { color: destructive ? c.danger : c.text }]}>{label}</Text>{detail ? <Text style={s.caption}>{detail}</Text> : null}</View></Pressable>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, content: { padding: 16, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 24 }, flex: { flex: 1, minWidth: 0 },
  title: { ...Type.title, fontWeight: '800', color: c.text }, heading: { ...Type.body, fontWeight: '800', color: c.text }, body: { ...Type.body, color: c.text }, muted: { ...Type.body, color: c.textMuted }, caption: { ...Type.caption, color: c.textMuted },
  columnLabel: { ...Type.caption, letterSpacing: .6, fontWeight: '800', color: c.textMuted }, link: { ...Type.body, fontWeight: '800', color: c.link, textAlign: 'center' },
  button: { minHeight: 48, borderRadius: Radius.md, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft }, textButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  disabled: { opacity: .45 }, card: { padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, backgroundColor: c.surface, gap: 12 },
  headerAction: { minHeight: 44, paddingHorizontal: 10, borderRadius: Radius.md, justifyContent: 'center', backgroundColor: c.surfaceSoft }, iconButton: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft },
  sessionBar: { backgroundColor: c.background, paddingHorizontal: 16, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 648, width: '100%', alignSelf: 'center' },
  sessionTitle: { ...Type.body, fontWeight: '800', color: c.text }, sessionDetail: { fontWeight: '400', color: c.textMuted }, sessionTime: { ...Type.bodyLarge, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
  pausedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: c.warningSoft }, pausedText: { ...Type.caption, fontWeight: '800', color: c.warning },
  track: { height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' }, fill: { height: 6, backgroundColor: c.accent },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.lg, backgroundColor: c.dangerSoft },
  selectorText: { ...Type.body, fontWeight: '800', color: c.link },
  stripHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  strip: { gap: 8, paddingVertical: 2 },
  chip: { width: 60, alignItems: 'center', gap: 2, padding: 4, borderRadius: Radius.md, borderWidth: 2, borderColor: 'transparent' }, chipCurrent: { borderColor: c.primary, backgroundColor: c.surface },
  chipBadge: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.success }, chipBadgePartial: { backgroundColor: c.primary },
  chipIndex: { ...Type.caption, fontWeight: '800', color: c.textMuted },
  exerciseCard: { padding: 14, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, backgroundColor: c.surface, gap: 12 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  exerciseName: { ...Type.title, fontWeight: '800', color: c.text }, prescription: { ...Type.label, color: c.textMuted, marginTop: 2 },
  // Two caption lines are always reserved so marking sets never moves the controls below.
  reserved: { minHeight: 32 },
  skipped: { padding: 10, borderRadius: Radius.md, backgroundColor: c.warningSoft },
  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bubble: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: c.fieldBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  bubbleNext: { borderColor: c.primary, backgroundColor: c.primarySoft }, bubbleDone: { borderColor: c.success, backgroundColor: c.success },
  bubbleText: { ...Type.bodyLarge, fontWeight: '800', color: c.textMuted },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  input: { width: 88, minHeight: 44, borderWidth: 1, borderColor: c.fieldBorder, borderRadius: Radius.md, paddingHorizontal: 8, textAlign: 'center', ...Type.bodyLarge, fontWeight: '700', color: c.text, backgroundColor: c.surface, fontVariant: ['tabular-nums'] },
  instructions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, padding: 10, backgroundColor: c.surfaceSoft },
  upcoming: { ...Type.label, color: c.textMuted, paddingHorizontal: 4 }, upcomingName: { fontWeight: '800', color: c.text },
  footer: { borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12, gap: 8 },
  footerRow: { flexDirection: 'row', gap: 10, maxWidth: 648, width: '100%', alignSelf: 'center' },
  pauseButton: { width: 56, minHeight: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft },
  primaryButton: { minHeight: 56, borderRadius: Radius.lg, paddingHorizontal: 16, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { ...Type.bodyLarge, fontWeight: '800', color: c.onPrimary, textAlign: 'center', flexShrink: 1 },
  restBar: { minHeight: 56, borderRadius: Radius.lg, backgroundColor: c.primaryStrong, overflow: 'hidden', maxWidth: 648, width: '100%', alignSelf: 'center' }, restBarDone: { backgroundColor: c.accent },
  restFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,.12)' },
  restContent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  restLabel: { ...Type.caption, fontWeight: '800', color: c.heroMuted, letterSpacing: .4 }, restTime: { ...Type.title, fontWeight: '800', color: c.onPrimary, fontVariant: ['tabular-nums'] },
  restButton: { minWidth: 52, minHeight: 44, paddingHorizontal: 8, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.16)' }, restButtonText: { ...Type.label, fontWeight: '800', color: c.onPrimary },
  overlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, backgroundColor: c.surface, maxWidth: 680, width: '100%', alignSelf: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 10 }, sheetContent: { padding: 18, paddingTop: 12, gap: 10 },
  sheetAction: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.lg, backgroundColor: c.surfaceSoft }, sheetActionDanger: { backgroundColor: c.dangerSoft },
  exerciseOption: { minHeight: 64, padding: 12, borderRadius: Radius.lg, backgroundColor: c.surfaceSoft, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' }, exerciseOptionCurrent: { borderColor: c.primary },
  syncBox: { gap: 6, padding: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border },
  resultCard: { padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, backgroundColor: c.surface, gap: 14 }, resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { flexGrow: 1, flexBasis: 120, padding: 12, borderRadius: Radius.lg, backgroundColor: c.surfaceSoft, gap: 2 }, statValue: { ...Type.title, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
  goalBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.lg, backgroundColor: c.primarySoft },
  resultGroup: { gap: 6 }, resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, resultLinks: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
});
