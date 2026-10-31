import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../../../packages/api-client/src/index.js';
test('deduplicates reads, caches briefly and invalidates after mutation',async()=>{
 const original=globalThis.fetch;let reads=0;
 globalThis.fetch=async(_url,init)=>{if(!init?.body)assert.equal((init?.headers as Record<string,string>)['content-type'],undefined);if(init?.method==='POST')return Response.json({id:'post'});reads++;await new Promise(r=>setTimeout(r,5));return Response.json([{id:'group',avatarUrl:'/media/avatars/example.webp'}]);};
 try{const client=createApiClient({baseUrl:'http://test'});const [a,b]=await Promise.all([client.listGroups(),client.listGroups()]);assert.equal(reads,1);assert.equal(a[0].avatarUrl,'http://test/media/avatars/example.webp');assert.deepEqual(a,b);await client.listGroups();assert.equal(reads,1);await client.createGroup({name:'Test'});await client.listGroups();assert.equal(reads,2);}finally{globalThis.fetch=original;}
});
