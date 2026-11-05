import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {buildApp} from '../src/app.js';
import {createDatabase} from '../src/database.js';
import {migrateDatabase} from '../src/migrate.js';
import {SequelizeAuthRepository} from '../src/repository.js';
import {GroupRepository} from '../src/group-repository.js';

test('MySQL: badge conta posts visíveis de outros autores, soma grupos e limpa após leitura',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});if(!process.env.DB_NAME?.includes('test'))throw new Error('Use banco de testes.');
  const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!});
  await migrateDatabase(db);const app=await buildApp({repository:new SequelizeAuthRepository(db),groupRepository:new GroupRepository(db),jwtSecret:'group-badge-test-secret-32-characters'});
  const users:string[]=[],groups:string[]=[];
  try{
    const register=async()=>{const res=await app.inject({method:'POST',url:'/auth/register',payload:{email:`badge-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Grupos'}});assert.equal(res.statusCode,201);const account=res.json();users.push(account.user.id);return {user:account.user,headers:{authorization:`Bearer ${account.accessToken}`}};};
    const owner=await register(),viewer=await register(),outsider=await register();
    for(const name of ['Grupo A','Grupo B']){
      const res=await app.inject({method:'POST',url:'/groups',headers:owner.headers,payload:{name}});assert.equal(res.statusCode,201);groups.push(res.json().id);
      assert.equal((await app.inject({method:'POST',url:`/groups/${res.json().id}/invites`,headers:owner.headers,payload:{username:viewer.user.username}})).statusCode,201);
      const invites=(await app.inject({url:'/groups/invites',headers:viewer.headers})).json();
      assert.equal((await app.inject({method:'PATCH',url:`/groups/invites/${invites[0].id}`,headers:viewer.headers,payload:{decision:'accepted'}})).statusCode,204);
      await app.inject({method:'POST',url:`/groups/${res.json().id}/seen`,headers:viewer.headers});
    }
    const count=async(headers=viewer.headers)=>(await app.inject({url:'/groups/dashboard',headers})).json().postsUnseen;
    assert.equal((await app.inject({url:'/groups/dashboard'})).statusCode,401);assert.equal(await count(),0);
    const postIds:string[]=[];
    for(const group of groups){const res=await app.inject({method:'POST',url:`/groups/${group}/posts`,headers:owner.headers,payload:{text:'Nova publicação'}});assert.equal(res.statusCode,201);postIds.push(res.json().id);}
    assert.equal(await count(),2);assert.equal(await count(outsider.headers),0);
    assert.equal((await app.inject({url:`/groups/dashboard?userId=${viewer.user.id}`,headers:outsider.headers})).json().postsUnseen,0);
    await app.inject({method:'POST',url:`/groups/${groups[0]}/posts`,headers:viewer.headers,payload:{text:'Minha publicação'}});assert.equal(await count(),2);
    await app.inject({method:'POST',url:`/groups/${groups[0]}/posts/${postIds[0]}/comments`,headers:owner.headers,payload:{text:'Comentário'}});assert.equal(await count(),2);
    await app.inject({method:'PUT',url:`/users/${owner.user.id}/block`,headers:viewer.headers,payload:{blocked:true}});assert.equal(await count(),0);
    await app.inject({method:'PUT',url:`/users/${owner.user.id}/block`,headers:viewer.headers,payload:{blocked:false}});assert.equal(await count(),2);
    assert.equal((await app.inject({method:'POST',url:`/groups/${groups[0]}/seen`,headers:outsider.headers})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/groups/invalid/seen',headers:viewer.headers})).statusCode,400);
    await app.inject({method:'POST',url:`/groups/${groups[0]}/seen`,headers:viewer.headers});assert.equal(await count(),1);
    await app.inject({method:'POST',url:`/groups/${groups[1]}/seen`,headers:viewer.headers});assert.equal(await count(),0);
    const deleted=await app.inject({method:'POST',url:`/groups/${groups[0]}/posts`,headers:owner.headers,payload:{text:'Post removido'}});assert.equal(await count(),1);
    assert.equal((await app.inject({method:'DELETE',url:`/groups/${groups[0]}/posts/${deleted.json().id}`,headers:owner.headers})).statusCode,204);assert.equal(await count(),0);
  }finally{
    for(const id of groups)await db.query('DELETE FROM `groups` WHERE id=?',{replacements:[id]});
    for(const id of users)await db.query('DELETE FROM users WHERE id=?',{replacements:[id]});
    await app.close();await db.close();
  }
});
