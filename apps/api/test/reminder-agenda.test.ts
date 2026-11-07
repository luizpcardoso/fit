import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import type {DailySummarySources} from '../src/daily-summary-routes.js';
import type {InjectableToday,SupplementToday,WorkoutGoalSummary} from '@fit/contracts';
test('agenda exige autenticação, limita período, isola usuários e omite ações realizadas, dispensadas, sem horário ou sem lembrete e dados pessoais',async()=>{
  let ownerId='';let done=false;const calls:string[]=[];
  const routine=async(userId:string,date:string)=>{calls.push(userId);return {date,total:userId===ownerId?2:0,consumed:0,remaining:2,items:userId===ownerId?[{supplement:{name:'SEGREDO'},slot:0,time:'10:00',consumedAt:done?'2026-11-01T08:00:00Z':null},{supplement:{name:'SEGREDO'},slot:1,time:'20:00',consumedAt:'2026-11-01T08:00:00Z'},{supplement:{name:'SEGREDO'},slot:2,time:'12:00',consumedAt:null,dismissedAt:'2026-11-01T08:00:00Z'},{supplement:{name:'SEGREDO',remind:false},slot:3,time:'14:00',consumedAt:null,dismissedAt:null},{supplement:{name:'SEGREDO'},slot:4,time:null,consumedAt:null,dismissedAt:null}]:[]} as SupplementToday;};
  const sources:DailySummarySources={medications:{today:routine},supplements:{today:routine},injectables:{today:async(userId,date)=>({date,total:userId===ownerId?1:0,applied:done?1:0,remaining:done?0:1,dismissed:0,items:[]} as InjectableToday)},mental:{list:async()=>[]},workouts:{getGoalSummary:async(userId,date)=>({schedule:userId===ownerId?[{weekday:7}]:[],sessionsByDate:done?{[date]:1}:{}} as unknown as WorkoutGoalSummary)},nutrition:{summary:async()=>{throw new Error('Agenda não deve consultar calorias.');}}};
  const app=await buildApp({jwtSecret:'routine-reminders-tests-secret-32-characters',medicationRepository:{...sources.medications,kind:'medication'} as Parameters<typeof buildApp>[0]['medicationRepository'],supplementRepository:{...sources.supplements,kind:'supplement'} as Parameters<typeof buildApp>[0]['supplementRepository'],injectableRepository:sources.injectables as Parameters<typeof buildApp>[0]['injectableRepository'],mentalWellbeingRepository:sources.mental as Parameters<typeof buildApp>[0]['mentalWellbeingRepository'],workoutRepository:sources.workouts as Parameters<typeof buildApp>[0]['workoutRepository'],nutritionRepository:sources.nutrition as Parameters<typeof buildApp>[0]['nutritionRepository']});
  try{
    const register=async()=>{const response=await app.inject({method:'POST',url:'/auth/register',payload:{email:`agenda-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Agenda'}});assert.equal(response.statusCode,201);return response.json();};
    const owner=await register(),other=await register();ownerId=owner.user.id;const headers={authorization:`Bearer ${owner.accessToken}`};
    const url='/me/reminder-agenda?from=2026-11-01&to=2026-11-07';
    assert.equal((await app.inject({url})).statusCode,401);assert.equal(calls.length,0);
    for(const query of ['from=2026-02-30&to=2026-03-01','from=2026-11-01&to=2026-11-08','from=2026-11-07&to=2026-11-01',`from=2026-11-01&to=2026-11-07&userId=${ownerId}`])assert.equal((await app.inject({url:`/me/reminder-agenda?${query}`,headers})).statusCode,400);
    const response=await app.inject({url,headers});assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'private, no-store');assert.equal(response.body.includes('SEGREDO'),false);
    const agenda=response.json();assert.equal(agenda.days.length,7);
    assert.deepEqual(agenda.days[0].entries,[{kind:'medication',time:'10:00',pending:1},{kind:'supplement',time:'10:00',pending:1},{kind:'injectable',time:null,pending:1},{kind:'workout',time:null,pending:1}]);
    const privateAgenda=(await app.inject({url,headers:{authorization:`Bearer ${other.accessToken}`}})).json();assert.ok(privateAgenda.days.every((day:{entries:unknown[]})=>day.entries.length===0));
    done=true;const cleared=(await app.inject({url,headers})).json();assert.ok(cleared.days.every((day:{entries:unknown[]})=>day.entries.length===0));
  }finally{await app.close();}
});
