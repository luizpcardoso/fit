export function configureMentalNotificationHandling(){}
export function addDailySummaryResponseListener(_onOpen: () => void) { return () => {}; }
export function addMentalNotificationResponseListener(_onOpen:()=>void){return()=>undefined}

export function addRoutineNotificationResponseListener(_onOpen:()=>void){return()=>undefined}
export function addBodyReminderResponseListener(_onOpen: (kind: 'weight' | 'measurements') => void) { return () => {}; }
