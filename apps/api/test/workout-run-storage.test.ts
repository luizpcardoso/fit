import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkoutStorage } from '../../mobile/src/utils/workout-run-storage-core.js';
const fixture = () => {
  const values = new Map<string, string>();
  let failingKey = '';
  const storage = createWorkoutStorage({
    get: async key => values.get(key) ?? null,
    set: async (key, value) => { if (key === failingKey) throw new Error('Disco indisponível'); values.set(key, value); },
    remove: async key => { values.delete(key); },
  });
  return { values, storage, fail: (key: string) => { failingKey = key; } };
};
test('persistência: interrupção não substitui a última sessão confirmada; logout limpa ambos os slots', async () => {
  const f = fixture();
  const old = { series: [1], notes: 'Treino recuperável' };
  await f.storage.write('owner', old);
  f.fail('fit.workout.owner.b.1');
  await assert.rejects(f.storage.write('owner', { series: [1, 2], notes: 'x'.repeat(8000) }));
  assert.deepEqual(await f.storage.read('owner'), old);
  await f.storage.clear('owner');
  assert.equal(f.values.size, 0, 'inclui os fragmentos do salvamento interrompido');
});
test('persistência: fragmentos preservam Unicode e respeitam o limite em bytes do SecureStore', async () => {
  const f = fixture(), original = { name: '🏋🏽 Exercício com acentuação '.repeat(800) };
  await f.storage.write('owner', original);
  assert.deepEqual(await f.storage.read('owner'), original);
  for (const [key, value] of f.values) if (/\.[ab]\.\d+$/.test(key)) assert.ok(Buffer.byteLength(value, 'utf8') <= 1800);
});
test('persistência: escritas simultâneas não misturam sessões nem contas', async () => {
  const f = fixture();
  await Promise.all([f.storage.write('owner', { series: [1] }), f.storage.write('owner', { series: [1, 2] }), f.storage.write('other', { series: [3] })]);
  assert.deepEqual(await f.storage.read('owner'), { series: [1, 2] });
  assert.deepEqual(await f.storage.read('other'), { series: [3] });
  await f.storage.clear('owner');
  assert.deepEqual(await f.storage.read('other'), { series: [3] });
});
