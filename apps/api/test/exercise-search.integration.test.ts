import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {QueryTypes} from 'sequelize';
import {buildApp} from '../src/app.js';
import {createDatabase} from '../src/database.js';
import {migrateDatabase} from '../src/migrate.js';
import {SequelizeAuthRepository} from '../src/repository.js';
import {WorkoutRepository} from '../src/workout-repository.js';
import {additionalCatalogExercises} from '../src/exercise-catalog-expansion.js';
import {up as expandCatalog} from '../src/migrations/038-expand-global-exercises.js';

test('MySQL: catálogo global busca por músculo, equipamento e nome sem acento; expansão não duplica', {skip:process.env.RUN_DB_TESTS !== '1'}, async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});
  if(!process.env.DB_NAME?.includes('test')) throw new Error('Use banco exclusivo de testes.');
  const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!});
  await migrateDatabase(db);
  const repo=new WorkoutRepository(db);
  const app=await buildApp({repository:new SequelizeAuthRepository(db),workoutRepository:repo,jwtSecret:'exercise-search-tests-secret-32-characters'});
  const users:string[]=[];
  try{
    const accounts=[];
    for(const name of ['Aluno','Outro']) {
      const res=await app.inject({method:'POST',url:'/auth/register',payload:{email:`catalog-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:name,lastName:'Teste'}});
      assert.equal(res.statusCode,201);accounts.push(res.json());users.push(res.json().user.id);
    }
    const headers={authorization:`Bearer ${accounts[0].accessToken}`};
    assert.equal((await app.inject({url:'/exercises?search=biceps'})).statusCode,401);
    assert.equal((await app.inject({url:`/exercises?search=${'x'.repeat(101)}`,headers})).statusCode,400);
    const search=async(term:string)=>{const res=await app.inject({url:`/exercises?search=${encodeURIComponent(term)}`,headers});assert.equal(res.statusCode,200);return res.json();};
    const noAccent=await search('biceps'),accent=await search('bíceps');
    assert.deepEqual(noAccent,accent);
    assert.ok(noAccent.some((item:{name:string})=>item.name==='Rosca direta com barra'));
    assert.ok(noAccent.some((item:{name:string})=>item.name==='Rosca martelo no banco inclinado'));
    assert.ok(noAccent.length<=60);
    const equipment=await search('Smith');assert.ok(equipment.some((item:{name:string})=>item.name==='Passada reversa no Smith'));
    const named=await search('Scott com halter');assert.ok(named.some((item:{name:string})=>item.name==='Rosca Scott com halter'));
    assert.deepEqual(await search('%'),[]);assert.deepEqual(await search("' OR 1=1 --"),[]);
    const privateName=`Rosca privada ${randomUUID()}`;
    await db.query("INSERT INTO exercises (id,owner_user_id,name,source,primary_muscle,created_at,updated_at) VALUES (?,?,?,'custom','bíceps',NOW(),NOW())",{replacements:[randomUUID(),users[1],privateName]});
    assert.deepEqual(await search(privateName),[]);
    await db.query("INSERT INTO portal_accounts (user_id,role,suspended) VALUES (?,'admin',FALSE)",{replacements:[users[0]]});
    await expandCatalog({context:db.getQueryInterface()});await expandCatalog({context:db.getQueryInterface()});
    const items=await db.query<{id:string}>("SELECT id FROM exercises WHERE id IN (:ids) AND source='catalog'",{replacements:{ids:additionalCatalogExercises.map(item=>item.id)},type:QueryTypes.SELECT});
    assert.equal(items.length,additionalCatalogExercises.length);
    const content=await db.query<{id:string}>("SELECT id FROM portal_content WHERE id IN (:ids) AND scope='global'",{replacements:{ids:additionalCatalogExercises.map(item=>item.id)},type:QueryTypes.SELECT});
    assert.equal(content.length,additionalCatalogExercises.length);
  }finally{
    for(const id of users){await db.query('DELETE FROM portal_content WHERE owner_id=?',{replacements:[id]});await db.query('DELETE FROM users WHERE id=?',{replacements:[id]});}
    await app.close();await db.close();
  }
});
