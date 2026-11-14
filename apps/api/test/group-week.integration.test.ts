import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {QueryTypes} from 'sequelize';
import {buildApp} from '../src/app.js';
import {createDatabase} from '../src/database.js';
import {migrateDatabase} from '../src/migrate.js';
import {SequelizeAuthRepository} from '../src/repository.js';
import {GroupRepository} from '../src/group-repository.js';

test('MySQL isolado: semana do grupo mostra só o que foi compartilhado e o placar só de quem aderiu',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 config({path:new URL('../.env',import.meta.url),quiet:true});
 const connection={host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!};
 const bootstrap=createDatabase({...connection,database:process.env.DB_NAME!});
 const name=`fit_group_week_test_${randomUUID().replaceAll('-','')}`;
 let db:ReturnType<typeof createDatabase>|undefined;
 let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try {
  await bootstrap.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  db=createDatabase({...connection,database:name});await migrateDatabase(db);
  const repo=new GroupRepository(db);
  app=await buildApp({repository:new SequelizeAuthRepository(db),groupRepository:repo,jwtSecret:'group-week-tests-secret-over-32-chars'});
  const accounts:any[]=[];
  for(const firstName of ['Ana','Bruno','Carla','Davi']) {
   const res:{statusCode:number;json:()=>any}=await app.inject({method:'POST',url:'/auth/register',payload:{email:`week-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName,lastName:'Teste'}});
   assert.equal(res.statusCode,201);accounts.push(res.json());
  }
  const [owner,bruno,carla,outsider]=accounts;
  const auth=(account:any)=>({authorization:`Bearer ${account.accessToken}`});
  const group=await repo.create(owner.user.id,{name:'Semana'});
  for(const account of [bruno,carla]){await repo.invite(owner.user.id,group,account.user.username);await repo.decideInvite(account.user.id,(await repo.invites(account.user.id))[0].id,'accepted');}
  // Quarta-feira 11/11/2026: a semana vai de segunda 09/11 a domingo 15/11.
  const date='2026-11-11',url=`/groups/${group}/week?date=${date}`;
  const session=(userId:string,performedOn:string,status='completed')=>db!.query("INSERT INTO workout_sessions (id,user_id,plan_name,division_name,division_label,performed_on,status,completion_mode,completed_exercise_ids,created_at,updated_at) VALUES (?,?,'Ficha','Treino','A',?,?,'quick','[]',NOW(),NOW())",{replacements:[randomUUID(),userId,performedOn,status],type:QueryTypes.INSERT});
  for(const day of ['2026-11-09','2026-11-10','2026-11-15'])await session(bruno.user.id,day);
  await session(bruno.user.id,'2026-11-08');            // semana anterior
  await session(bruno.user.id,'2026-11-12','cancelled'); // não realizado
  await session(carla.user.id,'2026-11-11');             // Carla não aderiu ao placar
  await session(owner.user.id,'2026-11-10');

  assert.equal((await app.inject({url})).statusCode,401);
  assert.equal((await app.inject({url,headers:auth(outsider)})).statusCode,404);
  assert.equal((await app.inject({url:`/groups/${group}/week?date=11/11/2026`,headers:auth(bruno)})).statusCode,400);
  assert.equal((await app.inject({url:`/groups/${group}/week`,headers:auth(bruno)})).statusCode,400);

  // Sem adesão, ninguém aparece, mesmo tendo treinado.
  let week=(await app.inject({url,headers:auth(bruno)})).json();
  assert.deepEqual({weekStart:week.weekStart,weekEnd:week.weekEnd,ranking:week.ranking,participating:week.participating},{weekStart:'2026-11-09',weekEnd:'2026-11-15',ranking:[],participating:false});

  const participation=`/groups/${group}/participation`;
  assert.equal((await app.inject({method:'PUT',url:participation,payload:{showInRanking:true}})).statusCode,401);
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(outsider),payload:{showInRanking:true}})).statusCode,404);
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(bruno),payload:{showInRanking:'sim'}})).statusCode,400);
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(bruno),payload:{showInRanking:true,userId:carla.user.id}})).statusCode,400);
  for(const account of [bruno,owner])assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(account),payload:{showInRanking:true}})).statusCode,204);

  week=(await app.inject({url,headers:auth(carla)})).json();
  assert.deepEqual(week.ranking.map((item:any)=>[item.user.displayName,item.workouts]),[['Bruno Teste',3],['Ana Teste',1]]);
  assert.equal(week.participating,false);
  assert.deepEqual(Object.keys(week.ranking[0]).sort(),['user','workouts']);
  assert.deepEqual(Object.keys(week.ranking[0].user).sort(),['avatarUrl','displayName','id','username']);
  assert.equal((await app.inject({url,headers:auth(bruno)})).json().participating,true);
  // Aderir ao placar não altera as preferências de compartilhamento automático.
  assert.deepEqual((await repo.get(bruno.user.id,group))!.sharePreferences,{workout_completed:false,cardio_completed:false,weekly_goal:false,weekly_streak:false});

  // Quem o leitor ocultou some do placar dele; sair do placar retira a pessoa.
  await repo.setBlock(carla.user.id,bruno.user.id,true);
  assert.deepEqual((await app.inject({url,headers:auth(carla)})).json().ranking.map((item:any)=>item.user.displayName),['Ana Teste']);
  await repo.setBlock(carla.user.id,bruno.user.id,false);
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(bruno),payload:{showInRanking:false}})).statusCode,204);
  assert.deepEqual((await app.inject({url,headers:auth(carla)})).json().ranking.map((item:any)=>item.user.displayName),['Ana Teste']);

  // Atividades compartilhadas contam publicações de conquista do grupo na semana.
  await db.query("INSERT INTO group_posts (id,group_id,author_user_id,kind,event_type,text,comments_enabled,created_at,updated_at) VALUES (?,?,?,'event','workout_completed','Treino concluído',1,'2026-11-10 12:00:00','2026-11-10 12:00:00'),(?,?,?,'event','cardio_completed','Cardio concluído',1,'2026-11-11 12:00:00','2026-11-11 12:00:00'),(?,?,?,'event','workout_completed','Antigo',1,'2026-11-02 12:00:00','2026-11-02 12:00:00')",{replacements:[randomUUID(),group,bruno.user.id,randomUUID(),group,bruno.user.id,randomUUID(),group,bruno.user.id],type:QueryTypes.INSERT});
  await db.query("UPDATE group_members SET joined_at='2026-11-01 00:00:00' WHERE group_id=?",{replacements:[group],type:QueryTypes.UPDATE});
  week=(await app.inject({url,headers:auth(carla)})).json();
  assert.equal(week.sharedActivities,2);assert.equal(week.activePeople,1);
 } finally {
  await app?.close();await db?.close();
  await bootstrap.query(`DROP DATABASE IF EXISTS \`${name}\``);await bootstrap.close();
 }
});
