import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';

// Opt-in: uses local MySQL and removes only the two accounts created by this test.
test('MySQL: criação, vencimento sem bloqueio, revalidação e isolamento', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const db = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME!, ssl: process.env.DB_SSL === 'true' });
  const auth = new SequelizeAuthRepository(db);
  const repository = new WorkoutRepository(db);
  const users: string[] = [];
  const app = await buildApp({ repository: auth, workoutRepository: repository, jwtSecret: 'validity-integration-test-secret-32-characters' });
  try {
    const accounts = [];
    for (const label of ['owner', 'other']) {
      const response = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `validity-${label}-${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Validade' } });
      assert.equal(response.statusCode, 201);
      accounts.push(response.json()); users.push(response.json().user.id);
    }
    const headers = { authorization: `Bearer ${accounts[0].accessToken}` };
    const payload = { name: 'Ficha validade teste', validityDays: 30, divisions: [{ name: 'Peito', exercises: [{ name: 'Supino teste', sets: 3, reps: '12' }] }] };
    const before = Date.now();
    const created = await app.inject({ method: 'POST', url: '/workout-plans', headers, payload });
    assert.equal(created.statusCode, 201);
    const id = created.json().id;
    const plan = await repository.getPlan(users[0], id);
    assert.ok(plan); assert.equal(plan.isExpired, false);
    const day = 86400000;
    assert.ok(Math.abs(new Date(plan.validUntil!).getTime() - before - 30 * day) < 5000, `deadline=${plan.validUntil} before=${new Date(before).toISOString()}`);
    const renewUrl = `/workout-plans/${id}/renew`;
    assert.equal((await app.inject({ method: 'POST', url: renewUrl, payload: { days: 60 } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: renewUrl, headers: { authorization: `Bearer ${accounts[1].accessToken}` }, payload: { days: 60 } })).statusCode, 404);
    for (const days of [0, -1, 366, 2.5]) assert.equal((await app.inject({ method: 'POST', url: renewUrl, headers, payload: { days } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: `/workout-plans/${randomUUID()}/renew`, headers, payload: { days: 30 } })).statusCode, 404);
    await db.query('UPDATE workout_plans SET valid_until=? WHERE id=? AND user_id=?', { replacements: [new Date('2020-01-01'), id, users[0]], type: QueryTypes.UPDATE });
    const expired = await app.inject({ method: 'GET', url: `/workout-plans/${id}`, headers });
    assert.equal(expired.json().isExpired, true);
    assert.equal((await app.inject({ method: 'POST', url: `/workout-plans/${id}/activate`, headers })).statusCode, 204);
    assert.equal((await app.inject({ method: 'POST', url: '/workout-sessions', headers, payload: { divisionId: plan.divisions[0].id, performedOn: '2026-10-26', completedExerciseIds: [plan.divisions[0].exercises[0].id] } })).statusCode, 201);
    const renewed = await app.inject({ method: 'POST', url: renewUrl, headers, payload: { days: 60 } });
    assert.equal(renewed.statusCode, 200); assert.equal(renewed.json().id, id); assert.equal(renewed.json().isExpired, false);
    assert.equal(renewed.json().divisions[0].id, plan.divisions[0].id);
    assert.equal(renewed.json().divisions[0].completedSessions, 1);
    assert.deepEqual(renewed.json().divisions[0].exercises, plan.divisions[0].exercises);
    assert.ok(Math.abs(new Date(renewed.json().validUntil).getTime() - Date.now() - 60 * day) < 5000);
    // Revalidating an unexpired plan replaces the date rather than adding to it.
    const again = await app.inject({ method: 'POST', url: renewUrl, headers, payload: { days: 30 } });
    assert.ok(Math.abs(new Date(again.json().validUntil).getTime() - Date.now() - 30 * day) < 5000);
    const persisted = await repository.getPlan(users[0], id);
    assert.ok(Math.abs(new Date(persisted!.validUntil!).getTime() - Date.now() - 30 * day) < 5000);
    assert.equal((await repository.listSessions(users[0])).length, 1);
    const unlimited = await repository.createPlan(users[0], { ...payload, validityDays: null });
    assert.equal((await repository.getPlan(users[0], unlimited))?.validUntil, null);
    assert.equal((await repository.listPlans(users[1])).length, 0);
  } finally {
    for (const id of users) await db.query('DELETE FROM users WHERE id=?', { replacements: [id], type: QueryTypes.DELETE });
    await app.close(); await db.close();
  }
});
