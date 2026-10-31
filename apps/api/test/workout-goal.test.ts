import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workoutGoalInputSchema } from '@fit/contracts';

const division = '00000000-0000-4000-8000-000000000001';

test('contrato de meta semanal aceita os dois modos e protege o planejamento', () => {
  assert.deepEqual(workoutGoalInputSchema.parse({ weeklyTarget: 3, mode: 'flexible', schedule: [] }), { weeklyTarget: 3, mode: 'flexible', schedule: [] });
  assert.deepEqual(workoutGoalInputSchema.parse({ weeklyTarget: 2, mode: 'planned', schedule: [{ weekday: 1, divisionId: division }, { weekday: 4, divisionId: null }] }).schedule.map(item => item.weekday), [1, 4]);
  for (const value of [
    { weeklyTarget: 0, mode: 'flexible', schedule: [] },
    { weeklyTarget: 3, mode: 'flexible', schedule: [{ weekday: 1, divisionId: null }] },
    { weeklyTarget: 2, mode: 'planned', schedule: [{ weekday: 1, divisionId: null }] },
    { weeklyTarget: 2, mode: 'planned', schedule: [{ weekday: 1, divisionId: null }, { weekday: 1, divisionId: null }] },
  ]) assert.throws(() => workoutGoalInputSchema.parse(value));
});
