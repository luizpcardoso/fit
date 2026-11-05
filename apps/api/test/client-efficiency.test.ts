import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../../../packages/api-client/src/index.js';
test('deduplicates reads, caches briefly and invalidates after mutation',async()=>{
 const original=globalThis.fetch;let reads=0;
 globalThis.fetch=async(_url,init)=>{if(!init?.body)assert.equal((init?.headers as Record<string,string>)['content-type'],undefined);if(init?.method==='POST')return Response.json({id:'post'});reads++;await new Promise(r=>setTimeout(r,5));return Response.json([{id:'group',avatarUrl:'/media/avatars/example.webp'}]);};
 try{const client=createApiClient({baseUrl:'http://test'});const changes:string[]=[];client.subscribeToChanges(path=>{changes.push(path);});const [a,b]=await Promise.all([client.listGroups(),client.listGroups()]);assert.equal(reads,1);assert.equal(a[0].avatarUrl,'http://test/media/avatars/example.webp');assert.deepEqual(a,b);await client.listGroups();assert.equal(reads,1);await client.createGroup({name:'Test'});await client.listGroups();assert.equal(reads,2);assert.deepEqual(changes,['/groups']);}finally{globalThis.fetch=original;}
});

test('successful writes invalidate reads started while the write was in flight',async()=>{
 const original=globalThis.fetch;
 let finishWrite!:()=>void,finishOldRead!:()=>void;
 let writing=false,committed=false;
 globalThis.fetch=async(_url,init)=>{
  if(init?.method==='POST'){writing=true;await new Promise<void>(resolve=>{finishWrite=resolve});committed=true;return Response.json({id:'created'});}
  if(writing&&!committed){await new Promise<void>(resolve=>{finishOldRead=resolve});return Response.json([{id:'old'}]);}
  return Response.json([{id:'fresh'}]);
 };
 try{
  const client=createApiClient({baseUrl:'http://test'});
  const write=client.createGroup({name:'Test'});
  await new Promise(resolve=>setImmediate(resolve));
  const oldRead=client.listGroups();
  await new Promise(resolve=>setImmediate(resolve));
  finishWrite();await write;
  assert.equal((await client.listGroups())[0].id,'fresh');
  finishOldRead();await oldRead;
  assert.equal((await client.listGroups())[0].id,'fresh');
 }finally{globalThis.fetch=original;}
});
