import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { SupplementRepository } from '../src/supplement-repository.js';

test('MySQL: suplementos privados, resumo diário e consumo idempotente', { skip:process.env.RUN_DB_TESTS!=='1' }, async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});
  const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!,ssl:process.env.DB_SSL==='true'});
  const users:string[]=[]; const repo=new SupplementRepository(db); const app=await buildApp({repository:new SequelizeAuthRepository(db),supplementRepository:repo,medicationRepository:new SupplementRepository(db,'medication'),jwtSecret:'supplement-integration-secret-32-characters'});
  try { const accounts=[]; for(const label of ['owner','other']){const result=await app.inject({method:'POST',url:'/auth/register',payload:{email:`supplement-${label}-${randomUUID()}@example.com`,password:'integration-test-123',phone:'71999990000',firstName:'Teste',lastName:'Suplemento'}});assert.equal(result.statusCode,201);accounts.push(result.json());users.push(result.json().user.id);}
    const owner={authorization:`Bearer ${accounts[0].accessToken}`}; const other={authorization:`Bearer ${accounts[1].accessToken}`};
    assert.equal((await app.inject({method:'GET',url:'/supplements'})).statusCode,401);
    const created=await app.inject({method:'POST',url:'/supplements',headers:owner,payload:{name:'Ômega 3',amount:3,unit:'capsule',dailyFrequency:2,times:['08:00','20:00'],notes:null}});assert.equal(created.statusCode,201);const id=created.json().id;
    assert.equal((await app.inject({method:'PATCH',url:`/supplements/${id}`,headers:other,payload:{active:false}})).statusCode,404);
    const date='2026-10-26'; let today=await app.inject({method:'GET',url:`/supplements/today?date=${date}`,headers:owner});assert.deepEqual({total:today.json().total,consumed:today.json().consumed,remaining:today.json().remaining},{total:2,consumed:0,remaining:2});
    const payload={date,slot:0};assert.equal((await app.inject({method:'POST',url:`/supplements/${id}/intakes`,headers:owner,payload})).statusCode,204);assert.equal((await app.inject({method:'POST',url:`/supplements/${id}/intakes`,headers:owner,payload})).statusCode,204);
    today=await app.inject({method:'GET',url:`/supplements/today?date=${date}`,headers:owner});assert.equal(today.json().consumed,1);
    assert.equal((await app.inject({method:'POST',url:`/supplements/${id}/intakes`,headers:owner,payload:{date,slot:2}})).statusCode,404);
    await app.inject({method:'DELETE',url:`/supplements/${id}/intakes`,headers:owner,payload});today=await app.inject({method:'GET',url:`/supplements/today?date=${date}`,headers:owner});assert.equal(today.json().consumed,0);
    await app.inject({method:'PATCH',url:`/supplements/${id}`,headers:owner,payload:{active:false}});today=await app.inject({method:'GET',url:`/supplements/today?date=${date}`,headers:owner});assert.equal(today.json().total,0);
    assert.deepEqual(await repo.list(users[1]),[]);
    assert.equal((await app.inject({method:'GET',url:'/medications'})).statusCode,401);
    const med=await app.inject({method:'POST',url:'/medications',headers:owner,payload:{name:'Medicamento de teste',amount:1,unit:'tablet',strength:'500 mg',dailyFrequency:2,times:['09:00','21:00']}});
    assert.equal(med.statusCode,201); const medId=med.json().id;
    for(const headers of [other,owner]) {
      const path=headers===other ? '/medications' : '/supplements';
      for(const method of ['POST','DELETE'] as const) assert.equal((await app.inject({method,url:`${path}/${medId}/intakes`,headers,payload})).statusCode,404);
      assert.equal((await app.inject({method:'PATCH',url:`${path}/${medId}`,headers,payload:{active:false}})).statusCode,404);
    }
    assert.equal((await app.inject({method:'POST',url:`/medications/${id}/intakes`,headers:owner,payload})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/medications',headers:owner,payload:{name:'Invalid',kind:'supplement',dailyFrequency:1,times:['09:00']}})).statusCode,400);
    assert.equal((await app.inject({method:'PATCH',url:`/medications/${medId}`,headers:owner,payload:{dailyFrequency:3}})).statusCode,400);
    const marked=await Promise.all([0,0,1].map(slot=>app.inject({method:'POST',url:`/medications/${medId}/intakes`,headers:owner,payload:{date,slot}})));
    marked.forEach(result=>assert.equal(result.statusCode,204));
    const daily=async(day=date)=>(await app.inject({method:'GET',url:`/medications/today?date=${day}`,headers:owner})).json();
    assert.equal((await daily()).consumed,2); assert.equal((await daily()).items[0].medication.strength,'500 mg');
    assert.equal((await daily('2026-10-27')).consumed,0);
    await app.inject({method:'PATCH',url:`/medications/${medId}`,headers:owner,payload:{active:false}});
    assert.equal((await daily()).total,0);
    await app.inject({method:'PATCH',url:`/medications/${medId}`,headers:owner,payload:{active:true}});
    assert.equal((await daily()).consumed,2); assert.equal((await daily()).total,2);
    await app.inject({method:'DELETE',url:`/medications/${medId}/intakes`,headers:owner,payload});
    assert.equal((await daily()).consumed,1);
    assert.equal((await app.inject({method:'GET',url:'/medications',headers:other})).json().length,0);
    assert.equal((await repo.list(users[0])).length,1);
  } finally {for(const id of users)await db.query('DELETE FROM users WHERE id=?',{replacements:[id],type:QueryTypes.DELETE});await app.close();await db.close();}
});
