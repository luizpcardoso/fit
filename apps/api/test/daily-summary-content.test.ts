import assert from 'node:assert/strict';
import test from 'node:test';
import { dailySummarySchema, type DailySummary } from '@fit/contracts';
import { dailySummaryContent, nextLocalMidnight } from '../../mobile/src/utils/daily-summary-content.js';

const summary: DailySummary = {
  date: '2026-10-31', updatedAt: '2026-10-31T15:30:00Z', checks: { completed: 3, total: 6 },
  nutrition: { consumedCalories: 1650, targetCalories: 2100, balance: -650 }, pending: 'checks',
};

test('card distingue meta alimentar de balanço e identifica a atualização', () => {
  const content = dailySummaryContent(summary);
  assert.equal(content.title, 'Orami · 3 de 6 feitas');
  assert.match(content.body, /1\.650 \/ 2\.100 kcal/);
  assert.match(content.body, /Balanço estimado: −650 kcal · parcial/);
  assert.match(content.body, /31\/10\/2026 · atualizado às/);
  assert.match(content.body, /Há pendências de hoje/);
});

test('sem refeições ou meta, card não inventa balanço nem objetivo alimentar', () => {
  const content = dailySummaryContent({ ...summary, nutrition: { consumedCalories: 0, targetCalories: null, balance: null }, pending: null });
  assert.match(content.body, /0 kcal registradas/);
  assert.match(content.body, /Balanço indisponível/);
  assert.match(content.body, /Checks do dia concluídos/);
  assert.equal(content.body.includes('−'), false);
  assert.equal(dailySummarySchema.safeParse({ ...summary, medicationName: 'privado' }).success, false);
});

test('virada usa a meia-noite local e avança mês e ano', () => {
  const now = new Date(2026, 11, 31, 23, 59);
  const midnight = nextLocalMidnight(now);
  assert.equal(midnight.getFullYear(), 2027);
  assert.equal(midnight.getMonth(), 0);
  assert.equal(midnight.getDate(), 1);
  assert.equal(midnight.getHours(), 0);
  assert.ok(midnight.getTime() > now.getTime());
});

test('resumo fixo mostra realizados e faltantes por categoria sem nomes pessoais',()=>{
  const content=dailySummaryContent({...summary,categories:[{kind:'medication',completed:1,total:2},{kind:'workout',completed:0,total:1},{kind:'mental',completed:0,total:0}]});
  assert.match(content.body,/3 feitas · 3 pendentes/);
  assert.match(content.body,/Medicamentos: 1\/2 · 1 pendente/);
  assert.match(content.body,/Treinos hoje: 0 realizados · treino planejado pendente/);
  assert.equal(content.body.includes('Check-in:'),false);
});

test('treino planejado permanece separado do progresso de checks',()=>{
  const content=dailySummaryContent({...summary,checks:{completed:9,total:9},categories:[{kind:'workout',completed:0,total:1}],pending:'workout'});
  assert.equal(content.title,'Orami · 9 de 9 feitas');
  assert.match(content.body,/Treinos hoje: 0 realizados · treino planejado pendente/);
  assert.match(content.body,/Treino planejado pendente/);
});

test('treinos realizados têm contagem própria e não mudam os checks concluídos', () => {
  const content = dailySummaryContent({ ...summary, checks: { completed: 9, total: 9 }, categories: [{ kind: 'workout', completed: 2, total: 2 }], pending: null });
  assert.equal(content.title, 'Orami · 9 de 9 feitas');
  assert.match(content.body, /Treinos hoje: 2 realizados/);
  assert.match(content.body, /Checks do dia concluídos/);
  assert.doesNotMatch(content.body, /−1 pendente|-1 pendente/);
});
