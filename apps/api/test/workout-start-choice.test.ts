import test from 'node:test';
import assert from 'node:assert/strict';
import { workoutStartChoices } from '../../mobile/src/utils/workout-start-choice.js';
import type { WorkoutPlan, WorkoutGoalSummary } from '@fit/contracts';
const plans = [{ id: 'plan', isActive: true, status: 'available', divisions: ['A','B','C'].map(id => ({ id, label: id, exercises: [{ sets: 3 }] })) }, { id: 'second', isActive: false, status: 'available', divisions: [{ id: 'D', exercises: [{ sets: 2 }] }] }, { id: 'archived', status: 'archived', divisions: [{ id: 'E', exercises: [{ sets: 3 }] }] }] as unknown as WorkoutPlan[];
const goal = { schedule: [{ weekday: 3, divisionId: 'C' }] } as WorkoutGoalSummary;
test('início sugere C do dia e permite escolher A ou outra ficha sem alterar a programação', () => {
  const { choices, planned, suggested } = workoutStartChoices(plans, goal, [], '2026-11-04');
  assert.equal(planned?.division.id, 'C'); assert.equal(suggested?.division.id, 'C');
  assert.deepEqual(choices.map(c => c.division.id), ['A','B','C','D']);
  assert.equal(workoutStartChoices(plans, goal, [], '2026-11-04', 'plan','A').suggested?.division.id,'A');
  assert.equal(workoutStartChoices(plans, goal, [], '2026-11-04', undefined, undefined, 'A').suggested?.division.id,'C');
  assert.equal(goal.schedule[0].divisionId,'C');
});
