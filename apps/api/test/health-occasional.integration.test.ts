import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { SupplementRepository } from '../src/supplement-repository.js';
import { InjectableRepository } from '../src/injectable-repository.js';
import { MentalWellbeingRepository } from '../src/mental-wellbeing-repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';
import { NutritionRepository } from '../src/nutrition-repository.js';

test('MySQL: eventuais privados, múltiplas tomadas idempotentes e rotina 7/10 preservada', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  assert.match(process.env.DB_NAME!, /test/, 'Use somente banco isolado de testes.');
  const db = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME! });
  const repo = new SupplementRepository(db, 'medication');
  const app = await buildApp({ repository: new SequelizeAuthRepository(db), medicationRepository: repo, supplementRepository: new SupplementRepository(db), injectableRepository: new InjectableRepository(db), mentalWellbeingRepository: new MentalWellbeingRepository(db), workoutRepository: new WorkoutRepository(db), nutritionRepository: new NutritionRepository(db), jwtSecret: 'health-occasional-test-secret-over-32-chars' });
  const users: string[] = [];
  try {
    const accounts = [];
    for (const label of ['Dono', 'Outro']) {
      const result = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `occasional-${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: label } });
      assert.equal(result.statusCode, 201); accounts.push(result.json()); users.push(result.json().user.id);
    }
    const owner = { authorization: `Bearer ${accounts[0].accessToken}` }, other = { authorization: `Bearer ${accounts[1].accessToken}` };
    const date = '2026-11-09';
    const post = (url: string, payload: Record<string, unknown>, headers = owner) => app.inject({ method: 'POST', url, payload, headers });
    const create = async (payload: Record<string, unknown>) => { const result = await post('/medications', payload); assert.equal(result.statusCode, 201); return result.json().id as string; };
    const scheduled: string[] = [];
    for (const frequency of [6, 4]) scheduled.push(await create({ name: `Recorrente ${frequency}`, dailyFrequency: frequency, times: [] }));
    for (const [index, id] of scheduled.entries()) for (let slot = 0; slot < (index ? 1 : 6); slot++) assert.equal((await post(`/medications/${id}/intakes`, { date, slot })).statusCode, 204);
    const daily = async () => (await app.inject({ url: `/medications/today?date=${date}`, headers: owner })).json();
    assert.deepEqual([(await daily()).consumed, (await daily()).total], [7, 10]);
    const summary = async () => { const response = await app.inject({ url: `/me/daily-summary?date=${date}`, headers: owner }); assert.equal(response.statusCode, 200); return response.json(); };
    const agenda = async () => { const response = await app.inject({ url: `/me/reminder-agenda?from=${date}&to=${date}`, headers: owner }); assert.equal(response.statusCode, 200); return response.json(); };
    const beforeSummary = await summary(), beforeAgenda = await agenda();
    // Even a direct client supplying schedule fields cannot put an occasional item in the routine/reminders.
    const id = await create({ name: 'Dor eventual', usageMode: 'occasional', illustration: 'drops', times: ['00:01'], remind: true });
    const input = { operationId: randomUUID(), date, time: '10:30' };
    const path = `/medications/${id}/occasional-intakes`;
    assert.equal((await app.inject({ method: 'POST', url: path, payload: input })).statusCode, 401);
    assert.equal((await post(path, input, other)).statusCode, 404);
    assert.equal((await post(`/supplements/${id}/occasional-intakes`, input)).statusCode, 404);
    assert.equal((await post(path, { ...input, time: '25:00' })).statusCode, 400);
    assert.equal((await post(path, { ...input, userId: users[1] })).statusCode, 400);
    assert.equal((await post(`/medications/${scheduled[0]}/occasional-intakes`, input)).statusCode, 404);
    for (const suffix of ['intakes', 'dismissals']) assert.equal((await post(`/medications/${id}/${suffix}`, { date, slot: 0 })).statusCode, 404);
    const results = await Promise.all([post(path, input), post(path, input)]); results.forEach(result => assert.equal(result.statusCode, 204));
    assert.equal((await post(path, { ...input, operationId: randomUUID() })).statusCode, 204);
    const occasional = async (headers = owner, day = date) => (await app.inject({ url: `/medications/occasional?date=${day}`, headers })).json();
    let records = await occasional(); assert.equal(records.count, 2); assert.equal(records.items[0].illustration, 'drops');
    assert.equal((await occasional(other)).count, 0);
    assert.deepEqual([(await daily()).consumed, (await daily()).total], [7, 10]);
    assert.deepEqual((await summary()).checks, beforeSummary.checks); assert.deepEqual(await agenda(), beforeAgenda);
    // Independent dates and late records.
    assert.equal((await occasional(owner, '2026-11-10')).count, 0);
    assert.equal((await post(path, { operationId: randomUUID(), date: '2026-11-08', time: '23:59' })).statusCode, 204);
    assert.equal((await occasional(owner, '2026-11-08')).count, 1);
    const [operationRows] = await db.query('SELECT id FROM supplement_occasional_intakes WHERE supplement_id=? AND operation_id=?', { replacements: [id, input.operationId] });
    const matching = operationRows[0] as { id: string };
    const undoPath = `${path}/${matching.id}`;
    assert.equal((await app.inject({ method: 'DELETE', url: undoPath, headers: other })).statusCode, 404);
    for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'DELETE', url: undoPath, headers: owner })).statusCode, 204);
    assert.equal((await occasional()).count, 1);
    assert.equal((await post(path, input)).statusCode, 204);
    assert.equal((await occasional()).count, 1, 'Reenvio após desfazer não ressuscita a tomada');
    assert.equal((await post(path, { ...input, time: '11:00' })).statusCode, 404);
    // Editing unrelated fields preserves mode and illustration; pause preserves history but blocks new writes.
    const patch = (payload: Record<string, unknown>) => app.inject({ method: 'PATCH', url: `/medications/${id}`, payload, headers: owner });
    assert.equal((await patch({ name: 'Renomeado', active: false })).statusCode, 204);
    assert.equal((await post(path, { ...input, operationId: randomUUID() })).statusCode, 404);
    records = await occasional(); assert.equal(records.count, 1); assert.equal(records.items[0].usageMode, 'occasional'); assert.equal(records.items[0].illustration, 'drops');
    assert.equal((await patch({ active: true, usageMode: 'recurring' })).statusCode, 204);
    assert.equal((await occasional()).count, 1); assert.equal((await daily()).total, 11);
    assert.equal((await patch({ usageMode: 'occasional' })).statusCode, 204); assert.equal((await daily()).total, 10);
    const stored = (await repo.list(users[0])).find(item => item.id === scheduled[0])!;
    assert.equal(stored.usageMode, 'recurring'); assert.equal(stored.illustration, null);
    await app.inject({ method: 'DELETE', url: `/medications/${id}`, headers: owner });
    assert.equal((await post(path, { ...input, operationId: randomUUID() })).statusCode, 404);
    const [count] = await db.query('SELECT COUNT(*) AS total FROM supplement_occasional_intakes WHERE supplement_id=?', { replacements: [id] });
    assert.equal(Number((count[0] as { total: number }).total), 3);
  } finally { for (const id of users) await db.query('DELETE FROM users WHERE id=?', { replacements: [id] }); await app.close(); await db.close(); }
});
