import type { AnalyticsBatch, AnalyticsDashboard, AnalyticsFeature } from '@fit/contracts';

export type RetentionPolicy = { rawDays: number; aggregateMonths: number };
export type RecordedAction = { id: string; userId: string; type: string; feature: AnalyticsFeature; occurredAt: Date };
export type RequestAggregate = {
  day: string; method: string; route: string; requests: number; clientErrors: number; serverErrors: number; totalMs: number;
  buckets: [number, number, number, number, number, number];
};
export interface ObservabilityStore {
  canViewDashboard(actor: string): Promise<boolean>;
  ingest(actor: string, batch: AnalyticsBatch): Promise<void>;
  write(actions: RecordedAction[], requests: RequestAggregate[]): Promise<void>;
  dashboard(days: number): Promise<AnalyticsDashboard>;
  maintain(policy: RetentionPolicy): Promise<void>;
}
export const DAY_MS = 86_400_000;
export const analyticsDay = (time: number | Date) => new Date(Number(time) - 3 * 3_600_000).toISOString().slice(0, 10);
export const dayStart = (day: string) => new Date(`${day}T03:00:00.000Z`);
export const shiftDay = (day: string, days: number) => analyticsDay(dayStart(day).getTime() + days * DAY_MS);
export const clientEventTypes = ['screen_view', 'session_start', 'heartbeat'];
export const meaningfulActions = ['workout_completed', 'meal_logged', 'diet_meal_logged', 'cardio_recorded', 'group_post_created', 'check_in_saved', 'medication_taken', 'supplement_taken', 'injection_recorded'];

// Matched against Fastify route templates, never raw URLs, identifiers, query strings or bodies.
export function routeFeature(route: string): AnalyticsFeature | null {
  if (/^\/auth\/(register|login|me)$/.test(route) || route === '/me/feedback' || route === '/me/social-profile') return 'account';
  if (/^\/(workout|exercises|cardio-sessions)/.test(route)) return 'fitness';
  if (route.startsWith('/nutrition/')) return 'nutrition';
  if (route.startsWith('/body-measurements')) return 'body';
  if (/^\/(medications|supplements|injectables)/.test(route)) return 'health';
  if (route.startsWith('/mental-check-ins')) return 'mental';
  if (/^\/groups(?:$|\/)/.test(route)) return 'groups';
  if (/^\/me\/(professionals|professional-assignments)(?:$|\/)/.test(route)) return 'professionals';
  return null;
}
const actions: Record<string, string> = {
  'POST /workout-plans': 'workout_created', 'PUT /workout-plans/:id': 'workout_updated',
  'POST /workout-sessions': 'workout_completed', 'PUT /workout-goal': 'workout_goal_saved',
  'POST /cardio-sessions': 'cardio_recorded', 'POST /nutrition/meals': 'meal_logged',
  'POST /nutrition/diet-meals': 'diet_meal_logged', 'POST /nutrition/favorites/:id/use': 'meal_logged',
  'POST /nutrition/foods': 'food_created', 'PUT /nutrition/goal': 'nutrition_goal_saved',
  'POST /body-measurements': 'measurement_recorded', 'POST /mental-check-ins': 'check_in_saved',
  'POST /medications/:id/intakes': 'medication_taken', 'POST /supplements/:id/intakes': 'supplement_taken',
  'POST /injectables/:id/applications': 'injection_recorded', 'POST /groups': 'group_created',
  'POST /groups/posts': 'group_post_created', 'POST /groups/:groupId/posts': 'group_post_created',
  'POST /groups/:groupId/posts/:postId/comments': 'group_comment_created',
  'PUT /groups/:groupId/posts/:postId/reaction': 'group_reaction_saved',
  'POST /me/feedback': 'feedback_sent', 'PATCH /auth/me': 'profile_updated',
  'POST /me/professional-assignments/:id/respond': 'professional_plan_responded',
};
export const routeAction = (method: string, route: string) => actions[`${method} ${route}`] ?? null;
export const p95Bound = (buckets: number[]) => {
  const total = buckets.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  let count = 0;
  for (let index = 0; index < buckets.length; index++) {
    count += buckets[index];
    if (count >= Math.ceil(total * .95)) return [100, 300, 1000, 3000, 10000, null][index];
  }
  return null;
};
