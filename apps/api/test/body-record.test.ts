import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyMeasurementInputSchema } from '@fit/contracts';
import { bodyValuesForEntry } from '../../mobile/src/utils/body-record.js';
import { createBodyReminderSynchronizer, defaultBodyReminders, expoWeekday, readBodyReminders, validBodyReminderTime, validBodyReminderWeekdays } from '../../mobile/src/utils/body-reminder-plan.js';
test('peso e medidas possuem payloads independentes, mantendo a leitura de registros mistos antigos', () => {
  const values = { weightKg: 75, waistCm: 80, hipsCm: null };
  assert.deepEqual(bodyValuesForEntry(values, 'weight'), { weightKg: 75, waistCm: null, hipsCm: null });
  assert.deepEqual(bodyValuesForEntry(values, 'measurements'), { weightKg: null, waistCm: 80, hipsCm: null });
  assert.deepEqual(bodyValuesForEntry(values, 'full'), values);
  assert.equal(bodyMeasurementInputSchema.safeParse({ date: '2026-11-02', ...bodyValuesForEntry(values, 'weight') }).success, true);
  assert.equal(bodyMeasurementInputSchema.safeParse({ date: '2026-11-02', ...bodyValuesForEntry(values, 'measurements') }).success, true);
  assert.equal(bodyMeasurementInputSchema.safeParse({ date: '2026-11-02', ...bodyValuesForEntry({ weightKg: 75, waistCm: null }, 'measurements') }).success, false);
});
test('lembretes são desligados por padrão, independentes e validam horário e preferências corrompidas', () => {
  assert.deepEqual(readBodyReminders(null), defaultBodyReminders());
  assert.deepEqual(readBodyReminders('bad'), defaultBodyReminders());
  assert.equal(validBodyReminderTime('24:00'), false);
  const prefs = readBodyReminders(JSON.stringify({ weight: { enabled: true, time: '09:00' }, measurements: { enabled: false, time: '10:30' } }));
  assert.equal(prefs.weight.enabled, true); assert.equal(prefs.measurements.enabled, false);
  assert.equal(prefs.measurements.time, '10:30');
  assert.deepEqual(readBodyReminders(JSON.stringify({ weight: { enabled: true, time: '99:00' } })).weight, defaultBodyReminders().weight);
});

test('sincronização substitui horários sem duplicar, cancela logout e descarta agendamento atrasado', async () => {
  const notifications = new Set<string>();
  let active = true;
  const sync = createBodyReminderSynchronizer({ listOwned: async () => [...notifications], cancel: async id => { notifications.delete(id); }, prepare: async () => {}, schedule: async (user, kind, time) => { const id = `${user}:${kind}:${time}`; notifications.add(id); return id; } });
  const prefs = defaultBodyReminders(); prefs.weight.enabled = true;
  await sync('owner', prefs); await sync('owner', prefs);
  assert.deepEqual([...notifications], ['owner:weight:08:00']);
  prefs.measurements.enabled = true; prefs.weight.time = '10:00'; await sync('owner', prefs);
  assert.equal(notifications.size, 2); assert.equal(notifications.has('owner:weight:08:00'), false);
  await sync(null); assert.equal(notifications.size, 0);
  const late = createBodyReminderSynchronizer({ listOwned: async () => [], cancel: async id => { notifications.delete(id); }, prepare: async () => {}, schedule: async () => { active = false; notifications.add('late'); return 'late'; } });
  await late('owner', prefs, () => active); assert.equal(notifications.size, 0);
  await sync('other', defaultBodyReminders()); assert.equal(notifications.size, 0);
});

test('lembretes por dias da semana agendam um gatilho por dia e convertem preferências antigas', async () => {
  const legacy = readBodyReminders(JSON.stringify({ weight: { enabled: true, time: '08:00' } }));
  assert.deepEqual(legacy.weight.weekdays, [1, 2, 3, 4, 5, 6, 7]);
  // Legacy weekly values used Expo numbering (domingo = 1): 2 = segunda, 7 = sábado.
  const migrated = readBodyReminders(JSON.stringify({ weight: { enabled: true, time: '09:15', frequency: 'weekly', weekday: 2 }, measurements: { enabled: true, time: '10:30', frequency: 'weekly', weekday: 1 } }));
  assert.deepEqual([migrated.weight.weekdays, migrated.measurements.weekdays], [[1], [7]]);
  assert.deepEqual(readBodyReminders(JSON.stringify({weight:{enabled:true,time:'08:00',frequency:'weekly',weekday:8}})).weight.weekdays,[7]);
  assert.deepEqual(readBodyReminders(JSON.stringify({weight:{enabled:true,time:'08:00',weekdays:[5,1,3]}})).weight.weekdays,[1,3,5]);
  assert.deepEqual(readBodyReminders(JSON.stringify({weight:{enabled:true,time:'08:00',weekdays:[0,9]}})).weight.weekdays,[1,2,3,4,5,6,7]);
  assert.equal(validBodyReminderWeekdays([]), false);
  assert.deepEqual([1, 6, 7].map(expoWeekday), [2, 7, 1]);
  const calls: unknown[] = [];
  const sync = createBodyReminderSynchronizer({ listOwned: async () => [], cancel: async () => {}, prepare: async () => {}, schedule: async (_user, kind, time, weekday) => { calls.push({ kind, time, weekday }); return `${kind}:${weekday}`; } });
  await sync('owner', { weight: { enabled: true, time: '09:15', weekdays: [1, 3, 5] }, measurements: { enabled: true, time: '10:30', weekdays: [1, 2, 3, 4, 5, 6, 7] } });
  assert.deepEqual(calls, [{kind:'weight',time:'09:15',weekday:1},{kind:'weight',time:'09:15',weekday:3},{kind:'weight',time:'09:15',weekday:5},{kind:'measurements',time:'10:30',weekday:null}]);
});
