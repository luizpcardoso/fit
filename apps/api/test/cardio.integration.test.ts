import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { CardioRepository } from '../src/cardio-repository.js';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';

test('MySQL: cardio persiste e protege registros de outro usuário', { skip:process.env.RUN_DB_TESTS!=='1' }, async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});
  const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!,ssl:process.env.DB_SSL==='true'});
  const users:string[]=[];await migrateDatabase(db);const app=await buildApp({repository:new SequelizeAuthRepository(db),cardioRepository:new CardioRepository(db),jwtSecret:'cardio-integration-secret-32-characters'});
  try{
    const accounts=[];for(const label of ['owner','other']){const response=await app.inject({method:'POST',url:'/auth/register',payload:{email:`cardio-${label}-${randomUUID()}@example.com`,password:'integration-test-123',phone:'71999990000',firstName:'Teste',lastName:'Cardio'}});assert.equal(response.statusCode,201);accounts.push(response.json());users.push(response.json().user.id)}
    const owner={authorization:`Bearer ${accounts[0].accessToken}`};const other={authorization:`Bearer ${accounts[1].accessToken}`};
    const created=await app.inject({method:'POST',url:'/cardio-sessions',headers:owner,payload:{date:'2026-10-28',mode:'estimated',activity:'stairs',intensity:'intense',durationMinutes:20,weightKg:75}});assert.equal(created.statusCode,201);assert.equal(created.json().calories,233);
    const id=created.json().id;assert.deepEqual((await app.inject({method:'GET',url:'/cardio-sessions?date=2026-10-28',headers:other})).json(),[]);
    assert.equal((await app.inject({method:'DELETE',url:`/cardio-sessions/${id}`,headers:other})).statusCode,404);
    assert.equal((await app.inject({method:'DELETE',url:`/cardio-sessions/${id}`,headers:owner})).statusCode,204);
  }finally{if(users.length)await db.query('DELETE FROM users WHERE id IN (?)',{replacements:[users],type:QueryTypes.DELETE});await app.close();await db.close()}
});
