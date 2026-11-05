import type { DailySummary } from '@fit/contracts';

const calories = (value: number) => Math.round(value).toLocaleString('pt-BR');
const pendingLabels = { checks: 'Há pendências de hoje', 'check-in': 'Check-in do dia pendente', workout: 'Treino planejado pendente' };

export function dailySummaryContent(summary: DailySummary) {
  const { consumedCalories, targetCalories, balance } = summary.nutrition;
  const [year, month, day] = summary.date.split('-');
  const time = new Date(summary.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const food = targetCalories == null
    ? `Alimentação: ${calories(consumedCalories)} kcal registradas`
    : `Alimentação: ${calories(consumedCalories)} / ${calories(targetCalories)} kcal`;
  const energy = balance == null ? 'Balanço indisponível · faltam registros'
    : `Balanço estimado: ${balance < 0 ? '−' : balance > 0 ? '+' : ''}${calories(Math.abs(balance))} kcal · parcial`;
  const labels={medication:'Medicamentos',supplement:'Suplementos',injectable:'Aplicações',mental:'Check-in',workout:'Treino'};
  const categories=(summary.categories??[]).filter(item=>item.total>0 || item.completed>0).map(item=>item.kind==='workout'
    ? `Treinos hoje: ${item.completed} ${item.completed===1?'realizado':'realizados'}${item.completed===0&&item.total>0?' · treino planejado pendente':''}`
    : `${labels[item.kind]}: ${item.completed}/${item.total} · ${item.total-item.completed} ${item.total-item.completed===1?'pendente':'pendentes'}`);
  return {
    title: `${summary.overdueMedications ? '⚠️ ' : ''}Orami · ${summary.checks.completed} de ${summary.checks.total} feitas`,
    body: [`${summary.checks.completed} feitas · ${summary.checks.total-summary.checks.completed} pendentes`,...categories,...(summary.overdueMedications ? [`⚠️ ${summary.overdueMedications} ${summary.overdueMedications === 1 ? 'horário de medicamento passou sem registro' : 'horários de medicamentos passaram sem registro'}`] : []),food, energy, summary.pending ? pendingLabels[summary.pending] : 'Checks do dia concluídos', `${day}/${month}/${year} · atualizado às ${time}`, 'Toque para ver os checks'].join('\n'),
  };
}

export function nextLocalMidnight(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
