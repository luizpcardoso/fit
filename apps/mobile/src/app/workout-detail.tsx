import { WorkoutPlanCover } from '@/components/workout-plan-cover';
import { WorkoutIllustration } from '@/components/workout-illustration';
import { ExerciseThumbnail } from '@/components/exercise-thumbnail';
import { useAuth } from '@/auth/auth-context';
import { PlanValidity } from '@/components/plan-validity';
import { RenewPlan } from '@/components/renew-plan';
import { CardShadow, Radius, Type, type AppPalette } from '@/constants/theme';
import { FixedScreenHeader, ScreenHeader } from '@/components/screen-header';
import { confirmAction, showDialog, showToast } from '@/components/app-dialog';
import { useAppTheme } from '@/theme/theme-provider';
import MaterialCommunityIcons from '@/components/icon';
import { isWorkoutRunOpen, type WorkoutPlan } from '@fit/contracts';
import { useWorkoutRun } from '@/components/workout-run-provider';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';
import { BottomSheet } from '@/components/bottom-sheet';
import { Skeleton, SkeletonCard, SkeletonGroup } from '@/components/skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WorkoutDetail() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  // The sheet keeps the last exercise while it slides out.
  const [exerciseId, setExerciseId] = useState(''), [lastExerciseId, setLastExerciseId] = useState('');
  if (exerciseId && exerciseId !== lastExerciseId) setLastExerciseId(exerciseId);
  const { run } = useWorkoutRun();
  const openRun = run && isWorkoutRunOpen(run.progress) ? run : null;

  // Reloads on focus so returning from "Editar ficha" shows the saved version.
  const load = useCallback(() => {
    if (!id) return;
    setLoadError('');
    api.getWorkoutPlan(id).then(value => {
      setPlan(value);
      setSelectedDivisionId(current => value.divisions.some(division => division.id === current) ? current : value.divisions[0]?.id ?? '');
    }).catch(() => setLoadError('Não foi possível carregar a ficha. Verifique a conexão e tente novamente.'));
  }, [api, id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const selectedDivision = plan?.divisions.find(item => item.id === selectedDivisionId) ?? plan?.divisions[0] ?? null;
  const shownExercise = plan?.divisions.flatMap(division => division.exercises).find(exercise => exercise.id === (exerciseId || lastExerciseId)) ?? null;
  const exerciseCount = useMemo(() => plan?.divisions.reduce((total, division) => total + division.exercises.length, 0) ?? 0, [plan]);

  if (!plan) return <SafeAreaView style={s.safe} edges={['top']}><View style={s.content}><ScreenHeader backLabel="Fichas" />{loadError ? <View accessibilityRole="alert" style={s.errorCard}><Text style={s.divisionTitle}>Não foi possível abrir a ficha</Text><Text style={s.muted}>{loadError}</Text><Pressable accessibilityRole="button" onPress={load} style={s.start}><Text style={s.startText}>Tentar novamente</Text></Pressable></View> : <SkeletonGroup label="Carregando ficha" style={s.skeleton}><SkeletonCard lines={3} height={190}/><Skeleton width="45%" height={20}/><SkeletonCard lines={4}/></SkeletonGroup>}</View></SafeAreaView>;

  const archived = plan.status === 'archived';
  const statusLabel = archived ? 'Arquivada' : plan.isActive ? 'Ficha ativa' : 'Ficha inativa';
  const statusIcon = archived ? 'archive-outline' : plan.isActive ? 'check-decagram' : 'pause-circle-outline';
  const readOnly = plan.origin === 'professional';
  const updateActive = async () => {
    setBusy(true); setMessage('');
    try {
      if (plan.isActive) { await api.deactivateWorkoutPlan(plan.id); setPlan({ ...plan, isActive: false }); showToast('Ficha desativada.'); }
      else { await api.activateWorkoutPlan(plan.id); setPlan({ ...plan, isActive: true }); showToast('Esta agora é sua ficha ativa.'); }
    } catch { setMessage('Não foi possível atualizar a ficha.'); }
    finally { setBusy(false); }
  };
  const updateArchived = async (nextArchived: boolean) => {
    setBusy(true); setMessage('');
    try {
      await api.setWorkoutPlanArchived(plan.id, nextArchived);
      setPlan({ ...plan, status: nextArchived ? 'archived' : 'available', isActive: false });
      showToast(nextArchived ? 'Ficha arquivada. Ela continua em Fichas arquivadas.' : 'Ficha restaurada.');
    } catch { setMessage('Não foi possível atualizar a ficha.'); }
    finally { setBusy(false); }
  };
  const confirmArchive = async () => {
    if (archived) return void updateArchived(false);
    if (await confirmAction({ title: 'Arquivar esta ficha?', message: `${plan.name} sairá das fichas atuais, mas os treinos realizados continuarão no histórico.`, confirmLabel: 'Arquivar ficha', cancelLabel: 'Manter ficha' })) void updateArchived(true);
  };
  // Rejecting keeps the dialog open with the error, so a failed delete is never silent.
  const confirmDelete = () => showDialog('Excluir esta ficha permanentemente?', 'A ficha e seus exercícios serão removidos. Os treinos realizados continuarão no histórico como “Ficha excluída”.', [{ text: 'Manter ficha', style: 'cancel' }, { text: 'Excluir ficha', style: 'destructive', onPress: async () => {
    try { await api.deleteWorkoutPlan(plan.id); } catch { throw new Error('Não foi possível excluir a ficha. Tente novamente.'); }
    showToast('Ficha excluída.'); router.dismissTo({ pathname: '/workouts', params: { section: 'plans' } });
  } }]);
  const openEdit = () => router.push({ pathname: '/workout-create', params: { id: plan.id } });

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <FixedScreenHeader backLabel="Fichas" right={<Pressable accessibilityRole="button" accessibilityLabel={`Ações da ficha ${plan.name}`} onPress={() => setActionsOpen(true)} style={s.menuButton}><MaterialCommunityIcons name="dots-horizontal" size={24} color={c.link} /></Pressable>} />
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      <View style={[s.identity, CardShadow]}>
        <WorkoutPlanCover coverId={plan.coverId}/>
        <View style={s.identityTop}>
          <View style={s.identityIcon}><MaterialCommunityIcons name="clipboard-text-outline" size={24} color={c.primaryStrong} /></View>
          <Text style={[s.eyebrow, s.flex]}>Detalhes da ficha</Text>
          <View style={[s.status, archived && s.statusArchived]}><MaterialCommunityIcons name={statusIcon} size={14} color={c.primaryStrong} /><Text style={s.statusText}>{statusLabel}</Text></View>
        </View>
        <Text accessibilityRole="header" style={s.title}>{plan.name}</Text>
        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statValue}>{plan.divisions.length}</Text><Text style={s.statLabel}>{plan.divisions.length === 1 ? 'treino' : 'treinos'}</Text></View>
          <View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{exerciseCount}</Text><Text style={s.statLabel}>exercícios</Text></View>
          <View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{plan.completedSessions}</Text><Text style={s.statLabel}>realizados</Text></View>
        </View>
        <View style={s.validity}><PlanValidity plan={plan} /></View>
        {readOnly ? <View style={s.origin}><MaterialCommunityIcons name="account-tie-outline" size={16} color={c.heroTint} /><Text style={s.originText}>Enviada pelo seu profissional</Text></View> : null}
      </View>

      {readOnly ? <View style={s.readOnlyNote}><MaterialCommunityIcons name="lock-outline" size={18} color={c.textMuted} /><Text style={s.inactiveHintText}>Esta ficha foi enviada pelo seu profissional e não pode ser editada por aqui. Para mudar exercícios ou cargas, peça o ajuste a ele.</Text></View> : null}

      {message ? <View accessibilityRole="alert" style={s.notice}><MaterialCommunityIcons name="information-outline" size={18} color={c.link} /><Text style={s.noticeText}>{message}</Text></View> : null}

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Treinos da ficha</Text><Text style={s.sectionSubtitle}>Troque de treino sem sair desta ficha</Text></View>
      {plan.divisions.length ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs} accessibilityRole="tablist">
          {plan.divisions.map(division => {
            const selected = division.id === selectedDivision?.id;
            return <Pressable key={division.id} accessibilityRole="tab" aria-selected={selected} onPress={() => setSelectedDivisionId(division.id)} style={[s.tab, selected && s.tabSelected]}>
              <View style={[s.tabLetter, selected && s.tabLetterSelected]}><Text style={[s.tabLetterText, selected && s.tabLetterTextSelected]}>{division.label}</Text></View>
              <View><Text numberOfLines={1} style={[s.tabTitle, selected && s.tabTitleSelected]}>{division.name}</Text><Text style={[s.tabMeta, selected && s.tabMetaSelected]}>{division.exercises.length} {division.exercises.length === 1 ? 'exercício' : 'exercícios'}</Text></View>
            </Pressable>;
          })}
        </ScrollView>

        {selectedDivision ? <View style={[s.divisionPanel, CardShadow]}>
          <View style={s.divisionHeader}>{selectedDivision.illustrationId ? <WorkoutIllustration id={selectedDivision.illustrationId} style={{ width: 96 }}/> : <View style={s.divisionLetter}><Text style={s.divisionLetterText}>{selectedDivision.label}</Text></View>}<View style={s.flex}><Text style={s.divisionTitle}>Treino {selectedDivision.label} · {selectedDivision.name}</Text><Text style={s.muted}>{selectedDivision.completedSessions} {selectedDivision.completedSessions === 1 ? 'vez realizado' : 'vezes realizado'}</Text></View></View>
          <View style={s.exerciseList}>{selectedDivision.exercises.map((exercise, index) => <Pressable key={exercise.id} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${exercise.name}`} onPress={() => setExerciseId(exercise.id)} style={[s.exercise, index > 0 && s.exerciseDivider]}><ExerciseThumbnail name={exercise.name} uri={exercise.imageUrl} size={72}/><View style={s.flex}><Text style={s.exerciseName}>{exercise.name}</Text><Text style={s.muted}>{exercise.sets} × {exercise.reps}{exercise.load != null ? ` · ${exercise.load} kg` : ''}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted}/></Pressable>)}</View>
          {!selectedDivision.exercises.length ? <View style={s.empty}><MaterialCommunityIcons name="dumbbell" size={24} color={c.textMuted} /><Text style={s.muted}>Nenhum exercício neste treino.</Text></View> : null}
        </View> : null}
      </> : <View style={s.empty}><MaterialCommunityIcons name="clipboard-alert-outline" size={27} color={c.textMuted} /><Text style={s.muted}>Esta ficha não possui treinos.</Text></View>}
    </ScrollView>
    {archived ? <View style={s.footer}><Text style={s.footerHint}>Ficha arquivada. Restaure para voltar a usá-la.</Text><Pressable accessibilityRole="button" aria-busy={busy} disabled={busy} style={[s.start, s.footerInner, busy && s.disabled]} onPress={() => void updateArchived(false)}><MaterialCommunityIcons name="archive-arrow-up-outline" size={19} color={c.onPrimary} /><Text style={s.startText}>Restaurar ficha</Text></Pressable></View>
      : !plan.isActive ? <View style={s.footer}><Text style={s.footerHint}>Ative esta ficha para treinar por ela. A ficha ativa atual fica guardada.</Text><Pressable accessibilityRole="button" aria-busy={busy} disabled={busy} style={[s.start, s.footerInner, busy && s.disabled]} onPress={() => void updateActive()}><MaterialCommunityIcons name="play-circle-outline" size={19} color={c.onPrimary} /><Text style={s.startText}>Ativar ficha</Text></Pressable></View>
      : selectedDivision ? <View style={s.footer}><Pressable accessibilityRole="button" style={[s.start, s.footerInner]} onPress={() => router.push(openRun ? '/workout-run' : { pathname: '/workout-run', params: { planId: plan.id, divisionId: selectedDivision.id } })}><MaterialCommunityIcons name="play" size={19} color={c.onPrimary} /><Text style={s.startText}>{openRun ? `Continuar treino ${openRun.divisionLabel}` : `Iniciar treino ${selectedDivision.label}`}</Text></Pressable></View> : null}
    <BottomSheet visible={Boolean(exerciseId)} onClose={() => setExerciseId('')} title={shownExercise?.name ?? ''} subtitle={shownExercise ? `${shownExercise.sets} séries × ${shownExercise.reps} repetições` : undefined} backdropLabel="Fechar detalhes do exercício">
      {shownExercise ? <>
        <ExerciseThumbnail name={shownExercise.name} uri={shownExercise.imageUrl} fill/>
        <View style={s.exerciseFacts}>
          <Text style={s.muted}>Carga: <Text style={s.exerciseName}>{shownExercise.load != null ? `${shownExercise.load} kg` : 'não definida'}</Text></Text>
          <Text style={s.muted}>Descanso: <Text style={s.exerciseName}>{shownExercise.restSeconds != null ? `${shownExercise.restSeconds} s` : 'não definido'}</Text></Text>
        </View>
        <Text style={s.exerciseNotes}>{shownExercise.notes || 'Sem orientações adicionais na ficha.'}</Text>
      </> : null}
    </BottomSheet>
    <BottomSheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Ações da ficha" subtitle={`Aplicam-se a ${plan.name}`} backdropLabel="Fechar ações da ficha">
      <View style={s.actionGrid}>
        {!readOnly ? <Pressable accessibilityRole="button" accessibilityLabel={`Editar ficha ${plan.name}`} disabled={busy} onPress={() => { setActionsOpen(false); openEdit(); }} style={[s.actionTile, busy && s.disabled]}><View style={s.actionIcon}><MaterialCommunityIcons name="pencil-outline" size={21} color={c.link} /></View><Text style={s.actionTitle}>Editar ficha</Text><Text style={s.actionText}>Nome, validade, treinos e exercícios</Text></Pressable> : null}
        <RenewPlan variant="tile" plan={plan} onRenewed={updated => { setActionsOpen(false); setPlan(updated); showToast('Validade da ficha atualizada.'); }} />
        {!archived ? <Pressable accessibilityRole="button" accessibilityLabel={`${plan.isActive ? 'Desativar' : 'Ativar'} ficha ${plan.name}`} disabled={busy} onPress={() => { setActionsOpen(false); void updateActive(); }} style={[s.actionTile, busy && s.disabled]}><View style={s.actionIcon}><MaterialCommunityIcons name={plan.isActive ? 'pause-circle-outline' : 'play-circle-outline'} size={21} color={c.link} /></View><Text style={s.actionTitle}>{plan.isActive ? 'Desativar ficha' : 'Ativar ficha'}</Text><Text style={s.actionText}>{plan.isActive ? 'Parar de usar como principal' : 'Usar nos próximos treinos'}</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`${archived ? 'Restaurar' : 'Arquivar'} ficha ${plan.name}`} disabled={busy} onPress={() => { setActionsOpen(false); void confirmArchive(); }} style={[s.actionTile, busy && s.disabled]}><View style={s.actionIcon}><MaterialCommunityIcons name={archived ? 'archive-arrow-up-outline' : 'archive-outline'} size={21} color={archived ? c.link : c.warning} /></View><Text style={s.actionTitle}>{archived ? 'Restaurar ficha' : 'Arquivar ficha'}</Text><Text style={s.actionText}>{archived ? 'Voltar para fichas atuais' : 'Retirar das fichas atuais'}</Text></Pressable>
      </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ficha ${plan.name} permanentemente`} disabled={busy} onPress={() => { setActionsOpen(false); confirmDelete(); }} style={[s.dangerRow, busy && s.disabled]}><View style={[s.actionIcon, s.dangerIcon, s.rowIcon]}><MaterialCommunityIcons name="trash-can-outline" size={21} color={c.danger} /></View><View style={s.flex}><Text style={[s.actionTitle, s.dangerText]}>Excluir ficha</Text><Text style={s.actionText}>Remover permanentemente</Text></View></Pressable>
    </BottomSheet>
  </SafeAreaView>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe:{flex:1,backgroundColor:c.background},menuButton:{width:44,height:44,borderRadius:Radius.md,alignItems:'center',justifyContent:'center',backgroundColor:c.surfaceSoft},footer:{borderTopWidth:1,borderTopColor:c.border,backgroundColor:c.surface,paddingHorizontal:16,paddingVertical:12},footerInner:{maxWidth:640,width:'100%',alignSelf:'center',minHeight:52},footerHint:{...Type.caption,color:c.textMuted,textAlign:'center',marginBottom:8},exerciseFacts:{flexDirection:'row',flexWrap:'wrap',gap:16},exerciseNotes:{...Type.body,color:c.text},content:{padding:20,paddingBottom:32,gap:14,maxWidth:680,width:'100%',alignSelf:'center'},flex:{flex:1,minWidth:0},skeleton:{gap:14,marginTop:8},errorCard:{backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:Radius.xl,padding:18,gap:10,marginTop:16},
  identity:{backgroundColor:c.primaryStrong,borderRadius:24,padding:17,gap:15},identityTop:{flexDirection:'row',alignItems:'center',gap:11,flexWrap:'wrap'},identityIcon:{width:44,height:44,borderRadius: 16,backgroundColor:c.white,alignItems:'center',justifyContent:'center'},eyebrow:{...Type.caption,fontWeight: '800',letterSpacing:.5,textTransform:'uppercase',color:c.heroMuted},title:{fontSize:23,fontWeight: '800',color:c.white,marginTop:2},status:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:c.white,paddingHorizontal:8,paddingVertical:6,borderRadius:Radius.md},statusText:{...Type.caption,fontWeight: '800',color:c.primaryStrong},statusArchived:{backgroundColor:c.heroWarning},origin:{flexDirection:'row',alignItems:'center',gap:6},originText:{...Type.caption,fontWeight:'700',color:c.heroTint},readOnlyNote:{flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:c.surfaceSoft,padding:12,borderRadius:Radius.lg},stats:{flexDirection:'row',alignItems:'center'},stat:{flex:1,alignItems:'center'},statValue:{fontSize:20,fontWeight: '800',color:c.white},statLabel:{fontSize: 12,color:c.heroMuted,marginTop:1},statDivider:{width:1,height:29,backgroundColor:'rgba(255,255,255,.14)'},validity:{backgroundColor:c.surface,borderRadius:12,paddingHorizontal:11,paddingVertical:9},
  notice:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:c.primarySoft,padding:12,borderRadius: 16},noticeText:{flex:1,color:c.link,fontSize: 12,fontWeight:'700'},sectionHeading:{gap:2,marginTop:3},sectionTitle:{fontSize:19,fontWeight: '800',color:c.text},sectionSubtitle:{fontSize: 12,color:c.textMuted},
  actionGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},actionTile:{width:'48%',flexGrow:1,minWidth:140,minHeight:105,borderWidth:1,borderColor:c.border,borderRadius:16,backgroundColor:c.surface,padding:12,justifyContent:'center'},actionIcon:{width:36,height:36,borderRadius:12,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center',marginBottom:7},actionTitle:{fontSize:12,fontWeight: '800',color:c.text},actionText:{fontSize: 12,color:c.textMuted,marginTop:2},dangerRow:{minHeight:64,marginTop:6,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:c.dangerSoft,borderRadius:16,backgroundColor:c.surface,padding:12},rowIcon:{marginBottom:0},dangerIcon:{backgroundColor:c.dangerSoft},dangerText:{color:c.danger},disabled:{opacity:.55},
  tabs:{gap:8,paddingRight:20},tab:{minWidth:145,maxWidth:210,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:c.border,borderRadius:16,backgroundColor:c.surface,padding:10},tabSelected:{backgroundColor:c.primary,borderColor:c.primary},tabLetter:{width:35,height:35,borderRadius: 12,backgroundColor:c.surfaceSoft,alignItems:'center',justifyContent:'center'},tabLetterSelected:{backgroundColor:c.white},tabLetterText:{fontSize:14,fontWeight: '800',color:c.link},tabLetterTextSelected:{color:c.primaryStrong},tabTitle:{maxWidth:135,fontSize:12,fontWeight: '800',color:c.text},tabTitleSelected:{color:c.white},tabMeta:{fontSize: 12,color:c.textMuted,marginTop:2},tabMetaSelected:{color:c.heroMuted},
  divisionPanel:{backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:20,padding:15,gap:13},divisionHeader:{flexDirection:'row',alignItems:'center',gap:10},divisionLetter:{width:42,height:42,borderRadius: 16,backgroundColor:c.primary,alignItems:'center',justifyContent:'center'},divisionLetterText:{color:c.white,fontWeight: '800',fontSize:17},divisionTitle:{fontSize:16,fontWeight: '800',color:c.text},muted:{...Type.label,color:c.textMuted},exerciseList:{borderTopWidth:1,borderTopColor:c.border},exercise:{minHeight:70,flexDirection:'row',alignItems:'center',gap:11,paddingVertical:8},exerciseDivider:{borderTopWidth:1,borderTopColor:c.border},exerciseName:{fontSize:13,fontWeight:'800',color:c.text},start:{minHeight:48,borderRadius: 16,backgroundColor:c.primary,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},startText:{color:c.onPrimary,fontWeight: '800',...Type.label},inactiveHint:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:c.surfaceSoft,padding:11,borderRadius: 16},inactiveHintText:{flex:1,color:c.textMuted,...Type.caption},empty:{backgroundColor:c.surfaceSoft,borderRadius:16,padding:20,alignItems:'center',gap:7},
});
