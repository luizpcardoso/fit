import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { PlanValidity } from '@/components/plan-validity';
import { ScreenHeader } from '@/components/screen-header';
import { showDialog } from '@/components/app-dialog';
import { useUnsavedChanges } from '@/utils/unsaved-changes';
import { localDate } from '@/utils/dates';
import type { WorkoutDivision, WorkoutPlan } from '@fit/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { ShareActivityModal } from '@/components/share-activity-modal';
import MaterialCommunityIcons from '@/components/icon';
import { Image } from 'expo-image';

export default function WorkoutRun() {
  const { colors: c } = useAppTheme(); const s = createStyles(c);

  const { api } = useAuth();
  const { planId, divisionId } = useLocalSearchParams<{ planId?: string; divisionId?: string }>();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [inactivePlans, setInactivePlans] = useState(0);
  const [chosen, setChosen] = useState<{ plan: WorkoutPlan; division: WorkoutDivision } | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const[shareActivity,setShareActivity]=useState<{eventType:'workout_completed';sourceType:'workout_session';sourceId:string}|null>(null);
  const saving = useRef(false);
  const load = useCallback(() => { return api.listWorkoutPlans().then(allPlans => {
    // Only a network/server failure is an error; no active plan is an empty state.
    const items = allPlans.filter(plan => plan.status === 'available' && plan.isActive);
    setPlans(items);
    setInactivePlans(allPlans.filter(plan => plan.status === 'available' && !plan.isActive).length);
    const plan = items.find(item => item.id === planId);
    const division = plan?.divisions.find(item => item.id === divisionId);
    if (plan && division) setChosen({ plan, division });
  }).catch(() => setLoadError('Não foi possível abrir seus treinos. Verifique a conexão e tente novamente.'))
    .finally(() => setLoading(false)); }, [api, planId, divisionId]);
  useEffect(() => { void load(); }, [load]);
  useUnsavedChanges(Boolean(chosen && checked.length && !saved), 'As marcações deste treino ainda não foram salvas. Finalize o treino para registrá-las no histórico.');
  const finish = async (exerciseIds = checked) => {
    if (!chosen || !exerciseIds.length || saving.current || saved) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const completed=await api.completeWorkout({ divisionId: chosen.division.id, performedOn: localDate(), completedExerciseIds: exerciseIds, shareAutomatically: false });
      setChecked(exerciseIds);
      setSaved(true);
      setShareActivity({eventType:'workout_completed',sourceType:'workout_session',sourceId:completed.id});
    } catch { setError('Não foi possível confirmar o registro. Suas marcações continuam aqui. Verifique o histórico antes de tentar novamente se a conexão caiu.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const confirmFinish = () => {
    if (!chosen || busy || saved) return;
    const total = chosen.division.exercises.length;
    const all = chosen.division.exercises.map(exercise => exercise.id);
    if (!checked.length) {
      showDialog('Nenhum exercício marcado', `Marque os exercícios que você fez. Se você fez o treino ${chosen.division.label} completo, registre os ${total} exercícios de uma vez.`, [{ text: 'Continuar treinando', style: 'cancel' }, { text: 'Registrar treino completo', onPress: () => { void finish(all); } }]);
    } else if (checked.length < total) {
      const pending = total - checked.length;
      showDialog('Finalizar com exercícios pendentes?', `${checked.length === 1 ? 'Só o exercício marcado será registrado' : `Só os ${checked.length} exercícios marcados serão registrados`}. ${pending === 1 ? 'O exercício não marcado fica' : `Os ${pending} não marcados ficam`} fora do histórico.`, [{ text: 'Continuar treinando', style: 'cancel' }, { text: 'Finalizar treino', onPress: () => { void finish(); } }]);
    } else void finish();
  };
  const retryLoad = () => { setLoading(true); setLoadError(''); void load(); };
  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader backLabel={planId ? 'Ficha' : 'Início'} showHome={Boolean(planId)} />
      {saved ? <View style={s.card}><View style={s.successIcon}><MaterialCommunityIcons name="check-circle" size={34} color={c.success} /></View><Text accessibilityRole="header" style={s.title}>Treino finalizado!</Text><Text style={s.text}>{checked.length} {checked.length === 1 ? 'exercício registrado' : 'exercícios registrados'} no seu histórico.</Text><Pressable accessibilityRole="button" style={s.button} onPress={() => router.replace({ pathname: '/workouts', params: { section: 'training' } })}><Text style={s.buttonText}>Ver histórico</Text></Pressable><Pressable accessibilityRole="button" style={s.secondary} onPress={() => router.dismissTo('/')}><Text style={s.link}>Voltar ao início</Text></Pressable></View> : <>
        {loading ? <ActivityIndicator accessibilityLabel="Carregando treinos" color={c.link} size="large" /> : null}
        {!loading && loadError ? <View accessibilityRole="alert" style={s.card}><Text style={s.heading}>Não foi possível carregar</Text><Text style={s.error}>{loadError}</Text><Pressable accessibilityRole="button" style={s.button} onPress={retryLoad}><Text style={s.buttonText}>Tentar novamente</Text></Pressable></View> : null}
        {!loading && !loadError && !plans.length ? <View style={[s.card, s.emptyCard]}>
          <View style={s.emptyIcon}><MaterialCommunityIcons name="clipboard-text-outline" size={30} color={c.link} /></View>
          <Text accessibilityRole="header" style={s.heading}>{inactivePlans ? 'Nenhuma ficha ativa' : 'Você ainda não tem uma ficha'}</Text>
          <Text style={[s.text, s.centered]}>{inactivePlans ? 'Ative uma das suas fichas para escolher o treino de hoje, ou crie uma nova.' : 'A ficha reúne seus treinos A, B, C… com os exercícios de cada dia.'}</Text>
          <Pressable accessibilityRole="button" style={[s.button, s.stretch]} onPress={() => router.push('/workout-create')}><Text style={s.buttonText}>Criar ficha</Text></Pressable>
          {inactivePlans ? <Pressable accessibilityRole="button" style={[s.secondary, s.stretch]} onPress={() => router.push({ pathname: '/workouts', params: { section: 'plans' } })}><Text style={s.link}>Ver minhas fichas</Text></Pressable> : null}
        </View> : null}
        {!loading && !loadError && plans.length ? <>
          <Text accessibilityRole="header" style={s.title}>{chosen ? `Treino ${chosen.division.label} · ${chosen.division.name}` : 'Qual treino vamos fazer?'}</Text>
          <Text style={s.text}>{chosen ? `${chosen.plan.name} · Marque cada exercício após realizá-lo.` : 'Escolha um treino da sua ficha ativa para começar.'}</Text>
        </> : null}
        {!chosen && !loading ? plans.map(plan => <View key={plan.id} style={s.card}><Text style={s.heading}>{plan.name}</Text><PlanValidity plan={plan} />{plan.divisions.map(division => <Pressable accessibilityRole="button" accessibilityLabel={`Começar treino ${division.label}, ${division.name}`} key={division.id} style={s.choice} onPress={() => { setChosen({ plan, division }); setChecked([]); setError(''); }}><View style={s.flex}><Text style={s.heading}>Treino {division.label} · {division.name}</Text><Text style={s.text}>{division.exercises.length} {division.exercises.length === 1 ? 'exercício' : 'exercícios'}</Text></View><Text style={s.link}>Começar</Text><MaterialCommunityIcons name="chevron-right" size={20} color={c.link} /></Pressable>)}</View>) : null}
        {chosen ? <>
          <PlanValidity plan={chosen.plan} /><View style={s.progress}><Text style={s.heading}>{checked.length} de {chosen.division.exercises.length} exercícios realizados</Text><View style={s.track}><View style={[s.fill, { width: `${checked.length / Math.max(chosen.division.exercises.length, 1) * 100}%` }]} /></View></View>
          {chosen.division.exercises.map((exercise, index) => {
            const done = checked.includes(exercise.id);
            return <View key={exercise.id} style={[s.card, done && s.done]}>{exercise.imageUrl ? <Image source={{ uri: exercise.imageUrl }} contentFit="cover" transition={180} style={s.exerciseImage} accessibilityLabel={`Imagem de ${exercise.name}`} /> : null}<Text style={s.heading}>{index + 1}. {exercise.name}</Text><Text style={s.prescription}>{exercise.sets} séries × {exercise.reps} repetições{exercise.load != null ? ` · ${exercise.load} kg` : ''}</Text>{exercise.restSeconds != null ? <Text style={s.text}>Descanso: {exercise.restSeconds} s</Text> : null}{exercise.notes ? <Text style={s.text}>{exercise.notes}</Text> : null}<Pressable accessibilityRole="checkbox" accessibilityLabel={`${exercise.name} realizado`} aria-disabled={busy} aria-checked={done} disabled={busy} style={[s.secondary, s.checkRow, done && s.doneButton]} onPress={() => setChecked(items => done ? items.filter(id => id !== exercise.id) : [...items, exercise.id])}><MaterialCommunityIcons name={done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={c.link} /><Text style={s.link}>{done ? 'Realizado' : 'Marcar como realizado'}</Text></Pressable></View>;
          })}
          <Text style={s.text}>Suas marcações serão salvas quando você finalizar o treino.</Text>
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        </> : null}
      </>}
    </ScrollView>
    {chosen && !saved ? <View style={s.footer}><Text accessibilityLiveRegion="polite" style={s.footerText}>{checked.length} de {chosen.division.exercises.length} marcados</Text><Pressable accessibilityRole="button" aria-busy={busy} aria-disabled={busy} disabled={busy} style={[s.button, busy && s.disabled]} onPress={confirmFinish}>{busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.buttonText}>Finalizar treino</Text>}</Pressable></View> : null}
    <ShareActivityModal activity={shareActivity} onClose={()=>setShareActivity(null)}/>
  </SafeAreaView>;
}
const createStyles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, content: { padding: 20, paddingTop: 8, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 32 }, title: { ...Type.headline, fontWeight: '800', color: c.text }, heading: { ...Type.bodyLarge, fontWeight: '800', color: c.text }, text: { ...Type.body, color: c.textMuted }, centered: { textAlign: 'center' }, link: { color: c.link, fontWeight: '800', ...Type.body }, card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.xl, padding: 16, gap: 12, overflow:'hidden' }, emptyCard: { alignItems: 'center', padding: 24 }, emptyIcon: { width: 60, height: 60, borderRadius: Radius.xl, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }, successIcon: { alignSelf: 'flex-start' }, stretch: { alignSelf: 'stretch' }, exerciseImage:{width:'auto',height:190,marginHorizontal:-16,marginTop:-16,backgroundColor:c.surfaceSoft}, choice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border }, flex: { flex: 1, minWidth: 0 }, button: { backgroundColor: c.primary, minHeight: 52, padding: 15, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: c.onPrimary, fontWeight: '800', ...Type.body }, secondary: { backgroundColor: c.surfaceSoft, minHeight: 48, padding: 12, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, checkRow: { flexDirection: 'row', gap: 8 }, done: { borderColor: c.accent }, doneButton: { backgroundColor: c.primarySoft }, prescription: { color: c.text, ...Type.body }, progress: { gap: 12 }, track: { height: 8, borderRadius: Radius.xs, backgroundColor: c.border, overflow: 'hidden' }, fill: { height: 8, backgroundColor: c.accent }, footer: { gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }, footerText: { ...Type.label, color: c.textMuted, textAlign: 'center' }, disabled: { opacity: 0.5 }, error: { color: c.danger, ...Type.body },
});
