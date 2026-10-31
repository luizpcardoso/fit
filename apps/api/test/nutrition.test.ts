import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyMeasurementInputSchema, dailyExpenditureInputSchema, foodInputSchema, mealInputSchema, type Food } from '@fit/contracts';
import { ageOnDate, estimateDailyExpenditure, nutritionForQuantity } from '../src/nutrition-repository.js';

test('calcula idade na data local sem antecipar aniversário', () => {
  assert.equal(ageOnDate('1990-11-10', '2026-10-28'), 35);
  assert.equal(ageOnDate('1990-10-28', '2026-10-28'), 36);
});

test('Mifflin-St Jeor separa atividade cotidiana de exercício', () => {
  const result = estimateDailyExpenditure({ date:'2026-10-28',mode:'estimated',gender:'male',birthDate:'1990-10-28',heightCm:180,weightKg:80,activityLevel:'sedentary',exerciseCalories:300 });
  assert.deepEqual(result, { basalCalories:1750, activityCalories:350, totalCalories:2400, formula:'Mifflin-St Jeor + atividade cotidiana sem exercício + exercício do dia' });
});

test('ajusta calorias e macros proporcionalmente à quantidade', () => {
  const food: Food = { id:'00000000-0000-4000-8000-000000000001',name:'Arroz',brand:null,servingAmount:100,servingUnit:'g',calories:130,protein:2.5,carbs:28,fat:.3,fiber:1.6,notes:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z' };
  assert.deepEqual(nutritionForQuantity(food,150), { foodId:food.id,foodName:'Arroz',servingAmount:100,servingUnit:'g',quantity:150,calories:195,protein:3.75,carbs:42,fat:.45,fiber:2.4 });
});

test('contratos rejeitam negativos, refeição ambígua e medida vazia', () => {
  assert.equal(foodInputSchema.safeParse({name:'Teste',servingAmount:-1,servingUnit:'g',calories:1,protein:1,carbs:1,fat:1}).success,false);
  assert.equal(mealInputSchema.safeParse({name:'Almoço',date:'2026-10-28',time:'12:30'}).success,false);
  assert.equal(dailyExpenditureInputSchema.safeParse({date:'2026-10-28',mode:'manual',totalCalories:-1}).success,false);
  assert.equal(bodyMeasurementInputSchema.safeParse({date:'2026-10-28',notes:'sem medida'}).success,false);
});
