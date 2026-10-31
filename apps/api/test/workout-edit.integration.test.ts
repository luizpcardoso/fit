import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from 'dotenv';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';

test('MySQL: editar ficha preserva histórico, isola proprietário e bloqueia ficha de profissional', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const db = createDatabase({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, database: process.env.DB_NAME!, ssl: process.env.DB_SSL === 'true' });
  const repository = new WorkoutRepository(db); const auth = new SequelizeAuthRepository(db); const users: string[] = []; const assignments: string[] = [];
  const app = await buildApp({ repository: auth, workoutRepository: repository, jwtSecret: 'workout-edit-integration-secret-with-32-characters' });
  try {
    const register = async (name: string) => { const account = (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `edit-${name}-${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: name } })).json(); users.push(account.user.id); return account; };
    const owner = await register('dono'); const other = await register('outro');
    const headers = { authorization: `Bearer ${owner.accessToken}` };
    const created = await app.inject({ method: 'POST', url: '/workout-plans', headers, payload: { name: 'Ficha original', validityDays: 30, divisions: [
      { name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: '12' }, { name: 'Crucifixo', sets: 3, reps: '12' }] },
      { name: 'Pernas', exercises: [{ name: 'Agachamento', sets: 4, reps: '10' }] },
    ] } });
    assert.equal(created.statusCode, 201);
    const planId = created.json().id as string;
    const original = (await repository.getPlan(owner.user.id, planId))!;
    assert.equal(original.origin, 'own');
    const [chest, legs] = original.divisions; const [bench, fly] = chest.exercises;
    // Two sessions: one on the division that stays, one on the division that will be removed.
    assert.equal((await app.inject({ method: 'POST', url: '/workout-sessions', headers, payload: { divisionId: chest.id, performedOn: '2026-10-20', completedExerciseIds: [bench.id, fly.id] } })).statusCode, 201);
    assert.equal((await app.inject({ method: 'POST', url: '/workout-sessions', headers, payload: { divisionId: legs.id, performedOn: '2026-10-21' } })).statusCode, 201);
    const before = await repository.listSessions(owner.user.id);

    const edit = { name: 'Ficha editada', divisions: [{ id: chest.id, name: 'Peito e ombro', exercises: [
      { id: bench.id, name: 'Supino', sets: 5, reps: '6–8', load: 60, restSeconds: 120 },
      { name: 'Desenvolvimento', sets: 3, reps: '10' },
    ] }] };
    assert.equal((await app.inject({ method: 'PUT', url: `/workout-plans/${planId}`, headers: { authorization: `Bearer ${other.accessToken}` }, payload: edit })).statusCode, 404);
    const response = await app.inject({ method: 'PUT', url: `/workout-plans/${planId}`, headers, payload: edit });
    assert.equal(response.statusCode, 200);
    const updated = response.json();
    assert.equal(updated.name, 'Ficha editada');
    assert.equal(updated.validUntil, original.validUntil, 'sem validityDays a validade atual é mantida');
    assert.equal(updated.divisions.length, 1);
    assert.equal(updated.divisions[0].id, chest.id);
    assert.equal(updated.divisions[0].name, 'Peito e ombro');
    assert.deepEqual(updated.divisions[0].exercises.map((item: { name: string }) => item.name), ['Supino', 'Desenvolvimento']);
    assert.equal(updated.divisions[0].exercises[0].id, bench.id, 'exercício mantido conserva o id usado pelo histórico');
    assert.equal(updated.divisions[0].exercises[0].sets, 5);
    assert.equal(updated.divisions[0].exercises[0].load, 60);

    const after = await repository.listSessions(owner.user.id);
    assert.equal(after.length, before.length);
    for (const session of before) {
      const current = after.find(item => item.id === session.id)!;
      assert.equal(current.performedOn, session.performedOn);
      assert.equal(current.status, session.status);
      assert.equal(current.planName, 'Ficha original');
      assert.equal(current.divisionName, session.divisionName);
      assert.equal(current.divisionLabel, session.divisionLabel);
      assert.deepEqual(current.completedExerciseIds, session.completedExerciseIds);
    }
    assert.equal(after.find(item => item.divisionName === 'Pernas')?.divisionId, null);
    assert.equal(after.find(item => item.divisionName === 'Peito')?.divisionId, chest.id);

    const renewed = await app.inject({ method: 'PUT', url: `/workout-plans/${planId}`, headers, payload: { ...edit, validityDays: null } });
    assert.equal(renewed.json().validUntil, null);

    const assignmentId = randomUUID(); assignments.push(assignmentId);
    await db.query("INSERT INTO professional_assignments (id,author_id,student_id,relationship_id,kind,status,source_id,source_revision,snapshot,workout_plan_id,request_id,created_at,updated_at) VALUES (?,?,?,?,'workout','active',?,1,'{}',?,?,NOW(),NOW())", { replacements: [assignmentId, other.user.id, owner.user.id, randomUUID(), randomUUID(), planId, randomUUID()] });
    assert.equal((await repository.getPlan(owner.user.id, planId))?.origin, 'professional');
    const blocked = await app.inject({ method: 'PUT', url: `/workout-plans/${planId}`, headers, payload: { ...edit, name: 'Tentativa' } });
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.json().code, 'PROFESSIONAL_PLAN_READ_ONLY');
    assert.equal((await repository.getPlan(owner.user.id, planId))?.name, 'Ficha editada');
  } finally {
    for (const id of assignments) await db.query('DELETE FROM professional_assignments WHERE id=?', { replacements: [id] });
    for (const id of users) await db.query('DELETE FROM users WHERE id=?', { replacements: [id] });
    await app.close(); await db.close();
  }
});
