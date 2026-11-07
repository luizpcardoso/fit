import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { InjectableRepository } from '../src/injectable-repository.js';
import { PreferenceRepository } from '../src/preference-repository.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { SupplementRepository } from '../src/supplement-repository.js';

test('MySQL: dias da semana, doses sem horário, dispensas do dia e preferências da conta', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  assert.match(process.env.DB_NAME!, /test/, 'Use um banco isolado com "test" no nome.');
  const db = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME!, ssl: process.env.DB_SSL === 'true' });
  const users: string[] = [];
  const app = await buildApp({ repository: new SequelizeAuthRepository(db), supplementRepository: new SupplementRepository(db), medicationRepository: new SupplementRepository(db, 'medication'), injectableRepository: new InjectableRepository(db), preferenceRepository: new PreferenceRepository(db), jwtSecret: 'daily-routine-integration-secret-32-chars' });
  try {
    const accounts = [];
    for (const label of ['owner', 'other']) { const result = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `routine-${label}-${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Rotina' } }); assert.equal(result.statusCode, 201); accounts.push(result.json()); users.push(result.json().user.id); }
    const owner = { authorization: `Bearer ${accounts[0].accessToken}` }, other = { authorization: `Bearer ${accounts[1].accessToken}` };
    const monday = '2026-11-02', tuesday = '2026-11-03';
    // Weekdays + untimed doses.
    const created = await app.inject({ method: 'POST', url: '/medications', headers: owner, payload: { name: 'Sem horário', dailyFrequency: 2, times: [], weekdays: [1, 3], remind: false } });
    assert.equal(created.statusCode, 201); const id = created.json().id;
    const listed = (await app.inject({ url: '/medications', headers: owner })).json()[0];
    assert.deepEqual([listed.times, listed.weekdays, listed.remind], [[], [1, 3], false]);
    const today = async (date: string) => (await app.inject({ url: `/medications/today?date=${date}`, headers: owner })).json();
    let day = await today(monday);
    assert.deepEqual([day.total, day.items.map((item: { time: string | null }) => item.time)], [2, [null, null]]);
    assert.equal((await today(tuesday)).total, 0);
    // Dismissal: ownership, validation, idempotency, undo.
    assert.equal((await app.inject({ method: 'POST', url: `/medications/${id}/dismissals`, headers: other, payload: { date: monday, slot: 0 } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: `/medications/${id}/dismissals`, payload: { date: monday, slot: 0 } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: `/medications/${id}/dismissals`, headers: owner, payload: { date: monday, slot: 9 } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: `/supplements/${id}/dismissals`, headers: owner, payload: { date: monday, slot: 0 } })).statusCode, 404);
    for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'POST', url: `/medications/${id}/dismissals`, headers: owner, payload: { date: monday, slot: 0 } })).statusCode, 204);
    day = await today(monday);
    assert.deepEqual([day.total, day.remaining, day.dismissed, Boolean(day.items[0].dismissedAt), day.items[1].dismissedAt], [1, 1, 1, true, null]);
    assert.equal((await app.inject({ method: 'DELETE', url: `/medications/${id}/dismissals`, headers: owner, payload: { date: monday, slot: 0 } })).statusCode, 204);
    assert.equal((await today(monday)).dismissed, 0);
    // Editing keeps omitted fields; null weekdays = every day.
    assert.equal((await app.inject({ method: 'PATCH', url: `/medications/${id}`, headers: owner, payload: { name: 'Renomeado' } })).statusCode, 204);
    assert.deepEqual((await app.inject({ url: '/medications', headers: owner })).json()[0].weekdays, [1, 3]);
    assert.equal((await app.inject({ method: 'PATCH', url: `/medications/${id}`, headers: owner, payload: { weekdays: null, times: ['08:00', '20:00'], remind: true } })).statusCode, 204);
    assert.equal((await today(tuesday)).total, 2);
    // Injectable dismissal.
    const injectable = await app.inject({ method: 'POST', url: '/injectables', headers: owner, payload: { name: 'Injetável teste', dose: 1, unit: 'mg', weekdays: [1] } });
    assert.equal(injectable.statusCode, 201); const injectableId = injectable.json().id;
    assert.equal((await app.inject({ method: 'POST', url: `/injectables/${injectableId}/dismissals`, headers: owner, payload: { date: tuesday } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: `/injectables/${injectableId}/dismissals`, headers: other, payload: { date: monday } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: `/injectables/${injectableId}/dismissals`, headers: owner, payload: { date: monday } })).statusCode, 204);
    const injectables = (await app.inject({ url: `/injectables/today?date=${monday}`, headers: owner })).json();
    assert.deepEqual([injectables.total, injectables.dismissed], [0, 1]);
    // Preferences persist per account.
    assert.equal((await app.inject({ method: 'PATCH', url: '/me/preferences', headers: owner, payload: { mealCategoryTimes: { breakfast: '09:30' } } })).statusCode, 200);
    assert.deepEqual((await app.inject({ url: '/me/preferences', headers: owner })).json(), { mealCategoryTimes: { breakfast: '09:30' } });
    assert.deepEqual((await app.inject({ url: '/me/preferences', headers: other })).json(), { mealCategoryTimes: {} });
    await db.query("UPDATE user_preferences SET preferences_json='not json' WHERE user_id=?", { replacements: [users[0]], type: QueryTypes.UPDATE });
    assert.deepEqual((await app.inject({ url: '/me/preferences', headers: owner })).json(), { mealCategoryTimes: {} });
  } finally {
    if (users.length) await db.query('DELETE FROM users WHERE id IN (?)', { replacements: [users], type: QueryTypes.DELETE });
    await app.close(); await db.close();
  }
});
