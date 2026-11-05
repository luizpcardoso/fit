import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '@/auth/auth-context';
import { createMealSync, type MealSyncState, type StoredMeals } from '@/utils/meal-sync-core';
import { mealStorage } from '@/utils/meal-sync-storage';
import { registerPendingLocalChanges } from '@/utils/pending-local-changes';

type Controller = ReturnType<typeof createMealSync>;
type Value = MealSyncState & { api: Controller['api']; cachedSummary: Controller['cachedSummary']; sync(): Promise<void>; refresh(): Promise<void> };
const Context = createContext<Value | null>(null);
const empty: MealSyncState = { ready: false, syncing: false, revision: 0, error: '', entries: [] };
export function MealSyncProvider({ children }: PropsWithChildren) {
  const { api, user } = useAuth();
  const owner = user?.id;
  const currentOwner = useRef(owner);
  useLayoutEffect(() => { currentOwner.current = owner; }, [owner]);
  const [state, setState] = useState<{ owner?: string; value: MealSyncState }>({ value: empty });
  const controller = useMemo(() => owner ? createMealSync({ owner, api, uuid: Crypto.randomUUID,
    storage: { read: () => mealStorage.read<StoredMeals>(owner), write: value => mealStorage.write(owner, value), clear: () => mealStorage.clear(owner) },
    onChange: value => setState({ owner, value }),
  }) : null, [owner, api]);
  useLayoutEffect(() => () => controller?.dispose(), [controller]);
  useEffect(() => {
    if (!controller || !owner) return;
    void controller.init();
    const unregister = registerPendingLocalChanges(owner, async () => { const saved = await mealStorage.read<StoredMeals>(owner); return !!saved?.entries.length; });
    const sub = AppState.addEventListener('change', () => { void controller.checkpoint(); });
    const unsubscribe = api.subscribeToChanges(path => {
      if ((path.startsWith('/nutrition/') && path !== '/nutrition/meal-sync') || path.startsWith('/body-measurements') || path.includes('professional-assignments')) void controller.invalidate().catch(() => {});
    });
    return () => {
      sub.remove(); unsubscribe(); unregister(); controller.dispose();
      if (currentOwner.current !== owner) void controller.clear().catch(() => {});
    };
  }, [api, controller, owner]);
  const visible = state.owner === owner ? state.value : empty;
  return <Context.Provider value={{ ...visible, api: controller?.api ?? api, cachedSummary: date => controller?.cachedSummary(date) ?? null, sync: () => controller?.sync() ?? Promise.resolve(), refresh: () => controller?.refresh() ?? Promise.resolve() }}>{children}</Context.Provider>;
}
export function useMealSync() { const value = useContext(Context); if (!value) throw new Error('Registros de alimentação indisponíveis.'); return value; }
