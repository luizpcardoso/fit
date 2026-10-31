import assert from 'node:assert/strict';
import test from 'node:test';
import { cardioSessionInputSchema, type CardioSession, type CardioSessionInput } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import { cardioMetValues, estimateCardioCalories, type CardioRepository } from '../src/cardio-repository.js';

test('estima calorias com MET, peso e duração', () => {
  assert.equal(cardioMetValues.walking.light, 2.8);
  assert.equal(cardioMetValues.cycling.moderate, 7);
  assert.equal(cardioMetValues.stairs.intense, 9.3);
  assert.equal(estimateCardioCalories(8.5, 80, 30), 340);
});

test('contratos de cardio separam estimativa e valor informado', () => {
  assert.equal(cardioSessionInputSchema.safeParse({ date:'2026-10-28',mode:'estimated',activity:'walking',intensity:'moderate',durationMinutes:30,weightKg:81.2 }).success,true);
  assert.equal(cardioSessionInputSchema.safeParse({ date:'2026-10-28',mode:'manual',calories:320,durationMinutes:null,source:'Garmin' }).success,true);
  assert.equal(cardioSessionInputSchema.safeParse({ date:'2026-10-28',mode:'estimated',activity:'walking',intensity:'moderate',durationMinutes:0,weightKg:81.2 }).success,false);
  assert.equal(cardioSessionInputSchema.safeParse({ date:'2026-10-28',mode:'manual',calories:320 }).success,false);
});

test('rotas de cardio exigem sessão e isolam registros por usuário', async () => {
  let sequence=0; const rows=new Map<string,CardioSession & { userId:string }>();
  const repository={
    async list(userId:string,date:string){return [...rows.values()].filter(item=>item.userId===userId&&item.date===date).map(({userId:_,...item})=>item)},
    async create(userId:string,input:CardioSessionInput){const now='2026-10-28T12:00:00.000Z';const estimated=input.mode==='estimated';const item:CardioSession&{userId:string}={id:`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,userId,date:input.date,mode:input.mode,activity:estimated?input.activity:null,intensity:estimated?input.intensity:null,durationMinutes:input.durationMinutes??null,weightKg:estimated?input.weightKg:null,met:estimated?cardioMetValues[input.activity][input.intensity]:null,calories:estimated?estimateCardioCalories(cardioMetValues[input.activity][input.intensity],input.weightKg,input.durationMinutes):Math.round(input.calories),source:estimated?null:input.source,createdAt:now,updatedAt:now};rows.set(item.id,item);const{userId:_,...response}=item;return response},
    async delete(userId:string,id:string){const item=rows.get(id);if(!item||item.userId!==userId)return false;rows.delete(id);return true},
  } as unknown as CardioRepository;
  const app=await buildApp({cardioRepository:repository,jwtSecret:'cardio-route-tests-secret-32-characters'});
  const account=(label:string)=>({email:`${label}@example.com`,password:'senha-forte-123',phone:'71999990000',firstName:'Teste',lastName:label});
  const owner=(await app.inject({method:'POST',url:'/auth/register',payload:account('cardio-owner')})).json();
  const other=(await app.inject({method:'POST',url:'/auth/register',payload:account('cardio-other')})).json();
  const ownerHeaders={authorization:`Bearer ${owner.accessToken}`};const otherHeaders={authorization:`Bearer ${other.accessToken}`};
  assert.equal((await app.inject({method:'GET',url:'/cardio-sessions?date=2026-10-28'})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/cardio-sessions',headers:ownerHeaders,payload:{date:'2026-10-28',mode:'estimated',activity:'running',intensity:'moderate',durationMinutes:30,weightKg:80}})).statusCode,201);
  const ownerRows=(await app.inject({method:'GET',url:'/cardio-sessions?date=2026-10-28',headers:ownerHeaders})).json();
  assert.equal(ownerRows[0].calories,340);
  assert.deepEqual((await app.inject({method:'GET',url:'/cardio-sessions?date=2026-10-28',headers:otherHeaders})).json(),[]);
  assert.equal((await app.inject({method:'DELETE',url:`/cardio-sessions/${ownerRows[0].id}`,headers:otherHeaders})).statusCode,404);
  assert.equal((await app.inject({method:'DELETE',url:`/cardio-sessions/${ownerRows[0].id}`,headers:ownerHeaders})).statusCode,204);
  assert.equal((await app.inject({method:'POST',url:'/cardio-sessions',headers:ownerHeaders,payload:{date:'2026-10-28',mode:'manual',calories:-1,source:'Relógio'}})).statusCode,400);
  await app.close();
});
