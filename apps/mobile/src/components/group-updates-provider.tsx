import {createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {AppState} from 'react-native';
import {usePathname} from 'expo-router';
import type {GroupDashboard} from '@fit/contracts';
import {useAuth} from '@/auth/auth-context';
const empty:GroupDashboard={totalUnseen:0,postsUnseen:0,pendingInvites:0,notificationsUnread:0};
const Context=createContext<GroupDashboard>(empty);
export function GroupUpdatesProvider({children}:PropsWithChildren){
  const {user}=useAuth();
  return <GroupUpdatesSession key={user?.id??'signed-out'}>{children}</GroupUpdatesSession>;
}
function GroupUpdatesSession({children}:PropsWithChildren){
  const {api,user}=useAuth();const userId=user?.id;const pathname=usePathname();
  const [dashboard,setDashboard]=useState<GroupDashboard>(empty);
  const refresh=useRef<()=>void>(()=>{});
  useEffect(()=>{
    if(!userId)return;
    let active=true,foreground=AppState.currentState==='active',version=0;
    let debounce:ReturnType<typeof setTimeout>|undefined;
    const load=async()=>{
      if(!active||!foreground)return;
      const request=++version;
      try{const result=await api.getGroupsDashboard();if(active&&request===version)setDashboard(result);}
      catch{/* Preserve the last confirmed count; the next foreground refresh retries. */}
    };
    refresh.current=()=>{void load();};
    const unsubscribe=api.subscribeToChanges(path=>{
      if(!path.startsWith('/groups')&&!path.startsWith('/users/'))return;
      ++version;clearTimeout(debounce);debounce=setTimeout(()=>{void load();},200);
    });
    const subscription=AppState.addEventListener('change',state=>{
      foreground=state==='active';
      if(foreground)void load();else ++version;
    });
    const timer=setInterval(()=>{void load();},30000);
    void load();
    return()=>{active=false;++version;clearInterval(timer);clearTimeout(debounce);unsubscribe();subscription.remove();refresh.current=()=>{};};
  },[api,userId]);
  useEffect(()=>{refresh.current();},[pathname]);
  return <Context.Provider value={dashboard}>{children}</Context.Provider>;
}
export function useGroupUpdates(){return useContext(Context);}
