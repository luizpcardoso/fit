import { FormStickyFooter } from '@/components/form-sticky-footer';
import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type, type AppPalette } from '@/constants/theme';
import { createWorkoutPlanSchema, updateWorkoutPlanSchema, workoutExerciseInputSchema, type CatalogExercise, type SuggestedWorkoutPlan, type WorkoutExerciseInput, type WorkoutPlan } from '@fit/contracts';
import { ApiClientError } from '@fit/api-client';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, FlatList, Keyboard, LayoutAnimation, Modal, Pressable, ScrollView as PlainScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ValidityPicker } from '@/components/validity-picker';
import { useAuth } from '@/auth/auth-context';
import { ProfessionalPlans } from '@/components/professional-plans';
import MaterialCommunityIcons from '@/components/icon';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import { WorkoutExerciseCard } from '@/components/workout-exercise-card';
import { PlanValidity } from '@/components/plan-validity';
import { ScreenHeader } from '@/components/screen-header';
import { confirmAction, showToast } from '@/components/app-dialog';
import { confirmLeave, useUnsavedChanges } from '@/utils/unsaved-changes';

/** id: existing plan row (edit mode), kept so completed sessions keep pointing to it. */
type DraftExercise = WorkoutExerciseInput & { draftId: string; id?: string };
type Draft = { id?: string; name: string; exercises: DraftExercise[] };
type Level = SuggestedWorkoutPlan['level'];
const levelLabels: Record<Level, string> = { adaptation: 'Adaptação', beginner: 'Iniciante', intermediate: 'Intermediário' };
const letter = (index: number) => String.fromCharCode(65 + index);
const exerciseFieldMessages: Record<string, string> = {
  name: 'nome do exercício (2 a 100 caracteres)', sets: 'séries (de 1 a 20)', reps: 'repetições (1 a 999, uma faixa como 8–12 ou uma orientação)',
  load: 'carga (de 0 a 2.000 kg)', restSeconds: 'descanso (de 0 a 3.600 segundos)', notes: 'observações (até 500 caracteres)',
};
/** Names every invalid field of one exercise, e.g. "Revise séries (de 1 a 20) e descanso (…)". */
const exerciseIssues = (fields: PropertyKey[]) => {
  const labels = [...new Set(fields.map(field => exerciseFieldMessages[String(field)] ?? 'os valores informados'))];
  return `Revise ${labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`}.`;
};
// Catalog references stay untouched in the database; only the display is localized.
const referenceTerms: [RegExp, string][] = [[/\bWHO\b/g, 'OMS'], [/\s*\bpreparticipation screening\b/gi, ' (triagem pré-participação)']];
const formatReferences = (value: string) => {
  const items = value.split(';').map(part => referenceTerms.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), part).replace(/\s*\b(?:19|20)\d{2}\b/g, '').trim()).filter(Boolean);
  return items.length ? `Referências: ${[...new Set(items)].join(', ')}` : '';
};
const snapshotOf = (name: string, divisions: Draft[], validity: string) => JSON.stringify({ name, validity, divisions: divisions.map(division => ({ id: division.id ?? null, name: division.name, exercises: division.exercises.map(exercise => [exercise.id ?? null, exercise.name, exercise.catalogExerciseId ?? null, exercise.sets, exercise.reps, exercise.load ?? null, exercise.restSeconds ?? null, exercise.notes ?? null]) })) });
const divisionLetters = (amount: number) => {
  const letters = Array.from({ length: amount }, (_, index) => String.fromCharCode(65 + index));
  return letters.length === 1 ? letters[0] : `${letters.slice(0, -1).join(', ')} e ${letters[letters.length - 1]}`;
};
const newDivision = (index: number): Draft => ({ name: `Treino ${String.fromCharCode(65 + index)}`, exercises: [] });
const initialDivisions = () => [newDivision(0), newDivision(1)];
const newExercise = (name: string, catalogExerciseId?: string): DraftExercise => ({ draftId: Crypto.randomUUID(), name, catalogExerciseId: catalogExerciseId ?? null, sets: 3, reps: '12', load: null, restSeconds: 60, notes: null });

export default function WorkoutCreate() {
  const { colors: c, scheme } = useAppTheme(); const styles = createStyles(c);

  const { api } = useAuth();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editMode = Boolean(editId);
  const saveLock = useRef(false);
  const request = useRef<{ snapshot: string; id: string } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const ask = (title: string, message: string, confirmLabel: string, action: () => void) => { void confirmAction({ title, message, confirmLabel, cancelLabel: 'Continuar editando', destructive: true }).then(confirmed => { if (confirmed) action(); }); };
  const [saved, setSaved] = useState(false);
  const [flow, setFlow] = useState<'choose' | 'edit'>(editId ? 'edit' : 'choose');
  const [fromLibrary, setFromLibrary] = useState(false);
  const [hasProfessional, setHasProfessional] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<'ready' | 'loading' | 'error' | 'readonly'>(editId ? 'loading' : 'ready');
  const [original, setOriginal] = useState<WorkoutPlan | null>(null);
  const [changeValidity, setChangeValidity] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all');
  const [goalFilter, setGoalFilter] = useState('all');
  const [personalOpen, setPersonalOpen] = useState(false);
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{ name: string; uri: string } | null>(null);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [name, setName] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [divisions, setDivisions] = useState<Draft[]>(initialDivisions);
  const [initialSnapshot, setInitialSnapshot] = useState(() => snapshotOf('', initialDivisions(), '30'));
  const [active, setActive] = useState(0);
  const [countOpen, setCountOpen] = useState(false);
  const tabsRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const formRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const divisionTop = useRef(0);
  useEffect(() => { tabsRef.current?.scrollTo({ x: active * 140, animated: true }); }, [active, divisions.length, flow]);
  const [editing, setEditing] = useState<{ division: number; id: string; value: WorkoutExerciseInput } | null>(null);
  const [exerciseError, setExerciseError] = useState('');
  const [exerciseNotice, setExerciseNotice] = useState('');
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [pendingExercises, setPendingExercises] = useState<DraftExercise[]>([]);
  const [pickerError, setPickerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedWorkoutPlan[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [saveFooterHeight, setSaveFooterHeight] = useState(0);
  const [pickerFooterHeight, setPickerFooterHeight] = useState(0);

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    api.listCatalogExercises(search).then(items => { if (!cancelled) { setCatalog(items); setImages(previous => ({ ...previous, ...Object.fromEntries(items.map(item => [item.id, item.imageUrl])) })); } }).catch(() => { if (!cancelled) { setCatalog([]); setPickerError('Não foi possível carregar o catálogo. Tente buscar novamente ou insira manualmente.'); } }).finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, [api, pickerOpen, search]);
  useEffect(() => {
    if (editId) return;
    let cancelled = false;
    // The option only makes sense with an active professional; if the check fails, keep it available.
    api.listProfessionals().then(rows => { if (!cancelled) setHasProfessional(rows.some(row => row.status === 'active')); }).catch(() => { if (!cancelled) setHasProfessional(true); });
    return () => { cancelled = true; };
  }, [api, editId]);
  const loadPlan = useCallback(() => {
    if (!editId) return Promise.resolve();
    return api.getWorkoutPlan(editId).then(plan => {
      setOriginal(plan);
      if (plan.origin === 'professional') { setLoadState('readonly'); return; }
      const drafts: Draft[] = plan.divisions.map(division => ({ id: division.id, name: division.name, exercises: division.exercises.map(exercise => ({ draftId: Crypto.randomUUID(), id: exercise.id, name: exercise.name, catalogExerciseId: exercise.catalogExerciseId ?? null, sets: exercise.sets, reps: exercise.reps, load: exercise.load ?? null, restSeconds: exercise.restSeconds ?? null, notes: exercise.notes ?? null })) }));
      setImages(previous => ({ ...previous, ...Object.fromEntries(plan.divisions.flatMap(division => division.exercises.filter(exercise => exercise.catalogExerciseId).map(exercise => [exercise.catalogExerciseId!, exercise.imageUrl]))) }));
      setName(plan.name); setDivisions(drafts); setActive(0); setChangeValidity(false); setValidityDays('30');
      setInitialSnapshot(snapshotOf(plan.name, drafts, 'keep'));
      setLoadState('ready');
    }).catch(() => setLoadState('error'));
  }, [api, editId]);
  useEffect(() => { void loadPlan(); }, [loadPlan]);
  const openExercisePicker = () => { setError(''); setPickerError(''); setPendingExercises([]); setSearch(''); setManualName(''); setCatalogLoading(true); setPickerOpen(true); };
  const openSuggestions = async () => {
    setSuggestionsOpen(true); setSuggestionsError('');
    if (suggestions.length || suggestionsLoading) return;
    setSuggestionsLoading(true);
    try { setSuggestions(await api.listWorkoutPlanSuggestions()); }
    catch { setSuggestionsError('Não foi possível carregar a biblioteca. Tente novamente.'); }
    finally { setSuggestionsLoading(false); }
  };
  const applySuggestion = (suggestion: SuggestedWorkoutPlan) => {
    const apply = () => {
      setImages(previous => ({ ...previous, ...Object.fromEntries(suggestion.divisions.flatMap(division => division.exercises.map(exercise => [exercise.catalogExerciseId, exercise.imageUrl]))) }));
      setName(suggestion.name);
      setDivisions(suggestion.divisions.map(division => ({ name: division.name, exercises: division.exercises.map(exercise => ({ draftId: Crypto.randomUUID(), name: exercise.name, catalogExerciseId: exercise.catalogExerciseId, sets: exercise.sets, reps: exercise.reps, load: null, restSeconds: exercise.restSeconds, notes: null })) })));
      setEditing(null); setExerciseError(''); setExerciseNotice('');
      setActive(0); setCountOpen(false); setFlow('edit'); setSuggestionsOpen(false); setError(''); setFromLibrary(true);
    };
    if (dirty) { setSuggestionsOpen(false); ask('Substituir a configuração?', 'As alterações atuais serão substituídas pelo modelo escolhido.', 'Usar modelo', apply); }
    else apply();
  };

  const current = divisions[active];
  const totalExercises = divisions.reduce((total, division) => total + division.exercises.length, 0);
  const completedDivisions = divisions.filter(division => division.exercises.length > 0).length;
  const filteredCatalog = catalog;
  const validityKey = editMode ? (changeValidity ? `change:${validityDays}` : 'keep') : validityDays;
  const dirty = loadState === 'ready' && snapshotOf(name, divisions, validityKey) !== initialSnapshot;
  const levels = [...new Set(suggestions.map(item => item.level))];
  const goals = [...new Set(suggestions.map(item => item.goal))];
  const visibleSuggestions = suggestions.filter(item => (levelFilter === 'all' || item.level === levelFilter) && (goalFilter === 'all' || item.goal === goalFilter));

  // The header asks through useUnsavedChanges; system back and gestures ask through usePreventRemove.
  useUnsavedChanges(dirty && !saved && !discarding, editMode ? 'As alterações desta ficha ainda não foram salvas.' : 'Os dados da nova ficha ainda não foram salvos.');
  const disablePrevention = usePreventRemove((dirty || busy) && !saved && !discarding, ({ repeat }) => {
    if (saveLock.current) return;
    void confirmLeave().then(confirmed => { if (confirmed) { setDiscarding(true); repeat(); } });
  });
  const [savedId, setSavedId] = useState('');
  useEffect(() => {
    if (!saved || !savedId) return;
    if (editMode && router.canGoBack()) router.back();
    else router.replace({ pathname: '/workout-detail', params: { id: savedId } });
  }, [saved, savedId, editMode]);
  const leave = (navigate: () => void) => { if (saveLock.current) return; setDiscarding(true); disablePrevention(); navigate(); };
  const goBack = () => leave(() => { if (router.canGoBack()) router.back(); else router.replace('/'); });
  const goHome = async () => { if (!saveLock.current && await confirmLeave()) leave(() => router.dismissTo('/')); };
  const updateDivision = (index: number, change: Partial<Draft>) => { if (!saveLock.current) setDivisions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item)); };
  const editingOriginal = editing ? divisions[editing.division]?.exercises.find(exercise => exercise.draftId === editing.id) : null;
  const exerciseDirty = editing != null && Object.entries(editing.value).some(([key, value]) => !Object.is(value, editingOriginal?.[key as keyof WorkoutExerciseInput]));
  const finishEditing = (action: () => void) => {
    const finish = () => { Keyboard.dismiss(); setEditing(null); setExerciseError(''); action(); };
    if (exerciseDirty) ask('Descartar edição do exercício?', 'Os ajustes deste exercício ainda não foram adicionados ao rascunho da ficha.', 'Descartar ajustes', finish);
    else finish();
  };
  const editExercise = (exercise: DraftExercise) => {
    const open = () => {
      const { draftId, id: _rowId, ...value } = exercise;
      setEditing({ division: active, id: draftId, value });
      setExerciseError(''); setExerciseNotice(''); setError('');
    };
    if (editing?.id === exercise.draftId) finishEditing(() => {});
    else finishEditing(open);
  };
  const saveExercise = () => {
    if (!editing || saveLock.current) return;
    const parsed = workoutExerciseInputSchema.safeParse(editing.value);
    if (!parsed.success) {
      setExerciseError(exerciseIssues(parsed.error.issues.map(issue => issue.path[0] ?? '')));
      return;
    }
    setDivisions(items => items.map((division, index) => index !== editing.division ? division : {
      ...division, exercises: division.exercises.map(exercise => exercise.draftId !== editing.id ? exercise : { ...parsed.data, draftId: exercise.draftId, id: exercise.id }),
    }));
    Keyboard.dismiss(); setEditing(null); setExerciseError(''); setError('');
    setExerciseNotice(`${parsed.data.name} atualizado no rascunho.`);
  };
  const removeExercise = (exercise: DraftExercise) => ask('Remover exercício?', editMode && exercise.id ? `${exercise.name} sairá deste treino ao salvar. Treinos já realizados continuam no histórico.` : `${exercise.name} será removido deste treino.`, 'Remover exercício', () => {
    updateDivision(active, { exercises: current.exercises.filter(item => item.draftId !== exercise.draftId) });
    setEditing(null); setExerciseError(''); setExerciseNotice(''); Keyboard.dismiss();
  });
  const changeDivisionCount = (amount: number) => {
    if (saveLock.current) return;
    const apply = () => { setCountOpen(false); setDivisions((items) => amount > items.length ? [...items, ...Array.from({ length: amount - items.length }, (_, index) => newDivision(items.length + index))] : items.slice(0, amount)); setActive((value) => Math.min(value, amount - 1)); };
    const removedHaveData = amount < divisions.length && divisions.slice(amount).some((division, index) => division.exercises.length > 0 || division.name !== newDivision(amount + index).name);
    if (removedHaveData) ask('Remover treinos?', `Os nomes e exercícios dos treinos removidos serão descartados. Os demais treinos serão mantidos.${editMode ? ' Treinos já realizados continuam no histórico.' : ''}`, 'Remover treinos', apply); else apply();
  };
  const sameExercise = (exercise: WorkoutExerciseInput, name: string, id?: string) =>
    Boolean(id && exercise.catalogExerciseId === id) || exercise.name.toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR');
  const toggleExercise = (exerciseName: string, catalogExerciseId?: string) => {
    const cleanName = exerciseName.trim();
    if (cleanName.length < 2) { setPickerError('Informe o nome do exercício.'); return; }
    if (current.exercises.some((exercise) => sameExercise(exercise, cleanName, catalogExerciseId))) {
      setPickerError('Este exercício já está neste treino.'); return;
    }
    setPickerError('');
    const selected = pendingExercises.some((exercise) => sameExercise(exercise, cleanName, catalogExerciseId));
    if (!selected && current.exercises.length + pendingExercises.length >= 50) {
      setPickerError('Cada treino pode ter até 50 exercícios.'); return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPendingExercises((items) => selected
      ? items.filter((exercise) => !sameExercise(exercise, cleanName, catalogExerciseId))
      : [...items, newExercise(cleanName, catalogExerciseId)]);
  };
  const addManualExercise = () => {
    const cleanName = manualName.trim();
    if (pendingExercises.some((exercise) => sameExercise(exercise, cleanName))) {
      setPickerError('Este exercício já está selecionado.'); return;
    }
    toggleExercise(cleanName);
    if (cleanName.length >= 2) setManualName('');
  };
  const confirmExercises = () => {
    if (!pendingExercises.length) return;
    updateDivision(active, { exercises: [...current.exercises, ...pendingExercises] });
    setPendingExercises([]); setPickerOpen(false); setError('');
  };
  const moveExercise = (index: number, direction: -1 | 1) => {
    const destination = index + direction; if (destination < 0 || destination >= current.exercises.length) return;
    const exercises = [...current.exercises]; [exercises[index], exercises[destination]] = [exercises[destination], exercises[index]]; updateDivision(active, { exercises });
  };
  // Points to the first invalid field: which workout, which exercise and what to fix.
  const showSaveIssue = (issues: { path: PropertyKey[] }[]) => {
    const [root, divisionIndex, key, exerciseIndex] = issues[0]?.path ?? [];
    const toTop = () => formRef.current?.scrollTo({ y: 0, animated: true });
    const toDivision = (index: number) => { setActive(index); formRef.current?.scrollTo({ y: divisionTop.current, animated: true }); };
    if (root === 'name') { setError('Dê um nome à ficha com pelo menos 2 caracteres.'); toTop(); return; }
    if (root === 'validityDays') { setError('Escolha uma validade de 1 a 365 dias ou selecione Sem prazo.'); toTop(); return; }
    if (root !== 'divisions' || typeof divisionIndex !== 'number') { setError('Revise os dados da ficha.'); return; }
    const label = `treino ${letter(divisionIndex)}`;
    if (key === 'name') { setError(`Dê um nome ao ${label} com pelo menos 2 caracteres.`); toDivision(divisionIndex); return; }
    if (key === 'exercises' && typeof exerciseIndex === 'number') {
      const exercise = divisions[divisionIndex]?.exercises[exerciseIndex];
      const fields = issues.filter(issue => issue.path[1] === divisionIndex && issue.path[3] === exerciseIndex).map(issue => issue.path[4] ?? '');
      const message = exerciseIssues(fields);
      setError(`Treino ${letter(divisionIndex)} · ${exercise?.name ?? `exercício ${exerciseIndex + 1}`}: ${message.charAt(0).toLocaleLowerCase('pt-BR')}${message.slice(1)}`);
      toDivision(divisionIndex);
      if (exercise) { const { draftId, id: _rowId, ...value } = exercise; setEditing({ division: divisionIndex, id: draftId, value }); setExerciseError(message); }
      return;
    }
    const count = divisions[divisionIndex]?.exercises.length ?? 0;
    setError(count ? `O ${label} pode ter até 50 exercícios.` : `Adicione pelo menos um exercício ao ${label}.`); toDivision(divisionIndex);
  };
  const save = async () => {
    if (saveLock.current || editing) return;
    const divisionPayload = divisions.map((division) => ({ ...(division.id ? { id: division.id } : {}), name: division.name.trim(), exercises: division.exercises.map(({ draftId: _draftId, id, ...exercise }) => (editMode && id ? { id, ...exercise } : exercise)) }));
    const validity = validityDays.trim() ? Number(validityDays) : null;
    const parsed = editMode
      ? updateWorkoutPlanSchema.safeParse({ name: name.trim(), ...(changeValidity ? { validityDays: validity } : {}), divisions: divisionPayload })
      : createWorkoutPlanSchema.safeParse({ validityDays: validity, name: name.trim(), divisions: divisionPayload });
    if (!parsed.success) { showSaveIssue(parsed.error.issues); return; }
    saveLock.current = true; Keyboard.dismiss(); setBusy(true); setError('');
    try {
      if (editMode && editId) {
        await api.updateWorkoutPlan(editId, updateWorkoutPlanSchema.parse(parsed.data));
        showToast('Ficha atualizada.'); setSavedId(editId); setSaved(true);
      } else {
        const input = createWorkoutPlanSchema.parse(parsed.data);
        const snapshot = JSON.stringify(input);
        if (request.current?.snapshot !== snapshot) request.current = { snapshot, id: Crypto.randomUUID() };
        const result = await api.createWorkoutPlan({ ...input, requestId: request.current.id });
        showToast('Ficha criada.'); setSavedId(result.id); setSaved(true);
      }
    }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Não foi possível salvar a ficha. Verifique a conexão e tente novamente.'); }
    finally { saveLock.current = false; setBusy(false); }
  };
  const title = editMode ? 'Editar ficha' : flow === 'choose' ? 'Nova ficha' : 'Criar ficha';
  const sources = [
    { icon: 'pencil-outline', title: 'Criar minha ficha', description: 'Monte seus treinos e exercícios do zero.', action: () => setFlow('edit') },
    { icon: 'bookshelf', title: 'Escolher ficha da biblioteca', description: 'Use um modelo pronto e ajuste ao seu treino.', action: () => void openSuggestions() },
    ...(hasProfessional === false || hasProfessional === null ? [] : [{ icon: 'account-tie-outline' as const, title: 'Usar ficha do meu personal', description: 'Veja e aceite os treinos enviados a você.', action: () => setPersonalOpen(true) }]),
  ] as const;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.safe}>
      <View style={styles.header}>
        <ScreenHeader backLabel={editMode ? 'Ficha' : 'Fichas'} onBack={goBack} showHome={false} right={<Pressable accessibilityRole="button" accessibilityLabel="Ir para o início" disabled={busy} hitSlop={4} onPress={() => void goHome()} style={styles.homeButton}><MaterialCommunityIcons name="home-variant-outline" size={22} color={c.link}/></Pressable>} />
      </View>
      {editMode && loadState !== 'ready' ? <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {loadState === 'loading' ? <ActivityIndicator accessibilityLabel="Carregando ficha" color={c.link} size="large" style={styles.catalogLoading} /> : null}
        {loadState === 'error' ? <View accessibilityRole="alert" style={styles.card}><Text style={styles.cardTitle}>Não foi possível abrir a ficha</Text><Text style={styles.helper}>Verifique a conexão e tente novamente.</Text><Pressable accessibilityRole="button" onPress={() => { setLoadState('loading'); void loadPlan(); }} style={styles.primary}><Text style={styles.primaryText}>Tentar novamente</Text></Pressable></View> : null}
        {loadState === 'readonly' ? <View style={styles.card}><MaterialCommunityIcons name="lock-outline" size={26} color={c.link}/><Text style={styles.cardTitle}>Esta ficha não pode ser editada</Text><Text style={styles.helper}>{original?.name} foi enviada pelo seu profissional. Para mudar exercícios, cargas ou validade, peça o ajuste a ele.</Text><Pressable accessibilityRole="button" onPress={goBack} style={styles.primary}><Text style={styles.primaryText}>Voltar para a ficha</Text></Pressable></View> : null}
      </View> : flow === 'choose' ? <ScrollView contentContainerStyle={styles.content}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.helper}>Escolha como começar sua próxima ficha.</Text>{sources.map(option => <Pressable key={option.title} accessibilityRole="button" onPress={option.action} style={[styles.card, styles.sourceCard]}><MaterialCommunityIcons name={option.icon} size={28} color={c.link}/><View style={styles.sourceCopy}><Text style={styles.cardTitle}>{option.title}</Text><Text style={styles.helper}>{option.description}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={c.link}/></Pressable>)}</ScrollView> : <><ScrollView bottomOffset={saveFooterHeight + 16} ref={formRef} pointerEvents={busy ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, styles.formContent]}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.intro}><Text style={styles.introTitle}>{editMode ? 'Ajuste sua ficha' : 'Sua próxima ficha começa aqui'}</Text><Text style={styles.helper}>{editMode ? 'As mudanças valem para os próximos treinos. Treinos já realizados continuam no histórico como foram registrados.' : 'Dê um nome à ficha, organize os treinos e adicione seus exercícios.'}</Text></View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}><MaterialCommunityIcons name="clipboard-text-outline" size={21} color={c.link}/><Text accessibilityRole="header" style={styles.cardTitle}>Sobre a ficha</Text></View>
          <View style={styles.section}><Text style={styles.label}>Nome da ficha</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel="Nome da ficha" maxLength={80} value={name} onChangeText={(value) => { if (!saveLock.current) { setName(value); setError(''); } }} placeholder="Ex.: Hipertrofia 4x por semana" style={styles.input} /></View>
          <View style={styles.section}><Text style={styles.label}>Validade</Text>
            {editMode && !changeValidity ? <View style={styles.validityRow}>{original ? <View style={styles.flex}><PlanValidity plan={original} /></View> : null}<Pressable accessibilityRole="button" accessibilityLabel="Alterar validade da ficha" disabled={busy} onPress={() => { setChangeValidity(true); setError(''); }} style={styles.inlineButton}><Text style={styles.link}>Alterar validade</Text></Pressable></View> : <>
              <ValidityPicker days={validityDays} onChange={value => { if (!saveLock.current) { setValidityDays(value); setError(''); } }} allowUnlimited disabled={busy} revealCustomInput />
              <Text style={styles.helper}>{validityDays === '' ? 'Você decide quando revisar esta ficha.' : 'Data sugerida para revisar a ficha, contada a partir de quando você salvar; depois dela você continua treinando.'}</Text>
              {editMode ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setChangeValidity(false); setValidityDays('30'); }} style={styles.inlineButton}><Text style={styles.link}>Manter validade atual</Text></Pressable> : null}
            </>}
          </View>
        </View>

        <View style={[styles.card, styles.organizationCard]}>
          <View style={styles.sectionHeading}><MaterialCommunityIcons name="view-grid-outline" size={21} color={c.link}/><Text accessibilityRole="header" style={styles.cardTitle}>Organização dos treinos</Text></View>
          <Text style={styles.helper}>Cada treino reúne uma lista de exercícios. Por exemplo: treino A para superiores e treino B para pernas.</Text>
          <Text style={styles.label}>Quantos treinos a ficha terá (A, B, C…)</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Quantidade de treinos: ${divisions.length}. Alterar`} aria-expanded={countOpen} aria-disabled={busy} disabled={busy} onPress={() => setCountOpen(value => !value)} style={styles.countControl}>
            <View style={styles.countCopy}><Text style={styles.countTitle}>{divisions.length} {divisions.length === 1 ? 'treino' : 'treinos'}</Text><Text style={styles.helper}>{divisionLetters(divisions.length)}</Text></View><Text style={styles.link}>{countOpen ? 'Fechar' : 'Alterar'}</Text><MaterialCommunityIcons name={countOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.link}/>
          </Pressable>
          {countOpen ? <View accessibilityRole="radiogroup" accessibilityLabel="Quantidade de treinos" style={styles.countOptions}>{[1, 2, 3, 4, 5].map(amount => <Pressable key={amount} accessibilityRole="radio" accessibilityLabel={`${amount} ${amount === 1 ? 'treino' : 'treinos'}: ${divisionLetters(amount)}`} aria-checked={divisions.length === amount} aria-disabled={busy} disabled={busy} onPress={() => { if (amount === divisions.length) setCountOpen(false); else finishEditing(() => changeDivisionCount(amount)); }} style={[styles.countOption, divisions.length === amount && styles.countOptionActive]}><MaterialCommunityIcons name={divisions.length === amount ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={divisions.length === amount ? c.link : c.textMuted}/><Text style={styles.countOptionText}>{amount} {amount === 1 ? 'treino' : 'treinos'}</Text><Text style={styles.helper}>{divisionLetters(amount)}</Text></Pressable>)}</View> : null}
          <Text style={styles.helper}>A quantidade de treinos é diferente dos dias que você treina na semana.</Text>
        </View>

        <View style={[styles.section, styles.editorNavigation]} onLayout={event => { divisionTop.current = event.nativeEvent.layout.y; }}>
          <Text accessibilityRole="header" style={styles.cardTitle}>Escolha o treino para editar</Text>
          <Text style={styles.helper}>{divisions.length === 1 ? 'Adicione e configure os exercícios do seu treino.' : 'Escolha um treino abaixo para adicionar e ajustar seus exercícios.'}</Text>
          <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            <View accessibilityRole="tablist" accessibilityLabel="Treinos da ficha" style={styles.tabs}>{divisions.map((division, index) => <Pressable key={index} accessibilityRole="tab" accessibilityLabel={`Treino ${String.fromCharCode(65 + index)}`} accessibilityHint={`${division.name}. ${division.exercises.length} exercícios.`} aria-selected={active === index} aria-disabled={busy} disabled={busy} onPress={() => { if (index !== active) finishEditing(() => { setActive(index); setExerciseNotice(''); setError(''); }); }} style={[styles.tab, active === index && styles.tabActive]}><View style={styles.tabHeading}><Text style={[styles.tabLabel, active === index && styles.tabLabelActive]}>Treino {String.fromCharCode(65 + index)}</Text>{active === index ? <MaterialCommunityIcons name="check" size={16} color={c.white}/> : null}</View><Text style={[styles.tabCount, active === index && styles.tabCountActive]}>{division.exercises.length === 0 ? 'Sem exercícios' : `${division.exercises.length} ${division.exercises.length === 1 ? 'exercício' : 'exercícios'}`}</Text></Pressable>)}</View>
          </ScrollView>
        </View>

        <View style={styles.card}>
          <View style={styles.divisionHeading}><Text accessibilityRole="header" style={styles.divisionTitle}>Treino {String.fromCharCode(65 + active)}</Text><Text style={styles.divisionPosition}>{active + 1} de {divisions.length}</Text></View>
          <View style={styles.section}><Text style={styles.label}>Nome deste treino</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel={`Nome do treino ${String.fromCharCode(65 + active)}`} maxLength={80} value={current.name} onChangeText={(value) => { updateDivision(active, { name: value }); setError(''); }} placeholder="Ex.: Peito e tríceps" style={styles.input} /></View>
          <View style={styles.exerciseHeading}><View style={styles.exerciseHeadingCopy}><Text style={styles.cardTitle}>Exercícios</Text>{current.exercises.length ? <Text style={styles.helper}>Toque para expandir e ajustar.</Text> : null}</View>{current.exercises.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar exercícios ao treino ${String.fromCharCode(65 + active)}`} onPress={() => finishEditing(openExercisePicker)} style={styles.addButton}><Text style={styles.addButtonText}>+ Adicionar</Text></Pressable> : null}</View>
          {!current.exercises.length ? <View style={styles.empty}><MaterialCommunityIcons name="dumbbell" size={30} color={c.link}/><Text style={styles.emptyTitle}>O que vamos treinar?</Text><Text style={[styles.helper, styles.centered]}>Escolha exercícios do catálogo ou adicione os seus.</Text><Pressable accessibilityRole="button" accessibilityLabel={`Adicionar exercícios ao treino ${String.fromCharCode(65 + active)}`} onPress={() => finishEditing(openExercisePicker)} style={styles.emptyAction}><MaterialCommunityIcons name="plus" size={20} color={c.white}/><Text style={styles.primaryText}>Adicionar exercícios</Text></Pressable></View> : null}
          {exerciseNotice ? <Text accessibilityLiveRegion="polite" style={styles.helper}>{exerciseNotice}</Text> : null}
          {current.exercises.map((exercise, index) => <WorkoutExerciseCard key={exercise.draftId}
            exercise={exercise} index={index} count={current.exercises.length}
            imageUrl={exercise.catalogExerciseId ? images[exercise.catalogExerciseId] : null}
            draft={editing?.id === exercise.draftId ? editing.value : null}
            error={editing?.id === exercise.draftId ? exerciseError : ''}
            onToggle={() => editExercise(exercise)}
            onChange={change => { setEditing(value => value ? { ...value, value: { ...value.value, ...change } } : null); setExerciseError(''); }}
            onSave={saveExercise} onCancel={() => finishEditing(() => {})}
            onMove={direction => moveExercise(index, direction)} onRemove={() => removeExercise(exercise)}
            onPreview={uri => setPreview({ name: exercise.name, uri })}/>) }
        </View>
        {!editMode && !fromLibrary ? <Pressable accessibilityRole="button" onPress={openSuggestions} style={styles.suggestionsButton}><MaterialCommunityIcons name="bookshelf" size={19} color={c.link}/><Text style={styles.suggestionsButtonText}>Prefiro começar com um modelo pronto</Text></Pressable> : null}
      </ScrollView><FormStickyFooter onLayout={event => setSaveFooterHeight(event.nativeEvent.layout.height)}><View style={styles.saveFooter}><View style={styles.footerSummary}><Text accessibilityLiveRegion="polite" style={styles.footerProgress}>{completedDivisions} de {divisions.length} {divisions.length === 1 ? 'treino com exercícios' : 'treinos com exercícios'}</Text><Text style={styles.helper}>{totalExercises} {totalExercises === 1 ? 'exercício' : 'exercícios'}</Text></View>{editing ? <Text accessibilityLiveRegion="polite" style={styles.helper}>Salve ou cancele a edição do exercício antes de salvar a ficha.</Text> : null}{error ? <Text accessibilityRole="alert" style={styles.alertText}>{error}</Text> : null}<Pressable accessibilityRole="button" aria-busy={busy} aria-disabled={busy || editing != null} disabled={busy || editing != null} onPress={save} style={[styles.primary, (busy || editing != null) && styles.busy]}>{busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>{editMode ? 'Salvar alterações' : 'Salvar ficha'}</Text>}</Pressable>
      </View></FormStickyFooter></>}
    </View>

    <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
      <SafeAreaView style={styles.modalSafe}><View style={styles.safe}><View style={styles.modalHeader}><View style={styles.modalHeading}><Text accessibilityRole="header" style={styles.modalTitle}>Selecionar exercícios</Text><Text style={styles.helper} numberOfLines={1}>Treino {letter(active)} · {current.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cancelar seleção de exercícios" onPress={() => setPickerOpen(false)} style={styles.closeButton}><Text style={styles.close}>Cancelar</Text></Pressable></View>
        <FlatList renderScrollComponent={props => <ScrollView {...props} bottomOffset={pickerFooterHeight + 16} />} data={catalogLoading ? [] : filteredCatalog} extraData={[current.exercises, pendingExercises]} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent} initialNumToRender={12} maxToRenderPerBatch={16} windowSize={7}
          ListHeaderComponent={<View style={styles.catalogHeader}><Text style={styles.label}>Buscar no catálogo</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} value={search} onChangeText={(value) => { setCatalogLoading(true); setSearch(value); }} accessibilityLabel="Buscar no catálogo" placeholder="Ex.: agachamento, rosca ou puxada" style={styles.searchInput} /><Text style={styles.sectionHint}>{search.trim() ? 'Resultados pelo nome' : 'Exercícios mais usados'}</Text><Text style={styles.helper}>Digite para encontrar outros exercícios. Marque e confirme para configurar todos em uma lista.</Text><View accessibilityLiveRegion="polite" style={styles.selectionStatus}><View style={styles.selectionIcon}><MaterialCommunityIcons name="check" size={14} color={c.onPrimary}/></View><Text style={styles.selectionStatusText}>{pendingExercises.length ? `${pendingExercises.length} ${pendingExercises.length === 1 ? 'exercício selecionado' : 'exercícios selecionados'}` : 'Selecione os exercícios desejados'}</Text></View>{pickerError ? <Text accessibilityRole="alert" style={styles.alertText}>{pickerError}</Text> : null}</View>}
          ListEmptyComponent={catalogLoading ? <ActivityIndicator color={c.link} style={styles.catalogLoading} /> : <Text style={styles.noResults}>Nenhum exercício encontrado.</Text>}
          renderItem={({ item }) => { const added = current.exercises.some((exercise) => sameExercise(exercise, item.name, item.id)); const checked = added || pendingExercises.some((exercise) => sameExercise(exercise, item.name, item.id)); return <Pressable accessibilityRole="checkbox" accessibilityLabel={item.name} aria-checked={checked} aria-disabled={added} disabled={added} onPress={() => toggleExercise(item.name, item.id)} style={[styles.catalogRow, checked && styles.selectedRow, added && styles.busy]}>{item.imageUrl ? <View><Image source={{uri:item.imageUrl}} contentFit="cover" transition={150} style={styles.catalogImage} /><View style={[styles.imageCheck, checked && styles.checkedIcon]}>{checked ? <MaterialCommunityIcons name="check" size={13} color={c.onPrimary}/> : null}</View></View> : <View style={[styles.catalogIcon, checked && styles.checkedIcon]}>{checked ? <MaterialCommunityIcons name="check" size={18} color={c.onPrimary}/> : null}</View>}<View style={styles.catalogCopy}><Text style={styles.catalogName}>{item.name}{added ? ' (já adicionado)' : ''}</Text>{item.primaryMuscle || item.equipment ? <Text style={styles.catalogMeta}>{[item.primaryMuscle, item.equipment].filter(Boolean).join(' · ')}</Text> : null}</View></Pressable>; }}
          ListFooterComponent={<View style={styles.catalogFooter}><View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>OU</Text><View style={styles.line} /></View><Text style={styles.label}>Exercício personalizado</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} maxLength={100} value={manualName} onChangeText={setManualName} onSubmitEditing={addManualExercise} accessibilityLabel="Nome do exercício personalizado" placeholder="Ex.: Remada unilateral no cabo" style={styles.searchInput} /><Pressable accessibilityRole="button" disabled={manualName.trim().length < 2} onPress={addManualExercise} style={[styles.manualButton, manualName.trim().length < 2 && styles.busy]}><Text style={styles.primaryText}>Selecionar personalizado</Text></Pressable>{pendingExercises.filter((exercise) => !exercise.catalogExerciseId).map((exercise) => <Pressable key={exercise.name} accessibilityRole="checkbox" accessibilityLabel={exercise.name} aria-checked={true} onPress={() => toggleExercise(exercise.name)} style={[styles.catalogRow, styles.selectedRow]}><View style={[styles.catalogIcon, styles.checkedIcon]}><MaterialCommunityIcons name="check" size={18} color={c.onPrimary}/></View><Text style={styles.catalogName}>{exercise.name}</Text></Pressable>)}</View>}
        />
        <FormStickyFooter onLayout={event => setPickerFooterHeight(event.nativeEvent.layout.height)}><View style={styles.pickerFooter}>
          <Text style={styles.helper}>{pendingExercises.length ? `${pendingExercises.length} ${pendingExercises.length === 1 ? 'exercício selecionado' : 'exercícios selecionados'}` : 'Nenhum exercício selecionado'}</Text>
          <Pressable accessibilityRole="button" aria-disabled={!pendingExercises.length} disabled={!pendingExercises.length} onPress={confirmExercises} style={[styles.primary, !pendingExercises.length && styles.busy]}><Text style={styles.primaryText}>{pendingExercises.length ? `Adicionar ${pendingExercises.length} ${pendingExercises.length === 1 ? 'exercício' : 'exercícios'} ao treino ${letter(active)}` : 'Adicionar exercícios'}</Text></Pressable>
        </View></FormStickyFooter>
      </View></SafeAreaView>
    </Modal>
    <Modal visible={suggestionsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSuggestionsOpen(false)}><SafeAreaView style={styles.modalSafe}><View style={styles.modalHeader}><View style={styles.modalHeading}><Text accessibilityRole="header" style={styles.modalTitle}>Biblioteca de fichas</Text><Text style={styles.helper}>Escolha um modelo pronto e personalize antes de salvar.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar biblioteca de fichas" onPress={()=>setSuggestionsOpen(false)} style={styles.closeButton}><Text style={styles.close}>Cancelar</Text></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}>{suggestionsLoading?<ActivityIndicator accessibilityLabel="Carregando biblioteca" color={c.link}/>:suggestionsError?<View style={styles.section}><Text accessibilityRole="alert" style={styles.alertText}>{suggestionsError}</Text><Pressable accessibilityRole="button" onPress={() => void openSuggestions()} style={styles.manualButton}><Text style={styles.primaryText}>Tentar novamente</Text></Pressable></View>:!suggestions.length?<Text style={styles.helper}>Nenhuma ficha disponível na biblioteca.</Text>:<>
      <View style={styles.filters}>
        {levels.length > 1 ? <><Text style={styles.label}>Nível</Text><PlainScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><View accessibilityRole="radiogroup" accessibilityLabel="Filtrar por nível" style={styles.chipRow}>{(['all', ...levels] as const).map(level => { const selected = levelFilter === level; return <Pressable key={level} accessibilityRole="radio" aria-checked={selected}  onPress={() => setLevelFilter(level)} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{level === 'all' ? 'Todos' : levelLabels[level]}</Text></Pressable>; })}</View></PlainScrollView></> : null}
        {goals.length > 1 ? <><Text style={styles.label}>Objetivo</Text><PlainScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><View accessibilityRole="radiogroup" accessibilityLabel="Filtrar por objetivo" style={styles.chipRow}>{['all', ...goals].map(goal => { const selected = goalFilter === goal; return <Pressable key={goal} accessibilityRole="radio" aria-checked={selected}  onPress={() => setGoalFilter(goal)} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{goal === 'all' ? 'Todos' : goal}</Text></Pressable>; })}</View></PlainScrollView></> : null}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.helper}>{visibleSuggestions.length} {visibleSuggestions.length === 1 ? 'modelo' : 'modelos'}</Text>
      {!visibleSuggestions.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum modelo com esses filtros</Text><Pressable accessibilityRole="button" onPress={() => { setLevelFilter('all'); setGoalFilter('all'); }} style={styles.inlineButton}><Text style={styles.link}>Limpar filtros</Text></Pressable></View> : null}
      {visibleSuggestions.map(suggestion => { const level = levelLabels[suggestion.level]; const repeatsLevel = suggestion.name.toLocaleLowerCase('pt-BR').includes(level.toLocaleLowerCase('pt-BR')); const references = formatReferences(suggestion.reference); return <Pressable accessibilityRole="button" accessibilityHint="Usa este modelo como ponto de partida da ficha" key={suggestion.id} onPress={() => applySuggestion(suggestion)} style={styles.suggestionCard}><Text style={styles.suggestionTitle}>{suggestion.name}</Text><Text style={styles.suggestionGoal}>{repeatsLevel ? suggestion.goal : `${suggestion.goal} · ${level.toLocaleLowerCase('pt-BR')}`}</Text><Text style={styles.helper}>{suggestion.description}</Text><Text style={styles.suggestionMeta}>{suggestion.divisions.length} {suggestion.divisions.length === 1 ? 'treino' : 'treinos'} ({suggestion.divisions.map((_, index) => letter(index)).join(', ')}){references ? ` · ${references}` : ''}</Text></Pressable>; })}
    </>}</ScrollView></SafeAreaView></Modal>
    <Modal visible={personalOpen} animationType="slide" onRequestClose={() => setPersonalOpen(false)}><SafeAreaView style={styles.modalSafe}><ScrollView contentContainerStyle={styles.content}><Pressable accessibilityRole="button" accessibilityLabel="Fechar fichas do personal" onPress={() => setPersonalOpen(false)} style={styles.modalBack}><MaterialCommunityIcons name="chevron-left" size={26} color={c.link}/><Text style={styles.link}>Nova ficha</Text></Pressable><ProfessionalPlans kind="workout"/><Pressable accessibilityRole="button" onPress={() => { setPersonalOpen(false); router.push({pathname:'/workouts',params:{section:'plans'}}); }} style={styles.primary}><Text style={styles.primaryText}>Ver minhas fichas</Text></Pressable></ScrollView></SafeAreaView></Modal>
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}><SafeAreaView style={{flex:1,backgroundColor:c.background,padding:20,gap:16}}><Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem" onPress={() => setPreview(null)} style={styles.modalBack}><MaterialCommunityIcons name="close" size={22} color={c.link}/><Text style={styles.link}>Fechar imagem</Text></Pressable><Text style={styles.cardTitle}>{preview?.name}</Text>{preview ? <Image source={{uri:preview.uri}} contentFit="contain" style={{flex:1}} accessibilityLabel={`Imagem ampliada de ${preview.name}`}/> : null}</SafeAreaView></Modal>
  </SafeAreaView>;
}

const createStyles = (c: AppPalette) => StyleSheet.create({
    sourceCard: { flexDirection: 'row', alignItems: 'center', minHeight: 100 }, sourceCopy: { flex: 1, gap: 5 }, flex: { flex: 1, minWidth: 0 }, formContent: { paddingBottom: 48 },
    validityRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, inlineButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
    modalHeading: { flex: 1, minWidth: 0, gap: 2 }, closeButton: { minHeight: 44, minWidth: 44, flexShrink: 0, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 8 }, modalBack: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
    filters: { gap: 8 }, chipRow: { flexDirection: 'row', gap: 8 }, filterChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, filterChipActive: { backgroundColor: c.primary, borderColor: c.primary }, filterChipText: { ...Type.label, color: c.text, fontWeight: '700' }, filterChipTextActive: { color: c.onPrimary },
    intro: { gap: 6 }, introTitle: { color: c.text, fontSize: 19, fontWeight: '800', lineHeight: 26 },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    organizationCard: { backgroundColor: c.primarySoft },
    editorNavigation: { marginTop: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.border },
    countControl: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.surface },
    countCopy: { flex: 1, gap: 3 }, countTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    countOptions: { gap: 6 }, countOption: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    countOptionActive: { backgroundColor: c.primarySoft, borderColor: c.link }, countOptionText: { flex: 1, color: c.text, fontSize: 14, fontWeight: '700' },
    divisionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, divisionPosition: { color: c.link, backgroundColor: c.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontSize: 12, fontWeight: '700' },
    centered: { textAlign: 'center' }, emptyAction: { minHeight: 48, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, backgroundColor: c.primary },
    footerSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, flexWrap: 'wrap' }, footerProgress: { color: c.text, fontSize: 12, fontWeight: '700' },
    saveFooter: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, width: '100%', maxWidth: 680, alignSelf: 'center' },
    pickerFooter: { padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }, selectedRow: { borderColor: c.accent, backgroundColor: c.primarySoft }, checkedIcon: { backgroundColor: c.accent }, catalogImage: { width: 54, height: 48, borderRadius: 12, backgroundColor: c.surfaceSoft }, imageCheck: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface },
    safe: { flex: 1, backgroundColor: c.background }, content: { padding: 20, paddingBottom: 24, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' }, header: { paddingHorizontal: 16, paddingVertical: 4, width: '100%', maxWidth: 680, alignSelf: 'center', borderBottomWidth: 1, borderBottomColor: c.border }, homeButton: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft }, title: { ...Type.headline, fontWeight: '800', color: c.text }, link: { color: c.link, fontWeight: '800' }, suggestionsButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 }, suggestionsButtonText: { flexShrink: 1, color: c.link, fontSize: 13, fontWeight: '700' }, suggestionCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 15, gap: 6 }, suggestionTitle: { color: c.text, fontSize: 16, fontWeight: '800' }, suggestionGoal: { color: c.link, fontSize: 12, fontWeight: '800' }, suggestionMeta: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 }, section: { gap: 8 }, label: { fontSize: 13, fontWeight: '700', color: c.text }, helper: { color: c.textMuted, fontSize: 13, lineHeight: 19 }, sectionHint: { color: c.link, fontSize: 12, fontWeight: '800' }, input: { minHeight: 49, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 14, color: c.text, fontSize: 15 }, tabs: { flexDirection: 'row', gap: 8 },
    tab: { width: 132, minHeight: 70, padding: 12, justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
    tabLabel: { color: c.text, fontSize: 14, fontWeight: '800' }, tabLabelActive: { color: c.white },
    tabCount: { color: c.textMuted, fontSize: 12 }, tabCountActive: { color: c.white },
    card: { backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 16, gap: 16 }, divisionTitle: { color: c.text, fontSize: 21, fontWeight: '800' }, exerciseHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 5, width: '100%' }, exerciseHeadingCopy: { flex: 1, minWidth: 0, paddingRight: 2 }, cardTitle: { fontSize: 17, fontWeight: '800', color: c.text }, addButton: { flexShrink: 0, minHeight: 44, justifyContent: 'center', backgroundColor: c.surfaceSoft, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start' }, addButtonText: { color: c.link, fontSize: 12, fontWeight: '800' }, empty: { alignItems: 'center', padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, borderRadius: 16, gap: 10 }, emptyTitle: { color: c.text, fontSize: 16, fontWeight: '800' }, primary: { minHeight: 54, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: c.onPrimary, fontSize: 15, fontWeight: '800', textAlign: 'center', paddingHorizontal: 8 }, busy: { opacity: 0.5 }, alertText: { color: c.danger, fontSize: 13, lineHeight: 18 }, modalSafe: { flex: 1, backgroundColor: c.background }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: c.border }, modalTitle: { color: c.text, fontSize: 22, fontWeight: '800' }, close: { color: c.link, fontWeight: '800' }, modalContent: { padding: 20, paddingBottom: 70, gap: 10 }, catalogHeader: { gap: 10, paddingBottom: 10 }, selectionStatus: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.border }, selectionIcon: { width: 22, height: 22, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, selectionStatusText: { flex: 1, color: c.link, fontSize: 13, fontWeight: '800' }, catalogFooter: { gap: 10, paddingTop: 10 }, catalogLoading: { paddingVertical: 28 }, searchInput: { height: 50, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 14, color: c.text }, catalogRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, marginBottom: 10 }, catalogIcon: { width: 29, height: 29, borderRadius: 12, backgroundColor: c.surfaceSoft, alignItems: 'center', justifyContent: 'center' }, catalogCopy: { flex: 1, paddingVertical: 8 }, catalogName: { color: c.text, fontSize: 14, fontWeight: '700' }, catalogMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 }, noResults: { color: c.textMuted, textAlign: 'center', padding: 20 }, divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }, line: { flex: 1, height: 1, backgroundColor: c.border }, dividerText: { color: c.textMuted, fontSize: 12, fontWeight: '800' }, manualButton: { height: 50, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }
});
