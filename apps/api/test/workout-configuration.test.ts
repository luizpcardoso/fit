import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkoutPlanSchema, workoutExerciseInputSchema } from '@fit/contracts';
import { stepRepetitions, stepWorkoutNumber } from '../../mobile/src/utils/workout-controls.js';

const exercise = { name: 'Supino', sets: 3, reps: '12', load: 12.5, restSeconds: 60 };
test('configuração valida limites, decimais e intervalos sem remover prescrições textuais', () => {
  for (const patch of [{ sets: 0 }, { sets: 21 }, { sets: 2.5 }, { load: -1 }, { load: 2001 }, { load: Infinity }, { restSeconds: -1 }, { restSeconds: 3601 }, { reps: '-5' }, { reps: '0' }, { reps: '12-8' }, { reps: '2.5' }]) {
    assert.equal(workoutExerciseInputSchema.safeParse({ ...exercise, ...patch }).success, false, JSON.stringify(patch));
  }
  for (const reps of ['1', '999', '8–12', '8 - 12', 'até a falha', '30 segundos', '12+12', '3 × 10']) assert.equal(workoutExerciseInputSchema.safeParse({ ...exercise, reps }).success, true);
  assert.equal(workoutExerciseInputSchema.parse(exercise).load, 12.5);
  assert.equal(createWorkoutPlanSchema.safeParse({ name: 'Ficha', requestId: 'invalid', divisions: [{ name: 'Peito', exercises: [exercise] }] }).success, false);
});
test('controles respeitam limites e preservam intervalos e orientações', () => {
  assert.equal(stepWorkoutNumber(1, -1, 1, 1, 20), 1);
  assert.equal(stepWorkoutNumber(20, 1, 1, 1, 20), 20);
  assert.equal(stepWorkoutNumber(12.25, 1, .5, 0, 2000), 12.75);
  assert.equal(stepWorkoutNumber(null, -1, .5, 0, 2000), 0);
  assert.equal(stepWorkoutNumber(1999.75, 1, .5, 0, 2000), 2000);
  assert.equal(stepRepetitions('8–12', 1), '9–13');
  assert.equal(stepRepetitions('8-12', -1), '7-11');
  for (const reps of ['1', 'até a falha', '-1', '12-8']) assert.equal(stepRepetitions(reps, -1), null);
});
