import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { DailyNutritionSummary } from '@fit/contracts';
import { router } from 'expo-router';
import { useMealSync } from './meal-sync-provider';
import { MealSyncStatus } from './meal-sync-status';
import { useAppTheme } from '@/theme/theme-provider';
import { usePagedData } from '@/hooks/use-paged-data';
import { HomeEnergyCard } from './home-energy-card';
import { MealForm } from './nutrition-forms';
import { HomeAccompaniment } from './home-accompaniment';
import { HomeAccompanimentCard } from './home-accompaniment-card';
import { useHomePreferences } from '@/utils/home-preferences';
import { Type } from '@/constants/theme';
import MaterialCommunityIcons from '@/components/icon';

export function HomeNutrition({ date, workout, refreshSignal = 0 }: { date: string; workout: ReactNode; /** Bumped by Início's pull-to-refresh. */ refreshSignal?: number }) {
  const { api, cachedSummary, refresh } = useMealSync(); const { colors: c } = useAppTheme();
  const load = useCallback(() => api.getNutritionSummary(date), [api, date]);
  const summary = usePagedData(`nutrition:${date}`, load);
  const cached = cachedSummary(date);
  const { showEnergyBalance } = useHomePreferences();
  const [form, setForm] = useState(false); const [notice, setNotice] = useState('');
  const data = cached ?? summary.data;
  const { refresh: refreshSummary } = summary;
  const onRefresh = useCallback(() => { void refresh().then(() => refreshSummary()).catch(() => {}); }, [refresh, refreshSummary]);
  const lastSignal = useRef(refreshSignal);
  useEffect(() => {
    if (lastSignal.current === refreshSignal) return;
    lastSignal.current = refreshSignal;
    onRefresh();
  }, [refreshSignal, onRefresh]);
  const onRegister = () => { setNotice(''); setForm(true); };
  const onDetails = () => router.push('/food-tracking');
  const panels = [
    { id: 'workout', title: 'Treino', content: workout },
    { id: 'food', title: 'Alimentação', content: <HomeFoodCard summary={data} loading={summary.loading && !data} error={summary.error} onRefresh={onRefresh} onRegister={onRegister} onDetails={onDetails}/> },
    ...(showEnergyBalance ? [{ id: 'balance', title: 'Balanço', content: <HomeEnergyCard summary={data} loading={summary.loading && !data} error={summary.error} onRefresh={onRefresh} onDetails={() => router.push('/nutrition')}/> }] : []),
  ];
  return <View style={{ gap: 8 }}><HomeAccompaniment panels={panels}/><MealSyncStatus/>
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: c.link }}>{notice}</Text> : null}
    {form ? <QuickMealForm date={date} onClose={() => setForm(false)} onSaved={async savedDate => { setForm(false); setNotice(savedDate === date ? 'Refeição salva neste aparelho.' : 'Refeição salva neste aparelho na data escolhida.'); await summary.refresh(); }}/> : null}
  </View>;
}

function HomeFoodCard({ summary, loading, error, onRefresh, onRegister, onDetails }: {
  summary: DailyNutritionSummary | null; loading: boolean; error: string;
  onRefresh(): void; onRegister(): void; onDetails(): void;
}) {
  const { colors: c } = useAppTheme();
  const meals = summary?.meals ?? [];
  const latest = [...meals].sort((a, b) => b.time.localeCompare(a.time) || b.createdAt.localeCompare(a.createdAt))[0];
  const consumed = meals.length ? summary?.consumed : null;
  const grams = (value: number) => Math.round(value).toLocaleString('pt-BR');
  return <HomeAccompanimentCard topic="food" title="Alimentação do dia" icon="silverware-fork-knife" testID="home-food-card">
    <View style={{ flexGrow: 1, gap: 12 }}>
      {loading && !summary ? <ActivityIndicator accessibilityLabel="Carregando alimentação" color={c.link}/> : summary ? <>
        {consumed ? <View accessible accessibilityLabel={`${grams(consumed.calories)} quilocalorias consumidas hoje. Proteínas ${grams(consumed.protein)} gramas, carboidratos ${grams(consumed.carbs)} gramas, gorduras ${grams(consumed.fat)} gramas.`} style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{grams(consumed.calories)} <Text style={{ ...Type.body, fontWeight: '500' }}>kcal consumidas</Text></Text>
          <Text style={{ ...Type.label, color: c.textMuted }}>Proteínas {grams(consumed.protein)} g · Carboidratos {grams(consumed.carbs)} g · Gorduras {grams(consumed.fat)} g</Text>
        </View> : null}
        <Text style={consumed ? { ...Type.label, color: c.text, fontWeight: '700' } : { color: c.text, fontSize: 28, fontWeight: '800' }}>{meals.length} <Text style={consumed ? undefined : { ...Type.body, fontWeight: '500' }}>{meals.length === 1 ? 'refeição registrada' : 'refeições registradas'}</Text></Text>
        {latest ? <View style={{ backgroundColor: c.surfaceSoft, padding: 14, borderRadius: 16, gap: 6 }}>
          <Text style={{ ...Type.caption, color: c.textMuted }}>Refeição mais recente · {latest.time.slice(0, 5)}</Text>
          <Text style={{ ...Type.body, color: c.text, fontWeight: '700' }}>{latest.name}</Text>
        </View> : <Text style={{ ...Type.body, color: c.textMuted }}>Ainda sem registros hoje. Adicione sua primeira refeição para acompanhar o dia.</Text>}
        {!meals.length ? <Text style={{ ...Type.caption, color: c.textMuted }}>Registre uma refeição rápida, escolha alimentos ou use sua dieta.</Text> : null}
      </> : null}
      {error ? <View style={{ gap: 4 }}><Text accessibilityRole="alert" style={{ ...Type.caption, color: c.danger }}>{error}</Text><Pressable accessibilityRole="button" onPress={onRefresh} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...Type.label, color: c.link, fontWeight: '700' }}>Tentar novamente</Text></Pressable></View> : null}
    </View>
    <Pressable accessibilityRole="button" onPress={onRegister} style={{ minHeight: 48, borderRadius: 16, padding: 12, backgroundColor: c.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <MaterialCommunityIcons name="plus" size={20} color={c.onPrimary}/><Text style={{ ...Type.label, color: c.onPrimary, fontWeight: '800' }}>Adicionar refeição</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onDetails} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ ...Type.label, color: c.link, fontWeight: '700' }}>Ver alimentação do dia</Text></Pressable>
  </HomeAccompanimentCard>;
}
function QuickMealForm({ date, onClose, onSaved }: { date: string; onClose(): void; onSaved(date: string): Promise<void> }) {
  const { api } = useMealSync();
  const loadDiets = useCallback(() => api.listDiets(), [api]);
  const diets = usePagedData("meal-diets", loadDiets);
  const loadFoods = useCallback(() => api.listFoods(), [api]);
  const foods = usePagedData('meal-foods', loadFoods);
  return <MealForm date={date} foods={foods.data ?? []} dietState={{loading:diets.loading,available:!!diets.data?.some(diet => diet.status === 'active'),error:diets.error,retry:() => void diets.refresh()}} foodState={{loading:foods.loading,error:foods.error,retry:() => void foods.refresh()}} initial={null} onClose={onClose} onSave={async input => { await api.createMeal(input); await onSaved(input.date); }} onDietSave={async input => { await api.recordDietMeal(input); await onSaved(input.date); }}/>
}
