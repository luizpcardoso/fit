import * as Notifications from 'expo-notifications';

export function configureMentalNotificationHandling(){
  Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:false,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
}

export function addMentalNotificationResponseListener(onOpen:()=>void){
  const subscription=Notifications.addNotificationResponseReceivedListener(response=>{if(response.notification.request.content.data?.route==='/mental-wellbeing')onOpen()});
  return()=>subscription.remove();
}
