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
  assert.equal(content.title, 'Orami · 3 de 6 checks');
  assert.match(content.body, /1\.650 \/ 2\.100 kcal/);
  assert.match(content.body, /Balanço estimado: −650 kcal · parcial/);
  assert.match(content.body, /31\/10\/2026 · atualizado às/);
  assert.match(content.body, /Há checks pendentes/);
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
