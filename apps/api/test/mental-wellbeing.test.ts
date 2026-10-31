import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { MentalCheckIn, MentalCheckInInput } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { MentalWellbeingStore } from '../src/mental-wellbeing-repository.js';

class MemoryMentalWellbeingStore implements MentalWellbeingStore {
  private items=new Map<string,MentalCheckIn&{userId:string}>();
  async list(userId:string,from:string,to:string){return[...this.items.values()].filter(item=>item.userId===userId&&item.date>=from&&item.date<=to).map(({userId:_,...item})=>item)}
  async create(userId:string,input:MentalCheckInInput){
    const existing=[...this.items.values()].find(item=>item.userId===userId&&item.date===input.date);const id=existing?.id??randomUUID();const now=new Date().toISOString();
    const item={...input,note:input.note??null,id,createdAt:existing?.createdAt??now,updatedAt:now};this.items.set(id,{...item,userId});return item;
  }
  async update(userId:string,id:string,input:MentalCheckInInput){const current=this.items.get(id);if(!current||current.userId!==userId)return null;const item={...input,note:input.note??null,id,createdAt:current.createdAt,updatedAt:new Date().toISOString()};this.items.set(id,{...item,userId});return item}
  async delete(userId:string,id:string){const current=this.items.get(id);if(!current||current.userId!==userId)return false;return this.items.delete(id)}
}

const account=async(app:Awaited<ReturnType<typeof buildApp>>,label:string)=>{
  const response=await app.inject({method:'POST',url:'/auth/register',payload:{email:`mind-${label}-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Mente'}});
  assert.equal(response.statusCode,201);return response.json() as {accessToken:string};
};
const payload:MentalCheckInInput={date:'2026-10-28',time:'20:30',mood:'good',emotions:['calm','grateful'],factors:['training'],note:'O treino ajudou a desacelerar.'};

test('check-ins mentais são autenticados, validados e privados por usuário',async()=>{
  const app=await buildApp({mentalWellbeingRepository:new MemoryMentalWellbeingStore(),jwtSecret:'mental-test-secret-with-32-characters'});
  try{
    const owner=await account(app,'owner');const other=await account(app,'other');const ownerHeaders={authorization:`Bearer ${owner.accessToken}`};const otherHeaders={authorization:`Bearer ${other.accessToken}`};
    assert.equal((await app.inject({method:'GET',url:'/mental-check-ins?from=2026-10-01&to=2026-10-31'})).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/mental-check-ins',headers:ownerHeaders,payload:{...payload,mood:'diagnosis'}})).statusCode,400);
    const created=await app.inject({method:'POST',url:'/mental-check-ins',headers:ownerHeaders,payload});assert.equal(created.statusCode,201);const item=created.json() as MentalCheckIn;
    assert.equal((await app.inject({method:'GET',url:'/mental-check-ins?from=2026-10-01&to=2026-10-31',headers:ownerHeaders})).json().length,1);
    assert.equal((await app.inject({method:'GET',url:'/mental-check-ins?from=2026-10-01&to=2026-10-31',headers:otherHeaders})).json().length,0);
    assert.equal((await app.inject({method:'PUT',url:`/mental-check-ins/${item.id}`,headers:otherHeaders,payload:{...payload,mood:'low'}})).statusCode,404);
    assert.equal((await app.inject({method:'DELETE',url:`/mental-check-ins/${item.id}`,headers:otherHeaders})).statusCode,404);
    const updated=await app.inject({method:'PUT',url:`/mental-check-ins/${item.id}`,headers:ownerHeaders,payload:{...payload,mood:'very_good'}});assert.equal(updated.statusCode,200);assert.equal(updated.json().mood,'very_good');
    assert.equal((await app.inject({method:'DELETE',url:`/mental-check-ins/${item.id}`,headers:ownerHeaders})).statusCode,204);
  }finally{await app.close()}
});
