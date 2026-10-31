import { useAuth } from '@/auth/auth-context';
import type { InjectableToday } from '@fit/contracts';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function useInjectablesToday(date:string){
  const{api}=useAuth();const[data,setData]=useState<{key:string;value:InjectableToday}|null>(null);const[error,setError]=useState('');const[loading,setLoading]=useState(true);const version=useRef(0);
  const refresh=useCallback(async()=>{const current=++version.current;try{const value=await api.getInjectablesToday(date);if(current===version.current){setData({key:date,value});setError('')}return true}catch{if(current===version.current)setError('Não foi possível atualizar os injetáveis.');return false}finally{if(current===version.current)setLoading(false)}},[api,date]);
  useFocusEffect(useCallback(()=>{void refresh();const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refresh()});return()=>{++version.current;subscription.remove()}},[refresh]));
  const matches=data?.key===date;return{daily:matches?data.value:null,error,loading:loading||(!matches&&!error),refresh};
}
