import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormInput } from '@/components/form-input';
import MaterialCommunityIcons from '@/components/icon';
import { WeekdayPicker, formatWeekdays } from '@/components/weekday-picker';
import { Radius, Scrim, type AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { useBodyReminders } from './body-reminders-provider';
import { formatTimeInput } from '@/utils/input-format';
import { validBodyReminderTime, type BodyReminderKind } from '@/utils/body-reminder-plan';

const kinds: { kind: BodyReminderKind; title: string; noun: string; icon: 'scale-bathroom' | 'tape-measure' }[] = [
  { kind: 'weight', title: 'Peso', noun: 'peso', icon: 'scale-bathroom' },
  { kind: 'measurements', title: 'Medidas', noun: 'medidas', icon: 'tape-measure' },
];

/** Compact summary per reminder; days and time are edited in a sheet, as in injectables. */
export function BodyReminderSettings() {
  const { prefs, ready, busy, error, save } = useBodyReminders(); const { colors: c } = useAppTheme(); const s = styles(c);
  const [editing, setEditing] = useState<BodyReminderKind | null>(null);
  const web = Platform.OS === 'web';
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Seus lembretes</Text>
    <Text style={s.muted}>Opcionais e independentes. Ativar um lembrete não exige registrar todos os dias. Você pode desligar quando quiser.</Text>
    {kinds.map(({ kind, title, noun, icon }) => { const pref = prefs[kind]; return <View key={kind} style={s.row}>
      <View style={s.icon}><MaterialCommunityIcons name={icon} size={20} color={c.link}/></View>
      <View style={s.flex}><Text style={s.rowTitle}>{title}</Text><Text style={s.muted}>{pref.enabled ? `${formatWeekdays(pref.weekdays)} · ${pref.time}` : 'Desligado'}</Text></View>
      {pref.enabled ? <Pressable accessibilityRole="button" accessibilityLabel={`Editar lembrete de ${noun}`} disabled={!ready || busy || web} onPress={() => setEditing(kind)} style={s.edit}><Text style={s.link}>Editar</Text></Pressable> : null}
      {/* Turning on opens the sheet first; nothing is scheduled until the person confirms days and time. */}
      <Switch accessibilityLabel={`Lembrete de ${noun}`} aria-checked={pref.enabled} disabled={!ready || busy || web} value={pref.enabled} onValueChange={enabled => { if (enabled) setEditing(kind); else void save(kind, false, pref.time, { weekdays: pref.weekdays }); }} trackColor={{ false: c.controlTrackOff, true: c.link }} thumbColor={c.controlThumb} ios_backgroundColor={c.controlTrackOff}/>
    </View>; })}
    {web ? <Text style={s.muted}>Lembretes disponíveis no aplicativo instalado.</Text> : null}
    {error && !editing ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text> : null}
    {editing ? <ReminderSheet key={editing} kind={editing} onClose={() => setEditing(null)}/> : null}
  </View>;
}

function ReminderSheet({ kind, onClose }: { kind: BodyReminderKind; onClose(): void }) {
  const { prefs, busy, error, save } = useBodyReminders(); const { colors: c } = useAppTheme(); const s = styles(c);
  const meta = kinds.find(item => item.kind === kind)!;
  const [weekdays, setWeekdays] = useState(prefs[kind].weekdays);
  const [time, setTime] = useState(prefs[kind].time);
  const [localError, setLocalError] = useState('');
  const submit = async () => {
    if (!weekdays.length) { setLocalError('Escolha ao menos um dia da semana.'); return; }
    if (!validBodyReminderTime(time)) { setLocalError('Informe um horário válido no formato HH:MM.'); return; }
    setLocalError('');
    if (await save(kind, true, time, { weekdays })) onClose();
  };
  const message = localError || error;
  return <Modal transparent visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={s.overlay}>
      {/* Backdrop is a sibling, not a parent, so sheet controls are never nested buttons. */}
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar lembrete" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose}/>
      <SafeAreaView edges={['bottom']} style={s.sheet}>
        <View style={s.handle}/>
        <View style={s.sheetHeader}>
          <View style={s.icon}><MaterialCommunityIcons name={meta.icon} size={22} color={c.link}/></View>
          <View style={s.flex}><Text accessibilityRole="header" style={s.title}>Lembrete de {meta.noun}</Text><Text style={s.muted}>Escolha os dias e o horário.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" disabled={busy} onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={21} color={c.textMuted}/></Pressable>
        </View>
        <Text style={s.section}>Dias da semana</Text>
        <WeekdayPicker value={weekdays} onChange={days => { setWeekdays(days); setLocalError(''); }} disabled={busy} labelSuffix={`lembrete de ${meta.noun}`} shortcuts/>
        <Text style={s.section}>Horário</Text>
        <FormInput accessibilityLabel={`Horário do lembrete de ${meta.noun}`} value={time} onChangeText={value => { setTime(formatTimeInput(value)); setLocalError(''); }} keyboardType="number-pad" maxLength={5} editable={!busy} placeholder="HH:MM" placeholderTextColor={c.textMuted} style={s.input}/>
        {message ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{message}</Text> : null}
        <Pressable accessibilityRole="button" aria-busy={busy} disabled={busy} onPress={() => void submit()} style={[s.primary, busy && { opacity: .6 }]}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <Text style={s.primaryText}>{prefs[kind].enabled ? 'Salvar lembrete' : 'Ativar lembrete'}</Text>}</Pressable>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = (c: AppPalette) => StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  title: { color: c.text, fontWeight: '800', fontSize: 18 },
  muted: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  rowTitle: { color: c.text, fontWeight: '700', fontSize: 15 },
  edit: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 6 },
  link: { color: c.link, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: c.surface, borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 20, gap: 12 },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  close: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft },
  section: { color: c.text, fontSize: 15, fontWeight: '800' },
  input: { color: c.text, borderColor: c.fieldBorder, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: c.onPrimary, fontWeight: '800' },
});
