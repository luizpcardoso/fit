import { energyBalanceDetails, energyBalanceInformation, formatEnergyBalance } from '@/utils/nutrition-summary';
import type { DailyNutritionSummary } from '@fit/contracts';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import MaterialCommunityIcons from '@/components/icon';
import { router } from 'expo-router';
import { useAppTheme } from '@/theme/theme-provider';
import { InformationModal } from './information-modal';
import { HomeAccompanimentCard } from './home-accompaniment-card';
import { showToast } from './app-dialog';
import { setHomePreference } from '@/utils/home-preferences';

const missingLabels: Record<string, string> = { birthDate: 'data de nascimento', estimationSex: 'base para estimativas', heightCm: 'altura', weightKg: 'peso' };
const listJoin = (items: string[]) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;

const kcal = (value: number) => `${Math.round(value).toLocaleString('pt-BR')} kcal`;
export function HomeEnergyCard({ summary, loading, error, onRefresh, onDetails }: {
  summary: DailyNutritionSummary | null; loading: boolean; error: string;
  onRefresh(): void; onDetails(): void;
}) {
  const { colors: c } = useAppTheme();
  const [info, setInfo] = useState(false);
  const energy = summary?.energyEstimate;
  const consumed = summary?.consumed?.calories ?? 0;
  const spent = energy?.totalCalories ?? null;
  const noMeals = summary != null && summary.meals.length === 0;
  const balance = noMeals ? null : summary?.balance ?? null;
  return <View style={{ flexGrow: 1 }}>
    <HomeAccompanimentCard topic="balance" title="Balanço calórico" icon="scale-balance" testID="home-energy-card" action={
      <Pressable accessibilityRole="button" accessibilityLabel="Como calculamos o balanço calórico" onPress={() => setInfo(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="information-outline" size={22} color={c.link}/></Pressable>
    }>
      {loading && !summary ? <ActivityIndicator accessibilityLabel="Atualizando balanço calórico" color={c.link}/> : error && !summary ? <View style={{ gap: 8 }}>
        <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={onRefresh} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link }}>Tentar novamente</Text></Pressable>
      </View> : summary ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 85, gap: 5 }}><Text style={{ color: c.textMuted, fontSize: 13 }}>Consumidas</Text><Text style={{ color: c.text, fontSize: 21, fontWeight: '800' }}>{kcal(consumed)}</Text><Text style={{ color: c.textMuted, fontSize: 12 }}>Refeições registradas</Text></View>
          <View style={{ flex: 1, minWidth: 85, gap: 5 }}><Text style={{ color: c.textMuted, fontSize: 13 }}>Gasto {energy?.source === 'recorded' ? 'informado' : 'estimado'}</Text><Text style={{ color: c.text, fontSize: 21, fontWeight: '800' }}>{spent == null ? '—' : kcal(spent)}</Text><Text style={{ color: c.textMuted, fontSize: 12 }}>Para o dia todo</Text></View>
        </View>
        {spent != null ? <View accessibilityLiveRegion="polite" style={{ padding: 16, borderRadius: 16, gap: 5, backgroundColor: c.primarySoft }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Balanço parcial</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.text, fontSize: 32, lineHeight: 40, fontVariant: ['tabular-nums'], fontWeight: '800' }}>{noMeals ? '—' : formatEnergyBalance(balance)}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, minHeight: 36 }}>{noMeals ? 'Registre ao menos uma refeição para começar a calcular seu balanço calórico.' : balance == null ? (spent == null ? 'Complete os dados para calcular o gasto.' : 'Adicione uma refeição para ver o balanço.') : balance < 0 ? 'Consumo registrado abaixo do gasto estimado.' : balance > 0 ? 'Consumo registrado acima do gasto estimado.' : 'Consumo registrado igual ao gasto estimado.'}</Text>
        </View> : null}
        {spent == null ? <View style={{ gap: 4, padding: 12, borderRadius: 16, backgroundColor: c.surfaceSoft }}>
          <Text style={{ color: c.textMuted, lineHeight: 20 }}>{energy?.missing.includes('supportedAge') ? 'A estimativa automática atende idades de 19 a 78 anos. Você pode informar seu gasto diário na aba Nutrição.' : `Para estimar seu gasto, falta informar: ${listJoin((energy?.missing ?? []).map(key => missingLabels[key]).filter(Boolean))}.`}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {energy?.missing.some(key => key !== 'weightKg' && key !== 'supportedAge') ? <Pressable accessibilityRole="button" onPress={() => router.push('/profile-details')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, fontWeight: '700' }}>Completar perfil</Text></Pressable> : null}
            {energy?.missing.includes('weightKg') ? <Pressable accessibilityRole="button" onPress={() => router.push('/body-measurements')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, fontWeight: '700' }}>Registrar peso</Text></Pressable> : null}
          </View>
        </View> : null}
      </> : null}
      {error && summary ? <View style={{gap: 4}}><Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text><Pressable accessibilityRole="button" onPress={onRefresh} style={{minHeight: 44, justifyContent: 'center'}}><Text style={{color: c.link}}>Tentar novamente</Text></Pressable></View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver detalhes do balanço" onPress={onDetails} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, fontWeight: '700' }}>Ver detalhes</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ocultar balanço calórico do Início" hitSlop={6} onPress={() => void setHomePreference('showEnergyBalance', false).then(() => showToast('Balanço oculto do Início. Você pode reativar em Configurações.', 'info')).catch(() => showToast('Não foi possível ocultar agora.', 'error'))} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: c.link, fontSize: 13, fontWeight: '700' }}>Ocultar</Text>
        </Pressable>
      </View>
    </HomeAccompanimentCard>
    {info ? <InformationModal title="Sobre o balanço calórico" paragraphs={energyBalanceInformation} details={energyBalanceDetails} onClose={() => setInfo(false)}/> : null}
  </View>;
}
