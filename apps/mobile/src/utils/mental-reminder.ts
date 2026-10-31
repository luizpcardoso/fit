import { LightPalette } from '@/constants/palette.generated';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'fit.mental-wellbeing.reminder';
const CHANNEL_ID = 'mental-wellbeing';

export type MentalReminder = { enabled: boolean; time: string; notificationId: string | null };
export const DEFAULT_MENTAL_REMINDER: MentalReminder = { enabled:false,time:'20:30',notificationId:null };

async function persist(value: MentalReminder) {
  const serialized=JSON.stringify(value);
  if(Platform.OS==='web') globalThis.localStorage?.setItem(STORAGE_KEY,serialized);
  else await SecureStore.setItemAsync(STORAGE_KEY,serialized);
}

export async function loadMentalReminder(): Promise<MentalReminder> {
  const stored=Platform.OS==='web'?globalThis.localStorage?.getItem(STORAGE_KEY):await SecureStore.getItemAsync(STORAGE_KEY);
  if(!stored)return DEFAULT_MENTAL_REMINDER;
  try{
    const parsed=JSON.parse(stored) as Partial<MentalReminder>;
    return{enabled:Boolean(parsed.enabled),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.time??'')?parsed.time!:'20:30',notificationId:typeof parsed.notificationId==='string'?parsed.notificationId:null};
  }catch{return DEFAULT_MENTAL_REMINDER}
}

export async function disableMentalReminder(current: MentalReminder) {
  if(Platform.OS!=='web'&&current.notificationId){try{await Notifications.cancelScheduledNotificationAsync(current.notificationId)}catch{/* o lembrete pode ter sido removido pelo sistema */}}
  const next={...current,enabled:false,notificationId:null};await persist(next);return next;
}

export async function enableMentalReminder(current: MentalReminder, time: string) {
  if(Platform.OS==='web')throw new Error('Os lembretes estão disponíveis no aplicativo instalado.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Informe um horário válido no formato HH:MM.');
  const permission=await Notifications.getPermissionsAsync();
  const finalPermission=permission.granted?permission:await Notifications.requestPermissionsAsync();
  if(!finalPermission.granted)throw new Error('Ative as notificações do Fit nas configurações do aparelho para usar o lembrete.');
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(CHANNEL_ID,{name:'Bem-estar',importance:AndroidImportance.DEFAULT,vibrationPattern:[0,200],lightColor:LightPalette.primary});
  if(current.notificationId){try{await Notifications.cancelScheduledNotificationAsync(current.notificationId)}catch{/* substitui o agendamento mesmo se o anterior não existir */}}
  const[hour,minute]=time.split(':').map(Number);
  const notificationId=await Notifications.scheduleNotificationAsync({
    content:{title:'Um momento para você',body:'Como foi o seu dia? Seu check-in está disponível.',sound:false,data:{route:'/mental-wellbeing'}},
    trigger:{type:SchedulableTriggerInputTypes.DAILY,hour,minute,channelId:Platform.OS==='android'?CHANNEL_ID:undefined},
  });
  const next={enabled:true,time,notificationId};await persist(next);return next;
}
