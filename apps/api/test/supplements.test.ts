import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supplementInputSchema, supplementIntakeInputSchema, suggestSupplementTimes } from '@fit/contracts';

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
