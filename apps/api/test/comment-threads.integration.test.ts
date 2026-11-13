import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {buildApp} from '../src/app.js';
import {createDatabase} from '../src/database.js';
import {migrateDatabase} from '../src/migrate.js';
import {SequelizeAuthRepository} from '../src/repository.js';
import {GroupRepository} from '../src/group-repository.js';

test('MySQL isolado: comentários têm um nível de respostas e reações por pessoa',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 config({path:new URL('../.env',import.meta.url),quiet:true});
 const connection={host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!};
 const bootstrap=createDatabase({...connection,database:process.env.DB_NAME!});
 const name=`fit_comments_test_${randomUUID().replaceAll('-','')}`;
 let db:ReturnType<typeof createDatabase>|undefined;
 let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try {
  await bootstrap.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  db=createDatabase({...connection,database:name});await migrateDatabase(db);
  const repo=new GroupRepository(db);
  app=await buildApp({repository:new SequelizeAuthRepository(db),groupRepository:repo,jwtSecret:'comment-tests-secret-over-32-characters'});
  const accounts=[];
  for(const firstName of ['Ana','Bruno','Carla']) {
   const res:{statusCode:number;json:()=>any}=await app.inject({method:'POST',url:'/auth/register',payload:{email:`comments-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName,lastName:'Teste'}});
   assert.equal(res.statusCode,201);accounts.push(res.json());
  }
  const [owner,member,outsider]=accounts;
  const headers={authorization:`Bearer ${member.accessToken}`};
  const group=await repo.create(owner.user.id,{name:'Conversas'});
  await repo.invite(owner.user.id,group,member.user.username);
  await repo.decideInvite(member.user.id,(await repo.invites(member.user.id))[0].id,'accepted');
  const post=await repo.createPost(owner.user.id,group,{text:'Vamos conversar'});
  const url=`/groups/${group}/posts/${post}/comments`;
  const root=await app.inject({method:'POST',url,headers,payload:{text:'Principal'}});assert.equal(root.statusCode,201);
  const parentCommentId=root.json().id;
  const reply=await app.inject({method:'POST',url,headers,payload:{text:'Resposta',parentCommentId}});assert.equal(reply.statusCode,201);
  assert.equal((await app.inject({method:'POST',url,headers,payload:{text:'Outro nível',parentCommentId:reply.json().id}})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url,headers,payload:{text:'Inválido',parentCommentId:'abc'}})).statusCode,400);
  const otherPost=await repo.createPost(owner.user.id,group,{text:'Outro post'});
  assert.equal((await app.inject({method:'POST',url:`/groups/${group}/posts/${otherPost}/comments`,headers,payload:{text:'Outro post',parentCommentId}})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url,payload:{text:'Sem sessão',parentCommentId}})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url,headers:{authorization:`Bearer ${outsider.accessToken}`},payload:{text:'Sem acesso',parentCommentId}})).statusCode,404);
  for(const id of [parentCommentId,reply.json().id]) {
   const reactionUrl=`/groups/${group}/comments/${id}/reaction`;
   assert.equal((await app.inject({method:'PUT',url:reactionUrl,payload:{reaction:'love'}})).statusCode,401);
   assert.equal((await app.inject({method:'PUT',url:reactionUrl,headers:{authorization:`Bearer ${outsider.accessToken}`},payload:{reaction:'love'}})).statusCode,404);
   assert.equal((await app.inject({method:'PUT',url:reactionUrl,headers,payload:{reaction:'invalid'}})).statusCode,400);
   for(const reaction of ['love','love','fire']) assert.equal((await app.inject({method:'PUT',url:reactionUrl,headers,payload:{reaction}})).statusCode,204);
   let comments:any[]=(await app.inject({url,headers})).json();
   assert.deepEqual(comments.find((c:any)=>c.id===id).reactionCounts,[{reaction:'fire',count:1,reactedByMe:true}]);
   assert.equal(comments.find((c:any)=>c.id===reply.json().id).parentCommentId,parentCommentId);
   assert.equal((await app.inject({method:'PUT',url:reactionUrl,headers,payload:{reaction:null}})).statusCode,204);
   comments=(await app.inject({url,headers})).json();assert.deepEqual(comments.find((c:any)=>c.id===id).reactionCounts,[]);
  }
  await repo.deleteComment(member.user.id,group,parentCommentId);
  const comments=(await app.inject({url,headers})).json();assert.equal(comments.find((c:any)=>c.id===parentCommentId).removed,true);assert.equal(comments.find((c:any)=>c.id===reply.json().id).text,'Resposta');
  assert.equal((await app.inject({method:'POST',url,headers,payload:{text:'Removido',parentCommentId}})).statusCode,404);
  assert.equal((await app.inject({method:'PUT',url:`/groups/${group}/comments/${parentCommentId}/reaction`,headers,payload:{reaction:'love'}})).statusCode,404);
  await repo.updatePost(owner.user.id,group,String(post),{text:'Fechado',commentsEnabled:false});
  assert.equal((await app.inject({method:'POST',url,headers,payload:{text:'Fechado'}})).statusCode,409);
 }finally{await app?.close();await db?.close();await bootstrap.query(`DROP DATABASE IF EXISTS \`${name}\``);await bootstrap.close();}
});
