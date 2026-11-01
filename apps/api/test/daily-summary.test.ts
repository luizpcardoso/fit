import assert from 'node:assert/strict';
import test from 'node:test';
import type { DailyNutritionSummary, InjectableToday, MentalCheckIn, SupplementToday, WorkoutGoalSummary } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { DailySummarySources } from '../src/daily-summary-routes.js';

const date = '2026-10-31';
const privateDetail = 'DADO-PRIVADO-NAO-EXIBIR';

test('resumo autentica, isola contas, valida a data e expõe somente agregados', async t => {
  const owners = new Set<string>();
  const calls: string[] = [];
  let hasMeals = true;
  let mentalDone = false;
  let workoutDone = false;
  const routine = async (userId: string) => {
    calls.push(userId);
    return { total: owners.has(userId) ? 2 : 0, consumed: owners.has(userId) ? 1 : 0, items: [{ supplement: { name: privateDetail } }] } as SupplementToday;
  };
  const sources: DailySummarySources = {
    medications: { today: routine }, supplements: { today: routine },
    injectables: { today: async userId => {
      calls.push(userId);
      return { total: owners.has(userId) ? 1 : 0, applied: 0, items: [{ injectable: { name: privateDetail } }] } as InjectableToday;
    } },
    mental: { list: async userId => {
      calls.push(userId);
      return owners.has(userId) && mentalDone ? [{ note: privateDetail }] as MentalCheckIn[] : [];
    } },
    workouts: { getGoalSummary: async userId => {
      calls.push(userId);
      return { schedule: owners.has(userId) ? [{ weekday: 6 }] : [], sessionsByDate: workoutDone ? { [date]: 1 } : {} } as unknown as WorkoutGoalSummary;
    } },
    nutrition: { summary: async userId => {
      calls.push(userId);
      return owners.has(userId) ? {
        consumed: hasMeals ? { calories: 1650 } : null, consumptionGoal: { targetCalories: 2100 },
        balance: hasMeals ? -650 : null, meals: hasMeals ? [{ name: privateDetail }] : [],
      } as unknown as DailyNutritionSummary : { consumed: null, consumptionGoal: { targetCalories: null }, balance: null, meals: [] } as unknown as DailyNutritionSummary;
    } },
  };
  const app = await buildApp({
    jwtSecret: 'daily-summary-route-tests-secret-32-characters',
    medicationRepository: { ...sources.medications, kind: 'medication' } as Parameters<typeof buildApp>[0]['medicationRepository'],
    supplementRepository: { ...sources.supplements, kind: 'supplement' } as Parameters<typeof buildApp>[0]['supplementRepository'],
    injectableRepository: sources.injectables as Parameters<typeof buildApp>[0]['injectableRepository'],
    mentalWellbeingRepository: sources.mental as Parameters<typeof buildApp>[0]['mentalWellbeingRepository'],
    workoutRepository: sources.workouts as Parameters<typeof buildApp>[0]['workoutRepository'],
    nutritionRepository: sources.nutrition as Parameters<typeof buildApp>[0]['nutritionRepository'],
  });
  t.after(() => app.close());
  const account = async (label: string) => (await app.inject({ method: 'POST', url: '/auth/register', payload: {
    email: `${label}@example.com`, password: 'senha-forte-123', phone: '71999990000', firstName: 'Teste', lastName: label,
  } })).json();
  const owner = await account('summary-owner');
  const other = await account('summary-other');
  owners.add(owner.user.id);
  const headers = { authorization: `Bearer ${owner.accessToken}` };
  const url = `/me/daily-summary?date=${date}`;

  assert.equal((await app.inject({ url })).statusCode, 401);
  assert.deepEqual(calls, []);
  const response = await app.inject({ url, headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.deepEqual(response.json().checks, { completed: 2, total: 7 });
  assert.deepEqual(response.json().nutrition, { consumedCalories: 1650, targetCalories: 2100, balance: -650 });
  assert.equal(response.json().pending, 'checks');
  assert.equal(response.body.includes(privateDetail), false);
  assert.deepEqual(calls, Array(6).fill(owner.user.id));

  calls.length = 0;
  const others = await app.inject({ url, headers: { authorization: `Bearer ${other.accessToken}` } });
  assert.equal(others.statusCode, 200);
  assert.deepEqual(others.json().checks, { completed: 0, total: 1 });
  assert.deepEqual(others.json().nutrition, { consumedCalories: 0, targetCalories: null, balance: null });
  assert.deepEqual(calls, Array(6).fill(other.user.id));
  for (const invalid of ['date=2026-02-30', 'date=invalid', '', `date=${date}&userId=${owner.user.id}`]) {
    assert.equal((await app.inject({ url: `/me/daily-summary?${invalid}`, headers })).statusCode, 400);
  }

  mentalDone = true; workoutDone = true; hasMeals = false;
  const emptyFood = (await app.inject({ url, headers })).json();
  assert.deepEqual(emptyFood.checks, { completed: 4, total: 7 });
  assert.equal(emptyFood.nutrition.balance, null);
  assert.equal(emptyFood.nutrition.consumedCalories, 0);
  await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: owner.refreshToken } });
  assert.equal((await app.inject({ url, headers })).statusCode, 401);
});
