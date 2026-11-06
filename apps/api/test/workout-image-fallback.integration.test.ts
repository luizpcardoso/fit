import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import { QueryTypes } from 'sequelize';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeAuthRepository } from '../src/repository.js';
import { WorkoutRepository } from '../src/workout-repository.js';
import { buildApp } from '../src/app.js';

test('MySQL: ficha sem snapshot usa a imagem atual do catálogo; snapshot prevalece; exercício próprio não herda', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const database = `fit_workout_image_test_${process.pid}_${Date.now()}`;
  const options = { host: process.env.DB_HOST!, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER!, password: process.env.DB_PASS! };
  const admin = await createConnection(options);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = createDatabase({ host: options.host, port: options.port, username: options.user, password: options.password, database });
  try {
    await migrateDatabase(db);
    const workouts = new WorkoutRepository(db);
    const app = await buildApp({ repository: new SequelizeAuthRepository(db), workoutRepository: workouts, jwtSecret: 'workout-image-test-secret-with-more-than-32-characters' });
    try {
      const owner = (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Imagem' } })).json();
      const catalogId = randomUUID(), customId = randomUUID();
      await db.query("INSERT INTO exercises (id,name,source,created_at,updated_at) VALUES (?,'Supino imagem teste','catalog',NOW(),NOW())", { replacements: [catalogId], type: QueryTypes.INSERT });
      await db.query("INSERT INTO exercises (id,owner_user_id,name,source,created_at,updated_at) VALUES (?,?,'Exercício próprio teste','custom',NOW(),NOW())", { replacements: [customId, owner.user.id], type: QueryTypes.INSERT });
      const id = await workouts.createPlan(owner.user.id, { name: 'Ficha antiga', divisions: [{ name: 'Peito', exercises: [{ name: 'Supino imagem teste', catalogExerciseId: catalogId, sets: 3, reps: '12' }, { name: 'Exercício próprio teste', catalogExerciseId: customId, sets: 3, reps: '12' }] }] });
      const images = async () => (await workouts.getPlan(owner.user.id, id))!.divisions[0].exercises.map(exercise => exercise.imageUrl);
      assert.deepEqual(await images(), [null, null]);

      // Image published after the plan was saved: the catalog row shows it, the custom one never inherits.
      const catalogKey = `${randomUUID()}.webp`;
      await db.query('UPDATE exercises SET image_url=? WHERE id IN (?)', { replacements: [catalogKey, [catalogId, customId]] });
      assert.deepEqual(await images(), [`/media/exercises/${catalogKey}`, null]);

      // A saved snapshot still wins over later catalog changes.
      const snapshotKey = `${randomUUID()}.webp`;
      await db.query("UPDATE workout_plan_exercises SET image_url=? WHERE exercise_id=?", { replacements: [snapshotKey, catalogId] });
      await db.query('UPDATE exercises SET image_url=? WHERE id=?', { replacements: [`${randomUUID()}.webp`, catalogId] });
      assert.equal((await images())[0], `/media/exercises/${snapshotKey}`);
    } finally { await app.close(); }
  } finally {
    await db.close();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
});
