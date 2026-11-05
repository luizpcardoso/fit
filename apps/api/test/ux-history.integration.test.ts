import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import type { SaveWorkoutRunInput } from '@fit/contracts';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';
import { CardioRepository } from '../src/cardio-repository.js';
import { NutritionRepository } from '../src/nutrition-repository.js';
import { buildApp } from '../src/app.js';

test('MySQL: histórico completo paginado, cardio, pesos para o gráfico e valores anteriores por série', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const database = `fit_ux_history_test_${process.pid}_${Date.now()}`;
  const options = { host: process.env.DB_HOST!, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER!, password: process.env.DB_PASS! };
  const admin = await createConnection(options);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = createDatabase({ host: options.host, port: options.port, username: options.user, password: options.password, database });
  try {
    await migrateDatabase(db);
    const workouts = new WorkoutRepository(db);
    const app = await buildApp({ repository: new SequelizeAuthRepository(db), workoutRepository: workouts, cardioRepository: new CardioRepository(db), nutritionRepository: new NutritionRepository(db), jwtSecret: 'ux-history-test-secret-with-more-than-32-characters' });
    try {
      const register = async () => (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Historico' } })).json();
      const [owner, other] = await Promise.all([register(), register()]);
      const headers = { authorization: `Bearer ${owner.accessToken}` }, otherHeaders = { authorization: `Bearer ${other.accessToken}` };
      const planId = await workouts.createPlan(owner.user.id, { name: 'Ficha histórico', divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '10', load: 60, restSeconds: 60 }] }] });
      const plan = (await workouts.getPlan(owner.user.id, planId))!, division = plan.divisions[0], exercise = division.exercises[0];
      // 25 sessions: more than the old 10-item cut and more than one page of 20.
      for (let day = 1; day <= 25; day++) await workouts.complete(owner.user.id, { divisionId: division.id, performedOn: `2026-10-${String(day).padStart(2, '0')}` });
      const first = (await app.inject({ method: 'GET', url: '/workout-sessions/page?page=1&pageSize=20', headers })).json();
      const second = (await app.inject({ method: 'GET', url: '/workout-sessions/page?page=2&pageSize=20', headers })).json();
      assert.equal(first.total, 25); assert.equal(first.totalPages, 2); assert.equal(first.items.length, 20); assert.equal(second.items.length, 5);
      assert.equal(first.items[0].performedOn, '2026-10-25'); assert.equal(second.items[4].performedOn, '2026-10-01');
      assert.equal(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size, 25, 'páginas não repetem nem pulam');
      assert.equal((await app.inject({ method: 'GET', url: '/workout-sessions/page', headers: otherHeaders })).json().total, 0, 'outra conta não vê o histórico');

      for (const day of ['2026-10-02', '2026-10-09', '2026-10-16']) assert.equal((await app.inject({ method: 'POST', url: '/cardio-sessions', headers, payload: { date: day, mode: 'manual', calories: 200, durationMinutes: 30, source: 'Relógio' } })).statusCode, 201);
      const cardio = (await app.inject({ method: 'GET', url: '/cardio-sessions/page?pageSize=2', headers })).json();
      assert.equal(cardio.total, 3); assert.equal(cardio.items[0].date, '2026-10-16');
      assert.equal((await app.inject({ method: 'GET', url: '/cardio-sessions/page', headers: otherHeaders })).json().total, 0);

      for (const [date, weightKg] of [['2026-09-01', 80], ['2026-10-01', 79.5], ['2026-10-20', 78.8]] as const) await app.inject({ method: 'POST', url: '/body-measurements', headers, payload: { date, weightKg } });
      await app.inject({ method: 'POST', url: '/body-measurements', headers, payload: { date: '2026-10-21', waistCm: 84 } });
      const weights = (await app.inject({ method: 'GET', url: '/body-measurements/weights?from=2026-10-01', headers })).json();
      assert.deepEqual(weights, [{ date: '2026-10-01', weightKg: 79.5 }, { date: '2026-10-20', weightKg: 78.8 }], 'só pesos do período, do mais antigo ao mais recente');
      assert.deepEqual((await app.inject({ method: 'GET', url: '/body-measurements/weights?from=2026-01-01', headers: otherHeaders })).json(), []);
      assert.equal((await app.inject({ method: 'GET', url: '/body-measurements/weights?from=ontem', headers })).statusCode, 400);

      const runId = randomUUID(), startedAt = Date.now() - 60_000;
      const base: SaveWorkoutRunInput = { planId, divisionId: division.id, version: 0, mutationId: randomUUID(), progress: { status: 'running', startedAt, finishedAt: null, performedOn: '2026-11-03', currentIndex: 0, pausedAt: null, pausedMs: 0, restEndsAt: null, restRemainingMs: null, exercises: [{ id: exercise.id, completedSets: [], skipped: false }] } };
      assert.equal((await app.inject({ method: 'PUT', url: `/workout-runs/${runId}`, headers, payload: base })).statusCode, 200);
      const invalid = { ...base, version: 1, mutationId: randomUUID(), progress: { ...base.progress, exercises: [{ id: exercise.id, completedSets: [0], skipped: false, performed: [{ set: 5, loadKg: 60, reps: 10 }] }] } };
      assert.equal((await app.inject({ method: 'PUT', url: `/workout-runs/${runId}`, headers, payload: invalid })).statusCode, 400, 'valor de série fora da prescrição');
      const finished = { ...base, version: 1, mutationId: randomUUID(), progress: { ...base.progress, status: 'completed' as const, finishedAt: Date.now(), exercises: [{ id: exercise.id, completedSets: [0, 1], skipped: false, performed: [{ set: 0, loadKg: 62.5, reps: 10 }, { set: 1, loadKg: 62.5, reps: 8 }] }] } };
      const saved = await app.inject({ method: 'PUT', url: `/workout-runs/${runId}`, headers, payload: finished });
      assert.equal(saved.statusCode, 200, saved.body);
      const previous = (await app.inject({ method: 'GET', url: `/workout-runs/previous?divisionId=${division.id}`, headers })).json();
      assert.deepEqual(previous[exercise.id], [{ set: 0, loadKg: 62.5, reps: 10 }, { set: 1, loadKg: 62.5, reps: 8 }]);
      assert.deepEqual((await app.inject({ method: 'GET', url: `/workout-runs/previous?divisionId=${division.id}`, headers: otherHeaders })).json(), {}, 'valores de outra conta não vazam');
    } finally { await app.close(); }
  } finally {
    await db.close();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
});
