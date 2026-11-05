import {createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {AppState,Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {useAuth} from '@/auth/auth-context';
import {defaultReminderPreferences,readReminderPreferences,reminderDateRange,planRoutineReminders,validReminderTime,type ReminderPreferences} from '@/utils/routine-reminder-plan';
import {clearRoutineReminders,prepareRoutineReminders,requestRoutineReminderPermission,syncRoutineReminders} from '@/utils/routine-reminders';
type State={ready:boolean;busy:boolean;preferences:ReminderPreferences;error:string;scheduled:number;through:string;limited:boolean};
type Actions={save(change:Partial<ReminderPreferences>):Promise<void>;refresh():Promise<void>};
const initial:State={ready:false,busy:false,preferences:defaultReminderPreferences,error:'',scheduled:0,through:'',limited:false};
const Context=createContext<(State&Actions)|null>(null);
export function RoutineReminderProvider({children}:PropsWithChildren){const {user,loading}=useAuth();return <RoutineReminderSession key={`${user?.id??'out'}:${loading}`}>{children}</RoutineReminderSession>;}
function RoutineReminderSession({children}:PropsWithChildren){
  const {api,user,loading}=useAuth();const userId=user?.id;
  const [state,setState]=useState<State>(()=>({...initial,ready:Platform.OS==='web'}));
  const actions=useRef<Actions>({save:async()=>{},refresh:async()=>{}});
  useEffect(()=>{
    if(loading||Platform.OS==='web')return;
    let active=true,ready=false,version=0,saving=false;
    let prefs={...defaultReminderPreferences};let day='';let timer:ReturnType<typeof setTimeout>|undefined;
    const key=userId?`fit.routine-reminders.${userId}`:null;
    const update=(value:Partial<State>)=>{if(active)setState(current=>({...current,...value}));};
    const refresh=async()=>{
      if(!active||!ready||!key||!prefs.enabled||AppState.currentState!=='active')return;
      const revision=++version;const range=reminderDateRange();day=range.from;
      const isCurrent=()=>active&&revision===version&&prefs.enabled&&range.from===reminderDateRange().from;
      update({busy:true,error:''});
      try{
        const agenda=await api.getReminderAgenda(range.from,range.to);if(!isCurrent())return;
        const plan=planRoutineReminders(agenda,prefs);await syncRoutineReminders(plan.items,userId!,isCurrent);
        if(isCurrent())update({scheduled:plan.items.length,through:range.to,limited:plan.limited});
      }catch{if(isCurrent())update({error:'Não foi possível atualizar os lembretes. Confira a conexão e as permissões de notificações e tente novamente.'});}
      finally{if(active&&revision===version)update({busy:false});}
    };
    const save=async(change:Partial<ReminderPreferences>)=>{
      if(!active||!ready||!key||saving)return;
      const next={...prefs,...change};
      if(!validReminderTime(next.workoutTime)||!validReminderTime(next.injectableTime)){update({error:'Informe os horários no formato HH:MM.'});return;}
      saving=true;++version;clearTimeout(timer);update({busy:true,error:''});
      try{
        if(next.enabled)await requestRoutineReminderPermission();if(!active)return;
        if(!next.enabled)await clearRoutineReminders();
        await SecureStore.setItemAsync(key,JSON.stringify(next));if(!active)return;
        prefs=next;update({preferences:next});
        if(next.enabled)await refresh();else{update({scheduled:0,through:'',limited:false});}
      }catch(error){update({error:error instanceof Error?error.message:'Não foi possível salvar os lembretes.'});}
      finally{saving=false;update({busy:false});}
    };
    actions.current={save,refresh};
    const queueRefresh=()=>{++version;clearTimeout(timer);timer=setTimeout(()=>{void refresh();},450);};
    const unsubscribe=api.subscribeToChanges(queueRefresh);
    const subscription=AppState.addEventListener('change',value=>{if(value==='active')queueRefresh();});
    const clock=setInterval(()=>{if(prefs.enabled&&day!==reminderDateRange().from)queueRefresh();},30000);
    void(async()=>{try{
      await prepareRoutineReminders(userId??null);const raw=key?await SecureStore.getItemAsync(key):null;if(!active)return;
      prefs=readReminderPreferences(raw);ready=true;update({ready:true,preferences:prefs});await refresh();
    }catch{ready=true;update({ready:true,error:'Não foi possível carregar os lembretes. Tente novamente.'});}})();
    return()=>{active=false;++version;clearTimeout(timer);clearInterval(clock);unsubscribe();subscription.remove();void clearRoutineReminders().catch(()=>{});};
  },[api,userId,loading]);
  return <Context.Provider value={{...state,save:change=>actions.current.save(change),refresh:()=>actions.current.refresh()}}>{children}</Context.Provider>;
}
export function useRoutineReminders(){const value=useContext(Context);if(!value)throw new Error('RoutineReminderProvider ausente.');return value;}
