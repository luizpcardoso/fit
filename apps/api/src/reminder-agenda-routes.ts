import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {reminderAgendaQuerySchema,reminderAgendaSchema,type ReminderAgenda,type ReminderKind} from '@fit/contracts';
import type {DailySummarySources} from './daily-summary-routes.js';
export function registerReminderAgendaRoutes(app:FastifyInstance,sources:Pick<DailySummarySources,'medications'|'supplements'|'injectables'|'workouts'>,secure:(req:FastifyRequest,reply:FastifyReply)=>Promise<unknown>){
  app.get('/me/reminder-agenda',{preHandler:secure},async(req,reply)=>{
    const {from,to}=reminderAgendaQuerySchema.parse(req.query);
    const days:ReminderAgenda['days']=[];
    // Bound the query to a week and process dates serially to avoid exhausting the DB pool.
    for(let cursor=Date.parse(from);cursor<=Date.parse(to);cursor+=86400000){
      const date=new Date(cursor).toISOString().slice(0,10);
      const [medications,supplements,injectables,workout]=await Promise.all([
        sources.medications.today(req.user.sub,date),sources.supplements.today(req.user.sub,date),
        sources.injectables.today(req.user.sub,date),sources.workouts.getGoalSummary(req.user.sub,date),
      ]);
      const groups=new Map<string,{kind:ReminderKind;time:string|null;pending:number}>();
      const add=(kind:ReminderKind,time:string|null,pending=1)=>{if(!pending)return;const key=`${kind}:${time??''}`;const existing=groups.get(key);if(existing)existing.pending+=pending;else groups.set(key,{kind,time,pending});};
      for(const [kind,routine] of [['medication',medications],['supplement',supplements]] as const){
        for(const item of routine.items) if(!item.consumedAt&&!item.dismissedAt&&item.time&&item.supplement.remind!==false) add(kind,item.time);
      }
      add('injectable',null,injectables.total-injectables.applied);
      const weekday=((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)+1;
      if(workout.schedule.some(day=>day.weekday===weekday)&&!(workout.sessionsByDate[date]>0)) add('workout',null);
      days.push({date,entries:[...groups.values()]});
    }
    reply.header('cache-control','private, no-store');
    return reminderAgendaSchema.parse({from,to,days});
  });
}
