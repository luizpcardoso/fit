import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import sharp from 'sharp';
import { createWorkoutPlanSchema, updateWorkoutPlanSchema, defaultWorkoutCover, portalContentInputSchema, workoutCoverIds } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { SequelizePortalStore } from '../src/portal.js';
import { ProfessionalManagement } from '../src/professional-management.js';
import { PortalContentService, registerPortalContent } from '../src/portal-content.js';
import { WorkoutRepository } from '../src/workout-repository.js';
import { backfillWorkoutCovers } from '../src/migrations/045-workout-plan-covers.js';

const divisions = [{ name: 'Corpo inteiro', exercises: [{ name: 'Agachamento', sets: 3, reps: '12', load: null, restSeconds: 60, notes: '' }] }];
const model = (coverId?: unknown) => ({ kind: 'workout', scope: 'global', name: 'Emagrecimento feminino', data: { validityDays: 30, divisions, ...(coverId === undefined ? {} : { coverId }) } });
test('capas: catálogo restrito e identificação por objetivo sem usar perfil pessoal', () => {
  for (const schema of [createWorkoutPlanSchema, updateWorkoutPlanSchema]) {
    for (const coverId of [...workoutCoverIds, null, undefined]) assert.equal(schema.safeParse({name:'Minha ficha',divisions,coverId}).success,true);
    for (const coverId of ['../file','https://example.com/image.png','unknown',42]) assert.equal(schema.safeParse({name:'Minha ficha',divisions,coverId}).success,false);
  }
  for (const id of [...workoutCoverIds, null]) assert.equal(portalContentInputSchema.safeParse(model(id)).success, true);
  for (const id of ['../file', 'https://example.com/image.png', 'unknown', 42]) assert.equal(portalContentInputSchema.safeParse(model(id)).success, false);
  assert.equal(defaultWorkoutCover('Perder peso', 'female'), 'running-woman');
  assert.equal(defaultWorkoutCover('Emagrecimento', 'male'), 'running-man');
  assert.equal(defaultWorkoutCover('Ganhar massa feminina'), 'muscle-woman');
  assert.equal(defaultWorkoutCover('Hipertrofia', 'male'), 'muscle-man');
  assert.equal(defaultWorkoutCover('Mobilidade e alongamento'), 'mobility');
  assert.equal(defaultWorkoutCover('Minha ficha'), 'wellness');
});

test('MySQL: admin vincula capas, profissionais preservam, cópias herdam e preenchimento é conservador', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({path:new URL('../.env',import.meta.url),quiet:true});
  const database = `fit_covers_test_${process.pid}_${Date.now()}`;
  const connection = { host:process.env.DB_HOST!,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER!,password:process.env.DB_PASS! };
  const adminConnection = await createConnection(connection);
  await adminConnection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = createDatabase({host:connection.host,port:connection.port,username:connection.user,password:connection.password,database});
  try {
    await migrateDatabase(db);
    const repository = new WorkoutRepository(db);
    const app = await buildApp({repository:new SequelizeAuthRepository(db),portalStore:new SequelizePortalStore(db),workoutRepository:repository,jwtSecret:'workout-covers-integration-test-secret-more-than-32'});
    await registerPortalContent(app,new PortalContentService(new ProfessionalManagement(db)),async(req,reply)=>{try{await req.jwtVerify();}catch{return reply.code(401).send({code:'UNAUTHORIZED',message:'Entre na sua conta.'});}});
    try {
      const register = async () => {const result=await app.inject({method:'POST',url:'/auth/register',payload:{email:`${randomUUID()}@example.com`,password:'integration-test-123',phone:'71999990000',firstName:'Teste',lastName:'Capa'}});assert.equal(result.statusCode,201);return result.json();};
      const owner=await register(), admin=await register(), professional=await register();
      const headers={authorization:`Bearer ${owner.accessToken}`}, adminHeaders={authorization:`Bearer ${admin.accessToken}`}, proHeaders={authorization:`Bearer ${professional.accessToken}`};
      await db.query("INSERT INTO portal_accounts (user_id,role,suspended) VALUES (?,'admin',FALSE)",{replacements:[admin.user.id]});
      const typeId=randomUUID();
      await db.query('INSERT INTO professional_types (id,name,capabilities) VALUES (?,?,?)',{replacements:[typeId,'Personal teste',JSON.stringify(['fitness.view','fitness.manage'])]});
      await db.query("INSERT INTO portal_accounts (user_id,role,suspended,type_id,capabilities,activated_at) VALUES (?,'professional',FALSE,?,?,UTC_TIMESTAMP())",{replacements:[professional.user.id,typeId,JSON.stringify(['fitness.view','fitness.manage'])]});
      assert.equal((await app.inject({method:'POST',url:'/portal/content',payload:model('running-woman')})).statusCode,401);
      assert.equal((await app.inject({method:'POST',url:'/portal/content',headers,payload:model('running-woman')})).statusCode,403);
      assert.equal((await app.inject({method:'POST',url:'/portal/content',headers:proHeaders,payload:{...model('running-woman'),scope:'private'}})).statusCode,403);
      assert.equal((await app.inject({method:'POST',url:'/portal/content',headers:adminHeaders,payload:model('https://example.com/image.png')})).statusCode,400);
      const created=await app.inject({method:'POST',url:'/portal/content',headers:adminHeaders,payload:model('running-woman')});
      assert.equal(created.statusCode,201,created.body);
      const id=created.json().id;
      const content=async (head:Record<string,string>,target:string)=>(await app.inject({method:'GET',url:'/portal/content?kind=workout',headers:head})).json().find((row:{id:string})=>row.id===target);
      const read=await content(adminHeaders,id);
      assert.equal(read.data.coverId,'running-woman');
      const update=await app.inject({method:'PUT',url:`/portal/content/${id}`,headers:adminHeaders,payload:{content:model('mobility'),revision:read.revision}});
      assert.equal(update.statusCode,200,update.body);
      const privateModel=await app.inject({method:'POST',url:'/portal/content',headers:proHeaders,payload:{...model(),scope:'private'}});
      assert.equal(privateModel.statusCode,201,privateModel.body);
      const ownId=privateModel.json().id;
      await db.query('UPDATE portal_content SET data=? WHERE id=?',{replacements:[JSON.stringify({...model().data,coverId:'muscle-man'}),ownId]});
      const kept=await app.inject({method:'PUT',url:`/portal/content/${ownId}`,headers:proHeaders,payload:{content:{...model(),scope:'private'},revision:1}});
      assert.equal(kept.statusCode,200,kept.body);
      assert.equal((await content(proHeaders,ownId)).data.coverId,'muscle-man');
      assert.equal((await app.inject({method:'PUT',url:`/portal/content/${ownId}`,headers:proHeaders,payload:{content:{...model('wellness'),scope:'private'},revision:2}})).statusCode,403);

      const catalog=await repository.listSuggestedPlans();assert.ok(catalog.length>0);assert.ok(catalog.every(row=>row.coverId));
      const source=catalog[0];
      await db.query("INSERT INTO portal_content (id,owner_id,kind,scope,name,data,revision,archived,created_at,updated_at) VALUES (?,?,'workout','global',?,?,1,FALSE,UTC_TIMESTAMP(),UTC_TIMESTAMP())",{replacements:[source.id,admin.user.id,source.name,JSON.stringify(model('wellness').data)]});
      assert.equal((await app.inject({method:'PUT',url:`/portal/content/${source.id}`,headers:adminHeaders,payload:{content:{...model('mobility'),name:source.name},revision:1}})).statusCode,200);
      assert.equal((await repository.listSuggestedPlans()).find(row=>row.id===source.id)!.coverId,'mobility');
      const personal = await app.inject({method:'POST',url:'/workout-plans',headers,payload:{name:'Ficha pessoal',divisions,coverId:'running-woman'}});
      assert.equal(personal.statusCode,201,personal.body);
      const personalId=personal.json().id;
      assert.equal((await repository.getPlan(owner.user.id,personalId))!.coverId,'running-woman');
      assert.equal((await app.inject({method:'POST',url:'/workout-plans',payload:{name:'Ficha pessoal',divisions,coverId:'strength'}})).statusCode,401);
      assert.equal((await app.inject({method:'POST',url:'/workout-plans',headers,payload:{name:'Ficha pessoal',divisions,coverId:'invalid'}})).statusCode,400);
      assert.equal((await app.inject({method:'PUT',url:`/workout-plans/${personalId}`,headers:proHeaders,payload:{name:'Outra conta',divisions,coverId:'mobility'}})).statusCode,404);
      assert.equal((await app.inject({method:'PUT',url:`/workout-plans/${personalId}`,headers,payload:{name:'Ficha pessoal',divisions,coverId:'strength'}})).statusCode,200);
      assert.equal((await repository.getPlan(owner.user.id,personalId))!.coverId,'strength');
      assert.equal((await app.inject({method:'PUT',url:`/workout-plans/${personalId}`,headers,payload:{name:'Ficha renomeada',divisions}})).statusCode,200);
      assert.equal((await repository.getPlan(owner.user.id,personalId))!.coverId,'strength');
      assert.equal((await app.inject({method:'POST',url:'/workout-plans',headers,payload:{name:'Ficha pessoal',divisions,coverId:'strength',sourceSuggestionId:randomUUID()}})).statusCode,404);
      const copied=await app.inject({method:'POST',url:'/workout-plans',headers,payload:{name:'Minha cópia',divisions,sourceSuggestionId:source.id}});
      assert.equal(copied.statusCode,201,copied.body);
      const overridden=await app.inject({method:'POST',url:'/workout-plans',headers,payload:{name:'Cópia com minha capa',divisions,sourceSuggestionId:source.id,coverId:'conditioning'}});
      assert.equal(overridden.statusCode,201,overridden.body);
      assert.equal((await repository.getPlan(owner.user.id,overridden.json().id))!.coverId,'conditioning');
      const planId=copied.json().id;
      assert.equal((await repository.getPlan(owner.user.id,planId))!.coverId,'mobility');
      await db.query('UPDATE workout_plans SET cover_id=NULL WHERE id=?',{replacements:[planId]});
      await db.query('UPDATE portal_content SET data=? WHERE id=?',{replacements:[JSON.stringify(model().data),id]});
      const before=(await repository.getPlan(owner.user.id,planId))!.divisions;
      await backfillWorkoutCovers(db.getQueryInterface());
      assert.equal((await repository.getPlan(owner.user.id,planId))!.coverId,'wellness');
      assert.deepEqual((await repository.getPlan(owner.user.id,planId))!.divisions,before);
      assert.equal((await content(proHeaders,ownId)).data.coverId,'muscle-man');
      await backfillWorkoutCovers(db.getQueryInterface());
      const covers=await app.inject({method:'GET',url:'/workout-plan-covers'});assert.equal(covers.json().length,8);
      for(const cover of covers.json()) {
        const asset=await app.inject({method:'GET',url:cover.url});assert.equal(asset.statusCode,200,cover.url);
        const meta=await sharp(asset.rawPayload).metadata();assert.equal(meta.width,640);assert.equal(meta.height,360);
      }
      assert.equal((await app.inject({method:'GET',url:'/assets/plan-covers/unknown.webp'})).statusCode,400);
    } finally {await app.close();}
  } finally {await db.close();await adminConnection.query(`DROP DATABASE \`${database}\``);await adminConnection.end();}
});
