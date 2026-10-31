import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { useAppTheme } from '@/theme/theme-provider';
import type { AppPalette } from '@/constants/theme';
import { supplementInputSchema, suggestSupplementTimes, type HealthItem, type HealthItemInput, type HealthKind } from '@fit/contracts';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatHealthTimeInput, healthUnits } from '@/utils/health';
import { formatDecimalInput, formatDecimalValue } from '@/utils/input-format';

type Props = { kind: HealthKind; initial: HealthItem | null; onClose(): void; onSave(input: HealthItemInput, active: boolean): Promise<void> };

export function HealthItemForm({ kind, initial, onClose, onSave }: Props) {
  const { colors: c, scheme } = useAppTheme(); const s = createStyles(c);

  const medication = kind === 'medication';
  const label = medication ? 'medicamento' : 'suplemento';
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(formatDecimalValue(initial?.amount));
  const [unit, setUnit] = useState<HealthItemInput['unit']>(initial?.unit ?? null);
  const [strength, setStrength] = useState(initial?.strength ?? '');
  const [frequency, setFrequency] = useState(initial?.dailyFrequency ?? 1);
  const [times, setTimes] = useState(() => Array.from({ length: initial?.dailyFrequency ?? 1 }, (_, index) => initial?.times[index] ?? (medication ? '' : suggestSupplementTimes(initial?.dailyFrequency ?? 1)[index])));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  type FieldKey = 'name' | 'amount' | 'strength' | 'times' | 'notes';
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [timeErrors, setTimeErrors] = useState<number[]>([]);
  const clearField = (key: FieldKey) => setFieldErrors(current => (current[key] ? { ...current, [key]: undefined } : current));
  const selectFrequency = (value: number) => {
    setFrequency(value);
    setTimes(medication ? Array.from({ length: value }, (_, index) => times[index] ?? '') : suggestSupplementTimes(value));
    setError(''); setTimeErrors([]); clearField('times');
  };
  const save = async () => {
    if (saving.current) return;
    const input = supplementInputSchema.safeParse({ name, amount: amount.trim() ? Number(amount.replace(',', '.')) : null, unit, strength: strength.trim() || null, dailyFrequency: frequency, times, notes: notes.trim() || null });
    // Field-level messages: the shared schema decides validity, the form explains where to fix it.
    const invalidTimes = times.flatMap((time, index) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? [index] : times.indexOf(time) !== index ? [index] : []);
    if (!input.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of input.error.issues) {
        const key = issue.path[0];
        if (key === 'name') next.name = name.trim() ? 'Use até 100 caracteres.' : `Informe o nome do ${label}.`;
        else if (key === 'amount') next.amount = 'Use um número maior que zero, ou deixe em branco.';
        else if (key === 'strength') next.strength = 'Use até 100 caracteres.';
        else if (key === 'notes') next.notes = 'Use até 500 caracteres.';
        else if (key === 'times') next.times = invalidTimes.some(index => times[index] && times.indexOf(times[index]) !== index) ? 'Cada tomada precisa de um horário diferente.' : 'Informe cada horário no formato HH:MM, por exemplo 07:00.';
      }
      setFieldErrors(next); setTimeErrors(invalidTimes);
      setError(Object.keys(next).length ? 'Revise os campos destacados.' : 'Revise os dados informados.');
      return;
    }
    setFieldErrors({}); setTimeErrors([]);
    saving.current = true; setBusy(true); setError('');
    try { await onSave(input.data, active); }
    catch { setError('Não foi possível salvar. Seus dados continuam aqui; verifique a conexão e tente novamente.'); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text accessibilityRole="header" style={s.title}>{initial ? 'Editar' : 'Novo'} {label}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={onClose} hitSlop={8} style={s.close}><Text style={s.link}>Fechar</Text></Pressable></View>
      <View style={s.flex}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text style={s.section}>O que você toma</Text>
        <Text style={s.label}>Nome</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel={`Nome do ${label}`} editable={!busy} maxLength={100} value={name} onChangeText={value => { setName(value); clearField('name'); }} placeholder={medication ? 'Ex.: Losartana' : 'Ex.: Ômega 3'} style={[s.input, fieldErrors.name && s.inputError]} />{fieldErrors.name ? <Text style={s.fieldError}>{fieldErrors.name}</Text> : null}
        <View style={s.twoColumns}><View style={s.flex}><Text style={s.label}>Quantidade por tomada</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel="Quantidade por tomada" editable={!busy} value={amount} onChangeText={value=>{ setAmount(formatDecimalInput(value,4,2)); clearField('amount'); }} keyboardType="decimal-pad" placeholder="Ex.: 1 ou 2,5" style={[s.input, fieldErrors.amount && s.inputError]} />{fieldErrors.amount ? <Text style={s.fieldError}>{fieldErrors.amount}</Text> : null}</View></View>
        <Text style={s.label}>Unidade · opcional</Text><View style={s.wrap}>{healthUnits.filter(([value]) => !medication || value !== 'scoop').map(([value, text]) => <Pressable key={value} accessibilityRole="radio" aria-checked={unit === value} aria-disabled={busy} disabled={busy} onPress={() => setUnit(unit === value ? null : value)} style={[s.chip, unit === value && s.selected]}><Text style={unit === value ? s.selectedText : s.chipText}>{text}</Text></Pressable>)}</View>
        <Text style={s.label}>Apresentação / concentração · opcional</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel="Apresentação ou concentração" editable={!busy} value={strength} onChangeText={value => { setStrength(value); clearField('strength'); }} maxLength={100} placeholder={medication ? 'Ex.: 500 mg por comprimido' : 'Ex.: 1.000 mg por cápsula'} style={[s.input, fieldErrors.strength && s.inputError]} />{fieldErrors.strength ? <Text style={s.fieldError}>{fieldErrors.strength}</Text> : null}
        <View style={s.divider} /><Text style={s.section}>Rotina diária</Text>
        <Text style={s.label}>Quantas tomadas por dia?</Text><View style={s.frequency}>{[1, 2, 3, 4, 5, 6].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} tomadas por dia`} aria-checked={frequency === value} aria-disabled={busy} disabled={busy} onPress={() => selectFrequency(value)} style={[s.frequencyButton, frequency === value && s.selected]}><Text style={frequency === value ? s.selectedText : s.chipText}>{value}x</Text></Pressable>)}</View>
        <Text style={s.helper}>{medication ? 'Preencha a frequência e os horários que você já utiliza.' : 'Horários sugeridos a partir das 07:00; ajuste à sua rotina.'}</Text>
        <View style={s.timeGrid}>{times.map((time, index) => <View key={index} style={s.timeField}><Text style={s.label}>{index + 1}ª tomada</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel={`Horário da ${index + 1}ª tomada`} editable={!busy} value={time} onChangeText={value => { setTimes(current => current.map((old, position) => position === index ? formatHealthTimeInput(value) : old)); setTimeErrors(current => current.filter(item => item !== index)); }} keyboardType="number-pad" maxLength={5} placeholder="Ex.: 07:00" style={[s.input, s.timeInput, timeErrors.includes(index) && s.inputError]} /></View>)}</View>{fieldErrors.times ? <Text style={s.fieldError}>{fieldErrors.times}</Text> : null}
        <Text style={s.label}>Observações · opcional</Text><TextInput keyboardAppearance={scheme} placeholderTextColor={c.textMuted} accessibilityLabel="Observações" editable={!busy} value={notes} onChangeText={value => { setNotes(value); clearField('notes'); }} maxLength={500} multiline placeholder="Ex.: Tomar depois do café da manhã" style={[s.input, s.notes, fieldErrors.notes && s.inputError]} />{fieldErrors.notes ? <Text style={s.fieldError}>{fieldErrors.notes}</Text> : null}
        {initial ? <View style={s.status}><View style={s.flex}><Text style={s.section}>{active ? 'Cadastro ativo' : 'Cadastro pausado'}</Text><Text style={s.helper}>Pausados não entram nas tomadas do dia.</Text></View><Switch {...(Platform.OS === 'web' ? { activeThumbColor: c.controlThumb } : {})} accessibilityLabel="Cadastro ativo" disabled={busy} value={active} onValueChange={setActive} aria-checked={active} aria-disabled={busy} trackColor={{ false: c.controlTrackOff, true: c.link }} thumbColor={c.controlThumb} ios_backgroundColor={c.controlTrackOff} /></View> : null}
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[s.primary, busy && s.disabled]}>{busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.primaryText}>Salvar {label}</Text>}</Pressable>
      </ScrollView></View>
    </SafeAreaView>
  </Modal>;
}
const createStyles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, flex: { flex: 1 }, header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }, title: { flex: 1, fontSize: 22, fontWeight: '800', color: c.text }, link: { color: c.link, fontWeight: '800' }, close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, inputError: { borderColor: c.danger }, fieldError: { color: c.danger, fontSize: 12, lineHeight: 16 }, content: { padding: 22, paddingBottom: 40, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' }, section: { color: c.text, fontSize: 16, fontWeight: '800' }, label: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 3 }, helper: { color: c.textMuted, fontSize: 12, lineHeight: 18 }, input: { backgroundColor: c.surface, color: c.text, borderWidth: 1, borderColor: c.border, padding: 14, borderRadius: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 44, justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: 11, borderRadius: 12 }, chipText: { color: c.textMuted, fontWeight: '700' }, selected: { backgroundColor: c.primary, borderColor: c.primary }, selectedText: { color: c.onPrimary, fontWeight: '800' }, twoColumns: { flexDirection: 'row', gap: 12 }, divider: { height: 1, backgroundColor: c.border, marginVertical: 6 }, frequency: { flexDirection: 'row', gap: 7 }, frequencyButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }, timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, timeField: { minWidth: 95, width: '30%', gap: 4 }, timeInput: { textAlign: 'center', fontWeight: '700' }, notes: { minHeight: 80, textAlignVertical: 'top' }, primary: { backgroundColor: c.primary, borderRadius: 16, padding: 16, alignItems: 'center' }, primaryText: { color: c.onPrimary, fontWeight: '800', textAlign: 'center' }, disabled: { opacity: 0.6 }, status: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, error: { color: c.danger, lineHeight: 20 },
});
