import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createBodyReminderSynchronizer, defaultBodyReminders, expoWeekday, readBodyReminders, type BodyReminderPreferences } from './body-reminder-plan';
const key = (user: string) => `fit.body-reminders.${user}`;
export const loadBodyReminders = async (user: string) => readBodyReminders(Platform.OS === 'web' ? null : await SecureStore.getItemAsync(key(user)));
export const persistBodyReminders = (user: string, prefs: BodyReminderPreferences) => SecureStore.setItemAsync(key(user), JSON.stringify(prefs));
export async function requestBodyReminderPermission() {
  if (Platform.OS === 'web') throw new Error('Os lembretes estão disponíveis no aplicativo instalado.');
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Ative as notificações da Orami nas configurações do aparelho.');
}
const synchronize = createBodyReminderSynchronizer({
  listOwned: async () => (await Notifications.getAllScheduledNotificationsAsync()).filter(item => item.content.data?.bodyReminder === true).map(item => item.identifier),
  cancel: id => Notifications.cancelScheduledNotificationAsync(id),
  prepare: async () => { if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('body-reminders', { name: 'Acompanhamento corporal', importance: AndroidImportance.DEFAULT, sound: null }); },
  schedule: async (user, kind, time, weekday) => {
    const [hour, minute] = time.split(':').map(Number);
    return Notifications.scheduleNotificationAsync({ identifier: weekday === null ? `fit.body.${user}.${kind}` : `fit.body.${user}.${kind}.${weekday}`, content: { title: 'Um momento para você', body: kind === 'weight' ? 'Se quiser, reserve um momento para registrar seu peso.' : 'Se quiser, reserve um momento para registrar suas medidas.', sound: false, data: { bodyReminder: true, route: '/body-measurements', kind } }, trigger: weekday !== null ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(weekday), hour, minute, channelId: Platform.OS === 'android' ? 'body-reminders' : undefined } : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: Platform.OS === 'android' ? 'body-reminders' : undefined } });
  },
});
export function syncBodyReminders(user: string | null, prefs: BodyReminderPreferences = defaultBodyReminders(), isCurrent = () => true): Promise<void> {
  return Platform.OS === 'web' ? Promise.resolve() : synchronize(user, prefs, isCurrent);
}
