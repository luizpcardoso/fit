import { ApiClientError, type createApiClient } from '@fit/api-client';
import { consumptionGoal, dietMacros, mealSyncEntrySchema, type DailyNutritionSummary, type DietView, type FavoriteMeal, type Food, type Meal, type MealInput, type MealItem, type MealSyncEntry, type NutritionValues } from '@fit/contracts';
import { createDeferredSync } from './deferred-sync';

type Api = ReturnType<typeof createApiClient>;
type Cached<T> = { at: number; value: T };
export type QueuedMeal = { request: MealSyncEntry; preview: Meal; attempted: boolean; error?: string; serverId?: string };
export type StoredMeals = { entries: QueuedMeal[]; foods?: Cached<Food[]>; diets?: Cached<DietView[]>; favorites?: Cached<FavoriteMeal[]>; days: Record<string, Cached<DailyNutritionSummary>> };
export type MealSyncState = { ready: boolean; syncing: boolean; revision: number; error: string; entries: QueuedMeal[] };
const empty = (): StoredMeals => ({ entries: [], days: {} });
const round = (n: number) => Math.round(n * 1000) / 1000;
const sumItems = (items: NutritionValues[]): NutritionValues => ({ calories: round(items.reduce((n, x) => n + x.calories, 0)), protein: round(items.reduce((n, x) => n + x.protein, 0)), carbs: round(items.reduce((n, x) => n + x.carbs, 0)), fat: round(items.reduce((n, x) => n + x.fat, 0)), fiber: items.some(x => x.fiber != null) ? round(items.reduce((n, x) => n + (x.fiber ?? 0), 0)) : null });
const emptySummary = (date: string): DailyNutritionSummary => ({ date, consumed: null, expenditure: null, energyEstimate: undefined, consumptionGoal: consumptionGoal(null, 0), balance: null, status: 'incomplete', meals: [] });

/** Preview only: the server recomputes catalog, favorite and prescription nutrition. */
export function previewQueuedMeal(request: MealSyncEntry, cache: StoredMeals, timestamp: string): Meal {
  let name: string, mode: Meal['mode'], items: MealItem[] = [], totals: NutritionValues;
  let category = request.input.category ?? null;
  if (request.kind === 'meal') {
    name = request.input.name;
    mode = request.input.items ? 'items' : 'direct';
    items = (request.input.items ?? []).map((entry, index) => {
      const food = cache.foods?.value.find(f => f.id === entry.foodId);
      if (!food) throw new Error('Abra seus alimentos com conexão antes de usá-los sem internet.');
      const factor = entry.quantity / food.servingAmount;
      return { id: `${request.id}-${index}`, foodId: food.id, foodName: food.name, servingAmount: food.servingAmount, servingUnit: food.servingUnit, quantity: entry.quantity, calories: round(food.calories * factor), protein: round(food.protein * factor), carbs: round(food.carbs * factor), fat: round(food.fat * factor), fiber: food.fiber == null ? null : round(food.fiber * factor) };
    });
    totals = request.input.directNutrition ?? sumItems(items);
  } else if (request.kind === 'favorite') {
    const favorite = cache.favorites?.value.find(f => f.id === request.favoriteId);
    if (!favorite) throw new Error('Abra suas favoritas com conexão antes de usá-las sem internet.');
    name = favorite.name; mode = favorite.mode;
    if (request.input.category === undefined) category = favorite.category ?? null;
    const factor = request.input.multiplier;
    const scale = (value: NutritionValues): NutritionValues => ({ calories: round(value.calories * factor), protein: round(value.protein * factor), carbs: round(value.carbs * factor), fat: round(value.fat * factor), fiber: value.fiber == null ? null : round(value.fiber * factor) });
    totals = scale(favorite);
    items = favorite.items.map((item, index) => ({ ...item, ...scale(item), id: `${request.id}-${index}`, quantity: round(item.quantity * factor) }));
  } else {
    const diet = cache.diets?.value.find(d => d.id === request.input.assignmentId && d.status === 'active');
    const meal = diet?.meals[request.input.mealIndex], option = meal?.options[request.input.optionIndex];
    if (!meal || !option || option.items.length !== request.input.quantities.length) throw new Error('Abra sua dieta com conexão antes de registrar esse consumo sem internet.');
    name = request.input.name ?? meal.name; mode = 'items';
    totals = dietMacros(option.items, request.input.quantities);
    items = option.items.map((item, index) => ({ id: `${request.id}-${index}`, foodId: null, foodName: item.food.name, servingAmount: item.food.servingAmount, servingUnit: item.food.servingUnit, quantity: request.input.quantities[index], ...dietMacros([item], [request.input.quantities[index]]), fiber: null }));
  }
  return { id: request.id, name, category, mode, date: request.input.date, time: request.input.time, ...totals, fiber: totals.fiber ?? null, items, createdAt: timestamp, updatedAt: timestamp };
}

export function overlayMeals(summary: DailyNutritionSummary, entries: QueuedMeal[]): DailyNutritionSummary {
  const hidden = new Set(entries.flatMap(e => [e.request.id, ...(e.serverId ? [e.serverId] : [])]));
  const meals = [...summary.meals.filter(m => !hidden.has(m.id) && (!m.syncId || !hidden.has(m.syncId))), ...entries.filter(e => !e.request.cancelled && e.preview.date === summary.date).map(e => e.preview)].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const consumed = meals.length ? sumItems(meals) : null;
  const energy = summary.energyEstimate?.totalCalories ?? summary.expenditure?.totalCalories ?? null;
  const balance = consumed && energy !== null ? round(consumed.calories - energy) : null;
  return { ...summary, meals, consumed, balance, status: balance === null ? 'incomplete' : Math.abs(balance) < 1 ? 'balanced' : balance < 0 ? 'deficit' : 'surplus', consumptionGoal: consumptionGoal(summary.consumptionGoal.targetCalories, consumed?.calories ?? 0) };
}

export function createMealSync(options: { owner: string; api: Api; uuid(): string; storage: { read(): Promise<StoredMeals | null>; write(value: StoredMeals): Promise<void>; clear(): Promise<void> }; onChange(state: MealSyncState): void; clock?: Parameters<typeof createDeferredSync>[0]['clock'] }) {
  let data = empty(), active = true, ready = false, syncing = false, revision = 0, error = '', serialQueue = Promise.resolve();
  let resolveReady!: () => void, rejectReady!: (e: unknown) => void;
  const hydrated = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  void hydrated.catch(() => {});
  let initialization: Promise<void> | null = null;
  const now = options.clock?.now ?? Date.now;
  const inFlight = new Map<string, Promise<unknown>>();
  let lastReadDate: string | undefined;
  let cacheGeneration = 0;
  const removals = new Map<string, number>();
  const confirmations = new Map<string, { revision: number; meal: Meal }>();
  const snapshot = (): MealSyncState => ({ ready, syncing, revision, error, entries: data.entries });
  const publish = () => { if (active) options.onChange(snapshot()); };
  const assertActive = () => { if (!active) throw new Error('A conta mudou. Abra o formulário novamente.'); };
  const serial = <T,>(work: () => Promise<T>) => { const next = serialQueue.then(work); serialQueue = next.then(() => {}, () => {}); return next; };
  const commit = async (next: StoredMeals) => {
    assertActive();
    const recent = Object.entries(next.days).sort(([, a], [, b]) => b.at - a.at).slice(0, 14);
    if (lastReadDate && next.days[lastReadDate] && !recent.some(([date]) => date === lastReadDate)) { recent.pop(); recent.push([lastReadDate, next.days[lastReadDate]]); }
    const days = Object.fromEntries(recent);
    await options.storage.write({ ...next, days });
    assertActive();
    if (next.entries !== data.entries) revision += 1;
    data = { ...next, days }; publish();
  };
  const retryable = (cause: unknown) => !(cause instanceof ApiClientError) || cause.status >= 500 || cause.status === 429;
  const once = <T,>(key: string, work: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key); if (existing) return existing as Promise<T>;
    const next = work(); inFlight.set(key, next);
    void next.finally(() => { if (inFlight.get(key) === next) inFlight.delete(key); }).catch(() => {});
    return next;
  };
  const references = async <K extends 'foods' | 'diets' | 'favorites'>(key: K, fetcher: () => Promise<NonNullable<StoredMeals[K]>['value']>): Promise<NonNullable<StoredMeals[K]>['value']> => {
    await hydrated; await serialQueue; assertActive();
    const stored = data[key]; if (stored && now() - stored.at < 300_000) return stored.value;
    const generation = cacheGeneration;
    const result = await once(key, async () => {
      try {
        const value = await fetcher(); assertActive();
        await serial(async () => { if (generation === cacheGeneration) await commit({ ...data, [key]: { at: now(), value } }); });
        return value;
      } catch (cause) {
        assertActive(); if (!retryable(cause)) throw cause;
        error = 'Sem conexão. Usando os dados disponíveis neste aparelho.'; publish();
        return data[key]?.value ?? [];
      }
    });
    return generation === cacheGeneration ? result : references(key, fetcher);
  };
  const getSummary = async (date: string): Promise<DailyNutritionSummary> => {
    lastReadDate = date;
    await hydrated; await serialQueue; assertActive();
    const stored = data.days[date];
    if (stored && now() - stored.at < 300_000) return overlayMeals(stored.value, data.entries);
    const generation = cacheGeneration;
    await once(`day:${date}`, async () => {
      const atRevision = revision;
      try {
        const value = await options.api.getNutritionSummary(date); assertActive();
        await serial(async () => {
          if (generation !== cacheGeneration) return;
          const changed = [...confirmations.values()].filter(c => c.revision > atRevision && c.meal.date === date).map(c => c.meal);
          const ids = new Set(changed.map(m => m.id));
          const deleted = new Set([...removals].filter(([, at]) => at > atRevision).map(([id]) => id));
          await commit({ ...data, days: { ...data.days, [date]: { at: now(), value: { ...value, meals: [...value.meals.filter(m => !ids.has(m.id) && !deleted.has(m.id) && (!m.syncId || !deleted.has(m.syncId))), ...changed] } } } });
        });
      } catch (cause) {
        assertActive(); if (!retryable(cause)) throw cause;
        error = 'Sem conexão. Usando os dados disponíveis neste aparelho.'; publish();
        if (!data.days[date] && !data.entries.some(e => e.preview.date === date)) throw cause;
      }
    });
    return generation === cacheGeneration ? overlayMeals(data.days[date]?.value ?? emptySummary(date), data.entries) : getSummary(date);
  };
  const send = async () => {
    await hydrated; await serialQueue; assertActive();
    let sent: QueuedMeal[] = [];
    try {
      await serial(async () => {
        sent = data.entries.filter(e => !e.error).slice(0, 25).map(e => ({ ...e, attempted: true }));
        if (sent.length) { const ids = new Set(sent.map(e => e.request.id)); await commit({ ...data, entries: data.entries.map(e => ids.has(e.request.id) ? { ...e, attempted: true } : e) }); }
      });
    } catch (cause) { error = 'Não foi possível preparar o envio. Seus registros continuam salvos. Confira o armazenamento do aparelho e tente novamente.'; publish(); throw cause; }
    if (!sent.length) return;
    syncing = true; error = ''; publish();
    try {
      const results = await options.api.syncMeals(sent.map(e => e.request), options.owner); assertActive();
      if (!Array.isArray(results) || results.some(r => r.status !== 'saved' && r.status !== 'rejected' || r.status === 'saved' && !('meal' in r)) || results.length !== sent.length || new Set(results.map(r => r.id)).size !== sent.length || results.some(r => !sent.some(e => e.request.id === r.id))) throw new Error('Resposta incompleta.');
      await serial(async () => {
        let entries = data.entries, days = { ...data.days };
        for (const result of results) {
          const current = entries.find(e => e.request.id === result.id), original = sent.find(e => e.request.id === result.id);
          if (!current || !original) continue;
          if (result.status === 'rejected') { entries = entries.map(e => e === current ? { ...e, error: result.message } : e); continue; }
          if (current.request.cancelled && !original.request.cancelled) { entries = entries.map(e => e === current ? { ...e, serverId: result.meal?.id, error: undefined } : e); continue; }
          entries = entries.filter(e => e !== current);
          if (!result.meal) {
            removals.set(result.id, revision + 1);
            if (current.serverId) removals.set(current.serverId, revision + 1);
            for (const [id, item] of confirmations) if (item.meal.syncId === result.id || id === current.serverId) confirmations.delete(id);
            while (removals.size > 200) removals.delete(removals.keys().next().value!);
          }
          if (result.meal) {
            const meal = result.meal;
            const base = days[meal.date]?.value ?? emptySummary(meal.date);
            days[meal.date] = { at: days[meal.date]?.at ?? 0, value: { ...base, meals: [...base.meals.filter(m => m.id !== meal.id), meal] } };
            confirmations.set(meal.id, { revision: revision + 1, meal });
            if (confirmations.size > 100) confirmations.delete(confirmations.keys().next().value!);
          } else {
            days = Object.fromEntries(Object.entries(days).map(([date, item]) => [date, { ...item, value: { ...item.value, meals: item.value.meals.filter(m => m.id !== current.serverId && m.syncId !== result.id) } }]));
          }
        }
        error = entries.some(e => e.error) ? 'Há registros pendentes que precisam de revisão.' : '';
        await commit({ ...data, entries, days });
      });
    } catch (cause) {
      if (active) { if (!retryable(cause)) await serial(() => commit({ ...data, entries: data.entries.map(e => sent.some(s => s.request.id === e.request.id) ? { ...e, error: 'Não foi possível confirmar este registro. Tente enviar novamente ou remova-o.' } : e) })); error = retryable(cause) ? 'Salvo neste aparelho. O envio será tentado novamente quando houver conexão.' : cause instanceof Error ? cause.message : 'Não foi possível sincronizar.'; publish(); }
      throw cause;
    } finally { syncing = false; publish(); }
  };
  const scheduler = createDeferredSync({ run: send, pending: () => active && ready && data.entries.some(e => !e.error), clock: options.clock });
  const enqueue = async (request: MealSyncEntry) => {
    await hydrated; await serialQueue; assertActive();
    const parsed = mealSyncEntrySchema.parse(request);
    await serial(async () => {
      if (data.entries.length >= 100) throw new Error('Sincronize os registros pendentes antes de adicionar outros.');
      if (data.entries.some(e => e.request.id === parsed.id)) return;
      const preview = previewQueuedMeal(parsed, data, new Date(now()).toISOString());
      await commit({ ...data, entries: [...data.entries, { request: parsed, preview, attempted: false }] });
    });
    scheduler.schedule(); return { id: parsed.id };
  };
  const invalidate = async () => { cacheGeneration += 1; inFlight.clear(); await hydrated; await serial(() => commit({ ...data, foods: data.foods && { ...data.foods, at: 0 }, favorites: data.favorites && { ...data.favorites, at: 0 }, diets: data.diets && { ...data.diets, at: 0 }, days: Object.fromEntries(Object.entries(data.days).map(([date, item]) => [date, { ...item, at: 0 }])) })); };
  const updateMeal = async (id: string, input: MealInput) => {
    await hydrated; await serialQueue; assertActive();
    if (!data.entries.some(e => e.request.id === id)) { await options.api.updateMeal(id, input); await invalidate(); return; }
    await serial(async () => {
      const entry = data.entries.find(e => e.request.id === id)!;
      if (entry.attempted) throw new Error('Este registro aguarda confirmação. Sincronize antes de editá-lo ou remova-o e registre novamente.');
      const request = mealSyncEntrySchema.parse({ id, kind: 'meal', input });
      const preview = previewQueuedMeal(request, data, entry.preview.createdAt);
      await commit({ ...data, entries: data.entries.map(e => e === entry ? { request, preview, attempted: false } : e) });
    });
    scheduler.schedule();
  };
  const deleteMeal = async (id: string) => {
    await hydrated; await serialQueue; assertActive();
    if (!data.entries.some(e => e.request.id === id)) { await options.api.deleteMeal(id); await invalidate(); return; }
    await serial(async () => {
      const entry = data.entries.find(e => e.request.id === id)!;
      await commit({ ...data, entries: entry.attempted ? data.entries.map(e => e === entry ? { ...e, request: { ...e.request, cancelled: true }, error: undefined } : e) : data.entries.filter(e => e !== entry) });
    });
    scheduler.schedule();
  };
  const api = { ...options.api,
    listFoods: () => references('foods', options.api.listFoods), listDiets: () => references('diets', options.api.listDiets), listFavoriteMeals: () => references('favorites', options.api.listFavoriteMeals),
    getNutritionSummary: getSummary, listMeals: async (date: string) => (await getSummary(date)).meals,
    createMeal: (input: MealInput) => enqueue({ id: options.uuid(), kind: 'meal', input }),
    recordDietMeal: (input: Parameters<Api['recordDietMeal']>[0]) => enqueue({ id: input.requestId, kind: 'diet', input }),
    reuseFavoriteMeal: (favoriteId: string, date: string, time: string, multiplier: number, category?: Meal['category']) => enqueue({ id: options.uuid(), kind: 'favorite', favoriteId, input: { date, time, multiplier, category } }),
    updateMeal, deleteMeal,
  };
  return { api, snapshot, cachedSummary: (date: string) => data.days[date] || data.entries.some(e => e.preview.date === date) ? overlayMeals(data.days[date]?.value ?? emptySummary(date), data.entries) : null,
    init: () => {
      active = true; scheduler.resume();
      initialization ??= (async () => { try { const stored = await options.storage.read(); assertActive(); if (stored) { stored.entries.forEach(e => mealSyncEntrySchema.parse(e.request)); data = stored; } ready = true; publish(); resolveReady(); if (data.entries.length) void scheduler.flush(); } catch (cause) { error = 'Não foi possível recuperar os registros deste aparelho. Reinicie o aplicativo para tentar novamente.'; publish(); rejectReady(cause); } })();
      return initialization;
    },
    sync: async () => {
      await hydrated; if (!data.entries.length) return;
      await serial(() => commit({ ...data, entries: data.entries.map(e => ({ ...e, error: undefined })) }));
      for (let batch = 0; batch < 4; batch++) {
        const before = data.entries.filter(e => !e.error).length;
        if (!before) break;
        await scheduler.flush(true);
        if (data.entries.filter(e => !e.error).length >= before) break;
      }
    },
    checkpoint: () => scheduler.flush(),
    refresh: async () => { await scheduler.flush(true); await invalidate(); revision += 1; publish(); },
    invalidate,
    dispose: () => { active = false; scheduler.dispose(); },
    clear: async () => { active = false; scheduler.dispose(); await serialQueue; await options.storage.clear(); },
  };
}
