import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import { type SaveWorkoutRunInput } from '@fit/contracts';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';
import { buildApp } from '../src/app.js';

test('MySQL: sessão recuperável, snapshot, concorrência, isolamento e conclusão idempotente', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const database = `fit_workout_runs_test_${process.pid}_${Date.now()}`;
  const options = { host: process.env.DB_HOST!, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER!, password: process.env.DB_PASS! };
  const admin = await createConnection(options);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = createDatabase({ host: options.host, port: options.port, username: options.user, password: options.password, database });
  try {
    await migrateDatabase(db);
    const workouts = new WorkoutRepository(db);
    const app = await buildApp({ repository: new SequelizeAuthRepository(db), workoutRepository: workouts, jwtSecret: 'workout-run-test-secret-with-more-than-32-characters' });
    try {
      const register = async () => (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Treino' } })).json();
      const [owner, other] = await Promise.all([register(), register()]);
      const headers = { authorization: `Bearer ${owner.accessToken}` }, otherHeaders = { authorization: `Bearer ${other.accessToken}` };
      const id = await workouts.createPlan(owner.user.id, { name: 'Ficha sessão', divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '12', restSeconds: 60 }, { name: 'Remada', sets: 2, reps: '10' }] }] });
      const plan = (await workouts.getPlan(owner.user.id, id))!, division = plan.divisions[0];
      const runId = randomUUID();
      let input: SaveWorkoutRunInput = { planId: plan.id, divisionId: division.id, version: 0, mutationId: randomUUID(), progress: { status: 'running', startedAt: Date.now(), finishedAt: null, performedOn: '2026-11-03', currentIndex: 0, pausedAt: null, pausedMs: 0, restEndsAt: null, restRemainingMs: null, exercises: division.exercises.map(e => ({ id: e.id, completedSets: [], skipped: false })) } };
      const put = (payload: SaveWorkoutRunInput, target = runId) => app.inject({ method: 'PUT', url: `/workout-runs/${target}`, headers, payload });
      assert.equal((await app.inject({ method: 'GET', url: '/workout-runs/active' })).statusCode, 401);
      assert.equal((await app.inject({ method: 'PUT', url: `/workout-runs/${randomUUID()}`, headers: otherHeaders, payload: input })).statusCode, 404);
      const started = await put(input); assert.equal(started.statusCode, 200, started.body); assert.equal(started.json().version, 1);
      assert.equal((await put(input)).json().version, 1, 'repetição da mesma mutação é idempotente');
      assert.equal((await app.inject({ method: 'GET', url: `/workout-runs/${runId}`, headers: otherHeaders })).statusCode, 404);
      assert.equal((await put({ ...input, mutationId: randomUUID() }, randomUUID())).statusCode, 409, 'uma sessão aberta por conta');
      input = { ...input, version: 1, mutationId: randomUUID(), progress: { ...input.progress, currentIndex: 1, exercises: input.progress.exercises.map((e, i) => ({ ...e, completedSets: i === 0 ? [0] : [] })) } };
      const saved = await put(input); assert.equal(saved.statusCode, 200, saved.body);
      const recovered = await app.inject({ method: 'GET', url: '/workout-runs/active', headers });
      assert.equal(recovered.headers['cache-control'], 'no-store');
      assert.equal(recovered.json().progress.currentIndex, 1);
      assert.deepEqual(recovered.json().progress.exercises[0].completedSets, [0]);
      assert.equal((await put({ ...input, mutationId: randomUUID() })).statusCode, 409, 'versão antiga não sobrescreve progresso');
      assert.equal((await put({ ...input, version: 2, mutationId: randomUUID(), progress: { ...input.progress, exercises: input.progress.exercises.map((e, i) => ({ ...e, completedSets: i === 0 ? [19] : [] })) } })).statusCode, 400);
      // Concurrent clients with the same base version: exactly one mutation wins.
      const parallel = await Promise.all([put({ ...input, version: 2, mutationId: randomUUID() }), put({ ...input, version: 2, mutationId: randomUUID() })]);
      assert.deepEqual(parallel.map(r => r.statusCode).sort(), [200, 409]);
      // Session snapshot survives deletion of its source plan.
      await workouts.deletePlan(owner.user.id, plan.id);
      input = { ...input, version: 3, mutationId: randomUUID(), progress: { ...input.progress, status: 'completed', finishedAt: Date.now() } };
      const finished = await put(input); assert.equal(finished.statusCode, 200, finished.body);
      assert.ok(finished.json().historySessionId);
      const retry = await put(input); assert.equal(retry.json().historySessionId, finished.json().historySessionId);
      const history = await workouts.listSessions(owner.user.id); assert.equal(history.length, 1);
      assert.equal(history[0].divisionName, 'Peito');
      assert.equal(history[0].divisionId, null);
      assert.equal(history[0].execution?.completedExercises, 0);
      assert.equal(history[0].execution?.completedSets, 1);
      assert.deepEqual(history[0].completedExerciseIds, [division.exercises[0].id]);
      assert.equal((await workouts.getGoalSummary(owner.user.id, '2026-11-03')).completed, 1);
      assert.equal((await app.inject({ method: 'GET', url: '/workout-runs/active', headers })).json(), null);
      assert.equal((await put({ ...input, version: 4, mutationId: randomUUID() })).statusCode, 409, 'sessão encerrada não pode ser reaberta');
      const secondPlanId = await workouts.createPlan(owner.user.id, { name: 'Segunda ficha', divisions: [{ name: 'Pernas', exercises: [{ name: 'Agachamento', sets: 2, reps: '10' }] }] });
      const secondPlan = (await workouts.getPlan(owner.user.id, secondPlanId))!;
      const next: SaveWorkoutRunInput = { ...input, planId: secondPlan.id, divisionId: secondPlan.divisions[0].id, version: 0, mutationId: randomUUID(), progress: { ...input.progress, startedAt: Date.now(), finishedAt: Date.now(), currentIndex: 0, exercises: secondPlan.divisions[0].exercises.map(e => ({ id: e.id, completedSets: [], skipped: false })) } };
      assert.equal((await put(next, randomUUID())).statusCode, 400, 'nenhuma atividade não pode virar treino completo');
      const discarded = await put({ ...next, mutationId: randomUUID(), progress: { ...next.progress, status: 'discarded' } }, randomUUID());
      assert.equal(discarded.statusCode, 200, discarded.body);
      assert.equal((await workouts.listSessions(owner.user.id)).length, 1, 'descarte não entra no histórico nem na meta');
      const fullInput = { ...next, mutationId: randomUUID(), progress: { ...next.progress, exercises: next.progress.exercises.map(e => ({ ...e, completedSets: [0, 1] })) } };
      const full = await put(fullInput, randomUUID());
      assert.equal(full.statusCode, 200, full.body);
      const finalHistory = await workouts.listSessions(owner.user.id);
      assert.equal(finalHistory.length, 2);
      assert.equal(finalHistory.find(item => item.id === full.json().historySessionId)?.execution?.completedExercises, 1);
      assert.equal((await workouts.getGoalSummary(owner.user.id, '2026-11-03')).completed, 2, 'vários treinos no mesmo dia continuam permitidos');

    } finally { await app.close(); }
  } finally {
    await db.close();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
});
