const STORAGE_KEY='fit.mental-wellbeing.reminder';
export type MentalReminder={enabled:boolean;time:string;notificationId:string|null};
export const DEFAULT_MENTAL_REMINDER:MentalReminder={enabled:false,time:'20:30',notificationId:null};
export async function loadMentalReminder():Promise<MentalReminder>{const stored=globalThis.localStorage?.getItem(STORAGE_KEY);if(!stored)return DEFAULT_MENTAL_REMINDER;try{const parsed=JSON.parse(stored) as Partial<MentalReminder>;return{enabled:false,time:/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.time??'')?parsed.time!:'20:30',notificationId:null}}catch{return DEFAULT_MENTAL_REMINDER}}
export async function disableMentalReminder(current:MentalReminder){return{...current,enabled:false,notificationId:null}}
export async function enableMentalReminder(_current:MentalReminder,_time:string):Promise<MentalReminder>{throw new Error('Os lembretes estão disponíveis no aplicativo instalado.')}
