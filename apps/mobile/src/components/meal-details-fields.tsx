import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { mealCategories, mealCategoryLabel, mealCategoryTime, type MealCategory } from '@fit/contracts';
import { FormInput } from './form-input';
import MaterialCommunityIcons from './icon';
import { useAppTheme } from '@/theme/theme-provider';
import { Radius, Type } from '@/constants/theme';
import { formatRelativeDay } from '@/utils/dates';
import { mealClock, stepMealTime } from '@/utils/meal-time';
import type { useMealWhen } from '@/hooks/use-meal-when';

export function MealCategoryPicker({ value, disabled, onChange }: { value: MealCategory | null; disabled: boolean; onChange(value: MealCategory | null): void }) {
  const { colors: c } = useAppTheme();
  return <View style={s.section}>
    <View style={s.row}><Text style={[s.label, s.flex, { color: c.text }]}>Categoria da refeição</Text><Pressable accessibilityRole="button" accessibilityLabel="Remover categoria da refeição" disabled={disabled || value === null} onPress={() => onChange(null)} style={s.smallAction}><Text style={[s.caption, { color: c.link, opacity: value === null ? .5 : 1 }]}>{value ? 'Remover' : 'Opcional'}</Text></Pressable></View>
    <Text style={[s.caption, { color: c.textMuted }]}>A categoria é independente do nome. Os horários são sugestões.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Categoria da refeição" style={s.categories}>
      {mealCategories.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.label} aria-checked={value === item.id} disabled={disabled} onPress={() => { Keyboard.dismiss(); onChange(item.id); }} style={[s.category, { borderColor: value === item.id ? c.primary : c.border, backgroundColor: value === item.id ? c.primarySoft : c.surface }]}><Text style={[s.categoryLabel, { color: c.text }]}>{item.label}</Text><Text style={[s.caption, { color: c.textMuted }]}>{mealCategoryTime(item.id)}</Text></Pressable>)}
    </View>
  </View>;
}

export function MealWhenFields({ value, category, disabled }: { value: ReturnType<typeof useMealWhen>; category?: MealCategory | null; disabled: boolean }) {
  const { colors: c } = useAppTheme();
  const [editDate, setEditDate] = useState(false);
  const reference = mealCategoryTime(category), earlier = stepMealTime(value.customTime, -1), later = stepMealTime(value.customTime, 1);
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
});
