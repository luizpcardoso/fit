import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import type { DailyNutritionSummary } from '@fit/contracts';
import { nutritionGoalInputSchema } from '@fit/contracts';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { showToast } from '@/components/app-dialog';
import { Scrim } from '@/constants/theme';

const kcal = (value: number) => `${Math.round(value).toLocaleString('pt-BR')} kcal`;
export function DailyNutritionCard({ summary, loading, error, onRefresh, onRegister, onDetails }: { summary: DailyNutritionSummary | null; loading: boolean; error: string; onRefresh(): void; onRegister(): void; onDetails?(): void }) {
  const { colors: c } = useAppTheme();
  const [editing, setEditing] = useState(false);
  const goal = summary?.consumptionGoal;
  return <View style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 24, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Text accessibilityRole="header" style={{ color: c.text, fontSize: 20, fontWeight: '800', flex: 1 }}>Alimentação do dia</Text><Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.link, fontWeight: '700' }}>{goal?.targetCalories ? 'Editar meta' : 'Definir meta'}</Text></Pressable></View>
    {loading ? <ActivityIndicator color={c.link}/> : error ? <View accessibilityRole="alert" style={{ gap: 8 }}><Text style={{ color: c.danger }}>{error}</Text><Pressable accessibilityRole="button" onPress={onRefresh} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: c.link, fontWeight: '700' }}>Tentar novamente</Text></Pressable></View> : summary ? <>
      <Text accessibilityLiveRegion="polite" style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>{kcal(summary.consumed?.calories ?? 0)} <Text style={{ fontSize: 13, fontWeight: '500', color: c.textMuted }}>consumidas</Text></Text>
      {goal?.targetCalories != null ? <>
        <Text style={{ color: c.textMuted }}>Meta diária: {kcal(goal.targetCalories)}</Text>
        <View accessibilityRole="progressbar" accessibilityLabel="Consumo em relação à meta diária" accessibilityValue={{ min: 0, max: 100, now: Math.round((goal.progress ?? 0) * 100) }} style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceSoft, overflow: 'hidden' }}><View style={{ height: '100%', width: `${(goal.progress ?? 0) * 100}%`, backgroundColor: c.link }}/></View>
        <Text style={{ color: c.text, fontWeight: '700' }}>{(goal.remainingCalories ?? 0) < 0 ? `${kcal(Math.abs(goal.remainingCalories!))} acima da meta` : `${kcal(goal.remainingCalories ?? 0)} restantes`}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>Restante = meta de consumo − calorias registradas. Exercícios não alteram esta meta.</Text>
      </> : <Text style={{ color: c.textMuted }}>Sem meta de consumo definida. Você pode continuar registrando suas refeições.</Text>}
      <Text style={{ color: c.textMuted, lineHeight: 20 }}>Proteínas {Math.round(summary.consumed?.protein ?? 0)} g · Carboidratos {Math.round(summary.consumed?.carbs ?? 0)} g · Gorduras {Math.round(summary.consumed?.fat ?? 0)} g</Text>
      {!summary.meals.length ? <Text style={{ color: c.textMuted }}>Nenhuma refeição registrada nesta data.</Text> : null}
    </> : null}
    <Pressable accessibilityRole="button" onPress={onRegister} style={{ minHeight: 48, padding: 12, borderRadius: 16, backgroundColor: c.primaryStrong, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.onPrimary, fontWeight: '800' }}>Registrar refeição</Text></Pressable>
    {onDetails ? <Pressable accessibilityRole="button" onPress={onDetails} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.link, fontWeight: '700' }}>Ver e editar refeições</Text></Pressable> : null}
    {editing ? <NutritionGoalForm initial={goal?.targetCalories ?? null} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onRefresh(); }}/> : null}
  </View>;
}
function NutritionGoalForm({ initial, onClose, onSaved }: { initial: number | null; onClose(): void; onSaved(): void }) {
  const { colors: c, scheme } = useAppTheme(); const { api } = useAuth();
  const [value, setValue] = useState(initial == null ? '' : String(initial)); const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState('');
  const save = async () => {
    if (lock.current) return;
    const parsed = nutritionGoalInputSchema.safeParse({ targetCalories: value.trim() ? Number(value) : null });
    if (!parsed.success) { setError('Informe um valor inteiro positivo de até 30.000 kcal, ou deixe vazio para remover a meta.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { await api.saveNutritionGoal(parsed.data); showToast(parsed.data.targetCalories == null ? 'Meta removida.' : 'Meta salva.'); onSaved(); } catch { setError('Não foi possível salvar a meta. Tente novamente.'); } finally { lock.current = false; setBusy(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!lock.current) onClose(); }}><SafeAreaView style={{ flex: 1, backgroundColor: Scrim, justifyContent: 'center', padding: 20 }}><View style={{maxHeight: '90%'}}><View accessibilityViewIsModal style={{ flexShrink: 1, padding: 20, borderRadius: 20, backgroundColor: c.surface, maxWidth: 480, width: '100%', alignSelf: 'center' }}><ScrollView keyboardLayout="layout" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 21, fontWeight: '800' }}>Meta diária de consumo</Text><Text style={{ color: c.textMuted }}>Informe a meta que você já utiliza. Deixe vazio para remover. O Fit não calcula uma recomendação alimentar.</Text>
    <Text style={{ color: c.text }}>Calorias por dia (kcal)</Text><TextInput accessibilityLabel="Meta diária em kcal" keyboardAppearance={scheme} keyboardType="number-pad" value={value} editable={!busy} onChangeText={setValue} maxLength={5} style={{ borderColor: c.fieldBorder, borderWidth: 1, color: c.text, borderRadius: 12, padding: 14 }} />
    {error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: c.primaryStrong, borderRadius: 12 }}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <Text style={{ color: c.onPrimary, fontWeight: '800' }}>Salvar meta</Text>}</Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.link }}>Cancelar</Text></Pressable>
  </ScrollView></View></View></SafeAreaView></Modal>;
}
