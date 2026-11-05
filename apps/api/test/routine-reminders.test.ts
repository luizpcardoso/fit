import assert from 'node:assert/strict';
import test from 'node:test';
import type {ReminderAgenda} from '@fit/contracts';
import {otherAccountReminderIds,defaultReminderPreferences,planRoutineReminders,readReminderPreferences,reconcileRoutineReminders,reminderDateRange,type PlannedReminder,type ReminderScheduler} from '../../mobile/src/utils/routine-reminder-plan.js';
const now=new Date(2026,10,1,9,0);
const agenda:ReminderAgenda={from:'2026-11-01',to:'2026-11-07',days:[{date:'2026-11-01',entries:[{kind:'medication',time:'08:00',pending:1},{kind:'medication',time:'10:00',pending:2},{kind:'supplement',time:'10:00',pending:1},{kind:'workout',time:null,pending:1}]}]};
const prefs={...defaultReminderPreferences,enabled:true};
test('planejamento usa horário local, agrupa avisos e respeita categorias e horário passado',()=>{
  const plan=planRoutineReminders(agenda,prefs,now);
  assert.equal(plan.items.length,2);assert.equal(new Date(plan.items[0].at).getHours(),10);
  assert.match(plan.items[0].body,/Medicamentos: 2 registros previstos/);assert.match(plan.items[0].body,/Suplementos: 1 registro previsto/);
  assert.equal(plan.items[1].kind,'workout');assert.equal(new Date(plan.items[1].at).getHours(),18);
  assert.equal(planRoutineReminders(agenda,{...prefs,enabled:false},now).items.length,0);
  const off=planRoutineReminders(agenda,{...prefs,medication:false,workout:false},now);
  assert.equal(off.items.length,1);assert.equal(off.items[0].body.includes('Medicamentos'),false);
  assert.equal(planRoutineReminders(agenda,prefs,new Date(2026,10,1,19)).items.length,0);
});
test('limita agenda nativa e trata virada de mês e ano',()=>{
  const crowded:ReminderAgenda={from:'2026-11-01',to:'2026-11-07',days:Array.from({length:7},(_,index)=>({date:`2026-11-0${index+1}`,entries:Array.from({length:24},(_,hour)=>({kind:'medication' as const,time:`${String(hour).padStart(2,'0')}:00`,pending:1}))}))};
  const plan=planRoutineReminders(crowded,prefs,now);assert.equal(plan.items.length,56);assert.equal(plan.limited,true);
  assert.deepEqual(reminderDateRange(new Date(2026,11,29)),{from:'2026-12-29',to:'2027-01-04'});
  assert.deepEqual(readReminderPreferences('bad'),defaultReminderPreferences);
  assert.equal(readReminderPreferences('{"enabled":"false","workoutTime":"25:99"}').enabled,false);
});
test('sincronização mantém avisos idênticos, retira obsoletos e preserva outros canais',async()=>{
  const items=planRoutineReminders(agenda,prefs,now).items;const operations:string[]=[];
  const scheduler:ReminderScheduler={list:async()=>[{identifier:'fit.daily-summary'},{identifier:'mental-reminder'},{identifier:items[0].identifier,signature:items[0].signature},{identifier:'fit.routine.obsoleto'}],cancel:async id=>{operations.push(`cancel:${id}`);},schedule:async item=>{operations.push(`schedule:${item.identifier}`);}};
  await reconcileRoutineReminders(scheduler,items,()=>true);
  assert.deepEqual(operations,['cancel:fit.routine.obsoleto',`schedule:${items[1].identifier}`]);
  operations.length=0;await reconcileRoutineReminders(scheduler,[],()=>true);
  assert.deepEqual(operations,[`cancel:${items[0].identifier}`,'cancel:fit.routine.obsoleto']);
});
test('logout invalida trabalho atrasado e falhas nativas são reportadas',async()=>{
  let current=true;let scheduled=0;
  const scheduler:ReminderScheduler={list:async()=>{current=false;return [];},cancel:async()=>{},schedule:async(_item:PlannedReminder)=>{scheduled++;}};
  const items=planRoutineReminders(agenda,prefs,now).items;
  await reconcileRoutineReminders(scheduler,items,()=>current);assert.equal(scheduled,0);
  await assert.rejects(()=>reconcileRoutineReminders({...scheduler,list:async()=>[],schedule:async()=>{throw new Error('permission denied');}},items,()=>true),/permission denied/);
});

test('preparo preserva agenda da mesma conta e retira notificações de outra',()=>{
  const items=[{identifier:'fit.routine.1',ownerId:'owner'},{identifier:'fit.routine.2',ownerId:'other'},{identifier:'fit.routine.legacy'},{identifier:'fit.daily-summary',ownerId:'other'}];
  assert.deepEqual(otherAccountReminderIds(items,'owner'),['fit.routine.2','fit.routine.legacy']);
  assert.deepEqual(otherAccountReminderIds(items,null),['fit.routine.1','fit.routine.2','fit.routine.legacy']);
});
