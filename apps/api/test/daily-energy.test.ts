import assert from 'node:assert/strict';
import test from 'node:test';
import type { DailyExpenditure } from '@fit/contracts';
import { dailyEnergy } from '../src/daily-energy.js';
const profile = { birthDate: '1990-10-28', estimationSex: 'male', heightCm: 180, weightKg: 80 };
const date = '2026-10-28';
test('base sedentária não pressupõe treinos e soma somente energia adicional ao repouso', () => {
  assert.equal(dailyEnergy(date, profile, 0, [], null).totalCalories, 2100);
  const result = dailyEnergy(date, profile, 1, [{mode:'estimated', met:7, weightKg:80, durationMinutes:30, calories:280}], null);
  assert.equal(result.baseCalories, 2100);
  assert.equal(result.workoutCalories, 150);
  assert.equal(result.cardioCalories, 240);
  assert.equal(result.totalCalories, 2490);
  assert.equal(dailyEnergy(date, profile, 2, [], null).totalCalories, 2400);
});
test('cardio manual desconta repouso quando há duração e aceita calorias ativas sem duração', () => {
  const result = dailyEnergy(date, profile, 0, [
    {mode:'manual', met:null, weightKg:null, durationMinutes:30, calories:300},
    {mode:'manual', met:null, weightKg:null, durationMinutes:null, calories:200},
  ], null);
  assert.equal(result.cardioCalories, 460);
});
test('gasto diário informado substitui tudo, inclusive sem perfil completo', () => {
  const override = {totalCalories:2500} as DailyExpenditure;
  const result = dailyEnergy(date, {birthDate:null, estimationSex:null, heightCm:null, weightKg:null}, 2, [{mode:'manual',met:null,weightKg:null,durationMinutes:null,calories:400}], override);
  assert.equal(result.source, 'recorded');
  assert.equal(result.totalCalories,2500);
  assert.equal(result.workoutCalories,null);
});
test('não inventa peso, sexo ou estimativas para idades fora da faixa do estudo', () => {
  const missing = dailyEnergy(date, {birthDate:null, estimationSex:'other', heightCm:null, weightKg:null},0,[],null);
  assert.equal(missing.totalCalories,null);
  assert.deepEqual(missing.missing,['birthDate','estimationSex','heightCm','weightKg']);
  for (const birthDate of ['2010-10-28','1940-10-28']) {
    assert.deepEqual(dailyEnergy(date,{...profile,birthDate},0,[],null).missing,['supportedAge']);
  }
});
