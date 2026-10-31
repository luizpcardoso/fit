import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { ShortcutRepository } from '../src/shortcut-repository.js';

test('MySQL: atalhos persistem por usuário', {skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!,ssl:process.env.DB_SSL==='true'});const users:string[]=[];
  await migrateDatabase(db);const app=await buildApp({repository:new SequelizeAuthRepository(db),shortcutRepository:new ShortcutRepository(db),jwtSecret:'shortcut-integration-secret-32-characters'});
  try{const accounts=[];for(const label of ['owner','other']){const response=await app.inject({method:'POST',url:'/auth/register',payload:{email:`shortcut-${label}-${randomUUID()}@example.com`,password:'integration-test-123',phone:'71999990000',firstName:'Teste',lastName:'Atalho'}});assert.equal(response.statusCode,201);accounts.push(response.json());users.push(response.json().user.id)}const owner={authorization:`Bearer ${accounts[0].accessToken}`};const other={authorization:`Bearer ${accounts[1].accessToken}`};
    await app.inject({method:'PUT',url:'/me/home-shortcuts',headers:owner,payload:{items:['cardio','weight','meal']}});assert.deepEqual((await app.inject({method:'GET',url:'/me/home-shortcuts',headers:owner})).json(),{items:['cardio','weight','meal']});assert.deepEqual((await app.inject({method:'GET',url:'/me/home-shortcuts',headers:other})).json(),{items:['workout','meal','cardio','weight','mental']});
  }finally{if(users.length)await db.query('DELETE FROM users WHERE id IN (?)',{replacements:[users],type:QueryTypes.DELETE});await app.close();await db.close()}
});
