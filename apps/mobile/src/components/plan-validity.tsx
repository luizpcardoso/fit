import { useAppTheme } from '@/theme/theme-provider';
import type { AppPalette } from '@/constants/theme';
import type { WorkoutPlan } from '@fit/contracts';
import { StyleSheet, Text } from 'react-native';

export function PlanValidity({ plan }: { plan: WorkoutPlan }) {
  const { colors: c } = useAppTheme(); const s = createStyles(c);

  if (!plan.validUntil) return <Text style={s.normal}>Sem prazo de validade</Text>;
  const date = new Date(plan.validUntil).toLocaleDateString('pt-BR');
  return <Text style={plan.isExpired ? s.expired : s.normal}>{plan.isExpired ? `⚑ Treino vencido em ${date} · Pode continuar usando` : `Válido até ${date}`}</Text>;
}
const createStyles = (c: AppPalette) => StyleSheet.create({ normal: { color: c.textMuted, fontSize: 12, lineHeight: 18 }, expired: { color: c.warning, backgroundColor: c.warningSoft, borderRadius: 8, padding: 8, fontSize: 12, lineHeight: 18, fontWeight: '700' } });
