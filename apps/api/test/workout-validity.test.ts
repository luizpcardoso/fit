import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkoutPlanSchema, renewWorkoutPlanSchema } from '@fit/contracts';
import { planValidity, validityDeadline } from '../src/workout-validity.js';

test('validade trata ausência de prazo, virada de mês e instante de vencimento', () => {
  const now = new Date('2026-01-31T15:00:00Z');
  assert.equal(validityDeadline(null, now), null);
  assert.equal(validityDeadline(undefined, now), null);
  assert.equal(validityDeadline(30, now)?.toISOString(), '2026-03-02T15:00:00.000Z');
  assert.equal(validityDeadline(60, now)?.toISOString(), '2026-04-01T15:00:00.000Z');
  assert.deepEqual(planValidity(null, now), { validUntil: null, isExpired: false });
  assert.equal(planValidity('2026-01-31T15:00:00Z', now).isExpired, true);
  assert.equal(planValidity('2026-01-31T15:00:01Z', now).isExpired, false);
  assert.equal(now.toISOString(), '2026-01-31T15:00:00.000Z');
});

test('contratos rejeitam prazos inválidos e mantêm criação sem prazo compatível', () => {
  for (const days of [0, -1, 366, 1.5, '30', null]) assert.equal(renewWorkoutPlanSchema.safeParse({ days }).success, false);
  for (const days of [1, 30, 60, 90, 365]) assert.equal(renewWorkoutPlanSchema.safeParse({ days }).success, true);
  const plan = { name: 'Ficha AB', divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '12' }] }] };
  assert.equal(createWorkoutPlanSchema.safeParse(plan).success, true);
  assert.equal(createWorkoutPlanSchema.safeParse({ ...plan, validityDays: null }).success, true);
  assert.equal(createWorkoutPlanSchema.safeParse({ ...plan, validityDays: -1 }).success, false);
});
