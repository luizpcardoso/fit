import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import { mealCategories, mealCategoryTime, mealInputSchema } from '@fit/contracts';
import { resolveMealWhen, stepMealTime } from '../../mobile/src/utils/meal-time.js';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { NutritionRepository } from '../src/nutrition-repository.js';
import { SequelizeAuthRepository } from '../src/repository.js';

test('refeições: referências por categoria não substituem o nome livre', () => {
  assert.deepEqual(mealCategories.map(item => mealCategoryTime(item.id)), ['07:30', '10:00', '12:30', '15:30', '19:30', '22:00']);
  const input = { name: 'Marmita congelada', category: 'lunch', date: '2026-11-04', time: '12:47', directNutrition: { calories: 500, protein: 0, carbs: 0, fat: 0 } };
  assert.equal(mealInputSchema.parse(input).name, 'Marmita congelada');
  assert.equal(mealInputSchema.safeParse({ ...input, category: 'categoria inventada' }).success, false);
  assert.equal(mealInputSchema.safeParse({ ...input, time: '24:00' }).success, false);
  assert.equal(mealCategoryTime(null), null);
  assert.equal(mealCategoryTime('breakfast', { breakfast: '09:30' }), '09:30');
  assert.equal(mealCategoryTime('lunch', { breakfast: '09:30' }), '12:30');
});

test('horários: passos de 30 minutos respeitam a data e preservam minutos exatos', () => {
  assert.equal(stepMealTime('12:47', 1), '13:17');
  assert.equal(stepMealTime('12:47', -1), '12:17');
  assert.equal(stepMealTime('00:30', -1), '00:00');
  assert.equal(stepMealTime('00:29', -1), null);
  assert.equal(stepMealTime('23:29', 1), '23:59');
  assert.equal(stepMealTime('23:30', 1), null);
  assert.equal(stepMealTime('25:00', -1), null);
  assert.equal(stepMealTime('1', 1), null);
});

test('Agora captura o relógio ao salvar, inclusive após meia-noite; customizado preserva data local', () => {
  const now = new Date(2026, 10, 5, 0, 2);
  assert.deepEqual(resolveMealWhen('now', '04/11/2026', '12:30', now), { date: '2026-11-05', time: '00:02' });
  assert.deepEqual(resolveMealWhen('custom', '04/11/2026', '23:59', now), { date: '2026-11-04', time: '23:59' });
  assert.equal(resolveMealWhen('custom', '31/02/2026', '12:00', now).date, null);
});

test('MySQL: categoria, nome e horário persistem em refeições, favoritas e consumo da dieta com isolamento', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const database = `fit_meal_entry_test_${process.pid}_${Date.now()}`;
  const connection = { host: process.env.DB_HOST!, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER!, password: process.env.DB_PASS! };
  const admin = await createConnection(connection);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = createDatabase({ host: connection.host, port: connection.port, username: connection.user, password: connection.password, database });
  try {
    await migrateDatabase(db);
    const app = await buildApp({ repository: new SequelizeAuthRepository(db), nutritionRepository: new NutritionRepository(db), jwtSecret: 'meal-entry-isolated-test-secret-more-than-32-characters' });
    try {
      const register = async () => {
        const response = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Refeição' } });
        assert.equal(response.statusCode, 201); return response.json();
      };
      const owner = await register(), other = await register();
      const headers = { authorization: `Bearer ${owner.accessToken}` }, foreign = { authorization: `Bearer ${other.accessToken}` };
      const input = { name: 'Marmita congelada', category: 'lunch', date: '2026-11-04', time: '12:47', directNutrition: { calories: 500, protein: 30, carbs: 60, fat: 15 } };
      const list = async (date = input.date) => (await app.inject({ method: 'GET', url: `/nutrition/meals?date=${date}`, headers })).json();
      assert.equal((await app.inject({ method: 'POST', url: '/nutrition/meals', payload: input })).statusCode, 401);
      assert.equal((await app.inject({ method: 'GET', url: `/nutrition/meals?date=${input.date}` })).statusCode, 401);
      for (const patch of [{ category: 'invalid' }, { time: '24:00' }, { userId: other.user.id }]) assert.equal((await app.inject({ method: 'POST', url: '/nutrition/meals', headers, payload: { ...input, ...patch } })).statusCode, 400);
      const response = await app.inject({ method: 'POST', url: '/nutrition/meals', headers, payload: input });
      assert.equal(response.statusCode, 201, response.body);
      const id = response.json().id;
      assert.equal((await list())[0].category, 'lunch');
      assert.equal((await list())[0].name, 'Marmita congelada');
      assert.equal((await list())[0].time, '12:47');
      assert.deepEqual((await app.inject({ method: 'GET', url: `/nutrition/meals?date=${input.date}`, headers: foreign })).json(), []);
      assert.equal((await app.inject({ method: 'PUT', url: `/nutrition/meals/${id}`, headers: foreign, payload: input })).statusCode, 404);
      assert.equal((await app.inject({ method: 'PUT', url: `/nutrition/meals/${randomUUID()}`, headers, payload: input })).statusCode, 404);
      const { category: _, ...legacy } = input;
      assert.equal((await app.inject({ method: 'PUT', url: `/nutrition/meals/${id}`, headers, payload: { ...legacy, time: '13:17' } })).statusCode, 204);
      assert.equal((await list())[0].category, 'lunch', 'cliente antigo preserva categoria');
      assert.equal((await list())[0].time, '13:17');
      const favorite = await app.inject({ method: 'POST', url: `/nutrition/meals/${id}/favorite`, headers });
      assert.equal(favorite.statusCode, 201, favorite.body);
      const favoriteId = favorite.json().id, use = `/nutrition/favorites/${favoriteId}/use`;
      const reuse = { date: '2026-11-05', time: '19:13', multiplier: 2 };
      assert.equal((await app.inject({ method: 'POST', url: use, payload: reuse })).statusCode, 401);
      assert.equal((await app.inject({ method: 'POST', url: use, headers: foreign, payload: reuse })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: use, headers, payload: { ...reuse, category: 'invalid' } })).statusCode, 400);
      assert.equal((await app.inject({ method: 'POST', url: use, headers, payload: reuse })).statusCode, 201);
      assert.equal((await list(reuse.date))[0].category, 'lunch');
      const reused = await app.inject({ method: 'POST', url: use, headers, payload: { ...reuse, category: 'dinner', time: '20:00' } });
      assert.equal(reused.statusCode, 201);
      const dinner = (await list(reuse.date)).find((row: { id: string }) => row.id === reused.json().id);
      assert.equal(dinner.category, 'dinner'); assert.equal(dinner.name, input.name); assert.equal(dinner.time, '20:00'); assert.equal(dinner.calories, 1000);
      const favorites = (await app.inject({ method: 'GET', url: '/nutrition/favorites', headers })).json();
      assert.equal(favorites[0].category, 'lunch'); assert.equal(favorites[0].calories, 500);
      assert.equal((await app.inject({ method: 'PUT', url: `/nutrition/meals/${id}`, headers, payload: { ...input, category: null } })).statusCode, 204);
      assert.equal((await list())[0].category, null);
      assert.equal((await app.inject({ method: 'POST', url: '/nutrition/meals', headers, payload: { ...legacy, name: 'Nome antigo' } })).statusCode, 201);
      assert.equal((await list()).find((row: { name: string }) => row.name === 'Nome antigo').category, null);

      const assignmentId = randomUUID();
      const food = { name: 'Arroz do plano', servingAmount: 100, servingUnit: 'g', calories: 130, protein: 3, carbs: 28, fat: 1 };
      const snapshot = { kind: 'diet', scope: 'private', name: 'Plano teste', data: { objective: '', notes: '', validityDays: 30, meals: [{ name: 'Almoço', time: '12:30', items: [{ food, quantity: 100, substitutions: '' }] }] } };
      await db.query("INSERT INTO professional_assignments (id,author_id,student_id,relationship_id,kind,status,source_id,source_revision,snapshot,request_id,created_at,updated_at) VALUES (?,?,?,?,'diet','active',?,1,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())", { replacements: [assignmentId, other.user.id, owner.user.id, randomUUID(), randomUUID(), JSON.stringify(snapshot), randomUUID()] });
      const dietInput = { assignmentId, mealIndex: 0, optionIndex: 0, quantities: [150], date: reuse.date, time: '13:07', requestId: randomUUID(), name: 'Marmita da dieta', category: 'lunch' };
      assert.equal((await app.inject({ method: 'POST', url: '/nutrition/diet-meals', headers: foreign, payload: dietInput })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: '/nutrition/diet-meals', headers, payload: { ...dietInput, calories: 999 } })).statusCode, 400);
      const consumption = await app.inject({ method: 'POST', url: '/nutrition/diet-meals', headers, payload: dietInput });
      assert.equal(consumption.statusCode, 201, consumption.body);
      assert.equal((await app.inject({ method: 'POST', url: '/nutrition/diet-meals', headers, payload: dietInput })).json().id, consumption.json().id);
      const recorded = (await list(reuse.date)).find((row: { id: string }) => row.id === consumption.json().id);
      assert.equal(recorded.name, 'Marmita da dieta'); assert.equal(recorded.category, 'lunch'); assert.equal(recorded.time, '13:07'); assert.equal(recorded.calories, 195); assert.equal(recorded.items[0].foodName, food.name);
      const { name: _name, category: _category, ...legacyDiet } = dietInput;
      const older = await app.inject({ method: 'POST', url: '/nutrition/diet-meals', headers, payload: { ...legacyDiet, requestId: randomUUID() } });
      assert.equal(older.statusCode, 201, older.body);
      const oldRecord = (await list(reuse.date)).find((row: { id: string }) => row.id === older.json().id);
      assert.equal(oldRecord.name, 'Almoço'); assert.equal(oldRecord.category, null);
      const syncUrl = '/nutrition/meal-sync';
      const queued = { id: randomUUID(), kind: 'meal', input: { ...input, name: 'Refeição offline' } };
      const dietQueued = { id: randomUUID(), kind: 'diet', input: { ...dietInput, name: 'Dieta offline' } };
      const favoriteQueued = { id: randomUUID(), kind: 'favorite', favoriteId, input: { date: input.date, time: '20:30', multiplier: 1 } };
      const badSource = { id: randomUUID(), kind: 'favorite', favoriteId: randomUUID(), input: { date: input.date, time: '20:30', multiplier: 1 } };
      const batch = { entries: [queued, dietQueued, favoriteQueued, badSource] };
      assert.equal((await app.inject({method:'POST',url:syncUrl,payload:batch})).statusCode,401);
      assert.equal((await app.inject({method:'POST',url:syncUrl,headers:{...headers,'x-orami-owner':other.user.id},payload:batch})).statusCode,403);
      assert.equal((await app.inject({method:'POST',url:syncUrl,headers,payload:{entries:[queued,queued]}})).statusCode,400);
      assert.equal((await app.inject({method:'POST',url:syncUrl,headers,payload:{entries:Array.from({length:26},()=>({...queued,id:randomUUID()}))}})).statusCode,400);
      const before = (await list()).length;
      const firstSync = await app.inject({method:'POST',url:syncUrl,headers,payload:batch});
      assert.equal(firstSync.statusCode,200,firstSync.body);
      assert.deepEqual(firstSync.json().map((r:{status:string})=>r.status),['saved','saved','saved','rejected']);
      assert.equal(firstSync.json()[0].meal.syncId,queued.id);
      const repeat = await app.inject({method:'POST',url:syncUrl,headers,payload:batch});
      assert.deepEqual(repeat.json(),firstSync.json(),'resposta perdida pode ser repetida sem duplicar');
      assert.equal((await list()).length,before+2);
      const concurrent = { ...queued, id: randomUUID() };
      const same = await Promise.all([1,2].map(()=>app.inject({method:'POST',url:syncUrl,headers,payload:{entries:[concurrent]}})));
      assert.equal(same[0].json()[0].meal.id,same[1].json()[0].meal.id,'requisições simultâneas são idempotentes');
      const cancel = await app.inject({method:'POST',url:syncUrl,headers,payload:{entries:[{...queued,cancelled:true}]}});
      assert.equal(cancel.json()[0].meal,null);
      assert.equal((await app.inject({method:'POST',url:syncUrl,headers,payload:{entries:[queued]}})).json()[0].meal,null,'reenvio antigo não ressuscita uma refeição removida');
      const cancelledFirst = { ...queued, id: randomUUID() };
      await app.inject({method:'POST',url:syncUrl,headers,payload:{entries:[{...cancelledFirst,cancelled:true}]}});
      assert.equal((await app.inject({method:'POST',url:syncUrl,headers,payload:{entries:[cancelledFirst]}})).json()[0].meal,null);
      const isolated = await app.inject({method:'POST',url:syncUrl,headers:foreign,payload:{entries:[favoriteQueued]}});
      assert.equal(isolated.json()[0].status,'rejected','a mesma solicitação não expõe favoritas de outra conta');
    } finally { await app.close(); }
  } finally {
    await db.close(); await admin.query(`DROP DATABASE \`${database}\``); await admin.end();
  }
});
