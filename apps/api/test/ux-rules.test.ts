import assert from 'node:assert/strict';
import test from 'node:test';
import { consumptionGoal, nutritionGoalInputSchema, pageQuerySchema, healthPageQuerySchema, pageWindow } from '@fit/contracts';

test('meta de consumo: ausente, dia vazio, abaixo e acima da meta', () => {
  assert.deepEqual(consumptionGoal(null, 500), { targetCalories: null, remainingCalories: null, progress: null });
  assert.deepEqual(consumptionGoal(2000, 0), { targetCalories: 2000, remainingCalories: 2000, progress: 0 });
  assert.deepEqual(consumptionGoal(2000, 500), { targetCalories: 2000, remainingCalories: 1500, progress: .25 });
  assert.deepEqual(consumptionGoal(2000, 2500), { targetCalories: 2000, remainingCalories: -500, progress: 1 });
  for (const targetCalories of [0, -1, 1.5, 30001, Infinity]) assert.equal(nutritionGoalInputSchema.safeParse({ targetCalories }).success, false);
});
test('paginação limita entradas e mantém página válida após exclusão', () => {
  assert.deepEqual(pageQuerySchema.parse({}), { page: 1, pageSize: 5 });
  assert.equal(healthPageQuerySchema.parse({ search: '  whey  ' }).search, 'whey');
  for (const query of [{page:0},{page:1.5},{pageSize:51},{page:'nan'},{page:100001}]) assert.equal(pageQuerySchema.safeParse(query).success,false);
  assert.deepEqual(pageWindow(12,{page:2,pageSize:5}),{page:2,pageSize:5,total:12,totalPages:3,offset:5});
  assert.equal(pageWindow(10,{page:3,pageSize:5}).page,2);
  assert.equal(pageWindow(0,{page:3,pageSize:5}).page,1);
});
