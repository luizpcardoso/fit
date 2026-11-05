import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { saveWorkoutRunSchema, toggleWorkoutRunPause, workoutRunElapsed, type WorkoutRunProgress } from '@fit/contracts';
import { PortalContentService } from '../src/portal-content.js';
import type { ProfessionalManagement } from '../src/professional-management.js';

const progress = (): WorkoutRunProgress => ({ status: 'running', startedAt: 1000, finishedAt: null, performedOn: '2026-11-03', currentIndex: 0, pausedAt: null, pausedMs: 0, restEndsAt: 61_000, restRemainingMs: null, exercises: [{ id: randomUUID(), completedSets: [], skipped: false }] });
test('treino: pausa congela os dois cronômetros e retomada desconta o intervalo', () => {
  const paused = toggleWorkoutRunPause(progress(), 11_000);
  assert.equal(paused.restRemainingMs, 50_000);
  assert.equal(paused.restEndsAt, null);
  assert.equal(workoutRunElapsed(paused, 101_000), 10_000);
  const resumed = toggleWorkoutRunPause(paused, 101_000);
  assert.equal(resumed.restEndsAt, 151_000);
  assert.equal(resumed.pausedMs, 90_000);
  assert.equal(workoutRunElapsed(resumed, 111_000), 20_000);
  assert.equal(workoutRunElapsed({ ...resumed, finishedAt: 111_000, status: 'completed' }, 999_000), 20_000);
});
test('treino: contrato rejeita séries inválidas e campos extras de autorização', () => {
  const input = { planId: randomUUID(), divisionId: randomUUID(), version: 0, mutationId: randomUUID(), progress: progress() };
  assert.equal(saveWorkoutRunSchema.safeParse(input).success, true);
  assert.equal(saveWorkoutRunSchema.safeParse({ ...input, userId: randomUUID() }).success, false);
  assert.equal(saveWorkoutRunSchema.safeParse({ ...input, progress: { ...input.progress, currentIndex: 50 } }).success, false);
  assert.equal(saveWorkoutRunSchema.safeParse({ ...input, progress: { ...input.progress, exercises: [{ id: randomUUID(), completedSets: [20], skipped: false }] } }).success, false);
});
test('imagens: profissional e usuário comum não podem cadastrar, substituir nem remover', async () => {
  for (const role of ['professional', 'user']) {
    const service = new PortalContentService({ require: async () => ({ role, capabilities: ['fitness.manage'] }) } as unknown as ProfessionalManagement);
    for (const value of [null, 'data:image/png;base64,SGk=']) await assert.rejects(() => service.setExerciseImage(randomUUID(), randomUUID(), value), (error: unknown) => error instanceof Error && /Somente administradores/.test(error.message));
  }
});

test('contador de séries: registra uma por toque, limita ao prescrito, permite desfazer e respeita pausa', async () => {
  const { changeWorkoutRunSeries, moveWorkoutRunExercise } = await import('@fit/contracts');
  const initial = progress(), exercises = [{ id: initial.exercises[0].id, sets: 2, restSeconds: 60 }];
  const one = changeWorkoutRunSeries(initial, exercises, 1, 10_000);
  assert.deepEqual(one.exercises[0].completedSets, [0]);
  assert.equal(one.restEndsAt, 70_000);
  const two = changeWorkoutRunSeries(one, exercises, 1, 20_000);
  assert.deepEqual(two.exercises[0].completedSets, [0, 1]);
  assert.equal(two.restEndsAt, null);
  assert.deepEqual(changeWorkoutRunSeries(two, exercises, 1, 30_000), two);
  assert.deepEqual(changeWorkoutRunSeries(two, exercises, -1, 30_000).exercises[0].completedSets, [0]);
  const paused = toggleWorkoutRunPause(one, 15_000);
  assert.deepEqual(changeWorkoutRunSeries(paused, exercises, 1, 20_000), paused);
  assert.deepEqual(moveWorkoutRunExercise(one, 1, 1), one);
});

test('concluir exercício registra apenas suas séries, encerra descanso e preserva relógio e sessão', async () => {
  const { completeWorkoutRunExercise } = await import('@fit/contracts');
  const initial = progress(), secondId = randomUUID();
  initial.exercises[0] = { ...initial.exercises[0], completedSets: [1], skipped: true };
  initial.exercises.push({ id: secondId, completedSets: [0], skipped: false });
  const exercises = [{ id: initial.exercises[0].id, sets: 3 }, { id: secondId, sets: 2 }];
  const completed = completeWorkoutRunExercise(initial, exercises);
  assert.deepEqual(completed.exercises[0].completedSets, [0, 1, 2]);
  assert.equal(completed.exercises[0].skipped, false);
  assert.deepEqual(completed.exercises[1], initial.exercises[1]);
  assert.equal(completed.restEndsAt, null);
  assert.equal(completed.restRemainingMs, null);
  assert.equal(completed.status, 'running');
  assert.equal(completed.currentIndex, 0);
  assert.equal(completed.finishedAt, null);
  assert.equal(workoutRunElapsed(completed, 20_000), workoutRunElapsed(initial, 20_000));
  assert.equal(completeWorkoutRunExercise(completed, exercises), completed, 'repetir não duplica séries');
  const paused = toggleWorkoutRunPause(initial, 10_000);
  assert.equal(completeWorkoutRunExercise(paused, exercises), paused);
  const finished = { ...initial, status: 'completed' as const, finishedAt: 20_000 };
  assert.equal(completeWorkoutRunExercise(finished, exercises), finished);
  const invalid = { ...initial, currentIndex: 49 };
  assert.equal(completeWorkoutRunExercise(invalid, exercises), invalid);
  assert.deepEqual(initial.exercises[0].completedSets, [1], 'não altera o progresso anterior em memória');
});
