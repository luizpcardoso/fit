import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import { createWorkoutPlanSchema, workoutIllustrationIds, type WorkoutPlan } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';

const division = { name: 'Costas', exercises: [{ name: 'Remada', sets: 3, reps: '12' }] };
test('ilustrações de treino aceitam apenas o catálogo, sem URLs ou uploads', () => {
  const payload = (fields: object) => ({ name: 'Ficha visual', divisions: [{ ...division, ...fields }] });
  for (const illustrationId of [...workoutIllustrationIds, null]) assert.equal(createWorkoutPlanSchema.safeParse(payload({ illustrationId })).success, true);
  assert.equal(createWorkoutPlanSchema.safeParse(payload({})).success, true, 'clientes anteriores podem omitir a imagem');
  for (const illustrationId of ['unknown', 'https://example.com/image.png', '../image', '', 42]) assert.equal(createWorkoutPlanSchema.safeParse(payload({ illustrationId })).success, false);
  assert.equal(createWorkoutPlanSchema.safeParse(payload({ imageUrl: 'https://example.com/image.png' })).success, false);
});

test('MySQL: ilustração por treino persiste, isola contas e conserva escolhas de clientes anteriores', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const database = `fit_workout_illustrations_test_${process.pid}_${Date.now()}`;
  const connection = { host: process.env.DB_HOST!, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER!, password: process.env.DB_PASS! };
  const admin = await createConnection(connection);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = createDatabase({ host: connection.host, port: connection.port, username: connection.user, password: connection.password, database });
  try {
    await migrateDatabase(db);
    const repository = new WorkoutRepository(db);
    const app = await buildApp({ repository: new SequelizeAuthRepository(db), workoutRepository: repository, jwtSecret: 'workout-illustrations-test-secret-with-more-than-32-characters' });
    try {
      const register = async () => (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Imagem' } })).json();
      const [owner, other] = await Promise.all([register(), register()]);
      const headers = { authorization: `Bearer ${owner.accessToken}` }, foreign = { authorization: `Bearer ${other.accessToken}` };
      const payload = { name: 'Ficha visual', requestId: randomUUID(), divisions: [{ ...division, illustrationId: 'back' }, { ...division, name: 'Peito', illustrationId: 'chest-shoulders' }] };
      assert.equal((await app.inject({ method: 'POST', url: '/workout-plans', payload })).statusCode, 401);
      assert.equal((await app.inject({ method: 'POST', url: '/workout-plans', headers, payload: { ...payload, divisions: [{ ...division, illustrationId: 'https://example.com/image.png' }] } })).statusCode, 400);
      const created = await app.inject({ method: 'POST', url: '/workout-plans', headers, payload });
      assert.equal(created.statusCode, 201, created.body);
      const id = created.json().id as string, url = `/workout-plans/${id}`;
      assert.equal((await app.inject({ method: 'POST', url: '/workout-plans', headers, payload })).json().id, id, 'repetição não duplica a ficha');
      assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
      assert.equal((await app.inject({ method: 'GET', url, headers: foreign })).statusCode, 404);
      const original = (await app.inject({ method: 'GET', url, headers })).json() as WorkoutPlan;
      assert.deepEqual(original.divisions.map(d => d.illustrationId), ['back', 'chest-shoulders']);
      const input = { name: original.name, divisions: original.divisions.map(d => ({ id: d.id, name: d.name, exercises: d.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps })) })) };
      assert.equal((await app.inject({ method: 'PUT', url, payload: input })).statusCode, 401);
      assert.equal((await app.inject({ method: 'PUT', url, headers: foreign, payload: input })).statusCode, 404);
      assert.equal((await app.inject({ method: 'PUT', url, headers, payload: { ...input, divisions: [{ ...input.divisions[0], illustrationId: 'invalid' }] } })).statusCode, 400);
      const edit = { ...input, divisions: input.divisions.map((d, i) => i === 0 ? { ...d, illustrationId: 'back-shoulders' } : d) };
      const updated = await app.inject({ method: 'PUT', url, headers, payload: edit });
      assert.equal(updated.statusCode, 200, updated.body);
      assert.deepEqual(updated.json().divisions.map((d: { illustrationId: string }) => d.illustrationId), ['back-shoulders', 'chest-shoulders']);
      assert.deepEqual(updated.json().divisions[0].exercises, original.divisions[0].exercises, 'escolher uma imagem não modifica os exercícios');
      const legacy = await app.inject({ method: 'PUT', url, headers, payload: input });
      assert.deepEqual(legacy.json().divisions.map((d: { illustrationId: string }) => d.illustrationId), ['back-shoulders', 'chest-shoulders'], 'omissão preserva as ilustrações');
      const cleared = await app.inject({ method: 'PUT', url, headers, payload: { ...input, divisions: input.divisions.map((d, i) => i === 0 ? { ...d, illustrationId: null } : d) } });
      assert.deepEqual(cleared.json().divisions.map((d: { illustrationId: string | null }) => d.illustrationId), [null, 'chest-shoulders']);
      assert.equal((await repository.listPlans(owner.user.id))[0].divisions[1].illustrationId, 'chest-shoulders');
    } finally { await app.close(); }
  } finally {
    await db.close();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
});
