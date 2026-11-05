import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';
import { isWorkoutRunOpen, type WorkoutRun, type WorkoutRunProgress } from '@fit/contracts';

type NativeWorkout = { addListener?(event: string, callback: () => void): { remove(): void }; showControls?(owner: string, id: string, label: string, exercises: string, progress: string): Promise<void>; show(owner: string, id: string, label: string, done: number, total: number, progress: string): Promise<void>; read(owner: string, id: string): Promise<string | null>; acknowledge(progress: string): Promise<void>; clear(): Promise<void> };
const native = requireOptionalNativeModule<NativeWorkout>('FitWorkout');
/** Loads and reps never leave the app's own storage: the notification only needs set counts. */
const forNative = (progress: WorkoutRunProgress) => JSON.stringify({ ...progress, exercises: progress.exercises.map(({ performed: _performed, ...exercise }) => exercise) });
/** Puts back the values recorded in the app into progress changed by notification controls. */
export function withLocalPerformed(fromNative: WorkoutRunProgress, local: WorkoutRunProgress): WorkoutRunProgress {
  return { ...fromNative, exercises: fromNative.exercises.map(exercise => { const performed = local.exercises.find(item => item.id === exercise.id)?.performed?.filter(entry => exercise.completedSets.includes(entry.set)); return performed ? { ...exercise, performed } : exercise; }) };
}
const channelId = 'fit-workout', restId = 'fit.workout-rest';
let presentationQueue: Promise<unknown> = Promise.resolve();
function enqueue(work: () => Promise<void>) {
  const next = presentationQueue.then(work, work);
  presentationQueue = next.catch(() => {});
  return next;
}
export const supportsWorkoutNavigation = Platform.OS === 'android' && typeof native?.showControls === 'function';
export function addNativeWorkoutListener(callback: () => void) { const sub = supportsWorkoutNavigation ? native?.addListener?.('onWorkoutChanged', callback) : undefined; return () => sub?.remove(); }
export const supportsWorkoutControls = Platform.OS === 'android' && Boolean(native);
export async function requestWorkoutNotificationPermission() {
  if (Platform.OS !== 'android') return false;
  await Notifications.setNotificationChannelAsync(channelId, { name: 'Treino em andamento', importance: AndroidImportance.LOW, sound: null, enableVibrate: false, showBadge: false, lockscreenVisibility: AndroidNotificationVisibility.PRIVATE });
  await Notifications.setNotificationChannelAsync('fit-workout-rest', { name: 'Fim do descanso', importance: AndroidImportance.DEFAULT, showBadge: false, lockscreenVisibility: AndroidNotificationVisibility.PRIVATE });
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function readWorkoutNotificationProgress(owner: string, id: string): Promise<WorkoutRunProgress | null> {
  const value = await native?.read(owner, id);
  return value ? JSON.parse(value) as WorkoutRunProgress : null;
}
export async function acknowledgeWorkoutNotificationProgress(progress: WorkoutRunProgress) {
  await native?.acknowledge(forNative(progress));
}
async function clearNotificationNow() {
  await native?.clear();
  if (Platform.OS !== 'web') await Promise.all([Notifications.dismissNotificationAsync('fit.workout'), Notifications.cancelScheduledNotificationAsync(restId)]);
}
export function clearWorkoutNotification() { return enqueue(clearNotificationNow); }
export function showWorkoutNotification(owner: string, run: WorkoutRun, isCurrent: () => boolean = () => true) {
  return enqueue(async () => {
  if (!isCurrent()) return;
  if (Platform.OS !== 'android' || !isWorkoutRunOpen(run.progress)) { await clearNotificationNow(); return; }
  if (!(await Notifications.getPermissionsAsync()).granted || !isCurrent()) return;
  const done = run.progress.exercises.filter(e => e.completedSets.length === run.exercises.find(x => x.id === e.id)?.sets).length;
  if (native) { await native.acknowledge(forNative(run.progress)); if (!isCurrent()) return; if (native.showControls) await native.showControls(owner, run.id, run.divisionLabel, JSON.stringify(run.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, restSeconds: e.restSeconds ?? 0 }))), forNative(run.progress));
    else await native.show(owner, run.id, run.divisionLabel, done, run.exercises.length, forNative(run.progress)); }
  else await Notifications.scheduleNotificationAsync({ identifier: 'fit.workout', content: { title: `Treino ${run.divisionLabel} ${run.progress.status === 'paused' ? 'pausado' : 'em andamento'}`, body: `${done} de ${run.exercises.length} exercícios · Toque para continuar`, sticky: true, autoDismiss: false, data: { workout: true }, sound: false }, trigger: { channelId } });
  await Notifications.cancelScheduledNotificationAsync(restId);
  if (!native && run.progress.restEndsAt && run.progress.restEndsAt > Date.now()) await Notifications.scheduleNotificationAsync({ identifier: restId, content: { title: 'Descanso concluído', body: 'Quando estiver pronto, continue seu treino.', data: { workout: true } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(run.progress.restEndsAt), channelId: 'fit-workout-rest' } });
  });
}
export function addWorkoutNotificationListener(open: () => void) {
  if (Platform.OS === 'web') return () => {};
  let active = true, last = '';
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response?.notification.request.content.data?.workout) return;
    const stamp = `${response.notification.date}:${response.actionIdentifier}`;
    if (last === stamp) return;
    last = stamp; open();
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; sub.remove(); };
}
