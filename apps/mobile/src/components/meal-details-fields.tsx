import { useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mealCategories, mealCategoryLabel, mealCategoryTime, type MealCategory } from '@fit/contracts';
import { FormInput } from './form-input';
import MaterialCommunityIcons from './icon';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Scrim, Type } from '@/constants/theme';
import { showToast } from './app-dialog';
import { useMealCategoryTimes } from '@/hooks/use-user-preferences';
import { formatTimeInput } from '@/utils/input-format';
import { formatRelativeDay } from '@/utils/dates';
import { mealClock, stepMealTime } from '@/utils/meal-time';
import type { useMealWhen } from '@/hooks/use-meal-when';

/** The category label names the meal until the person writes their own name. */
export function nameForCategory(current: string, previous: MealCategory | null, next: MealCategory | null) {
  const trimmed = current.trim();
  return !trimmed || trimmed === mealCategoryLabel(previous) ? mealCategoryLabel(next) ?? '' : current;
}

export function MealCategoryPicker({ value, disabled, onChange }: { value: MealCategory | null; disabled: boolean; onChange(value: MealCategory | null, suggestedTime: string | null): void }) {
  const { colors: c } = useAppTheme();
  const { timeFor } = useMealCategoryTimes();
  const [customizing, setCustomizing] = useState(false);
  return <View style={s.section}>
    <View style={s.row}><Text style={[s.label, s.flex, { color: c.text }]}>Categoria da refeição</Text><Pressable accessibilityRole="button" accessibilityLabel="Personalizar horários das categorias" disabled={disabled} onPress={() => { Keyboard.dismiss(); setCustomizing(true); }} style={s.smallAction}><Text style={[s.caption, { color: c.link }]}>Personalizar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remover categoria da refeição" disabled={disabled || value === null} onPress={() => onChange(null, null)} style={s.smallAction}><Text style={[s.caption, { color: c.link, opacity: value === null ? .5 : 1 }]}>{value ? 'Remover' : 'Opcional'}</Text></Pressable></View>
    <Text style={[s.caption, { color: c.textMuted }]}>A categoria sugere o nome e o horário; você pode alterar os dois.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Categoria da refeição" style={s.categories}>
      {mealCategories.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.label} aria-checked={value === item.id} disabled={disabled} onPress={() => { Keyboard.dismiss(); onChange(item.id, timeFor(item.id)); }} style={[s.category, { borderColor: value === item.id ? c.primary : c.border, backgroundColor: value === item.id ? c.primarySoft : c.surface }]}><Text style={[s.categoryLabel, { color: c.text }]}>{item.label}</Text><Text style={[s.caption, { color: c.textMuted }]}>{timeFor(item.id)}</Text></Pressable>)}
    </View>
    {customizing ? <MealCategoryTimesSheet onClose={() => setCustomizing(false)}/> : null}
  </View>;
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Edits the account's default time per category; empty fields use the product default. */
function MealCategoryTimesSheet({ onClose }: { onClose(): void }) {
  const { colors: c } = useAppTheme();
  const { custom, save } = useMealCategoryTimes();
  const [times, setTimes] = useState<Partial<Record<MealCategory, string>>>(custom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invalid = mealCategories.filter(item => times[item.id] && !timePattern.test(times[item.id]!));
  const submit = async () => {
    if (busy) return;
    if (invalid.length) { setError(`Use o formato HH:MM em: ${invalid.map(item => item.label).join(', ')}.`); return; }
    const next = Object.fromEntries(mealCategories.flatMap(item => times[item.id] && times[item.id] !== mealCategoryTime(item.id) ? [[item.id, times[item.id]!]] : [])) as Partial<Record<MealCategory, string>>;
    setBusy(true); setError('');
    try { await save(next); showToast('Horários das refeições salvos.'); onClose(); }
    catch { setError('Não foi possível salvar. Verifique a conexão e tente novamente.'); }
    finally { setBusy(false); }
  };
  return <Modal transparent visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={[s.overlay, { backgroundColor: Scrim }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar horários das refeições" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose}/>
      <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.surface }]}>
        <View style={s.row}><Text accessibilityRole="header" style={[s.sheetTitle, s.flex, { color: c.text }]}>Horários das refeições</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar" disabled={busy} onPress={onClose} style={[s.smallAction, { minWidth: 44, alignItems: 'center' }]}><MaterialCommunityIcons name="close" size={22} color={c.textMuted}/></Pressable></View>
        <Text style={[s.caption, { color: c.textMuted }]}>Ajuste ao seu dia a dia. Esses horários são sugeridos ao escolher a categoria, no app e na web.</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
          {mealCategories.map(item => <View key={item.id} style={s.row}>
            <View style={s.flex}><Text style={[s.label, { color: c.text }]}>{item.label}</Text><Text style={[s.caption, { color: c.textMuted }]}>Padrão {mealCategoryTime(item.id)}</Text></View>
            <FormInput accessibilityLabel={`Horário de ${item.label}`} value={times[item.id] ?? ''} editable={!busy} onChangeText={text => { setError(''); setTimes(current => ({ ...current, [item.id]: formatTimeInput(text) })); }} keyboardType="number-pad" maxLength={5} placeholder={mealCategoryTime(item.id) ?? 'HH:MM'} placeholderTextColor={c.textMuted} style={[s.input, s.timeInput, { color: c.text, backgroundColor: c.surface, borderColor: times[item.id] && !timePattern.test(times[item.id]!) ? c.danger : c.fieldBorder }]}/>
          </View>)}
        </ScrollView>
        {error ? <Text accessibilityRole="alert" style={[s.caption, { color: c.danger }]}>{error}</Text> : null}
        <View style={s.row}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setError(''); setTimes({}); }} style={[s.sheetButton, s.flex, { backgroundColor: c.surfaceSoft }]}><Text style={[s.label, { color: c.text }]}>Restaurar padrões</Text></Pressable>
          <Pressable accessibilityRole="button" aria-busy={busy} disabled={busy} onPress={() => void submit()} style={[s.sheetButton, s.flex, { backgroundColor: c.primary }]}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <Text style={[s.label, { color: c.onPrimary }]}>Salvar horários</Text>}</Pressable>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

export function MealWhenFields({ value, category, disabled }: { value: ReturnType<typeof useMealWhen>; category?: MealCategory | null; disabled: boolean }) {
  const { colors: c } = useAppTheme();
  const [editDate, setEditDate] = useState(false);
  const { timeFor } = useMealCategoryTimes();
  const reference = timeFor(category), earlier = stepMealTime(value.customTime, -1), later = stepMealTime(value.customTime, 1);
  return <View style={s.section}>
    <View style={s.row}><Text style={[s.label, s.flex, { color: c.text }]}>Quando você comeu?</Text><Pressable accessibilityRole="button" accessibilityLabel="Alterar data da refeição" disabled={disabled} onPress={() => { Keyboard.dismiss(); setEditDate(current => !current); }} style={s.smallAction}><Text style={[s.caption, { color: c.link }]}>{value.date ? formatRelativeDay(value.date) : 'Conferir data'} · Alterar data</Text></Pressable></View>
    {editDate ? <View style={s.section}><Text style={[s.caption, { color: c.textMuted }]}>Data (DD/MM/AAAA)</Text><FormInput accessibilityLabel="Data da refeição" value={value.dateInput} editable={!disabled} onChangeText={value.setDateInput} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" placeholderTextColor={c.textMuted} style={[s.input, { color: c.text, backgroundColor: c.surface, borderColor: c.fieldBorder }]}/></View> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel="Horário da refeição" style={s.row}>
      <Pressable accessibilityRole="radio" accessibilityLabel="Agora" aria-checked={value.mode === 'now'} aria-disabled={disabled || !value.canUseNow} disabled={disabled || !value.canUseNow} onPress={() => { Keyboard.dismiss(); value.chooseNow(); }} style={[s.timeChoice, { backgroundColor: value.mode === 'now' ? c.primarySoft : c.surface, borderColor: value.mode === 'now' ? c.primary : c.border, opacity: value.canUseNow ? 1 : .5 }]}><Text style={[s.label, { color: c.text }]}>Agora</Text><Text style={[s.caption, { color: c.textMuted }]}>{mealClock(value.now)} · ao salvar</Text></Pressable>
      <Pressable accessibilityRole="radio" accessibilityLabel="Selecionar horário" aria-checked={value.mode === 'custom'} disabled={disabled} onPress={() => { Keyboard.dismiss(); value.chooseCustom(); }} style={[s.timeChoice, { backgroundColor: value.mode === 'custom' ? c.primarySoft : c.surface, borderColor: value.mode === 'custom' ? c.primary : c.border }]}><Text style={[s.label, { color: c.text }]}>Selecionar horário</Text><Text style={[s.caption, { color: c.textMuted }]}>Outro momento</Text></Pressable>
    </View>
    {value.mode === 'now' ? <Text style={[s.caption, { color: c.textMuted }]}>O horário será atualizado no momento de salvar.</Text> : <>
      <View style={s.clockRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Diminuir horário em 30 minutos" disabled={disabled || earlier === null} aria-disabled={disabled || earlier === null} onPress={() => { if (earlier) value.setTime(earlier); }} style={[s.step, { backgroundColor: c.surfaceSoft, opacity: earlier === null ? .4 : 1 }]}><MaterialCommunityIcons name="minus" size={20} color={c.link}/><Text style={[s.caption, { color: c.link }]}>30 min</Text></Pressable>
        <FormInput accessibilityLabel="Horário exato (HH:MM)" value={value.customTime} editable={!disabled} onChangeText={value.setTime} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="HH:MM" selectTextOnFocus style={[s.clock, { color: c.text, width: 104, minHeight: 56, textAlign: 'center', borderBottomWidth: 1, borderColor: c.fieldBorder }]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Aumentar horário em 30 minutos" disabled={disabled || later === null} aria-disabled={disabled || later === null} onPress={() => { if (later) value.setTime(later); }} style={[s.step, { backgroundColor: c.surfaceSoft, opacity: later === null ? .4 : 1 }]}><MaterialCommunityIcons name="plus" size={20} color={c.link}/><Text style={[s.caption, { color: c.link }]}>30 min</Text></Pressable>
      </View>
      {reference && reference !== value.customTime ? <Pressable accessibilityRole="button" accessibilityLabel={`Usar horário sugerido ${reference}`} disabled={disabled} onPress={() => { Keyboard.dismiss(); value.suggest(reference, true); }} style={s.smallAction}><Text style={[s.caption, { color: c.link }]}>Usar {reference} · referência para {mealCategoryLabel(category)?.toLocaleLowerCase('pt-BR')}</Text></Pressable> : null}
      {!value.canUseNow ? <Text style={[s.caption, { color: c.textMuted }]}>Para outra data, selecione o horário em que comeu.</Text> : null}
    </>}
  </View>;
}
const s = StyleSheet.create({
  section: { gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, label: { ...Type.body, fontWeight: '700' }, caption: { ...Type.caption }, smallAction: { minHeight: 44, justifyContent: 'center' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, category: { width: '48%', minHeight: 60, borderWidth: 2, borderRadius: Radius.md, padding: 10, justifyContent: 'center', gap: 2 }, categoryLabel: { ...Type.body, fontWeight: '600' },
  timeChoice: { flex: 1, minHeight: 68, borderRadius: Radius.md, borderWidth: 2, padding: 10, gap: 4, justifyContent: 'center' }, clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, clock: { ...Type.headline, fontWeight: '800', fontVariant: ['tabular-nums'] }, step: { width: 64, minHeight: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 }, input: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, padding: 12, ...Type.body },
  overlay: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '90%', width: '100%', maxWidth: 680, alignSelf: 'center', borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 20, gap: 12 }, sheetTitle: { ...Type.headline, fontWeight: '800' }, timeInput: { width: 96, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: '700' }, sheetButton: { minHeight: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
