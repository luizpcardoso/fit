import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CreateWorkoutPlanInput, WorkoutPlan } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { WorkoutRepository } from '../src/workout-repository.js';

test('rotas de treino exigem autenticação, validam entrada e isolam proprietários', async () => {
  const plans = new Map<string, { owner: string; plan: WorkoutPlan }>();
  const fake = {
    listCatalog: async () => [{ id: '00000000-0000-4000-8000-000000000001', name: 'Agachamento livre' }],
    listPlans: async (userId: string) => [...plans.values()].filter((item) => item.owner === userId).map((item) => item.plan),
    createPlan: async (userId: string, input: CreateWorkoutPlanInput) => { const id = crypto.randomUUID(); plans.set(id, { owner: userId, plan: { id, name: input.name, isActive: true, status: 'available', validUntil: null, isExpired: false, completedSessions: 0, divisions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }); return id; },
    getPlan: async (userId: string, id: string) => plans.get(id)?.owner === userId ? plans.get(id)!.plan : null,
    activate: async () => true, setArchived: async () => true, complete: async () => crypto.randomUUID(), listSessions: async () => [], updateSession: async () => true,
    getGoalSummary: async (_userId: string, date: string) => ({ configured: false, weeklyTarget: 3, mode: 'flexible' as const, schedule: [], weekStart: date, weekEnd: date, completed: 0, remaining: 3, completedDays: [], sessionsByDate: {}, nextPlanned: null, missedPlanned: [] }), saveGoal: async () => true,
  } as unknown as WorkoutRepository;
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters', workoutRepository: fake });
  const unauthenticated = await app.inject({ method: 'GET', url: '/workout-plans' });
  assert.equal(unauthenticated.statusCode, 401);
  const accounts = await Promise.all(['owner', 'other'].map(async (name) => (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${name}@example.com`, password: 'senha-forte-123', phone: '71999990000', firstName: 'Usuário', lastName: name } })).json()));
  const invalid = await app.inject({ method: 'POST', url: '/workout-plans', headers: { authorization: `Bearer ${accounts[0].accessToken}` }, payload: { name: 'X', divisions: [] } });
  assert.equal(invalid.statusCode, 400);
  const created = await app.inject({ method: 'POST', url: '/workout-plans', headers: { authorization: `Bearer ${accounts[0].accessToken}` }, payload: { name: 'Ficha AB', divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '10' }] }] } });
  assert.equal(created.statusCode, 201);
  const forbidden = await app.inject({ method: 'GET', url: `/workout-plans/${created.json().id}`, headers: { authorization: `Bearer ${accounts[1].accessToken}` } });
  assert.equal(forbidden.statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/workout-goal?date=2026-10-27' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/workout-goal?date=2026-10-27', headers: { authorization: `Bearer ${accounts[0].accessToken}` } })).json().weeklyTarget, 3);
  assert.equal((await app.inject({ method: 'PUT', url: '/workout-goal', headers: { authorization: `Bearer ${accounts[0].accessToken}` }, payload: { weeklyTarget: 2, mode: 'planned', schedule: [{ weekday: 1, divisionId: null }, { weekday: 4, divisionId: null }] } })).statusCode, 204);
  assert.equal((await app.inject({ method: 'PUT', url: '/workout-goal', headers: { authorization: `Bearer ${accounts[0].accessToken}` }, payload: { weeklyTarget: 2, mode: 'planned', schedule: [] } })).statusCode, 400);
  await app.close();
});
