import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

test('mídia: chave ausente responde 404 sem cache; existente responde WebP imutável',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fit-media-'));
 process.env.MEDIA_DIR=dir;
 // media-storage resolves MEDIA_DIR on import, so load the app only after setting it.
 const {buildApp}=await import('../src/app.js');
 const {registerPortalContent}=await import('../src/portal-content.js');
 const app=await buildApp({jwtSecret:'media-test-secret-more-than-32-characters'});
 try{
  await registerPortalContent(app,{db:{query:async()=>[]}} as never,async()=>undefined);
  const key=`${randomUUID()}.webp`;
  for(const url of [`/media/exercises/${key}`,`/media/avatars/${key}`]){
   const missing=await app.inject({method:'GET',url});
   assert.equal(missing.statusCode,404,url);
   assert.equal(missing.headers['cache-control'],'no-store');
   assert.match(String(missing.headers['content-type']),/^application\/json/);
   assert.equal(missing.json().code,'NOT_FOUND');
  }
  await writeFile(join(dir,key),Buffer.from('webp'));
  for(const url of [`/media/exercises/${key}`,`/media/avatars/${key}`]){
   const found=await app.inject({method:'GET',url});
   assert.equal(found.statusCode,200,url);
   assert.equal(found.headers['content-type'],'image/webp');
   assert.equal(found.headers['cache-control'],'public, max-age=86400, immutable');
   assert.equal(found.body,'webp');
  }
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('mídia: chave de imagem de grupo ou foto de post não é servida pelas rotas públicas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fit-media-'));
 process.env.MEDIA_DIR=dir;
 const {buildApp}=await import('../src/app.js');
 const {registerPortalContent}=await import('../src/portal-content.js');
 const app=await buildApp({jwtSecret:'media-test-secret-more-than-32-characters',groupRepository:{isPrivateMedia:async()=>true} as never});
 try{
  await registerPortalContent(app,{db:{query:async()=>[{1:1}]}} as never,async()=>undefined);
  const key=`${randomUUID()}.webp`;
  await writeFile(join(dir,key),Buffer.from('webp'));
  for(const url of [`/media/exercises/${key}`,`/media/avatars/${key}`]){
   const response=await app.inject({method:'GET',url});
   assert.equal(response.statusCode,404,url);
   assert.equal(response.headers['cache-control'],'no-store');
  }
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
