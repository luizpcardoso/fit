import { z } from 'zod';

export const analyticsFeatures = ['home', 'fitness', 'nutrition', 'health', 'body', 'mental', 'groups', 'professionals', 'account'] as const;
export const analyticsFeatureLabels: Record<AnalyticsFeature, string> = {
  home: 'Início', fitness: 'Treinos e cardio', nutrition: 'Alimentação', health: 'Rotina de saúde',
  body: 'Medidas corporais', mental: 'Bem-estar', groups: 'Grupos', professionals: 'Acompanhamento profissional', account: 'Conta e preferências',
};
export type AnalyticsFeature = typeof analyticsFeatures[number];
export const analyticsScreens = [
  'home', 'workouts', 'workout_create', 'workout_detail', 'workout_run', 'session_edit',
  'nutrition', 'food_tracking', 'diet', 'body_measurements', 'health', 'health_routine',
  'mental_wellbeing', 'injectables', 'groups', 'group_detail', 'group_post', 'group_manage',
  'group_notifications', 'my_professionals', 'settings', 'profile_details', 'feedback', 'blocked_users',
] as const;
export type AnalyticsScreen = typeof analyticsScreens[number];
export const screenFeatures: Record<AnalyticsScreen, AnalyticsFeature> = {
  home: 'home', workouts: 'fitness', workout_create: 'fitness', workout_detail: 'fitness', workout_run: 'fitness', session_edit: 'fitness',
  nutrition: 'nutrition', food_tracking: 'nutrition', diet: 'nutrition', body_measurements: 'body', health: 'health', health_routine: 'health',
  mental_wellbeing: 'mental', injectables: 'health', groups: 'groups', group_detail: 'groups', group_post: 'groups', group_manage: 'groups', group_notifications: 'groups',
  my_professionals: 'professionals', settings: 'account', profile_details: 'account', feedback: 'account', blocked_users: 'account',
};
export const analyticsPlatformSchema = z.enum(['android', 'ios', 'web', 'other']);
export type AnalyticsPlatform = z.infer<typeof analyticsPlatformSchema>;
const eventBase = {
  id: z.uuid(), sessionId: z.uuid(), occurredAt: z.iso.datetime(),
  platform: analyticsPlatformSchema,
  appVersion: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][a-zA-Z0-9.-]{1,20})?$/).max(40),
};
export const analyticsEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...eventBase, type: z.literal('screen_view'), screen: z.enum(analyticsScreens) }),
  z.strictObject({ ...eventBase, type: z.enum(['session_start', 'heartbeat']) }),
]);
export const analyticsBatchSchema = z.strictObject({ events: z.array(analyticsEventSchema).min(1).max(20) });
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;
export const analyticsQuerySchema = z.strictObject({ days: z.coerce.number().int().refine(n => [7, 30, 90].includes(n)).default(30) });

export type AnalyticsMetric = { value: number; previous: number };
export type AnalyticsDashboard = {
  collectionEnabled: boolean; generatedAt: string; timezone: 'America/Bahia'; days: number;
  collectionStartedAt: string; coverageFrom: string; periodFrom: string; periodTo: string;
  partialCoverage: boolean; retention: { rawDays: number | null; aggregateMonths: number | null };
  summary: {
    totalAccounts: number; newAccounts: AnalyticsMetric; activeUsers: AnalyticsMetric;
    onlineUsers: number; dau: number; wau: number; mau: number;
    sessions: AnalyticsMetric; screenViews: AnalyticsMetric; actions: AnalyticsMetric;
    returningUsers: number; stickiness: number | null;
  };
  onboarding: { eligibleAccounts: number; activatedWithin7Days: number; returnedOnDay7: number };
  daily: { date: string; activeUsers: number; newAccounts: number; sessions: number; screenViews: number; actions: number }[];
  history: { month: string; newAccounts: number; sessions: number; screenViews: number; actions: number; requests: number; serverErrors: number }[];
  features: { feature: AnalyticsFeature; users: number; screenViews: number; actions: number }[];
  platforms: { platform: AnalyticsPlatform; users: number; sessions: number }[];
  versions: { version: string; users: number }[];
  quality: { requests: number; clientErrors: number; serverErrors: number; averageMs: number | null; p95UpperBoundMs: number | null;
    routes: { method: string; route: string; requests: number; clientErrors: number; serverErrors: number; averageMs: number }[] };
};
