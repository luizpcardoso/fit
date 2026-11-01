import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, SchedulableTriggerInputTypes } from 'expo-notifications';
import type { DailySummary } from '@fit/contracts';
import { dailySummaryContent, nextLocalMidnight } from './daily-summary-content';

export const DAILY_SUMMARY_NOTIFICATION_ID = 'fit.daily-summary';
const CHANNEL_ID = 'fit-daily-summary';
let queue: Promise<unknown> = Promise.resolve();

// Serializing presentation and removal prevents a late refresh from restoring a card after logout.
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

export async function requestDailySummaryPermission() {
  await configureChannel();
  const permission = await Notifications.getPermissionsAsync();
  const result = permission.granted ? permission : await Notifications.requestPermissionsAsync();
  if (!result.granted) throw new Error('Ative as notificações da Orami nas configurações do Android para usar o resumo.');
}

async function configureChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Resumo do dia', description: 'Checks e calorias do dia, sem som ou vibração.',
    importance: AndroidImportance.LOW, sound: null, enableVibrate: false,
    showBadge: false, lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

export function clearDailySummaryNotification() {
  return enqueue(async () => {
    const results = await Promise.allSettled([
      Notifications.cancelScheduledNotificationAsync(DAILY_SUMMARY_NOTIFICATION_ID),
      Notifications.dismissNotificationAsync(DAILY_SUMMARY_NOTIFICATION_ID),
    ]);
    if (results.some(result => result.status === 'rejected')) throw new Error('Não foi possível remover o resumo das notificações. Tente novamente.');
  });
}

export function presentDailySummary(summary: DailySummary, isCurrent: () => boolean) {
  return enqueue(async () => {
    if (!isCurrent()) return;
    if (!(await Notifications.getPermissionsAsync()).granted) {
      throw new Error('As notificações estão desativadas. Ative-as nas configurações do Android.');
    }
    await configureChannel();
    if ((await Notifications.getNotificationChannelAsync(CHANNEL_ID))?.importance === AndroidImportance.NONE) {
      throw new Error('As notificações do canal Resumo do dia estão desativadas. Ative-as nos ajustes do Android.');
    }
    if (!isCurrent()) return;
    const content = {
      ...dailySummaryContent(summary), sticky: true, autoDismiss: false, sound: false,
      data: { route: '/?showChecks=1', dailySummary: true },
    };
    await Notifications.cancelScheduledNotificationAsync(DAILY_SUMMARY_NOTIFICATION_ID);
    if (!isCurrent()) return;
    await Notifications.scheduleNotificationAsync({ identifier: DAILY_SUMMARY_NOTIFICATION_ID, content, trigger: { channelId: CHANNEL_ID } });
    if (!isCurrent()) return;
    // Replace the old day's figures with a neutral card even if JS is no longer running.
    // Android may delay this best-effort alarm; the visible summary always includes its date.
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_SUMMARY_NOTIFICATION_ID,
      content: { ...content, title: 'Orami · Resumo do dia', body: 'O dia mudou. Abra a Orami para atualizar seus checks e calorias.' },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: nextLocalMidnight(), channelId: CHANNEL_ID },
    });
  });
}
