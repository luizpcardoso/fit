import * as Notifications from 'expo-notifications';
import { DAILY_SUMMARY_NOTIFICATION_ID } from './daily-summary-notification';

export function configureMentalNotificationHandling(){
  Notifications.setNotificationHandler({handleNotification:async notification=>({shouldPlaySound:notification.request.content.data?.routineReminder===true,shouldSetBadge:false,shouldShowBanner:notification.request.identifier!==DAILY_SUMMARY_NOTIFICATION_ID,shouldShowList:true})});
}

export function addDailySummaryResponseListener(onOpen: () => void) {
  let active = true;
  let lastHandled = '';
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || response?.notification.request.identifier !== DAILY_SUMMARY_NOTIFICATION_ID) return;
    const stamp = `${response.notification.date}:${response.actionIdentifier}`;
    if (lastHandled === stamp) return;
    lastHandled = stamp;
    onOpen();
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; subscription.remove(); };
}

export function addMentalNotificationResponseListener(onOpen:()=>void){
  const subscription=Notifications.addNotificationResponseReceivedListener(response=>{if(response.notification.request.content.data?.route==='/mental-wellbeing')onOpen()});
  return()=>subscription.remove();
}

export function addRoutineNotificationResponseListener(onOpen:()=>void){
  let active=true;let lastHandled='';
  const handle=(response:Notifications.NotificationResponse|null)=>{
    if(!active||!response?.notification.request.content.data?.routineReminder)return;
    const stamp=`${response.notification.date}:${response.notification.request.identifier}:${response.actionIdentifier}`;
    if(stamp===lastHandled)return;lastHandled=stamp;onOpen();
    void Notifications.clearLastNotificationResponseAsync().catch(()=>{});
  };
  const subscription=Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(()=>{});
  return()=>{active=false;subscription.remove();};
}

export function addBodyReminderResponseListener(onOpen: (kind: 'weight' | 'measurements') => void) {
  let active = true, lastHandled = '';
  const handle = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (!active || !response || data?.bodyReminder !== true || (data.kind !== 'weight' && data.kind !== 'measurements')) return;
    const stamp = `${response.notification.date}:${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (stamp === lastHandled) return; lastHandled = stamp;
    onOpen(data.kind); void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; subscription.remove(); };
}
