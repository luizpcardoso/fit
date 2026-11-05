import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { createApiClient } from '@fit/api-client';
import type { DailyNutritionSummary, Meal, MealSyncEntry, MealSyncResult } from '@fit/contracts';
import { createDeferredSync } from '../../mobile/src/utils/deferred-sync.js';
import { createMealSync, overlayMeals, type StoredMeals } from '../../mobile/src/utils/meal-sync-core.js';

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function fakeClock() {
  let time = Date.now(), next = 0;
  const timers = new Map<number, { at: number; work(): void }>();
  return { now: () => time, set: (work: () => void, ms: number) => { const id = ++next; timers.set(id, { at: time + ms, work }); return id; }, clear: (id: unknown) => { timers.delete(Number(id)); },
    advance: async (ms: number) => { const target = time + ms; for (;;) { const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; time = due[1].at; timers.delete(due[0]); due[1].work(); await settle(); } time = target; await settle(); },
  };
}
const date = '2026-11-04';
const input = { name: 'Marmita congelada', category: 'lunch' as const, date, time: '12:47', directNutrition: { calories: 500, protein: 30, carbs: 60, fat: 15 } };
const summary: DailyNutritionSummary = { date, consumed: null, expenditure: null, energyEstimate: undefined, balance: null, status: 'incomplete', consumptionGoal: { targetCalories: 2000, remainingCalories: 2000, progress: 0 }, meals: [] };
function fixture() {
  const clock = fakeClock(), owner = randomUUID();
  let saved: StoredMeals | null = { entries: [], days: { [date]: { at: clock.now(), value: summary } } }, writeFails = false, offline = false, loseResponse = false;
  let hold: (() => Promise<void>) | null = null;
  const requests: MealSyncEntry[][] = [], server = new Map<string, Meal | null>();
  const api = {
    getNutritionSummary: async (day: string) => { if (offline) throw new Error('Sem conexão'); return { ...summary, date: day }; },
    listFoods: async () => [], listDiets: async () => [], listFavoriteMeals: async () => [],
    syncMeals: async (entries: MealSyncEntry[], expectedOwner: string): Promise<MealSyncResult[]> => {
      assert.equal(expectedOwner, owner); requests.push(structuredClone(entries));
      if (offline) throw new Error('Sem conexão');
      if (hold) await hold();
      const results = entries.map(entry => {
        if (entry.cancelled) server.set(entry.id, null);
        if (!server.has(entry.id)) server.set(entry.id, { id: randomUUID(), syncId: entry.id, name: entry.kind === 'meal' ? entry.input.name : input.name, category: input.category, date: entry.input.date, time: entry.input.time, ...input.directNutrition, fiber: null, items: [], mode: 'direct', createdAt: new Date(clock.now()).toISOString(), updatedAt: new Date(clock.now()).toISOString() });
        return { id: entry.id, status: 'saved' as const, meal: server.get(entry.id)! };
      });
      if (loseResponse) { loseResponse = false; throw new Error('Resposta perdida'); }
      return results;
    },
  } as unknown as ReturnType<typeof createApiClient>;
  const make = () => createMealSync({ owner, api, uuid: randomUUID, clock,
    storage: { read: async () => structuredClone(saved), write: async value => { if (writeFails) throw new Error('Armazenamento indisponível'); saved = structuredClone(value); }, clear: async () => { saved = null; } }, onChange: () => {},
  });
  return { clock, make, requests, server, api, saved: () => saved, failWrites: (value: boolean) => { writeFails = value; }, offline: (value: boolean) => { offline = value; }, loseResponse: () => { loseResponse = true; }, hold: (value: (() => Promise<void>) | null) => { hold = value; } };
}

test('sincronização: agrupa refeições por minuto e treino por cinco minutos, sem consulta ociosa', async () => {
  for(const delay of [60_000,300_000]) {
    const clock = fakeClock(); let dirty = false, calls = 0;
    const sync = createDeferredSync({ clock, delay, pending: () => dirty, run: async () => { calls++; dirty = false; } });
    sync.schedule(); await clock.advance(300_000); assert.equal(calls, 0);
    dirty = true; for (let i = 0; i < 50; i++) sync.schedule();
    await clock.advance(delay - 1); assert.equal(calls, 0);
    await clock.advance(1); assert.equal(calls, 1);
    await clock.advance(300_000); assert.equal(calls, 1);
    sync.dispose();
  }
});

test('sincronização: falhas têm espera progressiva, eventos de foco não provocam uma sequência de tentativas', async () => {
  const clock = fakeClock(); let calls = 0;
  const sync = createDeferredSync({ clock, pending: () => true, run: async () => { calls++; throw new Error('offline'); } });
  sync.schedule(); await clock.advance(60_000); assert.equal(calls, 1);
  for (let i = 0; i < 20; i++) await sync.flush();
  assert.equal(calls, 1);
  await clock.advance(60_000); assert.equal(calls, 2);
  await clock.advance(119_999); assert.equal(calls, 2);
  sync.dispose(); await clock.advance(600_000); assert.equal(calls, 2);
});

test('refeições: gravam localmente, recuperam após reabrir e uma resposta perdida não duplica consumo', async () => {
  const f = fixture(); f.offline(true);
  const first = f.make(); await first.init();
  await first.api.createMeal(input); await first.api.createMeal({ ...input, name: 'Segunda marmita' });
  assert.equal(f.requests.length, 0); assert.equal(f.saved()!.entries.length, 2);
  assert.equal((await first.api.getNutritionSummary(date)).consumed!.calories, 1000);
  first.dispose();
  const reopened = f.make(); await reopened.init(); await settle();
  assert.equal(reopened.snapshot().entries.length, 2); assert.equal(f.requests.length, 1);
  f.offline(false); f.loseResponse(); await reopened.sync();
  assert.equal(f.server.size, 2); assert.equal(reopened.snapshot().entries.length, 2);
  // A fetched server row is hidden while its local acknowledgement is pending.
  const remote = [...f.server.values()].filter((row): row is Meal => !!row);
  assert.equal(overlayMeals({ ...summary, meals: remote }, reopened.snapshot().entries).consumed!.calories, 1000);
  await reopened.sync();
  assert.equal(f.server.size, 2); assert.equal(reopened.snapshot().entries.length, 0);
  assert.equal((await reopened.api.getNutritionSummary(date)).consumed!.calories, 1000);
  reopened.dispose();
});

test('refeições: confirmação em andamento preserva novos registros e uma remoção concorrente', async () => {
  const f = fixture(), controller = f.make(); await controller.init();
  const one = await controller.api.createMeal(input);
  let release!: () => void;
  f.hold(() => new Promise<void>(resolve => { release = resolve; }));
  const sending = controller.sync(); await settle();
  await controller.api.deleteMeal(one.id);
  const two = await controller.api.createMeal(input);
  release(); await sending; f.hold(null);
  assert.equal(controller.snapshot().entries.length, 2);
  assert.equal(controller.snapshot().entries.find(e => e.request.id === one.id)!.request.cancelled, true);
  assert.equal(f.requests.length, 1, 'não envia a segunda refeição a cada mudança');
  await controller.sync();
  assert.equal(f.server.get(one.id), null); assert.ok(f.server.get(two.id));
  assert.equal((await controller.api.getNutritionSummary(date)).consumed!.calories, 500);
  controller.dispose();
});

test('refeições: erro de armazenamento não confirma salvamento; sair limpa somente a conta da fila', async () => {
  const f = fixture(), controller = f.make(); await controller.init();
  f.failWrites(true);
  await assert.rejects(controller.api.createMeal(input), /Armazenamento/);
  assert.equal(controller.snapshot().entries.length, 0); assert.equal(f.requests.length, 0);
  f.failWrites(false); await controller.api.createMeal(input);
  await controller.clear(); await f.clock.advance(300_000);
  assert.equal(f.requests.length, 0); assert.equal(f.saved(), null);
  await assert.rejects(controller.api.createMeal(input), /conta mudou/);
});


test('refeições: uma leitura anterior não recria no cache uma pendência cancelada', async () => {
  const f = fixture(), controller = f.make(); await controller.init();
  const created = await controller.api.createMeal(input);
  f.loseResponse(); await controller.sync();
  const row = f.server.get(created.id)!;
  let release!: () => void;
  f.api.getNutritionSummary = async () => { await new Promise<void>(resolve => { release = resolve; }); return {...summary, meals:[row]}; };
  await controller.invalidate();
  const reading = controller.api.getNutritionSummary(date); await settle();
  await controller.api.deleteMeal(created.id); await controller.sync();
  release();
  assert.equal((await reading).meals.length, 0);
  assert.equal(controller.cachedSummary(date)!.meals.length, 0);
  controller.dispose();
});

test('refeições: fila limitada a 100, envio manual em lotes e cache preserva a data consultada', async () => {
  const f = fixture(); f.saved()!.days = Object.fromEntries(Array.from({length:14},(_,i)=>[`2026-09-${String(i+1).padStart(2,'0')}`, {at:f.clock.now(),value:{...summary,date:`2026-09-${String(i+1).padStart(2,'0')}`}}]));
  f.offline(true); const controller = f.make(); await controller.init();
  const first = await controller.api.createMeal(input);
  await controller.api.getNutritionSummary(date);
  for(let i=1;i<100;i++) await controller.api.createMeal({...input,date:`2026-10-${String((i%28)+1).padStart(2,'0')}`});
  await assert.rejects(controller.api.createMeal(input), /Sincronize/);
  f.offline(false); await controller.sync();
  assert.deepEqual(f.requests.map(batch=>batch.length),[25,25,25,25]);
  assert.equal(controller.snapshot().entries.length,0);
  assert.equal(Object.keys(f.saved()!.days).length,14);
  assert.ok(controller.cachedSummary(date)!.meals[0].id !== first.id);
  controller.dispose(); await f.clock.advance(300_000); assert.equal(f.requests.length,4);
});


test('refeições: cancelar uma confirmação perdida remove também a cópia já recebida em consulta', async () => {
  const f = fixture(), controller = f.make(); await controller.init();
  const record = await controller.api.createMeal(input);
  f.loseResponse(); await controller.sync();
  const row = f.server.get(record.id)!;
  f.api.getNutritionSummary = async () => ({...summary,meals:[row]});
  await controller.invalidate(); await controller.api.getNutritionSummary(date);
  assert.equal(controller.cachedSummary(date)!.meals.length,1);
  await controller.api.deleteMeal(record.id); await controller.sync();
  assert.equal(f.server.get(record.id),null);
  assert.equal(controller.cachedSummary(date)!.meals.length,0);
  controller.dispose();
});


test('cache: uma consulta anterior à atualização não sobrescreve a versão atual', async () => {
  const f = fixture(), controller = f.make(); await controller.init();
  await controller.invalidate(); let release!: () => void, calls = 0;
  f.api.getNutritionSummary = async () => { const call = ++calls; if(call===1)await new Promise<void>(resolve=>{release=resolve;}); return {...summary,consumptionGoal:{targetCalories:call===1?1000:2000,remainingCalories:2000,progress:0}}; };
  const previous = controller.api.getNutritionSummary(date); await settle();
  await controller.invalidate(); await controller.api.getNutritionSummary(date);
  release(); await previous;
  assert.equal(calls,2); assert.equal(controller.cachedSummary(date)!.consumptionGoal.targetCalories,2000);
  controller.dispose();
});

test('refeições: falha ao preparar envio mantém fila durável e informa armazenamento', async () => {
  const f = fixture(), controller = f.make(); await controller.init();
  await controller.api.createMeal(input); f.failWrites(true);
  await controller.checkpoint();
  assert.equal(f.requests.length,0); assert.equal(f.saved()!.entries.length,1);
  assert.match(controller.snapshot().error,/armazenamento/);
  f.failWrites(false); await controller.sync();
  assert.equal(controller.snapshot().entries.length,0);
  controller.dispose();
});
