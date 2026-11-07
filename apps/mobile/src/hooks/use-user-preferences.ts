import { useAuth } from '@/auth/auth-context';
import { mealCategoryTime, type MealCategory, type UpdateUserPreferences, type UserPreferences } from '@fit/contracts';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Account preferences (`/me/preferences`), kept in memory per signed-in user and shared by
 * every screen. Nothing is persisted on the device; a failed load falls back to defaults.
 */
const defaults: UserPreferences = { mealCategoryTimes: {} };
let state: { userId: string | null; value: UserPreferences; loaded: boolean } = { userId: null, value: defaults, loaded: false };
let loading: string | null = null;
const listeners = new Set<() => void>();
const set = (next: typeof state) => { state = next; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => state;

type Api = ReturnType<typeof useAuth>['api'];
async function load(api: Api, userId: string) {
  if (loading === userId) return;
  loading = userId;
  if (state.userId !== userId) set({ userId, value: defaults, loaded: false });
  try {
    const value = await api.getPreferences();
    if (state.userId === userId) set({ userId, value, loaded: true });
  } catch { /* Defaults keep the forms usable; the next mount retries. */ }
  finally { if (loading === userId) loading = null; }
}

export function useUserPreferences() {
  const { user, api } = useAuth();
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const userId = user?.id ?? null;
  useEffect(() => { if (userId && (state.userId !== userId || !state.loaded)) void load(api, userId); }, [api, userId]);
  const preferences = current.userId === userId ? current.value : defaults;
  const save = useCallback(async (input: UpdateUserPreferences) => {
    if (!userId) return;
    const previous = state;
    set({ userId, value: { ...previous.value, ...input } as UserPreferences, loaded: previous.loaded });
    try { const value = await api.updatePreferences(input); if (state.userId === userId) set({ userId, value, loaded: true }); }
    catch (error) { if (state.userId === userId) set(previous); throw error; }
  }, [api, userId]);
  return { preferences, save };
}

/** Category time suggestions that respect the person's saved times. */
export function useMealCategoryTimes() {
  const { preferences, save } = useUserPreferences();
  const custom = preferences.mealCategoryTimes;
  const timeFor = useCallback((category?: MealCategory | null) => mealCategoryTime(category, custom), [custom]);
  return { custom, timeFor, save: (times: Partial<Record<MealCategory, string>>) => save({ mealCategoryTimes: times }) };
}
