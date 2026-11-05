import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {buildApp} from '../src/app.js';
import {createDatabase} from '../src/database.js';
import {migrateDatabase} from '../src/migrate.js';
import {SequelizeAuthRepository} from '../src/repository.js';
import {SupplementRepository} from '../src/supplement-repository.js';
import {InjectableRepository} from '../src/injectable-repository.js';
import {MentalWellbeingRepository} from '../src/mental-wellbeing-repository.js';
import {WorkoutRepository} from '../src/workout-repository.js';
import {NutritionRepository} from '../src/nutrition-repository.js';
import {planRoutineReminders,defaultReminderPreferences} from '../../mobile/src/utils/routine-reminder-plan.js';

test('MySQL: agenda e resumo refletem horários, pausas e registros reais sem compartilhar contas',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});if(!process.env.DB_NAME?.includes('test'))throw new Error('Use banco de testes.');
  const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!});
  await migrateDatabase(db);
  const app=await buildApp({repository:new SequelizeAuthRepository(db),medicationRepository:new SupplementRepository(db,'medication'),supplementRepository:new SupplementRepository(db,'supplement'),injectableRepository:new InjectableRepository(db),mentalWellbeingRepository:new MentalWellbeingRepository(db),workoutRepository:new WorkoutRepository(db),nutritionRepository:new NutritionRepository(db),jwtSecret:'reminder-agenda-integration-secret-32'});
  const users:string[]=[];
  try{
    const register=async()=>{const res=await app.inject({method:'POST',url:'/auth/register',payload:{email:`reminders-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Avisos'}});assert.equal(res.statusCode,201);const account=res.json();users.push(account.user.id);return {authorization:`Bearer ${account.accessToken}`};};
    const headers=await register(),other=await register();const date='2026-11-01';
    const medication=await app.inject({method:'POST',url:'/medications',headers,payload:{name:'Medicamento confidencial',dailyFrequency:2,times:['10:00','20:00']}});assert.equal(medication.statusCode,201);const id=medication.json().id;
    const url=`/me/reminder-agenda?from=${date}&to=2026-11-07`;
    const initial=(await app.inject({url,headers})).json();assert.deepEqual(initial.days[0].entries,[{kind:'medication',time:'10:00',pending:1},{kind:'medication',time:'20:00',pending:1}]);
    assert.ok((await app.inject({url,headers:other})).json().days.every((day:{entries:unknown[]})=>day.entries.length===0));
    const before=(await app.inject({url:`/me/daily-summary?date=${date}`,headers})).json();assert.deepEqual(before.categories.find((item:{kind:string})=>item.kind==='medication'),{kind:'medication',completed:0,total:2});
    const done=await app.inject({method:'POST',url:`/medications/${id}/intakes`,headers,payload:{date,slot:0}});assert.equal(done.statusCode,204);
    const changed=(await app.inject({url,headers})).json();assert.deepEqual(changed.days[0].entries,[{kind:'medication',time:'20:00',pending:1}]);assert.equal(changed.days[1].entries.length,2);
    const plan=planRoutineReminders(changed,{...defaultReminderPreferences,enabled:true},new Date(2026,10,1,8));assert.equal(plan.items.some(item=>item.at===new Date(2026,10,1,10).getTime()),false);
    const after=(await app.inject({url:`/me/daily-summary?date=${date}`,headers})).json();assert.deepEqual(after.categories.find((item:{kind:string})=>item.kind==='medication'),{kind:'medication',completed:1,total:2});
    assert.equal(JSON.stringify(after).includes('confidencial'),false);
    assert.equal((await app.inject({method:'PATCH',url:`/medications/${id}`,headers,payload:{active:false}})).statusCode,204);
    assert.ok((await app.inject({url,headers})).json().days.every((day:{entries:unknown[]})=>day.entries.length===0));
  }finally{for(const id of users)await db.query('DELETE FROM users WHERE id=?',{replacements:[id]});await app.close();await db.close();}
});
