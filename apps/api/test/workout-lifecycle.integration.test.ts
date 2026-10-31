import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';

test('MySQL: limite de fichas, ativação única e exclusão preserva sessões', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const db = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME!, ssl: process.env.DB_SSL === 'true' });
  const repository = new WorkoutRepository(db); const auth = new SequelizeAuthRepository(db); const users: string[] = [];
  const app = await buildApp({ repository: auth, workoutRepository: repository, jwtSecret: 'workout-lifecycle-integration-secret-32-characters' });
  try {
    const account = (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `lifecycle-${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Ciclo' } })).json(); users.push(account.user.id);
    const headers = { authorization: `Bearer ${account.accessToken}` }; const payload = (name: string) => ({ name, validityDays: 30, divisions: [{ name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '12' }] }] });
    const created: string[] = [];
    for (const name of ['Ficha 1', 'Ficha 2', 'Ficha 3']) { const response = await app.inject({ method: 'POST', url: '/workout-plans', headers, payload: payload(name) }); assert.equal(response.statusCode, 201); created.push(response.json().id); }
    assert.equal((await app.inject({ method: 'POST', url: '/workout-plans', headers, payload: payload('Ficha 4') })).statusCode, 409);
    assert.equal((await app.inject({ method: 'POST', url: `/workout-plans/${created[1]}/activate`, headers })).statusCode, 204);
    let plans = await repository.listPlans(account.user.id); assert.equal(plans.filter(item => item.isActive).length, 1); assert.equal(plans.find(item => item.id === created[1])?.isActive, true);
    assert.equal((await app.inject({ method: 'POST', url: `/workout-plans/${created[1]}/deactivate`, headers })).statusCode, 204);
    plans = await repository.listPlans(account.user.id); assert.equal(plans.filter(item => item.isActive).length, 0);
    const plan = plans.find(item => item.id === created[0])!; const division = plan.divisions[0];
    assert.equal((await app.inject({ method: 'POST', url: '/workout-sessions', headers, payload: { divisionId: division.id, performedOn: '2026-10-27' } })).statusCode, 201);
    assert.equal((await repository.getPlan(account.user.id, plan.id))?.completedSessions, 1);
    assert.equal((await app.inject({ method: 'DELETE', url: `/workout-plans/${plan.id}`, headers })).statusCode, 204);
    const session = (await repository.listSessions(account.user.id))[0]; assert.equal(session.planDeleted, true); assert.equal(session.planName, 'Ficha excluída'); assert.equal(session.divisionName, 'Peito');
    assert.equal((await app.inject({ method: 'PATCH', url: `/workout-plans/${created[2]}/archive`, headers, payload: { archived: true } })).statusCode, 204);
    assert.equal((await app.inject({ method: 'POST', url: '/workout-plans', headers, payload: payload('Ficha nova') })).statusCode, 201);
  } finally { for (const id of users) await db.query('DELETE FROM users WHERE id=?', { replacements: [id] }); await app.close(); await db.close(); }
});
