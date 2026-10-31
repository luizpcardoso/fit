import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';

test('MySQL: retries e concorrência não duplicam ficha; imagens e fichas privadas ficam isoladas', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({path:new URL('../.env',import.meta.url),quiet:true});
  if (!process.env.DB_NAME?.includes('test')) throw new Error('Use banco exclusivo de testes.');
  const db = createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!});
  const repository = new WorkoutRepository(db);
  const app = await buildApp({repository:new SequelizeAuthRepository(db),workoutRepository:repository,jwtSecret:'workout-configuration-tests-secret-32-chars'});
  const users: string[] = [];
  try {
    const accounts = [];
    for (const role of ['owner','other']) {
      const response = await app.inject({method:'POST',url:'/auth/register',payload:{email:`ui-${role}-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:role}});
      assert.equal(response.statusCode,201); accounts.push(response.json()); users.push(response.json().user.id);
    }
    const privateId = randomUUID();
    await db.query("INSERT INTO exercises (id,owner_user_id,name,source,image_url,created_at,updated_at) VALUES (?,?,?,'custom',?,NOW(),NOW())",{replacements:[privateId,users[1],'Exercício privado',`${randomUUID()}.webp`],type:QueryTypes.INSERT});
    const headers = {authorization:`Bearer ${accounts[0].accessToken}`};
    const input = {requestId:randomUUID(),name:'Ficha segura',divisions:[{name:'Peito',exercises:[{name:'Supino',catalogExerciseId:privateId,sets:3,reps:'8–12',load:12.5,restSeconds:60}]}]};
    for (const url of ['/exercises','/workout-plan-suggestions','/workout-plans']) assert.equal((await app.inject({url})).statusCode,401);
    const responses = await Promise.all(Array.from({length:3},() => app.inject({method:'POST',url:'/workout-plans',headers,payload:input})));
    for (const response of responses) assert.equal(response.statusCode,201);
    assert.equal(new Set(responses.map(response=>response.json().id)).size,1);
    const id = responses[0].json().id;
    assert.equal((await repository.listPlans(users[0])).length,1);
    const plan = await repository.getPlan(users[0],id);
    assert.ok(plan); assert.equal(plan.divisions[0].exercises[0].load,12.5);
    assert.equal(plan.divisions[0].exercises[0].imageUrl,null);
    assert.notEqual(plan.divisions[0].exercises[0].catalogExerciseId,privateId);
    assert.equal((await repository.listCatalog('Exercício privado')).length,0);
    const otherHeaders = {authorization:`Bearer ${accounts[1].accessToken}`};
    assert.equal((await app.inject({url:`/workout-plans/${id}`,headers:otherHeaders})).statusCode,404);
    assert.equal((await app.inject({method:'DELETE',url:`/workout-plans/${id}`,headers:otherHeaders})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/workout-plans',headers,payload:{...input,requestId:randomUUID(),divisions:[{name:'Peito',exercises:[{name:'Supino',sets:0,reps:'12',load:-1}]}]}})).statusCode,400);
    // The same key belongs to the current user, never to another account.
    const other = await app.inject({method:'POST',url:'/workout-plans',headers:otherHeaders,payload:{...input,divisions:[{name:'Peito',exercises:[{name:'Supino',sets:3,reps:'12'}]}]}});
    assert.equal(other.statusCode,201); assert.notEqual(other.json().id,id);
  } finally {
    for (const id of users) await db.query('DELETE FROM users WHERE id=?',{replacements:[id],type:QueryTypes.DELETE});
    await app.close(); await db.close();
  }
});
