import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { userPreferencesSchema, type UpdateUserPreferences, type UserPreferences } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { PreferenceStore } from '../src/preference-repository.js';

class MemoryPreferences implements PreferenceStore {
  rows = new Map<string, UserPreferences>();
  async get(userId: string) { return this.rows.get(userId) ?? userPreferencesSchema.parse({}); }
  async update(userId: string, input: UpdateUserPreferences) { const next = userPreferencesSchema.parse({ ...await this.get(userId), ...input }); this.rows.set(userId, next); return next; }
}

test('preferências da conta exigem autenticação, validam horários e ficam isoladas por usuário', async () => {
  const app = await buildApp({ preferenceRepository: new MemoryPreferences(), jwtSecret: 'preferences-test-secret-32-characters' });
  try {
    const account = async () => { const response = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `preferences-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'Preferencias' } }); assert.equal(response.statusCode, 201); return { authorization: `Bearer ${response.json().accessToken}` }; };
    const owner = await account(), other = await account();
    assert.equal((await app.inject({ url: '/me/preferences' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'PATCH', url: '/me/preferences', payload: { mealCategoryTimes: { breakfast: '09:30' } } })).statusCode, 401);
    const initial = await app.inject({ url: '/me/preferences', headers: owner });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.headers['cache-control'], 'private, no-store');
    assert.deepEqual(initial.json(), { mealCategoryTimes: {} });
    for (const payload of [{}, { mealCategoryTimes: { breakfast: '25:00' } }, { mealCategoryTimes: { brunch: '10:00' } }, { userId: 'x', mealCategoryTimes: {} }])
      assert.equal((await app.inject({ method: 'PATCH', url: '/me/preferences', headers: owner, payload })).statusCode, 400);
    const saved = await app.inject({ method: 'PATCH', url: '/me/preferences', headers: owner, payload: { mealCategoryTimes: { breakfast: '09:30', dinner: '20:00' } } });
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.json(), { mealCategoryTimes: { breakfast: '09:30', dinner: '20:00' } });
    assert.deepEqual((await app.inject({ url: '/me/preferences', headers: other })).json(), { mealCategoryTimes: {} });
    // Sending the map replaces it: an omitted category returns to the product default.
    assert.deepEqual((await app.inject({ method: 'PATCH', url: '/me/preferences', headers: owner, payload: { mealCategoryTimes: { breakfast: '09:00' } } })).json(), { mealCategoryTimes: { breakfast: '09:00' } });
  } finally { await app.close(); }
});
