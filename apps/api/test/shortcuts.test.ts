import assert from 'node:assert/strict';
import test from 'node:test';
import { homeShortcutsInputSchema, type HomeShortcuts } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import type { ShortcutRepository } from '../src/shortcut-repository.js';

test('contrato limita atalhos da Home e rejeita repetições',()=>{
  assert.equal(homeShortcutsInputSchema.safeParse({items:['workout','meal','cardio','weight']}).success,true);
  assert.equal(homeShortcutsInputSchema.safeParse({items:['workout','workout']}).success,false);
  assert.equal(homeShortcutsInputSchema.safeParse({items:['workout','meal','cardio','weight','medication','mental']}).success,false);
});

test('atalhos exigem autenticação e permanecem privados',async()=>{
  const defaults:HomeShortcuts={items:['workout','meal','cardio','weight']};const rows=new Map<string,HomeShortcuts>();
  const repository={get:async(userId:string)=>rows.get(userId)??defaults,save:async(userId:string,input:HomeShortcuts)=>{rows.set(userId,input);return input}} as unknown as ShortcutRepository;
  const app=await buildApp({shortcutRepository:repository,jwtSecret:'shortcut-route-tests-secret-32-characters'});
  const account=(label:string)=>({email:`${label}@example.com`,password:'senha-forte-123',phone:'71999990000',firstName:'Teste',lastName:label});
  const owner=(await app.inject({method:'POST',url:'/auth/register',payload:account('shortcut-owner')})).json();const other=(await app.inject({method:'POST',url:'/auth/register',payload:account('shortcut-other')})).json();
  const ownerHeaders={authorization:`Bearer ${owner.accessToken}`};const otherHeaders={authorization:`Bearer ${other.accessToken}`};
  assert.equal((await app.inject({method:'GET',url:'/me/home-shortcuts'})).statusCode,401);
  assert.equal((await app.inject({method:'PUT',url:'/me/home-shortcuts',headers:ownerHeaders,payload:{items:['weight','medication']}})).statusCode,200);
  assert.deepEqual((await app.inject({method:'GET',url:'/me/home-shortcuts',headers:ownerHeaders})).json(),{items:['weight','medication']});
  assert.deepEqual((await app.inject({method:'GET',url:'/me/home-shortcuts',headers:otherHeaders})).json(),defaults);
  assert.equal((await app.inject({method:'PUT',url:'/me/home-shortcuts',headers:ownerHeaders,payload:{items:['weight','weight']}})).statusCode,400);
  await app.close();
});
