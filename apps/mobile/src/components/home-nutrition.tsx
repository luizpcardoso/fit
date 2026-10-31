import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { usePagedData } from '@/hooks/use-paged-data';
import { HomeEnergyCard } from './home-energy-card';
import { MealForm } from './nutrition-forms';

export function HomeNutrition({ date }: { date: string }) {
  const { api } = useAuth(); const { colors: c } = useAppTheme();
  const load = useCallback(() => api.getNutritionSummary(date), [api, date]);
  const summary = usePagedData(`nutrition:${date}`, load);
  const [form, setForm] = useState(false); const [notice, setNotice] = useState('');
  return <View style={{ gap: 8 }}><HomeEnergyCard summary={summary.data} loading={summary.loading} error={summary.error} onRefresh={() => void summary.refresh()} onRegister={() => { setNotice(''); setForm(true); }} onDetails={() => router.push('/food-tracking')} />
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: c.link }}>{notice}</Text> : null}
    {form ? <QuickMealForm date={date} onClose={() => setForm(false)} onSaved={async savedDate => { setForm(false); setNotice(savedDate === date ? 'Refeição registrada.' : 'Refeição registrada na data escolhida.'); await summary.refresh(); }}/> : null}
  </View>;
}
function QuickMealForm({ date, onClose, onSaved }: { date: string; onClose(): void; onSaved(date: string): Promise<void> }) {
  const { api } = useAuth();
  const loadDiets = useCallback(() => api.listDiets(), [api]);
  const diets = usePagedData("meal-diets", loadDiets);
  const loadFoods = useCallback(() => api.listFoods(), [api]);
  const foods = usePagedData('meal-foods', loadFoods);
  return <MealForm date={date} foods={foods.data ?? []} dietState={{loading:diets.loading,available:!!diets.data?.some(diet => diet.status === 'active'),error:diets.error,retry:() => void diets.refresh()}} foodState={{loading:foods.loading,error:foods.error,retry:() => void foods.refresh()}} initial={null} onClose={onClose} onSave={async input => { await api.createMeal(input); await onSaved(input.date); }} onDietSave={async input => { await api.recordDietMeal(input); await onSaved(input.date); }}/>
}
