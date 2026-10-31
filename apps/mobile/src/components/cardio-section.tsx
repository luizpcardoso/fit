import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { useAuth } from '@/auth/auth-context';
import { InformationModal } from '@/components/information-modal';
import { CardShadow, Scrim, type AppPalette } from '@/constants/theme';
import { confirmAction, showToast } from '@/components/app-dialog';
import { formatRelativeDay } from '@/utils/dates';
import { useAppTheme } from '@/theme/theme-provider';
import { formatIntegerInput, formatWeightInput, formatWeightValue } from '@/utils/input-format';
import MaterialCommunityIcons from '@/components/icon';
import type { CardioActivity, CardioIntensity, CardioSession, CardioSessionInput } from '@fit/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShareActivityModal } from '@/components/share-activity-modal';

const activities: { value: CardioActivity; label: string; icon: 'walk'|'run'|'bike'|'stairs'|'bike-fast' }[] = [
  { value:'walking',label:'Caminhada',icon:'walk' },
  { value:'running',label:'Corrida',icon:'run' },
  { value:'cycling',label:'Bicicleta',icon:'bike' },
  { value:'stairs',label:'Escada',icon:'stairs' },
  { value:'spinning',label:'Spinning',icon:'bike-fast' },
];
const intensities: { value: CardioIntensity; label: string; hint: string }[] = [
  { value:'light',label:'Leve',hint:'Ritmo confortável' },
  { value:'moderate',label:'Moderada',hint:'Respiração mais rápida' },
  { value:'intense',label:'Intensa',hint:'Esforço difícil de sustentar' },
];
const activityLabel = (value: CardioActivity | null) => activities.find(item=>item.value===value)?.label ?? 'Cardio';
const intensityLabel = (value: CardioIntensity | null) => intensities.find(item=>item.value===value)?.label ?? '';

const infoParagraphs = [
  'Em “Calcular estimativa”, você informa atividade, intensidade, duração e peso, e o Fit calcula um gasto médio para a sessão, com base em tabelas de referência de atividades físicas.',
  'A estimativa não é uma medição individual. Inclinação, resistência, velocidade, condicionamento e diferenças do organismo podem aumentar ou reduzir o gasto real.',
  'Se você já tem o valor de um relógio, aplicativo ou equipamento, escolha “Informar calorias” e diga se ele é o total da sessão (inclui o gasto em repouso) ou só as calorias ativas. Não registre a mesma sessão duas vezes. Se você ajustar o gasto do dia em Nutrição, os cardios não são somados de novo.',
] as const;
const infoDetails = [
  'A estimativa usa valores MET do Compêndio de Atividades Físicas (2024): calorias = MET × peso (kg) × duração (min) ÷ 60. MET compara o esforço da atividade com o gasto em repouso.',
  'No balanço do dia, descontamos 1 MET de repouso de cada sessão estimada, porque o repouso já está na base diária. Nos valores informados como calorias totais, também descontamos o repouso do período; calorias ativas entram inteiras.',
] as const;

export function CardioSection({ date, title = 'Cardio de hoje', compact = false, onChanged }: { date: string; title?: string; compact?: boolean; onChanged?(): void }) {
  const { colors:c }=useAppTheme(); const s=styles(c); const { api }=useAuth();
  const [sessions,setSessions]=useState<CardioSession[]>([]); const [weight,setWeight]=useState<number|null>(null);
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [formOpen,setFormOpen]=useState(false); const [infoOpen,setInfoOpen]=useState(false);
  const[shareActivity,setShareActivity]=useState<{eventType:'cardio_completed';sourceType:'cardio_session';sourceId:string}|null>(null);
  const load=useCallback(async()=>{setError('');try{const[nextSessions,measurements]=await Promise.all([api.listCardioSessions(date),api.listBodyMeasurements()]);setSessions(nextSessions);setWeight(measurements.find(item=>item.weightKg!=null)?.weightKg??null)}catch{setError('Não foi possível carregar o cardio.')}finally{setLoading(false)}},[api,date]);
  useFocusEffect(useCallback(()=>{void load()},[load]));
  const totals=useMemo(()=>sessions.reduce((sum,item)=>({calories:sum.calories+item.calories,minutes:sum.minutes+(item.durationMinutes??0)}),{calories:0,minutes:0}),[sessions]);
  const remove=async(item:CardioSession)=>{if(!(await confirmAction({title:'Excluir este cardio?',message:'O registro será removido do seu histórico e do balanço do dia.',confirmLabel:'Excluir cardio',destructive:true})))return;try{await api.deleteCardioSession(item.id);showToast('Cardio excluído.');onChanged?.();await load()}catch{showToast('Não foi possível excluir o cardio. Confira a conexão e tente novamente.','error')}};

  if(compact)return <>
    <View style={s.compactCardio}>
      <View style={s.compactIcon}><MaterialCommunityIcons name="heart-pulse" size={21} color={c.accent}/></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Gerenciar cardio" onPress={()=>router.push({pathname:'/workouts',params:{section:'cardio'}})} style={s.flex}>
        <Text style={s.compactTitle}>Cardio hoje</Text>
        <Text style={s.compactMeta}>{loading?'Atualizando…':error?'Não foi possível carregar':sessions.length?`${totals.minutes} min · ${totals.calories} kcal · ${sessions.length} ${sessions.length===1?'registro':'registros'}`:'Nenhum registro · toque para gerenciar'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Entender estimativas de cardio" hitSlop={6} onPress={()=>setInfoOpen(true)} style={s.compactInfo}><MaterialCommunityIcons name="information-outline" size={18} color={c.heroMuted}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Adicionar cardio" hitSlop={4} onPress={()=>setFormOpen(true)} style={s.compactAdd}><MaterialCommunityIcons name="plus" size={20} color={c.primaryStrong}/></Pressable>
    </View>
    {formOpen?<CardioForm date={date} latestWeight={weight} onClose={()=>setFormOpen(false)} onSaved={async created=>{onChanged?.();setFormOpen(false);showToast('Cardio registrado.');setShareActivity({eventType:'cardio_completed',sourceType:'cardio_session',sourceId:created.id});await load()}}/>:null}
    {infoOpen?<InformationModal title="Como estimamos o gasto" paragraphs={infoParagraphs} details={infoDetails} onClose={()=>setInfoOpen(false)}/>:null}
    <ShareActivityModal activity={shareActivity} onClose={()=>setShareActivity(null)}/>
  </>;

  return <View style={s.section}>
    <View style={s.heading}><View style={s.flex}><Text style={s.title}>{title}</Text><Text style={s.subtitle}>Tempo, intensidade e gasto estimado</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Entender estimativas de cardio" onPress={()=>setInfoOpen(true)} style={s.info}><MaterialCommunityIcons name="information-outline" size={20} color={c.link}/></Pressable></View>
    <View style={[s.card,CardShadow]}>
      <View style={s.summary}>
        <View style={s.summaryIcon}><MaterialCommunityIcons name="heart-pulse" size={25} color={c.link}/></View>
        <View style={s.summaryMetric}><Text style={s.summaryValue}>{totals.minutes}</Text><Text style={s.summaryLabel}>minutos</Text></View>
        <View style={s.summaryDivider}/>
        <View style={s.summaryMetric}><Text style={s.summaryValue}>{totals.calories}</Text><Text style={s.summaryLabel}>kcal</Text></View>
        <Pressable accessibilityRole="button" onPress={()=>setFormOpen(true)} style={s.add}><MaterialCommunityIcons name="plus" size={21} color={c.onPrimary}/><Text style={s.addText}>Adicionar</Text></Pressable>
      </View>
      {error?<View accessibilityRole="alert" style={s.errorBox}><Text style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>void load()} style={s.retry}><Text style={s.link}>Tentar novamente</Text></Pressable></View>:null}
      {loading?<ActivityIndicator color={c.link} style={s.loading}/>:sessions.length?<View style={s.list}>{sessions.map((item,index)=><View key={item.id} style={[s.row,index>0&&s.rowBorder]}>
        <View style={s.rowIcon}><MaterialCommunityIcons name={item.mode==='manual'?'watch-variant':'run-fast'} size={20} color={c.link}/></View>
        <View style={s.flex}><Text style={s.rowTitle}>{item.mode==='manual'?'Valor informado':activityLabel(item.activity)}{item.intensity?` · ${intensityLabel(item.intensity)}`:''}</Text><Text style={s.rowMeta}>{[item.durationMinutes&&`${item.durationMinutes} min`,item.mode==='manual'&&item.source].filter(Boolean).join(' · ')}</Text></View>
        <View style={s.rowCalories}><Text style={s.kcal}>{item.calories}</Text><Text style={s.kcalUnit}>kcal</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Excluir cardio: ${item.mode==='manual'?'valor informado':activityLabel(item.activity)}, ${item.calories} kcal`} onPress={()=>void remove(item)} style={s.iconButton}><MaterialCommunityIcons name="trash-can-outline" size={20} color={c.textMuted}/></Pressable>
      </View>)}</View>:<View style={s.empty}><Text style={s.emptyTitle}>Nenhum cardio registrado</Text><Text style={s.emptyText}>Adicione uma sessão para estimar o gasto ou informar o valor de outro dispositivo.</Text></View>}
      <View style={s.notice}><MaterialCommunityIcons name="calculator-variant-outline" size={17} color={c.warning}/><Text style={s.noticeText}>Calorias estimadas são médias. Relógios e equipamentos também podem variar.</Text></View>
    </View>
    {formOpen?<CardioForm date={date} latestWeight={weight} onClose={()=>setFormOpen(false)} onSaved={async created=>{onChanged?.();setFormOpen(false);showToast('Cardio registrado.');setShareActivity({eventType:'cardio_completed',sourceType:'cardio_session',sourceId:created.id});await load()}}/>:null}
    {infoOpen?<InformationModal title="Como funciona o cardio" paragraphs={infoParagraphs} details={infoDetails} onClose={()=>setInfoOpen(false)}/>:null}
    <ShareActivityModal activity={shareActivity} onClose={()=>setShareActivity(null)}/>
  </View>;
}

function CardioForm({date,latestWeight,onClose,onSaved}:{date:string;latestWeight:number|null;onClose():void;onSaved(created:CardioSession):Promise<void>}) {
  const{colors:c}=useAppTheme();const s=formStyles(c);const{api}=useAuth();
  const[mode,setMode]=useState<'estimated'|'manual'>('estimated');const[activity,setActivity]=useState<CardioActivity>('walking');const[intensity,setIntensity]=useState<CardioIntensity>('moderate');
  // Manual values: the API treats calories with a duration as the session total (rest is discounted) and without one as active calories.
  const[caloriesKind,setCaloriesKind]=useState<'total'|'active'>('total');
  const[duration,setDuration]=useState('30');const[weight,setWeight]=useState(formatWeightValue(latestWeight));const[calories,setCalories]=useState('');const[source,setSource]=useState('');
  const[saving,setSaving]=useState(false);const[error,setError]=useState('');
  const submit=async()=>{setError('');const durationNumber=Number(duration);let input:CardioSessionInput;if(mode==='estimated'){const weightNumber=Number(weight.replace(',','.'));if(!durationNumber||!weightNumber){setError(!durationNumber?'Informe a duração em minutos para calcular.':'Informe seu peso em kg para calcular.');return}input={date,mode,activity,intensity,durationMinutes:durationNumber,weightKg:weightNumber}}else{const caloriesNumber=Number(calories);if(!caloriesNumber){setError('Informe as calorias da sessão.');return}if(source.trim().length<2){setError('Informe a fonte do valor, por exemplo o nome do relógio ou aplicativo.');return}if(caloriesKind==='total'&&!durationNumber){setError('Para calorias totais, informe a duração: ela é usada para descontar o gasto em repouso.');return}input={date,mode,calories:caloriesNumber,durationMinutes:caloriesKind==='total'?durationNumber:null,source:source.trim()}}setSaving(true);try{const created=await api.createCardioSession(input);await onSaved(created)}catch(value){setError(value instanceof Error&&value.message?value.message:'Não foi possível salvar o cardio. Confira a conexão e tente novamente.')}finally{setSaving(false)}};
  return <Modal transparent visible animationType="slide" onRequestClose={()=>{if(!saving)onClose()}}><View style={s.overlay}><SafeAreaView style={s.sheet} edges={['bottom']}><View style={s.header}><View><Text accessibilityRole="header" style={s.title}>Adicionar cardio</Text><Text style={s.subtitle}>Registro de {formatRelativeDay(date).toLocaleLowerCase('pt-BR')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar" disabled={saving} onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={21} color={c.textMuted}/></Pressable></View><ScrollView keyboardLayout="layout" keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View accessibilityRole="radiogroup" style={s.tabs}><Pressable accessibilityRole="radio" aria-checked={mode==='estimated'} onPress={()=>setMode('estimated')} style={[s.tab,mode==='estimated'&&s.tabActive]}><MaterialCommunityIcons name="calculator-variant-outline" size={18} color={mode==='estimated'?c.onPrimary:c.link}/><Text style={[s.tabText,mode==='estimated'&&s.tabTextActive]}>Calcular estimativa</Text></Pressable><Pressable accessibilityRole="radio" aria-checked={mode==='manual'} onPress={()=>setMode('manual')} style={[s.tab,mode==='manual'&&s.tabActive]}><MaterialCommunityIcons name="watch-variant" size={18} color={mode==='manual'?c.onPrimary:c.link}/><Text style={[s.tabText,mode==='manual'&&s.tabTextActive]}>Informar calorias</Text></Pressable></View>
    {mode==='estimated'?<>
      {!latestWeight?<View style={s.warning}><MaterialCommunityIcons name="alert-circle-outline" size={19} color={c.warning}/><View style={s.flex}><Text style={s.warningTitle}>Peso não encontrado</Text><Text style={s.warningText}>Informe seu peso abaixo. Se registrá-lo em Corpo e medidas, ele será preenchido automaticamente nas próximas vezes.</Text><Pressable accessibilityRole="button" onPress={()=>{onClose();router.push('/body-measurements')}} style={s.inlineLink}><Text style={s.link}>Ir para Corpo e medidas</Text></Pressable></View></View>:null}
      <FieldLabel text="Tipo de cardio"/><View accessibilityRole="radiogroup" style={s.activities}>{activities.map(item=><Pressable accessibilityRole="radio" aria-checked={activity===item.value} key={item.value} onPress={()=>setActivity(item.value)} style={[s.activity,activity===item.value&&s.activityActive]}><MaterialCommunityIcons name={item.icon} size={21} color={activity===item.value?c.link:c.textMuted}/><Text style={[s.activityText,activity===item.value&&s.activityTextActive]}>{item.label}</Text></Pressable>)}</View>
      <FieldLabel text="Intensidade"/><View accessibilityRole="radiogroup" style={s.intensities}>{intensities.map(item=><Pressable accessibilityRole="radio" aria-checked={intensity===item.value} key={item.value} onPress={()=>setIntensity(item.value)} style={[s.intensity,intensity===item.value&&s.intensityActive]}><Text style={[s.intensityText,intensity===item.value&&s.intensityTextActive]}>{item.label}</Text><Text style={s.intensityHint}>{item.hint}</Text></Pressable>)}</View>
      <View style={s.twoColumns}><View style={s.flex}><FieldLabel text="Duração (min)"/><TextInput accessibilityLabel="Duração em minutos" value={duration} onChangeText={value=>setDuration(formatIntegerInput(value,3))} keyboardType="number-pad" placeholder="Ex.: 30" placeholderTextColor={c.textMuted} style={s.input}/></View><View style={s.flex}><FieldLabel text="Peso (kg)"/><TextInput accessibilityLabel="Peso em kg" value={weight} onChangeText={value=>setWeight(formatWeightInput(value))} keyboardType="decimal-pad" placeholder="Ex.: 81,20" placeholderTextColor={c.textMuted} style={s.input}/></View></View>
      <View style={s.explainer}><MaterialCommunityIcons name="information-outline" size={18} color={c.link}/><Text style={s.explainerText}>Escolha a intensidade pelo esforço que você sentiu. O resultado é uma média calculada com atividade, intensidade, peso e duração.</Text></View>
    </>:<>
      <FieldLabel text="Calorias gastas"/><TextInput accessibilityLabel="Calorias gastas em kcal" value={calories} onChangeText={value=>setCalories(formatIntegerInput(value,5))} keyboardType="number-pad" placeholder="Ex.: 320 kcal" placeholderTextColor={c.textMuted} style={s.input}/>
      <FieldLabel text="O valor informado é"/><View accessibilityRole="radiogroup" style={s.intensities}>{([['total','Calorias totais (inclui repouso)','Como a maioria dos relógios mostra o “total”. Informe a duração para descontarmos o repouso.'],['active','Calorias ativas','Só o gasto além do repouso. Entra inteiro no balanço do dia.']] as const).map(([value,label,hint])=><Pressable key={value} accessibilityRole="radio" aria-checked={caloriesKind===value} onPress={()=>setCaloriesKind(value)} style={[s.intensity,caloriesKind===value&&s.intensityActive]}><Text style={[s.intensityText,caloriesKind===value&&s.intensityTextActive]}>{label}</Text><Text style={s.intensityHint}>{hint}</Text></Pressable>)}</View>
      {caloriesKind==='total'?<><FieldLabel text="Duração (min)"/><TextInput accessibilityLabel="Duração em minutos" value={duration} onChangeText={value=>setDuration(formatIntegerInput(value,3))} keyboardType="number-pad" placeholder="Ex.: 45" placeholderTextColor={c.textMuted} style={s.input}/></>:<Text style={s.explainerText}>Para calorias ativas, a duração não é registrada.</Text>}
      <FieldLabel text="Fonte"/><TextInput accessibilityLabel="Fonte do valor" value={source} onChangeText={setSource} maxLength={120} placeholder="Ex.: Apple Watch, Garmin ou esteira" placeholderTextColor={c.textMuted} style={s.input}/>
      <View style={s.explainer}><MaterialCommunityIcons name="watch-variant" size={18} color={c.link}/><Text style={s.explainerText}>Não registre a mesma sessão de novo, nem também como estimativa.</Text></View>
    </>}
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={()=>void submit()} style={[s.submit,saving&&s.disabled]}>{saving?<ActivityIndicator color={c.onPrimary}/>:<><Text style={s.submitText}>{mode==='estimated'?'Salvar e calcular':'Salvar valor informado'}</Text><MaterialCommunityIcons name="check" size={20} color={c.onPrimary}/></>}</Pressable>
  </ScrollView></SafeAreaView></View></Modal>;
}

function FieldLabel({text}:{text:string}){const{colors:c}=useAppTheme();return <Text style={{fontSize:12,fontWeight:'800',color:c.text}}>{text}</Text>}

const styles=(c:AppPalette)=>StyleSheet.create({section:{gap:10},heading:{flexDirection:'row',alignItems:'center',gap:10},flex:{flex:1,minWidth:0},title:{fontSize:20,fontWeight: '800',letterSpacing:-.4,color:c.text},subtitle:{fontSize: 12,color:c.textMuted,marginTop:2},info:{width:44,height:44,borderRadius: 16,backgroundColor:c.surfaceSoft,alignItems:'center',justifyContent:'center'},card:{backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius: 24,overflow:'hidden'},summary:{padding:15,flexDirection:'row',alignItems:'center',gap:10},summaryIcon:{width:43,height:43,borderRadius: 16,backgroundColor:c.primarySoft,alignItems:'center',justifyContent:'center'},summaryMetric:{alignItems:'flex-start'},summaryValue:{fontSize:21,fontWeight: '800',color:c.text},summaryLabel:{fontSize: 12,fontWeight:'700',color:c.textMuted},summaryDivider:{height:30,width:1,backgroundColor:c.border},add:{marginLeft:'auto',minHeight:44,backgroundColor:c.primary,borderRadius: 16,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:4},addText:{fontSize: 12,fontWeight: '800',color:c.onPrimary},loading:{paddingVertical:18},list:{borderTopWidth:1,borderTopColor:c.border,paddingHorizontal:15},row:{minHeight:67,flexDirection:'row',alignItems:'center',gap:10},rowBorder:{borderTopWidth:1,borderTopColor:c.border},rowIcon:{width:36,height:36,borderRadius:12,backgroundColor:c.surfaceSoft,alignItems:'center',justifyContent:'center'},rowTitle:{fontSize:13,fontWeight:'800',color:c.text},rowMeta:{fontSize: 12,color:c.textMuted,marginTop:2},rowCalories:{alignItems:'flex-end'},iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center',marginRight:-10},kcal:{fontSize:16,fontWeight: '800',color:c.text},kcalUnit:{fontSize: 12,color:c.textMuted},empty:{borderTopWidth:1,borderTopColor:c.border,padding:17,alignItems:'center'},emptyTitle:{fontSize:13,fontWeight:'800',color:c.text},emptyText:{fontSize: 12,lineHeight:16,textAlign:'center',color:c.textMuted,marginTop:4},notice:{flexDirection:'row',alignItems:'flex-start',gap:7,backgroundColor:c.warningSoft,paddingHorizontal:15,paddingVertical:11},noticeText:{flex:1,fontSize: 12,lineHeight:15,color:c.warning},errorBox:{marginHorizontal:15,marginBottom:10,paddingHorizontal:10,borderRadius: 12,backgroundColor:c.dangerSoft,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},error:{color:c.danger,fontSize: 12,flex:1},retry:{minHeight:44,justifyContent:'center'},link:{color:c.link,fontSize: 12,fontWeight: '800'},compactCardio:{minHeight:60,flexDirection:'row',alignItems:'center',gap:9,paddingTop:12,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.13)'},compactIcon:{width:36,height:36,borderRadius:12,backgroundColor:'rgba(255,255,255,.09)',alignItems:'center',justifyContent:'center'},compactTitle:{fontSize:12,fontWeight: '800',color:c.onPrimary},compactMeta:{fontSize: 12,color:c.heroMuted,marginTop:2},compactInfo:{width:32,height:32,alignItems:'center',justifyContent:'center'},compactAdd:{width:36,height:36,borderRadius:12,backgroundColor:c.onPrimary,alignItems:'center',justifyContent:'center'}});

const formStyles=(c:AppPalette)=>StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:Scrim},sheet:{maxHeight:'92%',backgroundColor:c.surface,borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:17,borderBottomWidth:1,borderBottomColor:c.border},title:{fontSize:21,fontWeight: '800',color:c.text},subtitle:{fontSize: 12,color:c.textMuted,marginTop:2},close:{width:44,height:44,borderRadius: 16,backgroundColor:c.surfaceSoft,alignItems:'center',justifyContent:'center'},
  content:{padding:20,paddingBottom:34,gap:12},flex:{flex:1,minWidth:0},tabs:{flexDirection:'row',backgroundColor:c.surfaceSoft,borderRadius: 16,padding:4,gap:4},tab:{flex:1,minHeight:48,borderRadius:12,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6,paddingHorizontal:7},tabActive:{backgroundColor:c.primary},tabText:{fontSize: 12,fontWeight:'800',color:c.link,textAlign:'center'},tabTextActive:{color:c.onPrimary},
  warning:{backgroundColor:c.warningSoft,borderRadius: 16,padding:13,flexDirection:'row',alignItems:'flex-start',gap:10},warningTitle:{fontSize:13,fontWeight: '800',color:c.text},warningText:{fontSize: 12,lineHeight:16,color:c.textMuted,marginTop:3},link:{fontSize: 12,fontWeight: '800',color:c.link},inlineLink:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},
  activities:{flexDirection:'row',flexWrap:'wrap',gap:8},activity:{width:'31%',minWidth:92,borderWidth:1,borderColor:c.border,borderRadius: 16,paddingVertical:11,paddingHorizontal:7,alignItems:'center',gap:5,backgroundColor:c.surface},activityActive:{borderColor:c.primary,backgroundColor:c.primarySoft},activityText:{fontSize: 12,fontWeight:'800',color:c.textMuted},activityTextActive:{color:c.link},
  intensities:{gap:7},intensity:{borderWidth:1,borderColor:c.border,borderRadius: 16,paddingHorizontal:13,paddingVertical:10},intensityActive:{borderColor:c.primary,backgroundColor:c.primarySoft},intensityText:{fontSize:12,fontWeight: '800',color:c.text},intensityTextActive:{color:c.link},intensityHint:{fontSize: 12,color:c.textMuted,marginTop:2},
  twoColumns:{flexDirection:'row',gap:10},input:{minHeight:50,borderWidth:1,borderColor:c.border,borderRadius: 16,paddingHorizontal:13,color:c.text,backgroundColor:c.surface,fontSize:14,marginTop:6},explainer:{flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:c.surfaceSoft,borderRadius: 16,padding:12},explainerText:{flex:1,fontSize: 12,lineHeight:16,color:c.textMuted},
  error:{color:c.danger,fontSize:12,fontWeight:'700',backgroundColor:c.dangerSoft,borderRadius:12,padding:11},submit:{minHeight:52,borderRadius: 16,backgroundColor:c.primary,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:4},submitText:{color:c.onPrimary,fontSize:13,fontWeight: '800'},disabled:{opacity:.6},
});
