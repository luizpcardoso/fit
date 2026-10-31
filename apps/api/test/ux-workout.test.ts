import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import type { WorkoutRepository } from '../src/workout-repository.js';
import type { GroupRepository } from '../src/group-repository.js';

test('conclusão persiste mesmo com falha social e escolha manual não publica automaticamente', async () => {
  let saved = 0; let socialCalls = 0;
  const repo = { complete: async () => { saved++; return randomUUID(); }, getGoalSummary: async () => ({ completed: 1, weeklyTarget: 3 }) } as unknown as WorkoutRepository;
  const groups = { createActivityPosts: async () => { socialCalls++; throw new Error('offline'); } } as unknown as GroupRepository;
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters', workoutRepository: repo, groupRepository: groups });
  try {
    const account = (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'ux-test@example.com', password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'UX' } })).json();
    const headers = { authorization: `Bearer ${account.accessToken}` };
    const payload = { divisionId: randomUUID(), performedOn: '2026-10-29' };
    assert.equal((await app.inject({ method: 'POST', url: '/workout-sessions', headers, payload })).statusCode, 201);
    assert.equal(saved, 1); assert.equal(socialCalls, 1);
    assert.equal((await app.inject({ method: 'POST', url: '/workout-sessions', headers, payload: { ...payload, shareAutomatically: false } })).statusCode, 201);
    assert.equal(saved, 2); assert.equal(socialCalls, 1);
  } finally { await app.close(); }
});
