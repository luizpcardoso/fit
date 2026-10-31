import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { SupplementRepository } from '../src/supplement-repository.js';
import { NutritionRepository } from '../src/nutrition-repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';
import { GroupRepository } from '../src/group-repository.js';

test('MySQL UX: exclusão preserva histórico, conclusão e compartilhamento isolam usuários e grupos', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  assert.match(process.env.DB_NAME ?? '', /test/, 'Use somente um banco de teste isolado');
  const db = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME! });
  const app = await buildApp({ repository: new SequelizeAuthRepository(db), supplementRepository: new SupplementRepository(db), medicationRepository: new SupplementRepository(db, 'medication'), nutritionRepository: new NutritionRepository(db), workoutRepository: new WorkoutRepository(db), groupRepository: new GroupRepository(db), jwtSecret: 'ux-test-secret-with-more-than-32-characters' });
  const users: string[] = []; const groups: string[] = [];
  try {
    const accounts = [];
    for (const label of ['owner','other']) {
      const r = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `ux-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: label } });
      assert.equal(r.statusCode, 201); accounts.push(r.json()); users.push(r.json().user.id);
    }
    const owner = { authorization: `Bearer ${accounts[0].accessToken}` }; const other = { authorization: `Bearer ${accounts[1].accessToken}` };
    for (const prefix of ['/medications','/supplements']) {
      const r = await app.inject({ method: 'POST', url: prefix, headers: owner, payload: { name: 'Item de teste', dailyFrequency: 1, times: ['08:00'] } });
      assert.equal(r.statusCode, 201); const id = r.json().id;
      const payload = { date: '2026-10-29', slot: 0 };
      assert.equal((await app.inject({ method: 'DELETE', url: `${prefix}/${id}` })).statusCode, 401);
      assert.equal((await app.inject({ method: 'DELETE', url: `${prefix}/${id}`, headers: other })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: `${prefix}/${id}/intakes`, headers: owner, payload })).statusCode, 204);
      assert.equal((await app.inject({ method: 'DELETE', url: `${prefix}/${id}`, headers: owner })).statusCode, 204);
      assert.equal((await app.inject({ method: 'GET', url: prefix, headers: owner })).json().length, 0);
      assert.equal((await app.inject({ method: 'GET', url: `${prefix}/today?date=2026-10-29`, headers: owner })).json().total, 0);
      assert.equal((await app.inject({ method: 'PATCH', url: `${prefix}/${id}`, headers: owner, payload: { active: true } })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: `${prefix}/${id}/intakes`, headers: owner, payload })).statusCode, 404);
      const [count] = await db.query<{ n: number }>('SELECT COUNT(*) n FROM supplement_intakes WHERE supplement_id=?', { replacements: [id], type: QueryTypes.SELECT });
      assert.equal(Number(count.n), 1);
    }
    for (const prefix of ['/medications', '/supplements']) {
      for (let i=0;i<12;i++) assert.equal((await app.inject({ method: 'POST', url: prefix, headers: owner, payload: { name: `Teste ${String(i).padStart(2,'0')}`, dailyFrequency: 1, times: ['08:00'] } })).statusCode, 201);
      const seen = new Set<string>();
      for (let page=1;page<=3;page++) {
        const result = (await app.inject({ method: 'GET', url: `${prefix}/page?page=${page}`, headers: owner })).json();
        assert.equal(result.total,12); assert.equal(result.items.length,page===3?2:5);
        for(const item of result.items) { assert.ok(!seen.has(item.id)); seen.add(item.id); }
      }
      const filtered=(await app.inject({method:'GET',url:`${prefix}/page?page=9&search=Teste%2001`,headers:owner})).json();
      assert.equal(filtered.page,1);assert.equal(filtered.total,1);
      assert.equal((await app.inject({method:'GET',url:`${prefix}/page?pageSize=1000`,headers:owner})).statusCode,400);
      assert.equal((await app.inject({method:'GET',url:`${prefix}/page`,headers:other})).json().total,0);
    }
    for(let i=0;i<12;i++) assert.equal((await app.inject({method:'POST',url:'/body-measurements',headers:owner,payload:{date:'2026-10-29',weightKg:70+i}})).statusCode,201);
    const page1=(await app.inject({method:'GET',url:'/body-measurements/page',headers:owner})).json();
    const page2=(await app.inject({method:'GET',url:'/body-measurements/page?page=2',headers:owner})).json();
    assert.equal(new Set([...page1.items,...page2.items].map(item=>item.id)).size,10);
    assert.deepEqual(page1.latest,page2.latest);
    const last=(await app.inject({method:'GET',url:'/body-measurements/page?page=3',headers:owner})).json();
    for(const item of last.items) assert.equal((await app.inject({method:'DELETE',url:`/body-measurements/${item.id}`,headers:owner})).statusCode,204);
    assert.equal((await app.inject({method:'GET',url:'/body-measurements/page?page=3',headers:owner})).json().page,2);
    assert.equal((await app.inject({method:'PUT',url:'/nutrition/goal',payload:{targetCalories:2000}})).statusCode,401);
    assert.equal((await app.inject({method:'PUT',url:'/nutrition/goal',headers:owner,payload:{targetCalories:-1}})).statusCode,400);
    assert.equal((await app.inject({method:'PUT',url:'/nutrition/goal',headers:owner,payload:{targetCalories:2000}})).statusCode,204);
    const summary=async(headers=owner)=>(await app.inject({method:'GET',url:'/nutrition/summary?date=2026-10-29',headers})).json();
    assert.equal((await summary()).consumptionGoal.remainingCalories,2000);
    assert.equal((await summary(other)).consumptionGoal.targetCalories,null);
    const meal={name:'Almoço',date:'2026-10-29',time:'12:30',directNutrition:{calories:500,protein:30,carbs:50,fat:20}};
    const mealResponse=await app.inject({method:'POST',url:'/nutrition/meals',headers:owner,payload:meal});assert.equal(mealResponse.statusCode,201);
    assert.equal((await summary()).consumptionGoal.remainingCalories,1500);
    await app.inject({method:'PUT',url:`/nutrition/meals/${mealResponse.json().id}`,headers:owner,payload:{...meal,directNutrition:{...meal.directNutrition,calories:2500}}});
    assert.equal((await summary()).consumptionGoal.remainingCalories,-500);
    await app.inject({method:'DELETE',url:`/nutrition/meals/${mealResponse.json().id}`,headers:owner});
    assert.equal((await summary()).consumptionGoal.remainingCalories,2000);
    const planResponse = await app.inject({ method: 'POST', url: '/workout-plans', headers: owner, payload: { name: 'Ficha teste', divisions: [{ name: 'Treino A', exercises: [{ name: 'Agachamento', sets: 3, reps: '10' }] }] } });
    assert.equal(planResponse.statusCode, 201);
    const plan = (await app.inject({ method: 'GET', url: `/workout-plans/${planResponse.json().id}`, headers: owner })).json();

    for (const name of ['Escolhido','Não escolhido']) {
      const r = await app.inject({ method: 'POST', url: '/groups', headers: owner, payload: { name } }); assert.equal(r.statusCode, 201); groups.push(r.json().id);
      await db.query('UPDATE group_event_settings SET workout_completed=1 WHERE group_id=?', { replacements: [r.json().id] });
      await db.query('UPDATE group_share_preferences SET workout_completed=1 WHERE group_id=? AND user_id=?', { replacements: [r.json().id, users[0]] });
    }
    const completed = await app.inject({ method: 'POST', url: '/workout-sessions', headers: owner, payload: { divisionId: plan.divisions[0].id, performedOn: '2026-10-29', shareAutomatically: false } });
    assert.equal(completed.statusCode, 201); const sourceId = completed.json().id;
    const countPosts = async () => (await db.query<{ group_id: string }>('SELECT group_id FROM group_posts WHERE source_id=?', { replacements: [sourceId], type: QueryTypes.SELECT }));
    assert.equal((await countPosts()).length, 0);
    const payload = { sourceType: 'workout_session', eventType: 'workout_completed', sourceId, groupIds: [groups[0]] };
    assert.equal((await app.inject({ method: 'POST', url: '/groups/share-activity', headers: other, payload })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: '/groups/share-activity', headers: owner, payload: { ...payload, groupIds: [groups[0], randomUUID()] } })).statusCode, 403);
    assert.equal((await countPosts()).length, 0);
    const responses = await Promise.all([1,2,3].map(() => app.inject({ method: 'POST', url: '/groups/share-activity', headers: owner, payload })));
    responses.forEach(r => assert.equal(r.statusCode, 201));
    assert.deepEqual((await countPosts()).map(r => r.group_id), [groups[0]]);
    assert.equal((await app.inject({ method: 'GET', url: '/workout-sessions', headers: owner })).json().length, 1);
  } finally {
    for (const id of groups) await db.query('DELETE FROM `groups` WHERE id=?', { replacements: [id] });
    for (const id of users) await db.query('DELETE FROM users WHERE id=?', { replacements: [id] });
    await app.close(); await db.close();
  }
});
