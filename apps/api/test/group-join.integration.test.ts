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

test('MySQL isolado: entrada por código exige aprovação e os números da conquista exigem as duas permissões',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 config({path:new URL('../.env',import.meta.url),quiet:true});
 const connection={host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!};
 const bootstrap=createDatabase({...connection,database:process.env.DB_NAME!});
 const name=`fit_group_join_test_${randomUUID().replaceAll('-','')}`;
 let db:ReturnType<typeof createDatabase>|undefined;
 let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try {
  await bootstrap.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  db=createDatabase({...connection,database:name});await migrateDatabase(db);
  const repo=new GroupRepository(db);
  app=await buildApp({repository:new SequelizeAuthRepository(db),groupRepository:repo,jwtSecret:'group-join-tests-secret-over-32-chars'});
  const accounts:any[]=[];
  for(const firstName of ['Ana','Bruno','Carla','Davi']) {
   const res:{statusCode:number;json:()=>any}=await app.inject({method:'POST',url:'/auth/register',payload:{email:`join-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName,lastName:'Teste'}});
   assert.equal(res.statusCode,201);accounts.push(res.json());
  }
  const [owner,member,visitor,other]=accounts;
  const auth=(account:any)=>({authorization:`Bearer ${account.accessToken}`});
  const group=await repo.create(owner.user.id,{name:'Código'});
  await repo.invite(owner.user.id,group,member.user.username);
  await repo.decideInvite(member.user.id,(await repo.invites(member.user.id))[0].id,'accepted');
  const linkUrl=`/groups/${group}/invite-link`;

  // Só a administração cria, consulta e revoga o código.
  assert.equal((await app.inject({method:'POST',url:linkUrl})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:linkUrl,headers:auth(member)})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:linkUrl,headers:auth(visitor)})).statusCode,404);
  assert.deepEqual((await app.inject({url:linkUrl,headers:auth(owner)})).json(),{active:false,expiresAt:null});
  const first=(await app.inject({method:'POST',url:linkUrl,headers:auth(owner)}));assert.equal(first.statusCode,201);
  const code=first.json().code;assert.match(code,/^[A-HJ-NP-Z2-9]{10}$/);
  const [stored]=await db.query<any>('SELECT code_hash FROM group_invite_links WHERE group_id=?',{replacements:[group],type:QueryTypes.SELECT});
  assert.notEqual(stored.code_hash,code);assert.equal(stored.code_hash.length,64);
  assert.equal((await app.inject({url:linkUrl,headers:auth(owner)})).json().code,undefined);

  // Quem tem o código vê apenas nome e tamanho do grupo, e pede para entrar.
  const joinUrl=`/groups/join/${code}`;
  assert.equal((await app.inject({url:joinUrl})).statusCode,401);
  assert.equal((await app.inject({url:'/groups/join/abc',headers:auth(visitor)})).statusCode,400);
  assert.equal((await app.inject({url:'/groups/join/ZZZZZZZZZZ',headers:auth(visitor)})).statusCode,404);
  assert.deepEqual((await app.inject({url:joinUrl,headers:auth(visitor)})).json(),{group:{name:'Código',memberCount:2},status:'available'});
  assert.equal((await app.inject({url:`/groups/join/${code.toLowerCase()}`,headers:auth(visitor)})).statusCode,200);
  assert.equal((await app.inject({url:joinUrl,headers:auth(member)})).json().status,'member');
  assert.equal((await app.inject({method:'POST',url:joinUrl,headers:auth(member)})).statusCode,409);
  assert.equal((await app.inject({method:'POST',url:joinUrl,headers:auth(visitor)})).statusCode,201);
  assert.equal((await app.inject({method:'POST',url:joinUrl,headers:auth(visitor)})).statusCode,409);
  assert.equal((await app.inject({url:joinUrl,headers:auth(visitor)})).json().status,'pending');
  // Pedir não dá acesso: o feed continua fechado até a aprovação.
  assert.equal((await app.inject({url:`/groups/${group}/posts`,headers:auth(visitor)})).statusCode,404);
  assert.ok((await repo.notifications(owner.user.id)).some(item=>item.type==='join_request'&&item.title==='Pedido para entrar'));

  const requestsUrl=`/groups/${group}/join-requests`;
  assert.equal((await app.inject({url:requestsUrl,headers:auth(member)})).statusCode,403);
  assert.equal((await app.inject({url:requestsUrl,headers:auth(visitor)})).statusCode,404);
  const requests=(await app.inject({url:requestsUrl,headers:auth(owner)})).json();
  assert.equal(requests.length,1);assert.equal(requests[0].user.id,visitor.user.id);
  assert.deepEqual(Object.keys(requests[0].user).sort(),['avatarUrl','displayName','id','username']);
  const decide=(account:any,id:string,decision:string)=>app!.inject({method:'PATCH',url:`${requestsUrl}/${id}`,headers:auth(account),payload:{decision}});
  assert.equal((await decide(member,requests[0].id,'approved')).statusCode,403);
  assert.equal((await decide(visitor,requests[0].id,'approved')).statusCode,404);
  assert.equal((await decide(owner,requests[0].id,'talvez')).statusCode,400);
  assert.equal((await decide(owner,randomUUID(),'approved')).statusCode,404);
  assert.equal((await decide(owner,requests[0].id,'approved')).statusCode,204);
  assert.equal((await decide(owner,requests[0].id,'declined')).statusCode,409);
  assert.equal((await app.inject({url:`/groups/${group}/posts`,headers:auth(visitor)})).statusCode,200);
  assert.ok((await repo.notifications(visitor.user.id)).some(item=>item.title==='Pedido aprovado'));

  // Recusa não dá acesso; código novo invalida o anterior; revogar encerra o código.
  assert.equal((await app.inject({method:'POST',url:joinUrl,headers:auth(other)})).statusCode,201);
  const [pending]=(await app.inject({url:requestsUrl,headers:auth(owner)})).json();
  assert.equal((await decide(owner,pending.id,'declined')).statusCode,204);
  assert.equal((await app.inject({url:`/groups/${group}/posts`,headers:auth(other)})).statusCode,404);
  const second=(await app.inject({method:'POST',url:linkUrl,headers:auth(owner)})).json().code;
  assert.equal((await app.inject({url:joinUrl,headers:auth(other)})).statusCode,404);
  assert.equal((await app.inject({url:`/groups/join/${second}`,headers:auth(other)})).statusCode,200);
  assert.equal((await app.inject({method:'DELETE',url:linkUrl,headers:auth(member)})).statusCode,403);
  assert.equal((await app.inject({method:'DELETE',url:linkUrl,headers:auth(owner)})).statusCode,204);
  assert.equal((await app.inject({url:`/groups/join/${second}`,headers:auth(other)})).statusCode,404);
  // Código vencido não serve.
  const third=(await app.inject({method:'POST',url:linkUrl,headers:auth(owner)})).json().code;
  await db.query('UPDATE group_invite_links SET expires_at=UTC_TIMESTAMP(6)-INTERVAL 1 MINUTE WHERE group_id=? AND revoked_at IS NULL',{replacements:[group],type:QueryTypes.UPDATE});
  assert.equal((await app.inject({method:'POST',url:`/groups/join/${third}`,headers:auth(other)})).statusCode,404);

  // Números da conquista: precisam do grupo E da pessoa; cargas e nomes nunca entram.
  await repo.updateEvents(owner.user.id,group,{workout_completed:true,cardio_completed:false,weekly_goal:false,weekly_streak:false,member_joined:true});
  const session=async()=>{const id=randomUUID();await db!.query("INSERT INTO workout_sessions (id,user_id,plan_name,division_name,division_label,performed_on,status,completion_mode,completed_exercise_ids,created_at,updated_at) VALUES (?,?,'Ficha','Treino','A',CURDATE(),'completed','detailed',?,NOW(),NOW())",{replacements:[id,member.user.id,JSON.stringify([randomUUID(),randomUUID()])],type:QueryTypes.INSERT});return id;};
  const statsOf=async(sourceId:string)=>{const feed=(await app!.inject({url:`/groups/${group}/posts`,headers:auth(owner)})).json();const [row]=await db!.query<any>('SELECT id FROM group_posts WHERE source_id=?',{replacements:[sourceId],type:QueryTypes.SELECT});return feed.items.find((item:any)=>item.id===row.id).activityStats;};
  const share=async()=>{const id=await session();assert.equal(typeof await repo.shareActivity(member.user.id,[group],'workout_completed','workout_session',id),'number');return statsOf(id);};
  const participation=`/groups/${group}/participation`;
  assert.equal(await share(),null);
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(member),payload:{shareActivityStats:true}})).statusCode,204);
  assert.equal(await share(),null); // o grupo ainda não permite
  assert.equal((await app.inject({method:'PATCH',url:`/groups/${group}`,headers:auth(member),payload:{allowActivityStats:true}})).statusCode,403);
  assert.equal((await app.inject({method:'PATCH',url:`/groups/${group}`,headers:auth(owner),payload:{allowActivityStats:true}})).statusCode,204);
  assert.deepEqual(await share(),{durationMinutes:null,exercises:2,sets:null});
  const details=(await app.inject({url:`/groups/${group}`,headers:auth(member)})).json();
  assert.equal(details.allowActivityStats,true);assert.deepEqual(details.participation,{showInRanking:false,shareActivityStats:true});
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(member),payload:{}})).statusCode,400);
  assert.equal((await app.inject({method:'PUT',url:participation,headers:auth(member),payload:{shareActivityStats:false}})).statusCode,204);
  assert.equal(await share(),null);
 } finally {
  await app?.close();await db?.close();
  await bootstrap.query(`DROP DATABASE IF EXISTS \`${name}\``);await bootstrap.close();
 }
});
