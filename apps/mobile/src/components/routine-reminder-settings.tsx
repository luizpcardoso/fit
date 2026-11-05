import {useState} from 'react';
import {ActivityIndicator,Linking,Platform,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {router} from 'expo-router';
import {FormInput} from './form-input';
import {useRoutineReminders} from './routine-reminder-provider';
import {reminderLabels,validReminderTime,type ReminderPreferences} from '@/utils/routine-reminder-plan';
import {formatTimeInput} from '@/utils/input-format';
import {Radius,Type,type AppPalette} from '@/constants/theme';
import {useAppTheme} from '@/theme/theme-provider';
export function RoutineReminderSettings(){
  const {colors:c}=useAppTheme();const s=styles(c);
  const {ready,busy,preferences:p,error,scheduled,through,limited,save,refresh}=useRoutineReminders();
  const unsupported=Platform.OS==='web';
  const disabled=unsupported||!ready||busy;
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>Lembretes nos horários</Text>
    <View style={s.card}>
      <View style={s.row}><View style={s.copy}><Text style={s.label}>Lembrar das ações da rotina</Text><Text style={s.detail}>Avisos discretos, sem nomes de medicamentos, doses ou anotações.</Text></View><Switch accessibilityLabel="Ativar lembretes da rotina" value={p.enabled} disabled={disabled} onValueChange={enabled=>void save({enabled})} trackColor={{false:c.controlTrackOff,true:c.primary}} thumbColor={c.controlThumb}/></View>
      {unsupported?<Text style={s.detail}>Configure no aplicativo instalado para receber notificações mesmo com o app fechado.</Text>:<>
        {(['medication','supplement','workout','injectable'] as const).map(kind=><View key={kind} style={s.row}><View style={s.copy}><Text style={s.label}>{reminderLabels[kind]}</Text><Text style={s.detail}>{kind==='medication'||kind==='supplement'?'Usa os horários cadastrados em cada item.':'Somente nos dias planejados.'}</Text></View><Switch accessibilityLabel={`Lembretes de ${reminderLabels[kind].toLowerCase()}`} value={p[kind]} disabled={disabled} onValueChange={value=>void save({[kind]:value} as Partial<ReminderPreferences>)} trackColor={{false:c.controlTrackOff,true:c.primary}} thumbColor={c.controlThumb}/></View>)}
        <ReminderTimes key={`${p.workoutTime}:${p.injectableTime}`} preferences={p} disabled={disabled} save={save}/>
        <Text style={s.detail}>A programação cobre até 7 dias e é renovada ao abrir o app ou alterar registros. Ações já concluídas deixam de gerar avisos futuros. O sistema pode ajustar a entrega para economizar bateria.</Text>
        {p.enabled?<><Text accessibilityLiveRegion="polite" style={s.detail}>{through?`${scheduled} avisos programados. Agenda consultada até ${through.split('-').reverse().join('/')}.`:'Preparando a agenda de lembretes.'}{limited?' Os próximos 56 horários foram priorizados; abra o app para renovar a programação.':''}</Text><Pressable accessibilityRole="button" disabled={disabled} onPress={()=>void refresh()} style={s.button}><Text style={s.link}>Atualizar lembretes</Text></Pressable></>:null}
        <Text style={s.detail}>Preferências desta conta neste aparelho. Ao sair da conta, os avisos programados são removidos.</Text>
      </>}
      {busy?<ActivityIndicator accessibilityLabel="Atualizando lembretes" color={c.link}/>:null}
      {error?<><Text accessibilityRole="alert" style={{color:c.danger}}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>void Linking.openSettings()} style={s.button}><Text style={s.link}>Abrir ajustes do aparelho</Text></Pressable></>:null}
      <Pressable accessibilityRole="button" onPress={()=>router.push('/mental-wellbeing')} style={s.button}><Text style={s.link}>Configurar lembrete do check-in na área Mente</Text></Pressable>
    </View>
  </View>;
}
function ReminderTimes({preferences:p,disabled,save}:{preferences:ReminderPreferences;disabled:boolean;save(change:Partial<ReminderPreferences>):Promise<void>}){
  const {colors:c}=useAppTheme();const s=styles(c);
  const [workoutTime,setWorkoutTime]=useState(p.workoutTime),[injectableTime,setInjectableTime]=useState(p.injectableTime);
  const changed=workoutTime!==p.workoutTime||injectableTime!==p.injectableTime;
  return <>
    {p.workout?<View style={s.row}><Text style={[s.label,s.copy]}>Horário do treino</Text><FormInput accessibilityLabel="Horário do lembrete de treino" value={workoutTime} editable={!disabled} onChangeText={value=>setWorkoutTime(formatTimeInput(value))} keyboardType="number-pad" maxLength={5} style={s.input}/></View>:null}
    {p.injectable?<View style={s.row}><Text style={[s.label,s.copy]}>Horário das aplicações</Text><FormInput accessibilityLabel="Horário do lembrete de aplicações" value={injectableTime} editable={!disabled} onChangeText={value=>setInjectableTime(formatTimeInput(value))} keyboardType="number-pad" maxLength={5} style={s.input}/></View>:null}
    {changed?<Pressable accessibilityRole="button" disabled={disabled||!validReminderTime(workoutTime)||!validReminderTime(injectableTime)} onPress={()=>void save({workoutTime,injectableTime})} style={s.button}><Text style={s.link}>Salvar horários</Text></Pressable>:null}
  </>;
}
const styles=(c:AppPalette)=>StyleSheet.create({section:{gap:12},title:{...Type.title,fontWeight:'800',color:c.text},card:{borderRadius:Radius.xl,padding:16,gap:14,backgroundColor:c.surface,borderWidth:1,borderColor:c.border},row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:48},copy:{flex:1,gap:4},label:{...Type.body,fontWeight:'700',color:c.text},detail:{...Type.label,color:c.textMuted,lineHeight:20},input:{width:86,minHeight:44,borderWidth:1,borderColor:c.border,borderRadius:Radius.md,padding:10,color:c.text},button:{minHeight:44,justifyContent:'center'},link:{...Type.label,color:c.link,fontWeight:'700'}});
