import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { NutritionRepository } from '../src/nutrition-repository.js';
import { SequelizeAuthRepository } from '../src/repository.js';

test('MySQL: nutrição persiste, isola usuários e preserva snapshots', { skip:process.env.RUN_DB_TESTS!=='1' }, async()=>{
  config({path:new URL('../.env',import.meta.url),quiet:true});
  const db=createDatabase({host:process.env.DB_HOST!,port:Number(process.env.DB_PORT),username:process.env.DB_USER!,password:process.env.DB_PASS!,database:process.env.DB_NAME!,ssl:process.env.DB_SSL==='true'});
  const users:string[]=[]; await migrateDatabase(db); const repo=new NutritionRepository(db); const app=await buildApp({repository:new SequelizeAuthRepository(db),nutritionRepository:repo,jwtSecret:'nutrition-integration-secret-32-characters'});
  try {
    const accounts=[];for(const label of ['owner','other']){const response=await app.inject({method:'POST',url:'/auth/register',payload:{email:`nutrition-${label}-${randomUUID()}@example.com`,password:'integration-test-123',phone:'71999990000',firstName:'Teste',lastName:'Nutrição'}});assert.equal(response.statusCode,201);accounts.push(response.json());users.push(response.json().user.id)}
    const owner={authorization:`Bearer ${accounts[0].accessToken}`};const other={authorization:`Bearer ${accounts[1].accessToken}`};const date='2026-10-28';
    assert.equal((await app.inject({method:'GET',url:'/nutrition/foods'})).statusCode,401);
    assert.equal((await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`})).statusCode,401);
    assert.equal((await app.inject({method:'GET',url:'/nutrition/summary?date=invalid',headers:owner})).statusCode,400);
    await db.query("UPDATE users SET birth_date='1990-10-28',gender='male',estimation_sex='male',height_cm=180,activity_level='very_active' WHERE id=?",{replacements:[users[0]],type:QueryTypes.UPDATE});
    await repo.createMeasurement(users[0],{date:'2026-10-27',weightKg:80});
    await repo.createMeasurement(users[0],{date:'2026-10-29',weightKg:120});
    for(const [userId,status,performedOn] of [[users[0],'completed',date],[users[0],'cancelled',date],[users[0],'completed','2026-10-27'],[users[1],'completed',date]]) {
      await db.query('INSERT INTO workout_sessions (id,user_id,plan_name,division_name,division_label,performed_on,status,completion_mode,completed_exercise_ids,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',{replacements:[randomUUID(),userId,'Teste','Treino','A',performedOn,status,'quick','[]'],type:QueryTypes.INSERT});
    }
    for(const userId of users) await db.query("INSERT INTO cardio_sessions (id,user_id,session_date,mode,activity,intensity,duration_minutes,weight_kg,met,calories,created_at,updated_at) VALUES (?,?,?,'estimated','cycling','moderate',30,80,7,280,NOW(),NOW())",{replacements:[randomUUID(),userId,date],type:QueryTypes.INSERT});
    const emptySummary=(await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:owner})).json();assert.equal(emptySummary.balance,null);assert.equal(emptySummary.status,'incomplete');
    let energy=(await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:owner})).json().energyEstimate;
    assert.equal(energy.baseCalories,2100);assert.equal(energy.workoutCount,1);assert.equal(energy.workoutCalories,150);assert.equal(energy.cardioCalories,240);assert.equal(energy.totalCalories,2490);
    assert.equal((await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:other})).json().energyEstimate.totalCalories,null);

    const foodResponse=await app.inject({method:'POST',url:'/nutrition/foods',headers:owner,payload:{name:'Arroz',brand:null,servingAmount:100,servingUnit:'g',calories:130,protein:2.5,carbs:28,fat:.3,fiber:1.6,notes:null}});assert.equal(foodResponse.statusCode,201);const foodId=foodResponse.json().id;
    assert.equal((await app.inject({method:'PATCH',url:`/nutrition/foods/${foodId}`,headers:other,payload:{calories:999}})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/nutrition/meals',headers:owner,payload:{name:'Almoço',date,time:'12:30',items:[{foodId,quantity:150}]}})).statusCode,201);
    let summary=(await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:owner})).json();assert.equal(summary.consumed.calories,195);assert.equal(summary.balance,-2295);assert.equal(summary.status,'deficit');const mealId=summary.meals[0].id;
    await app.inject({method:'PATCH',url:`/nutrition/foods/${foodId}`,headers:owner,payload:{calories:999}});summary=(await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:owner})).json();assert.equal(summary.consumed.calories,195);
    const favorite=await app.inject({method:'POST',url:`/nutrition/meals/${mealId}/favorite`,headers:owner});assert.equal(favorite.statusCode,201);const favoriteId=favorite.json().id;
    await app.inject({method:'POST',url:`/nutrition/favorites/${favoriteId}/use`,headers:owner,payload:{date:'2026-10-29',time:'12:30',multiplier:2}});const reused=(await app.inject({method:'GET',url:'/nutrition/summary?date=2026-10-29',headers:owner})).json();assert.equal(reused.consumed.calories,390);
    await app.inject({method:'PUT',url:'/nutrition/expenditures',headers:owner,payload:{date,mode:'estimated',gender:'male',birthDate:'1990-10-28',heightCm:180,weightKg:80,activityLevel:'sedentary',exerciseCalories:300}});await app.inject({method:'PUT',url:'/nutrition/expenditures',headers:owner,payload:{date,mode:'manual',totalCalories:2400,source:'Relógio'}});summary=(await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:owner})).json();assert.equal(summary.expenditure.mode,'manual');assert.equal(summary.expenditure.totalCalories,2400);assert.equal(summary.balance,-2205);assert.equal(summary.energyEstimate.totalCalories,2400);assert.equal(summary.energyEstimate.source,'recorded');
    assert.equal((await app.inject({method:'POST',url:'/body-measurements',headers:owner,payload:{date,weightKg:80}})).statusCode,201);
    assert.equal((await app.inject({method:'POST',url:'/body-measurements',headers:owner,payload:{date,weightKg:-1}})).statusCode,400);
    assert.equal((await app.inject({method:'DELETE',url:`/nutrition/foods/${foodId}`,headers:owner})).statusCode,204);summary=await new NutritionRepository(db).summary(users[0],date);assert.equal(summary.consumed?.calories,195);assert.equal(summary.meals[0].items[0].foodId,null);
    assert.equal((await app.inject({method:'DELETE',url:`/nutrition/foods/${foodId}`,headers:owner})).statusCode,404);
    assert.equal((await app.inject({method:'DELETE',url:`/nutrition/expenditures/${date}`,headers:owner})).statusCode,204);
    const automaticAgain=(await app.inject({method:'GET',url:`/nutrition/summary?date=${date}`,headers:owner})).json();
    assert.equal(automaticAgain.energyEstimate.source,'automatic');assert.equal(automaticAgain.balance,-2295);assert.equal(automaticAgain.expenditure,null);
    assert.deepEqual(await new NutritionRepository(db).listFoods(users[1]),[]);const otherSummary=await new NutritionRepository(db).summary(users[1],date);assert.equal(otherSummary.consumed,null);assert.equal(otherSummary.expenditure,null);
  } finally { if(users.length)await db.query('DELETE FROM users WHERE id IN (?)',{replacements:[users],type:QueryTypes.DELETE});await app.close();await db.close(); }
});
