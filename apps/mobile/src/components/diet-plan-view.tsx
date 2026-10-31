import MaterialCommunityIcons from '@/components/icon';
import { dietOptionName, MAX_DIET_OPTIONS, type DietView } from '@fit/contracts';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-provider';

export function DietPlanTabs({ diets, selected, onSelect }: { diets: DietView[]; selected?: string; onSelect(id: string): void }) {
  const { colors: c } = useAppTheme();
  if (diets.length < 2) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
    {diets.map(diet => <Pressable key={diet.id} accessibilityRole="radio" accessibilityLabel={`${diet.name}, ${diet.status === 'active' ? 'atual' : 'anterior'}`} aria-checked={selected === diet.id} onPress={() => onSelect(diet.id)} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: selected === diet.id ? c.link : c.border, backgroundColor: selected === diet.id ? c.primarySoft : c.surface }}><Text style={{ color: c.text, fontWeight: '700' }}>{diet.name}{diet.status !== 'active' ? ' · Anterior' : ''}</Text></Pressable>)}
  </ScrollView>;
}
export function DietMealRows({ diet, options = {}, onSelect }: { diet: DietView; options?: Record<number, number>; onSelect(mealIndex: number): void }) {
  const { colors: c } = useAppTheme();
  return <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surface }}>
    {diet.meals.map((meal, index) => {
      const option = meal.options[options[index] ?? 0] ?? meal.options[0];
      return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Abrir ${meal.name}${meal.time ? ` às ${meal.time}` : ''}`} onPress={() => onSelect(index)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, minHeight: 72, gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: c.border }}>
        <Text style={{ color: c.link, fontWeight: '800', width: 48, fontSize: 13 }}>{meal.time || '—'}</Text>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{meal.name}</Text><Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 12 }}>{option.items.length} {option.items.length === 1 ? 'alimento' : 'alimentos'}{meal.options.length > 1 ? ` · ${meal.options.length} opções` : ''}</Text></View>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>{Math.round(option.macros.calories)} kcal</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={c.textMuted}/>
      </Pressable>;
    })}
  </View>;
}
export function DietOptionTabs({ meal, selected, onSelect, disabled = false }: { meal: DietView['meals'][number]; selected: number; onSelect(index: number): void; disabled?: boolean }) {
  const { colors: c } = useAppTheme();
  return <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {meal.options.slice(0, MAX_DIET_OPTIONS).map((option, index) => <Pressable key={index} accessibilityRole="radio" accessibilityLabel={dietOptionName(meal.name, index)} aria-checked={selected === index} aria-disabled={disabled} disabled={disabled} onPress={() => onSelect(index)} style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: selected === index ? c.link : c.border, backgroundColor: selected === index ? c.primarySoft : c.surface }}><Text style={{ color: c.text, fontWeight: selected === index ? '800' : '500' }}>{dietOptionName(meal.name, index)}</Text></Pressable>)}
  </View>;
}
export function DietExpiry({ diet }: { diet: DietView }) {
  const { colors: c } = useAppTheme();
  if (!diet.expired) return null;
  return <Text style={{ color: c.warning, fontSize: 12, lineHeight: 18 }}>Validade encerrada. Confirme o planejamento com seu profissional.</Text>;
}
