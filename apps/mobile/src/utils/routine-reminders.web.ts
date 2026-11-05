import type {PlannedReminder} from './routine-reminder-plan';
export async function requestRoutineReminderPermission(){throw new Error('Os lembretes estão disponíveis no aplicativo instalado.');}
export async function syncRoutineReminders(_items:PlannedReminder[],_ownerId:string,_isCurrent:()=>boolean){}
export async function clearRoutineReminders(){}

export async function prepareRoutineReminders(_ownerId:string|null){}
