import type {ReminderAgenda,ReminderKind} from '@fit/contracts';
export type ReminderPreferences={enabled:boolean;medication:boolean;supplement:boolean;workout:boolean;injectable:boolean;workoutTime:string;injectableTime:string};
export const defaultReminderPreferences:ReminderPreferences={enabled:false,medication:true,supplement:true,workout:true,injectable:true,workoutTime:'18:00',injectableTime:'08:00'};
export const validReminderTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function readReminderPreferences(raw:string|null):ReminderPreferences {
  try{
    const parsed=JSON.parse(raw??'{}');const next={...defaultReminderPreferences};
    for(const key of ['enabled','medication','supplement','workout','injectable'] as const) if(typeof parsed?.[key]==='boolean')next[key]=parsed[key];
    for(const key of ['workoutTime','injectableTime'] as const)if(typeof parsed?.[key]==='string'&&validReminderTime(parsed[key]))next[key]=parsed[key];
    return next;
  }catch{return {...defaultReminderPreferences};}
}
export const reminderLabels:Record<ReminderKind,string>={medication:'Medicamentos',supplement:'Suplementos',workout:'Treino',injectable:'Aplicações'};
export type PlannedReminder={identifier:string;at:number;body:string;kind:ReminderKind;signature:string};
export const ROUTINE_PREFIX='fit.routine.';
export const MAX_ROUTINE_NOTIFICATIONS=56; // Reserve space for check-in, the summary and other local notices on iOS.
export function reminderDateRange(now=new Date()){
  const format=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+6);
  return {from:format(now),to:format(end)};
}
export function planRoutineReminders(agenda:ReminderAgenda,prefs:ReminderPreferences,now=new Date()){
  if(!prefs.enabled)return {items:[] as PlannedReminder[],limited:false};
  const groups=new Map<string,{at:number;categories:Map<ReminderKind,number>}>();
  for(const day of agenda.days){
    const [year,month,date]=day.date.split('-').map(Number);
    for(const entry of day.entries){
      if(!prefs[entry.kind])continue;
      const time=entry.time??(entry.kind==='workout'?prefs.workoutTime:entry.kind==='injectable'?prefs.injectableTime:null);
      if(!time||!validReminderTime(time))continue;
      const [hour,minute]=time.split(':').map(Number);const at=new Date(year,month-1,date,hour,minute).getTime();
      if(at<=now.getTime())continue;
      const group=groups.get(String(at))??{at,categories:new Map<ReminderKind,number>()};
      group.categories.set(entry.kind,(group.categories.get(entry.kind)??0)+entry.pending);groups.set(String(at),group);
    }
  }
  const all=[...groups.values()].sort((a,b)=>a.at-b.at).map(group=>{
    const categories=[...group.categories].sort(([a],[b])=>a.localeCompare(b));
    const body=categories.map(([kind,count])=>`${reminderLabels[kind]}: ${count} ${count===1?'registro previsto':'registros previstos'}`).join(' · ')+'. Abra o app para conferir.';
    return {identifier:`${ROUTINE_PREFIX}${group.at}`,at:group.at,body,kind:categories[0][0],signature:JSON.stringify([group.at,body])};
  });
  return {items:all.slice(0,MAX_ROUTINE_NOTIFICATIONS),limited:all.length>MAX_ROUTINE_NOTIFICATIONS};
}

export type ScheduledReminder={identifier:string;signature?:string;ownerId?:string};
export function otherAccountReminderIds(items:ScheduledReminder[],ownerId:string|null){
  return items.filter(item=>item.identifier.startsWith(ROUTINE_PREFIX)&&(!ownerId||item.ownerId!==ownerId)).map(item=>item.identifier);
}
export type ReminderScheduler={list():Promise<ScheduledReminder[]>;cancel(id:string):Promise<void>;schedule(item:PlannedReminder):Promise<void>};
/** Only touch our own pending notices. Serialize callers and invalidate stale work on logout. */
export async function reconcileRoutineReminders(scheduler:ReminderScheduler,items:PlannedReminder[],isCurrent:()=>boolean){
  const existing=(await scheduler.list()).filter(item=>item.identifier.startsWith(ROUTINE_PREFIX));
  if(!isCurrent())return;
  const desired=new Map(items.map(item=>[item.identifier,item]));
  const retained=new Set<string>();
  for(const item of existing){
    if(!isCurrent())return;
    const matching=desired.get(item.identifier);
    if(matching&&matching.signature===item.signature)retained.add(item.identifier);
    else await scheduler.cancel(item.identifier);
  }
  for(const item of items){
    if(!isCurrent())return;
    if(!retained.has(item.identifier))await scheduler.schedule(item);
  }
}
