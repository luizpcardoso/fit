import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import {reconcileRoutineReminders,otherAccountReminderIds,ROUTINE_PREFIX,type ReminderScheduler,type PlannedReminder} from './routine-reminder-plan';
import {AndroidImportance,AndroidNotificationVisibility} from 'expo-notifications';
const CHANNEL_ID='fit-routine-reminders';
let queue:Promise<unknown>=Promise.resolve();
const enqueue=<T>(work:()=>Promise<T>)=>{const next=queue.then(work,work);queue=next.catch(()=>{});return next;};
async function configureChannel(){if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(CHANNEL_ID,{name:'Lembretes da rotina',importance:AndroidImportance.DEFAULT,sound:'default',showBadge:false,lockscreenVisibility:AndroidNotificationVisibility.PRIVATE});}
export async function requestRoutineReminderPermission(){
  await configureChannel();
  const current=await Notifications.getPermissionsAsync();const permission=current.granted?current:await Notifications.requestPermissionsAsync();
  if(!permission.granted)throw new Error('Ative as notificações da Orami nos ajustes do aparelho para receber lembretes.');
  if(Platform.OS==='android'&&(await Notifications.getNotificationChannelAsync(CHANNEL_ID))?.importance===AndroidImportance.NONE)throw new Error('Ative o canal Lembretes da rotina nos ajustes de notificações.');
}
const scheduler=(ownerId:string):ReminderScheduler=>({
  list:async()=> (await Notifications.getAllScheduledNotificationsAsync()).map(item=>({identifier:item.identifier,signature:item.content.data?.ownerId===ownerId&&typeof item.content.data?.signature==='string'?item.content.data.signature:undefined})),
  cancel:id=>Notifications.cancelScheduledNotificationAsync(id),
  schedule:async item=>{await Notifications.scheduleNotificationAsync({identifier:item.identifier,content:{title:'Orami · Hora de cuidar da rotina',body:item.body,sound:'default',data:{routineReminder:true,ownerId,kind:item.kind,signature:item.signature}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(item.at),channelId:CHANNEL_ID}});},
});
export function syncRoutineReminders(items:PlannedReminder[],ownerId:string,isCurrent:()=>boolean){return enqueue(async()=>{
  if(!isCurrent())return;
  if(!(await Notifications.getPermissionsAsync()).granted)throw new Error('As notificações estão desativadas. Ative-as nos ajustes do aparelho.');
  await configureChannel();
  if(Platform.OS==='android'&&(await Notifications.getNotificationChannelAsync(CHANNEL_ID))?.importance===AndroidImportance.NONE)throw new Error('Ative o canal Lembretes da rotina nos ajustes do aparelho.');
  await reconcileRoutineReminders(scheduler(ownerId),items,isCurrent);
});}
export function clearRoutineReminders(){return enqueue(async()=>{
  await reconcileRoutineReminders(scheduler(''),[],()=>true);
  const presented=await Notifications.getPresentedNotificationsAsync();
  await Promise.all(presented.filter(item=>item.request.identifier.startsWith(ROUTINE_PREFIX)).map(item=>Notifications.dismissNotificationAsync(item.request.identifier)));
});}

export function prepareRoutineReminders(ownerId:string|null){return enqueue(async()=>{
  const scheduled=await Notifications.getAllScheduledNotificationsAsync();
  const obsolete=otherAccountReminderIds(scheduled.map(item=>({identifier:item.identifier,ownerId:typeof item.content.data?.ownerId==='string'?item.content.data.ownerId:undefined})),ownerId);
  for(const id of obsolete)await Notifications.cancelScheduledNotificationAsync(id);
  const presented=await Notifications.getPresentedNotificationsAsync();
  const old=otherAccountReminderIds(presented.map(item=>({identifier:item.request.identifier,ownerId:typeof item.request.content.data?.ownerId==='string'?item.request.content.data.ownerId:undefined})),ownerId);
  for(const id of old)await Notifications.dismissNotificationAsync(id);
});}
