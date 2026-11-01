import type { DailySummary } from '@fit/contracts';

const calories = (value: number) => Math.round(value).toLocaleString('pt-BR');
const pendingLabels = { checks: 'Há checks pendentes', 'check-in': 'Check-in do dia pendente', workout: 'Treino planejado pendente' };

export function dailySummaryContent(summary: DailySummary) {
  const { consumedCalories, targetCalories, balance } = summary.nutrition;
  const [year, month, day] = summary.date.split('-');
  const time = new Date(summary.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const food = targetCalories == null
    ? `Alimentação: ${calories(consumedCalories)} kcal registradas`
    : `Alimentação: ${calories(consumedCalories)} / ${calories(targetCalories)} kcal`;
  const energy = balance == null ? 'Balanço indisponível · faltam registros'
    : `Balanço estimado: ${balance < 0 ? '−' : balance > 0 ? '+' : ''}${calories(Math.abs(balance))} kcal · parcial`;
  return {
    title: `Orami · ${summary.checks.completed} de ${summary.checks.total} checks`,
    body: [food, energy, summary.pending ? pendingLabels[summary.pending] : 'Checks do dia concluídos', `${day}/${month}/${year} · atualizado às ${time}`, 'Toque para ver os checks'].join('\n'),
  };
}

export function nextLocalMidnight(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
