import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { dailySummaryQuerySchema, dailySummarySchema, errorJsonSchema } from '@fit/contracts';
import type { SupplementRepository } from './supplement-repository.js';
import type { InjectableStore } from './injectable-repository.js';
import type { MentalWellbeingStore } from './mental-wellbeing-repository.js';
import type { WorkoutRepository } from './workout-repository.js';
import type { NutritionRepository } from './nutrition-repository.js';

export type DailySummarySources = {
  medications: Pick<SupplementRepository, 'today'>;
  supplements: Pick<SupplementRepository, 'today'>;
  injectables: Pick<InjectableStore, 'today'>;
  mental: Pick<MentalWellbeingStore, 'list'>;
  workouts: Pick<WorkoutRepository, 'getGoalSummary'>;
  nutrition: Pick<NutritionRepository, 'summary'>;
};

// A missing intake is an unconfirmed record, never proof that a dose was not taken.
export function overdueMedicationCount(date: string, items: { time?: string | null; consumedAt?: string | null; dismissedAt?: string | null }[], now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  if (date !== `${part('year')}-${part('month')}-${part('day')}`) return 0;
  const time = `${part('hour')}:${part('minute')}`;
  return items.filter(item => !item.consumedAt && !item.dismissedAt && item.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) && item.time < time).length;
}

export function registerDailySummaryRoutes(
  app: FastifyInstance,
  sources: DailySummarySources,
  secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
  account: Pick<import('./repository.js').AuthRepository, 'findUserById'>,
) {
  app.get('/me/daily-summary', {
    preHandler: secure,
    schema: {
      tags: ['Resumo diário'], summary: 'Resumo privado para a notificação do dia', security: [{ bearerAuth: [] }],
      response: { 400: errorJsonSchema, 401: errorJsonSchema },
    },
  }, async (request, reply) => {
    const { date } = dailySummaryQuerySchema.parse(request.query);
    const userId = request.user.sub;
    const countMental = (await account.findUserById(userId))?.countMentalCheckIn !== false;
    const [medications, supplements, injectables, mental, workout, nutrition] = await Promise.all([
      sources.medications.today(userId, date), sources.supplements.today(userId, date),
      sources.injectables.today(userId, date), countMental ? sources.mental.list(userId, date, date) : Promise.resolve([]),
      sources.workouts.getGoalSummary(userId, date), sources.nutrition.summary(userId, date),
    ]);
    const weekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const planned = workout.schedule.some(day => day.weekday === weekday);
    const workoutsToday = workout.sessionsByDate[date] ?? 0;
    const workoutDone = workoutsToday > 0;
    const routineTotal = medications.total + supplements.total + injectables.total;
    const routineDone = medications.consumed + supplements.consumed + injectables.applied;
    reply.header('cache-control', 'private, no-store');
    const now = new Date();
    return dailySummarySchema.parse({
      date, updatedAt: now.toISOString(),
      ...(request.headers["x-orami-summary-version"] === "2" ? { overdueMedications: overdueMedicationCount(date, medications.items ?? [], now) } : {}),
      // A planned workout is an activity, not a check. Keep it visible in its
      // own category and pending state without making completed routine checks
      // look incomplete in the notification title.
      checks: { total: routineTotal + Number(countMental), completed: routineDone + Number(countMental && mental.length > 0) },
      categories: [
        {kind:'medication',completed:medications.consumed,total:medications.total},
        {kind:'supplement',completed:supplements.consumed,total:supplements.total},
        {kind:'injectable',completed:injectables.applied,total:injectables.total},
        {kind:'mental',completed:Number(countMental&&mental.length>0),total:Number(countMental)},
        {kind:'workout',completed:workoutsToday,total:Math.max(Number(planned),workoutsToday)},
      ],
      nutrition: {
        consumedCalories: nutrition.consumed?.calories ?? 0,
        targetCalories: nutrition.consumptionGoal.targetCalories,
        balance: nutrition.meals.length ? nutrition.balance : null,
      },
      pending: routineDone < routineTotal ? 'checks' : countMental && mental.length === 0 ? 'check-in' : planned && !workoutDone ? 'workout' : null,
    });
  });
}
