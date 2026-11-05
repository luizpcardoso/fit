import { useState } from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';
import { FormInput } from '@/components/form-input';
import { useAppTheme } from '@/theme/theme-provider';
import { useBodyReminders } from './body-reminders-provider';
import { formatTimeInput } from '@/utils/input-format';
import type { BodyReminderKind, BodyReminderSchedule } from '@/utils/body-reminder-plan';
export function BodyReminderSettings() {
  const { prefs, ready } = useBodyReminders();
  return <ReminderControls key={`${ready}:${JSON.stringify(prefs)}`}/>;
}
function ReminderControls() {
  const { prefs, ready, busy, error, save } = useBodyReminders(); const { colors: c } = useAppTheme();
  const [times, setTimes] = useState({ weight: prefs.weight.time, measurements: prefs.measurements.time });
  const [schedules, setSchedules] = useState<Record<BodyReminderKind, BodyReminderSchedule>>({ weight: prefs.weight, measurements: prefs.measurements });
  return <View style={{ gap: 12, padding: 16, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
    <Text accessibilityRole="header" style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>Seus lembretes</Text>
    <Text style={{ color: c.textMuted, fontSize: 12 }}>Opcionais e independentes. Ativar um lembrete não exige registrar todos os dias. Você pode desligar quando quiser.</Text>
    {(['weight', 'measurements'] as BodyReminderKind[]).map(kind => <View key={kind} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: c.text, flex: 1 }}>Lembrar de registrar {kind === 'weight' ? 'peso' : 'medidas'}</Text><Switch accessibilityLabel={`Lembrete de ${kind === 'weight' ? 'peso' : 'medidas'}`} disabled={!ready || busy || Platform.OS === 'web'} value={prefs[kind].enabled} onValueChange={enabled => void save(kind, enabled, times[kind], schedules[kind])}/></View>
      {prefs[kind].enabled ? <><Text style={{ color: c.textMuted }}>Frequência</Text><View accessibilityRole="radiogroup" style={{flexDirection:'row',gap:12}}>{(['daily','weekly'] as const).map(frequency=><Pressable key={frequency} accessibilityRole="radio" accessibilityState={{checked:schedules[kind].frequency===frequency}} disabled={busy} onPress={()=>setSchedules(current=>({...current,[kind]:{...current[kind],frequency}}))} style={{minHeight:44,padding:12,borderRadius:12,backgroundColor:schedules[kind].frequency===frequency?c.primarySoft:c.surface,borderWidth:1,borderColor:c.border}}><Text style={{color:c.link}}>{frequency==='daily'?'Diário':'Semanal'}</Text></Pressable>)}</View>{schedules[kind].frequency==='weekly'?<View accessibilityRole="radiogroup" style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((label,index)=><Pressable key={label} accessibilityRole="radio" accessibilityLabel={`${label}, lembrete de ${kind==='weight'?'peso':'medidas'}`} accessibilityState={{checked:schedules[kind].weekday===index+1}} disabled={busy} onPress={()=>setSchedules(current=>({...current,[kind]:{...current[kind],weekday:index+1}}))} style={{minHeight:44,padding:12,borderWidth:1,borderColor:c.border,borderRadius:12,backgroundColor:schedules[kind].weekday===index+1?c.primarySoft:c.surface}}><Text style={{color:c.link}}>{label}</Text></Pressable>)}</View>:null}<Text style={{ color: c.textMuted }}>Horário</Text><FormInput accessibilityLabel={`Horário do lembrete de ${kind === 'weight' ? 'peso' : 'medidas'}`} value={times[kind]} onChangeText={value => setTimes(current => ({ ...current, [kind]: formatTimeInput(value) }))} keyboardType="number-pad" maxLength={5} editable={!busy} style={{ color: c.text, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 12 }}/><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save(kind, true, times[kind], schedules[kind])} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, fontWeight: '700' }}>Salvar lembrete</Text></Pressable></> : null}
    </View>)}
    {Platform.OS === 'web' ? <Text style={{ color: c.textMuted }}>Lembretes disponíveis no aplicativo instalado.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text> : null}
  </View>;
}
