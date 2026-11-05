import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {buildApp} from '../src/app.js';
import {createDatabase} from '../src/database.js';
import {migrateDatabase} from '../src/migrate.js';
import {SequelizeAuthRepository} from '../src/repository.js';
import {GroupRepository} from '../src/group-repository.js';

test('MySQL isolado: Social agrega grupos, pagina empates e preserva entrada, bloqueio e revogação',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 config({path:new URL('../.env',import.meta.url),quiet:true});
 const connection={host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!};
 const bootstrap=createDatabase({...connection,database:process.env.DB_NAME!});
 const name=`fit_social_test_${randomUUID().replaceAll('-','')}`;
 let db:ReturnType<typeof createDatabase>|undefined;
 let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try {
  await bootstrap.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  db=createDatabase({...connection,database:name}); await migrateDatabase(db);
  const repo=new GroupRepository(db);
  app=await buildApp({repository:new SequelizeAuthRepository(db),groupRepository:repo,jwtSecret:'social-feed-tests-secret-over-32-characters'});
  const accounts=[];
  for(const firstName of ['Ana','Bruno','Carla']) {const res:{statusCode:number;json:()=>any}=await app.inject({method:'POST',url:'/auth/register',payload:{email:`social-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName,lastName:'Teste'}});assert.equal(res.statusCode,201);accounts.push(res.json());}
  const [owner,viewer,outsider]=accounts; const headers={authorization:`Bearer ${viewer.accessToken}`};
  const a=await repo.create(owner.user.id,{name:'Amigos'}), b=await repo.create(owner.user.id,{name:'Academia'});
  const secret=await repo.create(outsider.user.id,{name:'Privado de terceiros'});
  for(const group of [a,b]){await repo.invite(owner.user.id,group,viewer.user.username);const invites=await repo.invites(viewer.user.id);await repo.decideInvite(viewer.user.id,invites[0].id,'accepted');}
  await db.query("DELETE FROM group_posts WHERE kind='event'");
  const ids:string[]=[];
  for(let i=0;i<35;i++){const id=randomUUID();ids.push(id);await db.query("INSERT INTO group_posts (id,group_id,author_user_id,kind,text,comments_enabled,created_at,updated_at) VALUES (?,?,?,'manual',?,1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 SECOND),UTC_TIMESTAMP(6))",{replacements:[id,i%2?a:b,owner.user.id,`Publicação ${i}`]});}
  // Exact timestamp ties exercise the ID tiebreaker across group boundaries.
  await db.query('UPDATE group_posts SET created_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id IN (?)',{replacements:[ids]});
  const secretPost=await repo.createPost(outsider.user.id,secret,{text:'Segredo'});
  assert.equal(await repo.markSeen(viewer.user.id,a,String(secretPost)),false);
  assert.equal(await repo.markSeen(outsider.user.id,a,ids[1]),false);
  assert.equal(await repo.markSeen(viewer.user.id,a,ids[1]),true);
  assert.equal((await app.inject({url:'/social/feed'})).statusCode,401);
  assert.equal((await app.inject({url:'/social/feed?before=inválido',headers})).statusCode,400);
  assert.equal((await app.inject({url:`/social/feed?userId=${owner.user.id}`,headers})).statusCode,400);
  const first=await app.inject({url:'/social/feed',headers});assert.equal(first.statusCode,200);
  const page=first.json();assert.equal(page.items.length,30);assert.ok(page.nextCursor);
  assert.deepEqual(new Set(page.items.map((p:any)=>p.group.name)),new Set(['Amigos','Academia']));
  assert.ok(page.items.every((p:any)=>p.group.id===p.groupId&&p.group.role==='member'));
  const rest=(await app.inject({url:`/social/feed?before=${encodeURIComponent(page.nextCursor)}`,headers})).json();
  assert.equal(rest.items.length,5);assert.equal(rest.nextCursor,null);assert.equal(new Set([...page.items,...rest.items].map(p=>p.id)).size,35);
  await db.query("UPDATE group_members SET joined_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 5 SECOND) WHERE user_id=? AND group_id=?",{replacements:[viewer.user.id,a]});
  assert.ok((await repo.listPosts(viewer.user.id,undefined))!.items.every(p=>p.groupId===b));
  await repo.setBlock(viewer.user.id,owner.user.id,true);assert.equal((await repo.listPosts(viewer.user.id,undefined))!.items.length,0);
  await repo.setBlock(viewer.user.id,owner.user.id,false);
  await db.query('UPDATE `groups` SET active=0 WHERE id=?',{replacements:[b]});
  assert.equal((await repo.listPosts(viewer.user.id,undefined))!.items.length,0);
  await db.query('UPDATE `groups` SET active=1 WHERE id=?',{replacements:[b]});
  await db.query("UPDATE group_members SET status='left' WHERE user_id=? AND group_id=?",{replacements:[viewer.user.id,b]});
  assert.equal((await repo.listPosts(viewer.user.id,undefined))!.items.length,0);
  assert.equal((await app.inject({url:'/social/feed',headers:{authorization:`Bearer ${outsider.accessToken}`}})).json().items.some((p:any)=>p.groupId===a),false);
 }finally{await app?.close();await db?.close();await bootstrap.query(`DROP DATABASE IF EXISTS \`${name}\``);await bootstrap.close();}
});
