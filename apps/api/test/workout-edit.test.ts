import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { updateWorkoutPlanSchema, workoutPlanReadOnlyCode, type UpdateWorkoutPlanInput, type WorkoutPlan } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { WorkoutRepository } from '../src/workout-repository.js';

const plan = (id: string, name: string, origin: 'own' | 'professional'): WorkoutPlan => ({ id, name, origin, isActive: true, status: 'available', validUntil: null, isExpired: false, completedSessions: 0, divisions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
const payload = (name = 'Ficha editada') => ({ name, validityDays: 60, divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 4, reps: '8–10', load: 40, restSeconds: 90 }] }] });

test('PUT /workout-plans/:id exige autenticação, isola proprietário, valida e bloqueia ficha de profissional', async () => {
  const plans = new Map<string, { owner: string; plan: WorkoutPlan }>();
  const received: UpdateWorkoutPlanInput[] = [];
  const fake = {
    updatePlan: async (userId: string, id: string, input: UpdateWorkoutPlanInput) => {
      const item = plans.get(id);
      if (!item || item.owner !== userId) return 'not_found';
      if (item.plan.origin === 'professional') return 'professional';
      received.push(input);
      item.plan = { ...item.plan, name: input.name };
      return item.plan;
    },
  } as unknown as WorkoutRepository;
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters', workoutRepository: fake });
  try {
    const [owner, other] = await Promise.all(['dono', 'outro'].map(async (name) => (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `edit-${name}@example.com`, password: 'senha-forte-123', phone: '71999990000', firstName: 'Usuário', lastName: name } })).json()));
    const own = randomUUID(); const professional = randomUUID();
    plans.set(own, { owner: owner.user.id, plan: plan(own, 'Minha ficha', 'own') });
    plans.set(professional, { owner: owner.user.id, plan: plan(professional, 'Ficha do personal', 'professional') });
    const as = (account: { accessToken: string }) => ({ authorization: `Bearer ${account.accessToken}` });

    assert.equal((await app.inject({ method: 'PUT', url: `/workout-plans/${own}`, payload: payload() })).statusCode, 401);

    const foreign = await app.inject({ method: 'PUT', url: `/workout-plans/${own}`, headers: as(other), payload: payload('Invasão') });
    assert.equal(foreign.statusCode, 404);
    assert.equal(plans.get(own)!.plan.name, 'Minha ficha');

    for (const invalid of [
      { name: 'X', divisions: [] },
      { ...payload(), divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 21, reps: '10' }] }] },
      { ...payload(), requestId: randomUUID() },
      { ...payload(), divisions: [{ id: 'nao-uuid', name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '10' }] }] },
      { ...payload(), validityDays: 400 },
    ]) assert.equal((await app.inject({ method: 'PUT', url: `/workout-plans/${own}`, headers: as(owner), payload: invalid })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PUT', url: '/workout-plans/nao-uuid', headers: as(owner), payload: payload() })).statusCode, 400);

    const readOnly = await app.inject({ method: 'PUT', url: `/workout-plans/${professional}`, headers: as(owner), payload: payload() });
    assert.equal(readOnly.statusCode, 403);
    assert.equal(readOnly.json().code, workoutPlanReadOnlyCode);
    assert.equal(plans.get(professional)!.plan.name, 'Ficha do personal');

    const exerciseId = randomUUID();
    const updated = await app.inject({ method: 'PUT', url: `/workout-plans/${own}`, headers: as(owner), payload: { ...payload('  Ficha renovada  '), divisions: [{ id: randomUUID(), name: 'Peito', exercises: [{ id: exerciseId, name: 'Supino', sets: 3, reps: '12' }] }] } });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().name, 'Ficha renovada');
    assert.equal(received.at(-1)?.divisions[0].exercises[0].id, exerciseId);
  } finally { await app.close(); }
});

test('contrato de edição reaproveita os limites da criação', () => {
  assert.equal(updateWorkoutPlanSchema.safeParse(payload()).success, true);
  assert.equal(updateWorkoutPlanSchema.safeParse({ ...payload(), validityDays: null }).success, true);
  assert.equal(updateWorkoutPlanSchema.safeParse({ ...payload(), divisions: Array.from({ length: 6 }, () => payload().divisions[0]) }).success, false);
  assert.equal(updateWorkoutPlanSchema.safeParse({ ...payload(), divisions: [{ name: 'Peito', exercises: [] }] }).success, false);
  assert.equal(updateWorkoutPlanSchema.safeParse({ ...payload(), divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '10', userId: 'x' }] }] }).success, false);
});
