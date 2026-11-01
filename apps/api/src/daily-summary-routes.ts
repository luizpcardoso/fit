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

export function registerDailySummaryRoutes(
  app: FastifyInstance,
  sources: DailySummarySources,
  secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
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
    const [medications, supplements, injectables, mental, workout, nutrition] = await Promise.all([
      sources.medications.today(userId, date), sources.supplements.today(userId, date),
      sources.injectables.today(userId, date), sources.mental.list(userId, date, date),
      sources.workouts.getGoalSummary(userId, date), sources.nutrition.summary(userId, date),
    ]);
    const weekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const planned = workout.schedule.some(day => day.weekday === weekday);
    const workoutDone = (workout.sessionsByDate[date] ?? 0) > 0;
    const routineTotal = medications.total + supplements.total + injectables.total;
    const routineDone = medications.consumed + supplements.consumed + injectables.applied;
    reply.header('cache-control', 'private, no-store');
    return dailySummarySchema.parse({
      date, updatedAt: new Date().toISOString(),
      checks: { total: routineTotal + 1 + Number(planned), completed: routineDone + Number(mental.length > 0) + Number(planned && workoutDone) },
      nutrition: {
        consumedCalories: nutrition.consumed?.calories ?? 0,
        targetCalories: nutrition.consumptionGoal.targetCalories,
        balance: nutrition.meals.length ? nutrition.balance : null,
      },
      pending: routineDone < routineTotal ? 'checks' : mental.length === 0 ? 'check-in' : planned && !workoutDone ? 'workout' : null,
    });
  });
}
