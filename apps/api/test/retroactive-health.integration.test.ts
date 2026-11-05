import type { LightMyRequestResponse } from 'fastify';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { buildApp } from '../src/app.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { SupplementRepository } from '../src/supplement-repository.js';
import { InjectableRepository } from '../src/injectable-repository.js';

test('MySQL: checks anteriores preservam outros dias, são idempotentes e isolam contas nas três categorias', {skip:process.env.RUN_DB_TESTS!=='1'}, async () => {
 config({path:new URL('../.env',import.meta.url),quiet:true});
 const connection={host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!};
 const bootstrap=createDatabase({...connection,database:process.env.DB_NAME!}), name=`fit_retro_test_${randomUUID().replaceAll('-','')}`;
 let db:ReturnType<typeof createDatabase>|undefined, app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try {
  await bootstrap.query(`CREATE DATABASE \`${name}\``); db=createDatabase({...connection,database:name}); await migrateDatabase(db);
  app=await buildApp({repository:new SequelizeAuthRepository(db),supplementRepository:new SupplementRepository(db),medicationRepository:new SupplementRepository(db,'medication'),injectableRepository:new InjectableRepository(db),jwtSecret:'retroactive-health-test-secret-32-characters'});
  const headers:{authorization:string}[]=[];
  for(const label of ['owner','other']){const response:LightMyRequestResponse=await app.inject({method:'POST',url:'/auth/register',payload:{email:`${label}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Retroativo'}});assert.equal(response.statusCode,201);headers.push({authorization:`Bearer ${response.json().accessToken}`});}
  for(const path of ['/supplements','/medications','/injectables']){
   const injectable=path==='/injectables';
   const created:LightMyRequestResponse=await app.inject({method:'POST',url:path,headers:headers[0],payload:injectable?{name:'Teste',dose:1,unit:'mg',customUnit:null,weekdays:[1,2,3,4,5,6,7],halfLifeDays:null,notes:null}:{name:'Teste',amount:1,unit:'tablet',dailyFrequency:2,times:['08:00','20:00'],notes:null}});
   assert.equal(created.statusCode,201,created.body);const id=created.json().id;
   const url=`${path}/${id}/${injectable?'applications':'intakes'}`, payload=(date:string)=>injectable?{date}:{date,slot:0};
   assert.equal((await app.inject({method:'POST',url,headers:headers[0],payload:payload('2026-11-02')})).statusCode,204);
   assert.equal((await app.inject({method:'POST',url,headers:headers[1],payload:payload('2026-10-30')})).statusCode,404);
   assert.equal((await app.inject({method:'POST',url,payload:payload('2026-10-30')})).statusCode,401);
   for(let repeat=0;repeat<2;repeat++)assert.equal((await app.inject({method:'POST',url,headers:headers[0],payload:payload('2026-10-30')})).statusCode,204);
   const count=async(date:string)=>{const result=await app!.inject({url:`${path}/today?date=${date}`,headers:headers[0]});assert.equal(result.statusCode,200);return injectable?result.json().applied:result.json().consumed;};
   assert.equal(await count('2026-11-02'),1);assert.equal(await count('2026-10-30'),1);assert.equal(await count('2026-10-29'),0);
   assert.equal((await app.inject({method:'POST',url,headers:headers[0],payload:payload('invalid')})).statusCode,400);
  }
 } finally {await app?.close();await db?.close();await bootstrap.query(`DROP DATABASE IF EXISTS \`${name}\``);await bootstrap.close();}
});
