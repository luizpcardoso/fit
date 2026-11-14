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

test('MySQL isolado: quem reagiu é visível só a membros e a reação gera uma notificação agrupada',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 config({path:new URL('../.env',import.meta.url),quiet:true});
 const connection={host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!};
 const bootstrap=createDatabase({...connection,database:process.env.DB_NAME!});
 const name=`fit_reactions_test_${randomUUID().replaceAll('-','')}`;
 let db:ReturnType<typeof createDatabase>|undefined;
 let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try {
  await bootstrap.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  db=createDatabase({...connection,database:name});await migrateDatabase(db);
  const repo=new GroupRepository(db);
  app=await buildApp({repository:new SequelizeAuthRepository(db),groupRepository:repo,jwtSecret:'reaction-tests-secret-over-32-characters'});
  const accounts:any[]=[];
  for(const firstName of ['Ana','Bruno','Carla','Davi','Eva']) {
   const res:{statusCode:number;json:()=>any}=await app.inject({method:'POST',url:'/auth/register',payload:{email:`reactions-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName,lastName:'Teste'}});
   assert.equal(res.statusCode,201);accounts.push(res.json());
  }
  const [owner,bruno,carla,outsider,late]=accounts;
  const auth=(account:any)=>({authorization:`Bearer ${account.accessToken}`});
  const group=await repo.create(owner.user.id,{name:'Reações'});
  const join=async(account:any)=>{await repo.invite(owner.user.id,group,account.user.username);await repo.decideInvite(account.user.id,(await repo.invites(account.user.id))[0].id,'accepted');};
  await join(bruno);await join(carla);
  const post=String(await repo.createPost(owner.user.id,group,{text:'Treino feito'}));
  const reactionUrl=`/groups/${group}/posts/${post}/reaction`,listUrl=`/groups/${group}/posts/${post}/reactions`;
  const react=async(account:any,reaction:string|null)=>assert.equal((await app!.inject({method:'PUT',url:reactionUrl,headers:auth(account),payload:{reaction}})).statusCode,204);
  const reactionNotes=async()=>(await repo.notifications(owner.user.id)).filter(item=>item.type==='reaction');

  // Acesso à lista: sem sessão, fora do grupo, parâmetro inválido e quem entrou depois da publicação.
  assert.equal((await app.inject({url:listUrl})).statusCode,401);
  assert.equal((await app.inject({url:listUrl,headers:auth(outsider)})).statusCode,404);
  assert.equal((await app.inject({url:`/groups/${group}/posts/abc/reactions`,headers:auth(bruno)})).statusCode,400);
  assert.deepEqual((await app.inject({url:listUrl,headers:auth(bruno)})).json(),[]);

  // A própria reação não avisa o autor.
  await react(owner,'like');
  assert.equal((await reactionNotes()).length,0);

  await react(bruno,'strength');
  let notes=await reactionNotes();
  assert.equal(notes.length,1);assert.equal(notes[0].postId,post);assert.equal(notes[0].groupId,group);
  assert.match(notes[0].message,/^Bruno Teste reagiu à sua publicação\.$/);

  // Trocar o emoji não gera nem altera aviso; outra pessoa atualiza o mesmo aviso ainda não lido.
  await react(bruno,'fire');
  assert.equal((await reactionNotes()).length,1);
  await react(carla,'love');
  notes=await reactionNotes();
  assert.equal(notes.length,1);assert.match(notes[0].message,/^Carla Teste e mais 1 pessoa reagiram à sua publicação\.$/);

  const list=(await app.inject({url:listUrl,headers:auth(bruno)})).json();
  assert.deepEqual(list.map((item:any)=>[item.user.displayName,item.reaction]).sort(),[['Ana Teste','like'],['Bruno Teste','fire'],['Carla Teste','love']]);
  assert.deepEqual(Object.keys(list[0]).sort(),['reactedAt','reaction','user']);
  assert.deepEqual(Object.keys(list[0].user).sort(),['avatarUrl','displayName','id','username']);

  // Depois de lido, tirar e recolocar a reação dentro de uma hora não cria outro aviso.
  assert.equal(await repo.readNotification(owner.user.id,notes[0].id),true);
  await react(bruno,null);await react(bruno,'like');
  notes=await reactionNotes();assert.equal(notes.length,1);assert.ok(notes[0].readAt);
  // Passada uma hora, uma nova reação volta a avisar.
  await db.query("UPDATE group_notifications SET created_at=created_at-INTERVAL 2 HOUR WHERE id=?",{replacements:[notes[0].id],type:QueryTypes.UPDATE});
  await react(carla,null);await react(carla,'applause');
  assert.equal((await reactionNotes()).length,2);

  // Quem o leitor ocultou some da lista dele; quem o autor ocultou não gera aviso.
  await repo.setBlock(bruno.user.id,carla.user.id,true);
  assert.ok(!(await app.inject({url:listUrl,headers:auth(bruno)})).json().some((item:any)=>item.user.id===carla.user.id));
  const second=String(await repo.createPost(owner.user.id,group,{text:'Outro treino'}));
  await repo.setBlock(owner.user.id,bruno.user.id,true);
  assert.equal((await app.inject({method:'PUT',url:`/groups/${group}/posts/${second}/reaction`,headers:auth(bruno),payload:{reaction:'like'}})).statusCode,204);
  assert.ok(!(await reactionNotes()).some(item=>item.postId===second));

  // Quem entra depois não lê a publicação antiga nem suas reações.
  await join(late);
  assert.equal((await app.inject({url:listUrl,headers:auth(late)})).statusCode,404);
  // Publicação removida deixa de expor a lista.
  await repo.deletePost(owner.user.id,group,post);
  assert.equal((await app.inject({url:listUrl,headers:auth(bruno)})).statusCode,404);
 } finally {
  await app?.close();await db?.close();
  await bootstrap.query(`DROP DATABASE IF EXISTS \`${name}\``);await bootstrap.close();
 }
});
