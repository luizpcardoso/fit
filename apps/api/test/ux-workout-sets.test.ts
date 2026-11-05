import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { completeWorkoutRunExercise, changeWorkoutRunSeries, toggleWorkoutRunSet, updateWorkoutRunSetValues, workoutRunProgressSchema, workoutRunVolume, type WorkoutRunProgress } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { WorkoutRepository } from '../src/workout-repository.js';
import type { CardioRepository } from '../src/cardio-repository.js';

const progress = (): WorkoutRunProgress => ({ status: 'running', startedAt: 1000, finishedAt: null, performedOn: '2026-11-03', currentIndex: 0, pausedAt: null, pausedMs: 0, restEndsAt: null, restRemainingMs: null, exercises: [{ id: randomUUID(), completedSets: [], skipped: false }] });

test('série marcada guarda carga e repetições, inicia o descanso e pode ser corrigida ou desmarcada', () => {
  const initial = progress(), exercises = [{ id: initial.exercises[0].id, sets: 3, restSeconds: 90 }];
  const second = toggleWorkoutRunSet(initial, exercises, 1, { loadKg: 60, reps: 10 }, 10_000);
  assert.deepEqual(second.exercises[0].completedSets, [1], 'a linha escolhida é marcada, não a primeira livre');
  assert.deepEqual(second.exercises[0].performed, [{ set: 1, loadKg: 60, reps: 10 }]);
  assert.equal(second.restEndsAt, 100_000);
  assert.ok(workoutRunProgressSchema.safeParse(second).success);
  const corrected = updateWorkoutRunSetValues(second, exercises[0].id, 1, { loadKg: 62.5, reps: 8 });
  assert.deepEqual(corrected.exercises[0].performed, [{ set: 1, loadKg: 62.5, reps: 8 }]);
  assert.equal(corrected.restEndsAt, second.restEndsAt, 'corrigir valores não mexe no descanso');
  assert.equal(updateWorkoutRunSetValues(corrected, exercises[0].id, 2, { loadKg: 1, reps: 1 }).exercises[0].performed?.length, 1, 'série não marcada não recebe valores');
  const unchecked = toggleWorkoutRunSet(corrected, exercises, 1, { loadKg: null, reps: null }, 20_000);
  assert.deepEqual(unchecked.exercises[0].completedSets, []);
  assert.deepEqual(unchecked.exercises[0].performed, []);
  const paused = { ...second, status: 'paused' as const, pausedAt: 15_000 };
  assert.equal(toggleWorkoutRunSet(paused, exercises, 0, { loadKg: 60, reps: 10 }, 16_000), paused, 'pausado não registra');
  assert.equal(toggleWorkoutRunSet(initial, exercises, 3, { loadKg: 60, reps: 10 }, 16_000), initial, 'série fora da prescrição é ignorada');
});

test('volume soma kg × reps só das séries concluídas; desfazer pelo contador limpa os valores', () => {
  const initial = progress(), exercises = [{ id: initial.exercises[0].id, sets: 3, restSeconds: 0 }];
  let value = toggleWorkoutRunSet(initial, exercises, 0, { loadKg: 50, reps: 10 }, 1_000);
  value = toggleWorkoutRunSet(value, exercises, 1, { loadKg: 55, reps: null }, 2_000);
  assert.equal(workoutRunVolume(value), 500);
  const undone = changeWorkoutRunSeries(value, exercises, -1, 3_000);
  assert.deepEqual(undone.exercises[0].performed?.map(entry => entry.set), [0]);
  const all = completeWorkoutRunExercise(undone, exercises, set => ({ loadKg: 40, reps: set + 10 }));
  assert.deepEqual(all.exercises[0].performed, [{ set: 0, loadKg: 50, reps: 10 }, { set: 1, loadKg: 40, reps: 11 }, { set: 2, loadKg: 40, reps: 12 }], 'mantém o que já estava registrado');
  assert.equal(workoutRunVolume(all), 500 + 440 + 480);
});

test('progresso antigo sem valores continua válido e os valores rejeitam dados fora do limite', () => {
  assert.ok(workoutRunProgressSchema.safeParse(progress()).success);
  const invalid = progress(); invalid.exercises[0] = { ...invalid.exercises[0], completedSets: [0], performed: [{ set: 0, loadKg: -1, reps: 10 }] };
  assert.equal(workoutRunProgressSchema.safeParse(invalid).success, false);
});

test('históricos paginados exigem sessão e só leem o próprio usuário; erros do cliente não viram 500', async () => {
  const seen: string[] = [];
  const workouts = { sessionsPage: async (userId: string, query: { page: number; pageSize: number }) => { seen.push(`sessions:${userId}:${query.page}:${query.pageSize}`); return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 }; }, runs: { previous: async (userId: string, divisionId: string) => { seen.push(`previous:${userId}:${divisionId}`); return {}; } } } as unknown as WorkoutRepository;
  const cardio = { page: async (userId: string, query: { page: number }) => { seen.push(`cardio:${userId}:${query.page}`); return { items: [], page: query.page, pageSize: 20, total: 0, totalPages: 1 }; } } as unknown as CardioRepository;
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters', workoutRepository: workouts, cardioRepository: cardio });
  for (const url of ['/workout-sessions/page', '/cardio-sessions/page', `/workout-runs/previous?divisionId=${randomUUID()}`]) assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401, url);
  const account = (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'pages@example.com', password: 'senha-forte-123', phone: '71999990000', firstName: 'Teste', lastName: 'Paginas' } })).json();
  const headers = { authorization: `Bearer ${account.accessToken}` };
  assert.equal((await app.inject({ method: 'GET', url: '/workout-sessions/page?page=2&pageSize=20', headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/workout-sessions/page?pageSize=500', headers })).statusCode, 400, 'tamanho de página limitado');
  assert.equal((await app.inject({ method: 'GET', url: '/cardio-sessions/page?page=3', headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/workout-runs/previous?divisionId=x', headers })).statusCode, 400);
  const division = randomUUID();
  assert.equal((await app.inject({ method: 'GET', url: `/workout-runs/previous?divisionId=${division}`, headers })).statusCode, 200);
  assert.deepEqual(seen, [`sessions:${account.user.id}:2:20`, `cardio:${account.user.id}:3`, `previous:${account.user.id}:${division}`], 'identidade vem do token, nunca do cliente');
  const empty = await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' }, payload: '' });
  assert.equal(empty.statusCode, 400, 'corpo JSON vazio é erro do cliente');
  await app.close();
});

test('limite de requisições é por conta autenticada, não pelo IP compartilhado', async () => {
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  const accounts = await Promise.all(['a', 'b'].map(async name => (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `limit-${name}@example.com`, password: 'senha-forte-123', phone: '71999990000', firstName: 'Teste', lastName: `Conta ${name}` } })).json()));
  let last = 0;
  for (let index = 0; index < 121; index++) last = (await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${accounts[0].accessToken}` } })).statusCode;
  assert.equal(last, 429, 'a mesma conta é limitada');
  assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${accounts[1].accessToken}` } })).statusCode, 200, 'outra conta no mesmo IP continua atendida');
  await app.close();
});
