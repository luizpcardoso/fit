import assert from 'node:assert/strict';
import { test } from 'node:test';
import { occasionalIntakeInputSchema, supplementInputSchema, supplementIntakeInputSchema, suggestSupplementTimes, updateSupplementSchema } from '@fit/contracts';

test('contratos de suplementos aceitam os exemplos e rejeitam programação inválida', () => {
  for (const input of [
    { name:'Multivitamínico',amount:1,unit:'capsule',dailyFrequency:1,times:['08:00'],notes:null },
    { name:'Ômega 3',amount:3,unit:'capsule',dailyFrequency:2,times:['07:00','19:00'],notes:null },
    { name:'Whey',amount:30,unit:'g',dailyFrequency:3,times:['07:00','15:00','23:00'],notes:null },
    { name:'Creatina',amount:5,unit:'g',dailyFrequency:6,times:['07:00','11:00','15:00','19:00','23:00','03:00'],notes:null },
  ]) assert.equal(supplementInputSchema.safeParse(input).success,true);
  assert.equal(supplementInputSchema.safeParse({name:'X',dailyFrequency:0,times:['25:00']}).success,false);
  assert.equal(supplementInputSchema.safeParse({name:'Creatina',dailyFrequency:1,times:['08:00','20:00']}).success,false);
  assert.equal(supplementInputSchema.safeParse({name:'Creatina',dailyFrequency:2,times:['08:00','08:00']}).success,false);
  assert.equal(supplementIntakeInputSchema.safeParse({date:'2026-10-26',slot:0}).success,true);
  assert.equal(supplementIntakeInputSchema.safeParse({date:'26/10/2026',slot:-1}).success,false);
});

test('sugestões iniciam às 07:00 e usam múltiplos de 30 minutos', () => {
  assert.deepEqual(suggestSupplementTimes(2), ['07:00','19:00']);
  assert.deepEqual(suggestSupplementTimes(3), ['07:00','15:00','23:00']);
  assert.deepEqual(suggestSupplementTimes(5), ['07:00','12:00','16:30','21:30','02:00']);
  for (let frequency=1;frequency<=6;frequency++) for (const time of suggestSupplementTimes(frequency)) assert.equal(Number(time.slice(3)) % 30,0);
});

test('contratos aceitam doses sem horário, dias da semana e lembrete por item', () => {
  const untimed = supplementInputSchema.safeParse({ name: 'Creatina', dailyFrequency: 2, times: [], remind: false });
  assert.equal(untimed.success, true);
  assert.deepEqual(untimed.data?.times, []);
  assert.equal(supplementInputSchema.safeParse({ name: 'Creatina', dailyFrequency: 1, times: ['08:00'], weekdays: [1, 3, 5] }).success, true);
  assert.equal(supplementInputSchema.safeParse({ name: 'Creatina', dailyFrequency: 1, times: ['08:00'], weekdays: null }).success, true);
  for (const weekdays of [[], [0], [8], [1, 1], [1, 2, 3, 4, 5, 6, 7, 1]]) assert.equal(supplementInputSchema.safeParse({ name: 'Creatina', dailyFrequency: 1, times: ['08:00'], weekdays }).success, false);
  assert.equal(supplementInputSchema.safeParse({ name: 'Creatina', dailyFrequency: 2, times: ['08:00'] }).success, false);
  assert.equal(updateSupplementSchema.safeParse({ times: [] }).success, true);
  assert.equal(updateSupplementSchema.safeParse({ weekdays: [2, 2] }).success, false);
  assert.equal(updateSupplementSchema.safeParse({ remind: 'no' }).success, false);
});

test('modo e ilustração são opcionais para clientes antigos e validados para novos cadastros', () => {
  assert.equal(supplementInputSchema.safeParse({ name: 'Pré-treino', usageMode: 'occasional', illustration: 'powder', times: [] }).success, true);
  assert.equal(supplementInputSchema.safeParse({ name: 'Teste', usageMode: 'sometimes' }).success, false);
  assert.equal(supplementInputSchema.safeParse({ name: 'Teste', illustration: '../../foto' }).success, false);
  assert.deepEqual(updateSupplementSchema.parse({ name: 'Renomeado' }), { name: 'Renomeado' });
  assert.equal(supplementInputSchema.parse({ name: 'Legado' }).usageMode, undefined);
});

test('tomadas eventuais validam operação, data, horário e campos desconhecidos', () => {
  const input = { operationId: '029b3b2b-979e-4d06-96f5-c8b6e214c343', date: '2026-11-09', time: '23:59' };
  assert.equal(occasionalIntakeInputSchema.safeParse(input).success, true);
  for (const patch of [{ operationId: 'inválido' }, { date: '2026-02-30' }, { time: '24:00' }, { time: '8:30' }, { slot: 0 }, { userId: 'outro' }]) {
    assert.equal(occasionalIntakeInputSchema.safeParse({ ...input, ...patch }).success, false);
  }
});
