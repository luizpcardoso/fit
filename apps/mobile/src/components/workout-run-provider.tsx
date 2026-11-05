import { registerPendingLocalChanges } from '@/utils/pending-local-changes';
import { createDeferredSync } from '@/utils/deferred-sync';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { ApiClientError } from '@fit/api-client';
import { isWorkoutRunOpen, workoutRunProgressSchema, type SaveWorkoutRunInput, type WorkoutPlan, type WorkoutRun, type WorkoutRunProgress } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { localDate } from '@/utils/dates';
import { clearWorkoutStorage, readWorkoutStorage, writeWorkoutStorage } from '@/utils/workout-run-storage';
import { acknowledgeWorkoutNotificationProgress, addWorkoutNotificationListener, clearWorkoutNotification, readWorkoutNotificationProgress, requestWorkoutNotificationPermission, withLocalPerformed, showWorkoutNotification, addNativeWorkoutListener } from '@/utils/workout-run-notification';

type Stored = { run: WorkoutRun | null; dirty: boolean; pending: SaveWorkoutRunInput | null; plans: WorkoutPlan[]; notificationEnabled: boolean; notificationOffered?: boolean };
type Value = { run: WorkoutRun | null; plans: WorkoutPlan[]; ready: boolean; plansLoading: boolean; notificationEnabled: boolean; notificationOffered: boolean; setNotificationEnabled(value: boolean): Promise<void>; declineNotificationOffer(): Promise<void>; dirty: boolean; saving: boolean; error: string; conflict: WorkoutRun | null; start(plan: WorkoutPlan, divisionId: string): Promise<void>; update(change: (p: WorkoutRunProgress) => WorkoutRunProgress): Promise<void>; sync(): Promise<void>; useRemote(): Promise<void>; dismiss(): Promise<void> };
const Context = createContext<Value | null>(null);
const empty: Stored = { run: null, dirty: false, pending: null, plans: [], notificationEnabled: false, notificationOffered: false };
export function WorkoutRunProvider({ children }: PropsWithChildren) {
  const { api, user, loading } = useAuth();
  const [state, setState] = useState<Stored>(empty), [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState<WorkoutRun | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const currentOwner = useRef(user?.id);
  useLayoutEffect(() => { currentOwner.current = user?.id; }, [user?.id]);
  const [loadedOwner, setLoadedOwner] = useState<string | undefined>(undefined);
  const actions = useRef<Pick<Value, 'start' | 'update' | 'sync' | 'useRemote' | 'dismiss' | 'setNotificationEnabled' | 'declineNotificationOffer'>>({ declineNotificationOffer: async () => {}, start: async () => {}, update: async () => {}, sync: async () => {}, useRemote: async () => {}, dismiss: async () => {}, setNotificationEnabled: async () => {} });
  useEffect(() => {
    if (loading) return;
    const owner = user?.id;
    let active = true, data: Stored = empty, queue = Promise.resolve(), syncing = false, blocked = false, rejected = false;
    const serial = <T,>(work: () => Promise<T>): Promise<T> => { const next = queue.then(work); queue = next.then(() => {}, () => {}); return next; };
    const commit = async (next: Stored) => {
      if (!owner || !active) return;
      await writeWorkoutStorage(owner, { ...next, plans: [] });
      if (!active) return;
      data = next; setState(next);
    };
    const notify = async () => { if (!active || !owner) return; try { if (data.run && data.notificationEnabled) await showWorkoutNotification(owner, data.run, () => active && currentOwner.current === owner && data.notificationEnabled); else await clearWorkoutNotification(); } catch { if (active) setError('Seu treino está salvo. Não foi possível atualizar a notificação.'); } };
    const sync = async () => {
      if (!active || !owner || syncing || blocked || rejected || !data.run || !data.dirty) return;
      syncing = true; setSaving(true);
      let failed = false;
      try {
        await serial(async () => {
          if (!data.run || data.pending) return;
          await commit({ ...data, pending: { planId: data.run.planId, divisionId: data.run.divisionId, version: data.run.version, mutationId: Crypto.randomUUID(), progress: data.run.progress } });
        });
        const runId = data.run!.id, input = data.pending!;
        const result = await api.saveWorkoutRun(runId, input, owner);
        if (!active) return;
        await serial(async () => {
          if (data.run?.id !== runId) return;
          const changed = JSON.stringify(data.run.progress) !== JSON.stringify(input.progress);
          await commit({ ...data, run: changed ? { ...result, progress: data.run.progress } : result, pending: null, dirty: changed });
          setError('');
        });

      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiClientError && cause.status === 409) {
          blocked = true;
          setConflict((cause.details as unknown as { run: WorkoutRun }).run);
          setError('O treino mudou em outro aparelho ou já existe outra sessão aberta. Seu progresso local foi preservado.');
        } else if (cause instanceof ApiClientError && (cause.status === 400 || cause.status === 404)) {
          rejected = true;
          await serial(async () => {
            if (!data.run || !active) return;
            if (cause.status === 404 && data.run.version === 0 && data.run.progress.status === 'discarded') {
              // The user explicitly discarded a local-only run whose source no longer exists.
              await commit({ ...data, run: null, dirty: false, pending: null });
              await notify(); setError('');
            } else {
              // A definite rejection did not commit. A corrected local state needs a new mutation.
              await commit({ ...data, pending: null });
              setError(cause.message);
            }
          });
        } else { failed = true; setError(cause instanceof ApiClientError && cause.status < 500 ? cause.message : 'Salvo neste aparelho. A sincronização será tentada novamente quando houver conexão.'); }
      } finally {
        syncing = false;
        if (active) setSaving(false);
      }
      if (failed) throw new Error('Sincronização adiada.');
    };
    const scheduler = createDeferredSync({ delay: 300_000, run: sync, pending: () => active && !!owner && !!data.run && data.dirty && !blocked && !rejected });
    const update = async (change: (p: WorkoutRunProgress) => WorkoutRunProgress) => {
      await restoreNative();
      await serial(async () => {
        if (!data.run || blocked) return;
        const progress = workoutRunProgressSchema.parse(change(data.run.progress));
        if (JSON.stringify(progress) === JSON.stringify(data.run.progress)) return;
        await commit({ ...data, run: { ...data.run, progress }, dirty: true });
        rejected = false; setError('');
        await notify();
      });
      if (data.run && !isWorkoutRunOpen(data.run.progress)) void scheduler.flush(true);
      else scheduler.schedule();
    };
    const restoreNative = async () => {
      if (!owner || !data.run || !isWorkoutRunOpen(data.run.progress)) return;
      const nativeProgress = await readWorkoutNotificationProgress(owner, data.run.id);
      if (nativeProgress && workoutRunProgressSchema.safeParse(nativeProgress).success) await serial(async () => {
        if (!data.run || !active) return;
        const p = withLocalPerformed(nativeProgress, data.run.progress);
        if (JSON.stringify(p) !== JSON.stringify(data.run.progress)) await commit({ ...data, run: { ...data.run, progress: p }, dirty: true });
        await acknowledgeWorkoutNotificationProgress(p);
      });
    };
    actions.current = {
      setNotificationEnabled: async value => {
        await restoreNative();
        if (value && !(await requestWorkoutNotificationPermission())) throw new Error('Permita as notificações nos ajustes do Android para ativar o card. Você pode continuar controlando pelo aplicativo.');
        await serial(async () => {
          if (!owner || !active) return;
          await writeWorkoutStorage(`${owner}.preferences`, { notificationEnabled: value, notificationOffered: true });
          await commit({ ...data, notificationEnabled: value, notificationOffered: true });
          await notify();
        });
      },
      // The one-time invitation answered "Agora não": keep the card off and stop asking on this device.
      declineNotificationOffer: async () => {
        await serial(async () => {
          if (!owner || !active) return;
          await writeWorkoutStorage(`${owner}.preferences`, { notificationEnabled: data.notificationEnabled, notificationOffered: true });
          await commit({ ...data, notificationOffered: true });
        });
      },
      update, sync: async () => { rejected = false; await scheduler.flush(true); },
      start: async (plan, divisionId) => {
        await serial(async () => {
          if (!owner || blocked) throw new Error('Revise a sessão atual antes de iniciar outra.');
          if (data.run && (isWorkoutRunOpen(data.run.progress) || data.dirty)) throw new Error('Continue ou sincronize o treino atual antes de iniciar outro.');
          const d = plan.divisions.find(x => x.id === divisionId);
          if (!d?.exercises.length) throw new Error('Este treino não possui exercícios.');
          const run: WorkoutRun = { id: Crypto.randomUUID(), planId: plan.id, divisionId: d.id, planName: plan.name, divisionName: d.name, divisionLabel: d.label, exercises: d.exercises, version: 0, historySessionId: null, progress: { status: 'running', startedAt: Date.now(), finishedAt: null, performedOn: localDate(), currentIndex: 0, pausedAt: null, pausedMs: 0, restEndsAt: null, restRemainingMs: null, exercises: d.exercises.map(e => ({ id: e.id, completedSets: [], skipped: false })) } };
          await commit({ ...data, run, dirty: true, pending: null });
        });
        void scheduler.flush();
        await notify();
      },
      useRemote: async () => {
        const remote = await api.getActiveWorkoutRun();
        await serial(async () => { await commit({ ...data, run: remote, dirty: false, pending: null }); blocked = false; rejected = false; setConflict(null); setError(''); await notify(); });
      },
      dismiss: async () => { await serial(async () => { if (data.run && !isWorkoutRunOpen(data.run.progress) && !data.dirty) { await commit({ ...data, run: null, pending: null }); await notify(); } }); },
    };
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setReady(false); setPlansLoading(true); setState(empty); setError(''); setConflict(null); setLoadedOwner(owner);
      if (!owner) { await clearWorkoutNotification().catch(() => {}); if (active) setReady(true); return; }
      try {
        const [stored, cachedPlans, preferences] = await Promise.all([readWorkoutStorage<Stored>(owner), readWorkoutStorage<WorkoutPlan[]>(`${owner}.plans`), readWorkoutStorage<{ notificationEnabled: boolean; notificationOffered?: boolean }>(`${owner}.preferences`).catch(() => null)]);
        if (!active) return;
        if (stored?.run && !workoutRunProgressSchema.safeParse(stored.run.progress).success) throw new Error('O treino salvo não pôde ser lido.');
        data = { ...empty, ...stored, plans: cachedPlans ?? [], notificationEnabled: preferences?.notificationEnabled === true, notificationOffered: preferences?.notificationOffered === true }; setState(data); if (data.plans.length) setPlansLoading(false);
        await restoreNative();
        if (active) setReady(true);
        await notify();
        await scheduler.flush();
        const [remote, plans] = await Promise.all([api.getActiveWorkoutRun(), api.listWorkoutPlans()]);
        if (!active) return;
        await serial(async () => {
          if (data.run && (data.dirty || isWorkoutRunOpen(data.run.progress))) {
            if (remote && remote.id !== data.run.id) { blocked = true; setConflict(remote); setError('Há outro treino aberto na sua conta. Revise antes de continuar.'); }
            else if (remote && remote.version > data.run.version && !data.dirty) await commit({ ...data, run: remote });
          } else if (remote) await commit({ ...data, run: remote });
          await writeWorkoutStorage(`${owner}.plans`, plans);
          await commit({ ...data, plans });
          await notify(); setPlansLoading(false);
        });
      } catch { if (active) { setReady(true); setPlansLoading(false); setError('Não foi possível atualizar seus treinos. Os dados disponíveis neste aparelho foram mantidos.'); } }
    })();
    const refreshPlans = async () => {
      if (!owner || !active) return;
      try {
        const plans = await api.listWorkoutPlans();
        await serial(async () => {
          if (!active) return;
          await writeWorkoutStorage(`${owner}.plans`, plans);
          await commit({ ...data, plans });
        });
      } catch { /* The last available plans remain usable offline. */ }
    };
    const unsubscribe = api.subscribeToChanges(path => {
      if (path.startsWith('/workout-plans') || path.includes('professional-assignments')) void refreshPlans();
    });
    const unregisterPending = owner ? registerPendingLocalChanges(owner, async () => { await queue; return !!(await readWorkoutStorage<Stored>(owner))?.dirty; }) : () => {};
    let lastPlansRefresh = Date.now();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active' && Date.now() - lastPlansRefresh > 300_000) { lastPlansRefresh = Date.now(); void refreshPlans(); }
      void restoreNative().then(() => scheduler.flush()).catch(() => { if (active) setError('Não foi possível recuperar o controle da notificação.'); });
    });
    const nativeSubscription = addNativeWorkoutListener(() => { void restoreNative().then(notify).then(() => scheduler.schedule()).catch(() => { if (active) setError('Não foi possível atualizar o controle do treino. Abra a sessão novamente.'); }); });
    return () => {
      active = false; scheduler.dispose(); unregisterPending(); sub.remove(); unsubscribe(); nativeSubscription();
      // Explicit logout clears local private data; process termination keeps it for recovery.
      if (owner && currentOwner.current !== owner) void queue.then(async () => { await clearWorkoutStorage(owner); await clearWorkoutStorage(`${owner}.plans`); }).catch(() => {});
      void clearWorkoutNotification().catch(() => {});
    };
  }, [api, user?.id, loading]);
  useEffect(() => { if (!user?.id) return; return addWorkoutNotificationListener(() => router.push('/workout-run')); }, [user?.id]);
  return <Context.Provider value={{ ...(loadedOwner === user?.id ? state : empty), ready: loadedOwner === user?.id && ready, plansLoading, setNotificationEnabled: value => actions.current.setNotificationEnabled(value), declineNotificationOffer: () => actions.current.declineNotificationOffer(), notificationOffered: (loadedOwner === user?.id ? state : empty).notificationOffered === true, saving, error, conflict, start: (...args) => actions.current.start(...args), update: change => actions.current.update(change), sync: () => actions.current.sync(), useRemote: () => actions.current.useRemote(), dismiss: () => actions.current.dismiss() }}>{children}</Context.Provider>;
}
export function useWorkoutRun() { const value = useContext(Context); if (!value) throw new Error('Sessão de treino indisponível.'); return value; }
