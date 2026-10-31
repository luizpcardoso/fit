import { z } from 'zod';

export const emailSchema = z.string().trim().email('Informe um e-mail válido.').max(254).transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(72, 'A senha deve ter no máximo 72 caracteres.');
export const phoneSchema = z.string().trim().min(10, 'Informe um telefone válido.').max(20).regex(/^\+?[0-9 ()-]+$/, 'Informe um telefone válido.');
export const nameSchema = z.string().trim().min(2, 'Informe pelo menos 2 caracteres.').max(60);

export const registerInputSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

export const loginInputSchema = z.strictObject({ email: emailSchema, password: passwordSchema });
export const refreshInputSchema = z.strictObject({ refreshToken: z.string().min(32).max(512) });
export const genderSchema = z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say']);
/** Reference used only by energy formulas (Mifflin–St Jeor); independent from gender identity. */
export const estimationSexSchema = z.enum(['female', 'male']);
export const activityLevelSchema = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const primaryGoalSchema = z.enum(['lose_weight', 'maintain', 'gain_muscle', 'performance']);
export const updateProfileSchema = z.strictObject({
  birthDate: z.string().date().nullable().optional(),
  gender: genderSchema.nullable().optional(),
  estimationSex: estimationSexSchema.nullable().optional(),
  heightCm: z.number().int().min(80).max(250).nullable().optional(),
  activityLevel: activityLevelSchema.nullable().optional(),
  primaryGoal: primaryGoalSchema.nullable().optional(),
});

export const socialUsernameSchema = z.string().trim().toLowerCase().min(3, 'Use pelo menos 3 caracteres.').max(30).regex(/^[a-z0-9._]+$/, 'Use apenas letras minúsculas, números, ponto e sublinhado.');
export const updateSocialProfileSchema = z.strictObject({
  username: socialUsernameSchema.optional(),
  displayName: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
}).refine(value => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  phone: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string().nullable(),
  gender: genderSchema.nullable(),
  estimationSex: estimationSexSchema.nullable(),
  heightCm: z.number().int().nullable(),
  activityLevel: activityLevelSchema.nullable(),
  primaryGoal: primaryGoalSchema.nullable(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export type RegisterInput = z.input<typeof registerInputSchema>;
export type LoginInput = z.input<typeof loginInputSchema>;
export type RefreshInput = z.input<typeof refreshInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSocialProfileInput = z.infer<typeof updateSocialProfileSchema>;
export type Gender = z.infer<typeof genderSchema>;
export type EstimationSex = z.infer<typeof estimationSexSchema>;
export type ActivityLevel = z.infer<typeof activityLevelSchema>;
export type PrimaryGoal = z.infer<typeof primaryGoalSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export type ApiErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'PLAN_LIMIT_REACHED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type ApiError = { code: ApiErrorCode; message: string; fieldErrors?: Record<string, string[]> };

// Grupos e feed social
export const groupRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member']);
export const groupEventTypeSchema = z.enum(['workout_completed', 'cardio_completed', 'weekly_goal', 'weekly_streak', 'member_joined']);
export const groupReactionSchema = z.enum(['like', 'love', 'strength', 'fire', 'applause']);
export const groupReportReasonSchema = z.enum(['harassment', 'offensive', 'spam', 'sexual', 'privacy', 'dangerous', 'other']);
export const groupPostingModeSchema = z.enum(['all_members', 'admins_only']);
export const groupUserSchema = z.object({ id: z.string().uuid(), username: z.string().nullable(), displayName: z.string(), avatarUrl: z.string().nullable() });
export const createGroupSchema = z.strictObject({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).nullable().optional(), avatarUrl: z.string().url().max(500).nullable().optional() });
export const updateGroupSchema = z.strictObject({
  name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(500).nullable().optional(), avatarUrl: z.string().url().max(500).nullable().optional(),
  postingMode: groupPostingModeSchema.optional(), commentsEnabled: z.boolean().optional(), active: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, 'Informe ao menos um campo.');
export const groupEventSettingsSchema = z.strictObject({ workout_completed: z.boolean(), cardio_completed: z.boolean(), weekly_goal: z.boolean(), weekly_streak: z.boolean(), member_joined: z.boolean() });
export const groupSharePreferencesSchema = z.strictObject({ workout_completed: z.boolean(), cardio_completed: z.boolean(), weekly_goal: z.boolean(), weekly_streak: z.boolean() });
export const createGroupInviteSchema = z.strictObject({ username: socialUsernameSchema });
export const groupInviteDecisionSchema = z.strictObject({ decision: z.enum(['accepted', 'declined']) });
export const updateGroupMemberSchema = z.strictObject({ role: z.enum(['admin', 'moderator', 'member']) });
export const createGroupPostSchema = z.strictObject({
  text: z.string().trim().max(2000).nullable().optional(),
  photoDataUrl: z.string().max(14_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).nullable().optional(),
  commentsEnabled: z.boolean().optional(),
}).refine(value => Boolean(value.text || value.photoDataUrl), 'Escreva uma mensagem ou selecione uma foto.');
export const updateGroupPostSchema = z.strictObject({ text: z.string().trim().min(1).max(2000), commentsEnabled: z.boolean().optional() });
export const createGroupCommentSchema = z.strictObject({ text: z.string().trim().min(1).max(1000) });
export const updateGroupReactionSchema = z.strictObject({ reaction: groupReactionSchema.nullable() });
export const createGroupReportSchema = z.strictObject({ targetType: z.enum(['post', 'comment']), targetId: z.string().uuid(), reason: groupReportReasonSchema, details: z.string().trim().max(500).nullable().optional() });
export const resolveGroupReportSchema = z.strictObject({ resolution: z.enum(['dismissed', 'content_removed']), note: z.string().trim().max(500).nullable().optional() });

export type GroupRole = z.infer<typeof groupRoleSchema>;
export type GroupEventType = z.infer<typeof groupEventTypeSchema>;
export type GroupReaction = z.infer<typeof groupReactionSchema>;
export type GroupReportReason = z.infer<typeof groupReportReasonSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type GroupEventSettings = z.infer<typeof groupEventSettingsSchema>;
export type GroupSharePreferences = z.infer<typeof groupSharePreferencesSchema>;
export type CreateGroupPostInput = z.infer<typeof createGroupPostSchema>;
export type UpdateGroupPostInput = z.infer<typeof updateGroupPostSchema>;
export type CreateGroupCommentInput = z.infer<typeof createGroupCommentSchema>;
export type GroupUser = z.infer<typeof groupUserSchema>;
export type GroupSummary = { id:string;name:string;description:string|null;avatarUrl:string|null;role:GroupRole;memberCount:number;unseenCount:number;active:boolean;createdAt:string };
export type GroupDetails = GroupSummary & { postingMode:'all_members'|'admins_only';commentsEnabled:boolean;eventSettings:GroupEventSettings;sharePreferences:GroupSharePreferences;joinedAt:string };
export type GroupMember = { user:GroupUser;role:GroupRole;joinedAt:string };
export type GroupInvite = { id:string;group:{id:string;name:string;avatarUrl:string|null};invitedBy:GroupUser;status:'pending'|'accepted'|'declined'|'cancelled'|'expired';createdAt:string;expiresAt:string };
export type GroupReactionCount = { reaction:GroupReaction;count:number;reactedByMe:boolean };
export type GroupPost = { id:string;groupId:string;author:GroupUser;kind:'manual'|'event'|'announcement';eventType:GroupEventType|null;text:string|null;photoUrl:string|null;commentsEnabled:boolean;reactionCounts:GroupReactionCount[];commentCount:number;createdAt:string;updatedAt:string;edited:boolean };
export type GroupComment = { id:string;postId:string;author:GroupUser;text:string;createdAt:string;updatedAt:string;edited:boolean;removed:boolean };
export type GroupNotification = { id:string;type:'invite'|'comment'|'role_changed'|'removed'|'report_resolved';title:string;message:string;groupId:string|null;postId:string|null;readAt:string|null;createdAt:string };
export type GroupReport = { id:string;targetType:'post'|'comment';targetId:string;reason:GroupReportReason;details:string|null;status:'pending'|'dismissed'|'content_removed';reporter:GroupUser;createdAt:string;resolvedAt:string|null };
export type GroupDashboard = { totalUnseen:number;pendingInvites:number;notificationsUnread:number };

export const workoutExerciseInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  catalogExerciseId: z.string().uuid().nullable().optional(),
  sets: z.number().int().min(1).max(20),
  reps: z.string().trim().min(1).max(30).refine(value => {
    // Keep existing instructions (timed sets, drop sets) while rejecting invalid numbers.
    if (/^[-–]\s*\d/.test(value)) return false;
    if (/^[+]?\d+(?:[.,]\d+)?$/.test(value)) return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 999;
    const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(value);
    return !range || (Number(range[1]) >= 1 && Number(range[2]) >= Number(range[1]) && Number(range[2]) <= 999);
  }, 'Informe repetições positivas ou uma orientação.'),
  load: z.number().min(0).max(2000).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export const workoutDivisionInputSchema = z.strictObject({ name: z.string().trim().min(2).max(80), exercises: z.array(workoutExerciseInputSchema).min(1).max(50) });
export const validityDaysSchema = z.number().int().min(1).max(365);
export const renewWorkoutPlanSchema = z.strictObject({ days: validityDaysSchema });
export const createWorkoutPlanSchema = z.strictObject({ requestId: z.string().uuid().optional(), validityDays: validityDaysSchema.nullable().optional(), name: z.string().trim().min(2).max(80), divisions: z.array(workoutDivisionInputSchema).min(1).max(5) });
/** Editing reuses the creation rules. Known ids keep the same plan rows so completed sessions still point to them. */
export const updateWorkoutPlanSchema = createWorkoutPlanSchema.omit({ requestId: true }).extend({ divisions: z.array(workoutDivisionInputSchema.extend({ id: z.string().uuid().optional(), exercises: z.array(workoutExerciseInputSchema.extend({ id: z.string().uuid().optional() })).min(1).max(50) })).min(1).max(5) });
export const workoutPlanReadOnlyCode = 'PROFESSIONAL_PLAN_READ_ONLY';
export const completeWorkoutSchema = z.strictObject({ divisionId: z.string().uuid(), performedOn: z.string().date(), completedExerciseIds: z.array(z.string().uuid()).max(50).optional(), shareAutomatically: z.boolean().optional() });
export const updateWorkoutSessionSchema = z.strictObject({ performedOn: z.string().date().optional(), status: z.enum(['completed', 'cancelled']).optional(), completedExerciseIds: z.array(z.string().uuid()).max(50).optional() }).refine((value) => Object.keys(value).length > 0);

export type WorkoutExerciseInput = z.infer<typeof workoutExerciseInputSchema>;
export type CreateWorkoutPlanInput = z.infer<typeof createWorkoutPlanSchema>;
export type UpdateWorkoutPlanInput = z.infer<typeof updateWorkoutPlanSchema>;
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;
export type UpdateWorkoutSessionInput = z.infer<typeof updateWorkoutSessionSchema>;
export type WorkoutExercise = WorkoutExerciseInput & { id: string; source: 'catalog' | 'custom'; imageUrl: string | null };
export type WorkoutDivision = { id: string; label: string; name: string; position: number; completedSessions: number; exercises: WorkoutExercise[] };
/** origin 'professional': sent by a professional, read-only for the student (absent means own plan). */
export type WorkoutPlan = { id: string; name: string; origin?: 'own' | 'professional'; isActive: boolean; status: 'available' | 'archived'; validUntil: string | null; isExpired: boolean; completedSessions: number; divisions: WorkoutDivision[]; createdAt: string; updatedAt: string };
export type WorkoutSession = { id: string; planId: string | null; divisionId: string | null; planDeleted: boolean; planName: string; divisionName: string; divisionLabel: string; performedOn: string; status: 'completed' | 'cancelled'; completionMode: 'quick' | 'detailed'; completedExerciseIds: string[]; createdAt: string; updatedAt: string };
export type ExerciseCategory = 'strength'|'cardio'|'mobility'|'flexibility'|'functional';
export type CatalogExercise = { id: string; name: string; category: ExerciseCategory | null; equipment: string | null; primaryMuscle: string | null; imageUrl: string | null };
export type SuggestedWorkoutPlan = { id:string; name:string; audience:'female'|'male'|'unisex'; goal:string; level:'adaptation'|'beginner'|'intermediate'; description:string; reference:string; divisions:{id:string;name:string;position:number;exercises:{id:string;catalogExerciseId:string;name:string;category:ExerciseCategory|null;equipment:string|null;primaryMuscle:string|null;imageUrl:string|null;sets:number;reps:string;restSeconds:number|null;position:number}[]}[] };

export const workoutGoalModeSchema = z.enum(['flexible', 'planned']);
export const workoutGoalScheduleItemSchema = z.strictObject({
  weekday: z.number().int().min(1).max(7),
  divisionId: z.string().uuid().nullable(),
});
export const workoutGoalInputSchema = z.strictObject({
  weeklyTarget: z.number().int().min(1).max(7),
  mode: workoutGoalModeSchema,
  schedule: z.array(workoutGoalScheduleItemSchema).max(7),
}).superRefine((value, context) => {
  if (value.mode === 'flexible' && value.schedule.length) context.addIssue({ code: 'custom', message: 'A meta flexível não usa dias planejados.', path: ['schedule'] });
  if (value.mode === 'planned' && value.schedule.length !== value.weeklyTarget) context.addIssue({ code: 'custom', message: 'Selecione um dia para cada treino da meta.', path: ['schedule'] });
  if (new Set(value.schedule.map(item => item.weekday)).size !== value.schedule.length) context.addIssue({ code: 'custom', message: 'Os dias planejados não podem se repetir.', path: ['schedule'] });
});
export type WorkoutGoalInput = z.infer<typeof workoutGoalInputSchema>;
export type WorkoutGoalScheduleItem = z.infer<typeof workoutGoalScheduleItemSchema>;
export type WorkoutGoal = WorkoutGoalInput & { configured: boolean };
export type WorkoutGoalPlanDay = WorkoutGoalScheduleItem & { date: string; divisionLabel: string | null; divisionName: string | null };
export type WorkoutGoalSummary = WorkoutGoal & {
  weekStart: string; weekEnd: string; completed: number; remaining: number;
  completedDays: string[]; sessionsByDate: Record<string, number>;
  nextPlanned: WorkoutGoalPlanDay | null; missedPlanned: WorkoutGoalPlanDay[];
};

export const healthKindSchema = z.enum(['supplement', 'medication']);
export type HealthKind = z.infer<typeof healthKindSchema>;
export const supplementUnitSchema = z.enum(['capsule', 'tablet', 'g', 'mg', 'ml', 'dose', 'scoop', 'drop', 'other']);
const formatSupplementMinutes = (minutes: number) => { const normalized = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(normalized / 60)).padStart(2,'0')}:${String(normalized % 60).padStart(2,'0')}`; };
export const suggestSupplementTimes = (frequency: number) => Array.from({ length: frequency }, (_, index) => formatSupplementMinutes(Math.round((420 + index * 1440 / frequency) / 30) * 30));
const supplementBaseSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  amount: z.number().positive().max(10000).nullable().optional(),
  unit: supplementUnitSchema.nullable().optional(),
  dailyFrequency: z.number().int().min(1).max(6).default(1),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(6).default(['07:00']),
  notes: z.string().trim().max(500).nullable().optional(),
  strength: z.string().trim().max(100).nullable().optional(),
});
export const supplementInputSchema = supplementBaseSchema.superRefine((value, context) => { if (value.times.length !== value.dailyFrequency) context.addIssue({ code:'custom', message:'Informe um horário para cada dose.', path:['times'] }); if (new Set(value.times).size !== value.times.length) context.addIssue({ code:'custom', message:'Os horários não podem se repetir.', path:['times'] }); });
export const updateSupplementSchema = supplementBaseSchema.partial().extend({ dailyFrequency: z.number().int().min(1).max(6).optional(), times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(6).optional(), active: z.boolean().optional() }).superRefine((value, context) => { if (!Object.keys(value).length) context.addIssue({ code:'custom', message:'Informe ao menos um campo.' }); if (value.dailyFrequency !== undefined && value.times !== undefined && value.times.length !== value.dailyFrequency) context.addIssue({ code:'custom', message:'Informe um horário para cada dose.', path:['times'] }); if (value.times && new Set(value.times).size !== value.times.length) context.addIssue({ code:'custom', message:'Os horários não podem se repetir.', path:['times'] }); });
export const supplementIntakeInputSchema = z.strictObject({ slot: z.number().int().min(0).max(5), date: z.string().date() });
export type SupplementInput = z.infer<typeof supplementInputSchema>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
export type Supplement = SupplementInput & { id: string; active: boolean; createdAt: string; updatedAt: string };
export type SupplementTodayItem = { supplement: Supplement; slot: number; time: string | null; consumedAt: string | null };
export type SupplementToday = { date: string; total: number; consumed: number; remaining: number; items: SupplementTodayItem[] };

// Shared public fields; legacy supplement responses retain their existing shape.
export type HealthItem = Supplement;
export type HealthItemInput = SupplementInput;
export type UpdateHealthItemInput = UpdateSupplementInput;
export type HealthTodayItem = Omit<SupplementTodayItem, 'supplement'> & { item: HealthItem };
export type HealthToday = Omit<SupplementToday, 'items'> & { items: HealthTodayItem[] };
export type Medication = HealthItem;
export type MedicationTodayItem = Omit<SupplementTodayItem, 'supplement'> & { medication: Medication };
export type MedicationToday = Omit<SupplementToday, 'items'> & { items: MedicationTodayItem[] };

export const localDateSchema = z.string().date();
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const nutrientValueSchema = z.number().min(0).max(100000);
export const nutritionValuesSchema = z.strictObject({ calories: nutrientValueSchema, protein: nutrientValueSchema, carbs: nutrientValueSchema, fat: nutrientValueSchema, fiber: nutrientValueSchema.nullable().optional() });
export const foodInputSchema = nutritionValuesSchema.extend({
  name: z.string().trim().min(2).max(120), servingAmount: z.number().positive().max(100000), servingUnit: z.enum(['g', 'ml', 'unit']),
  brand: z.string().trim().max(120).nullable().optional(), notes: z.string().trim().max(500).nullable().optional(),
});
export const updateFoodSchema = foodInputSchema.partial().refine(value => Object.keys(value).length > 0, 'Informe ao menos um campo.');
export const mealItemInputSchema = z.strictObject({ foodId: z.string().uuid(), quantity: z.number().positive().max(100000) });
export const mealInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(120), date: localDateSchema, time: localTimeSchema,
  items: z.array(mealItemInputSchema).min(1).max(100).optional(), directNutrition: nutritionValuesSchema.optional(),
}).superRefine((value, context) => { if (Boolean(value.items) === Boolean(value.directNutrition)) context.addIssue({ code: 'custom', message: 'Informe alimentos ou os totais diretos da refeição.' }); });
export const updateMealSchema = mealInputSchema;
export const favoriteUpdateSchema = z.strictObject({ name: z.string().trim().min(2).max(120) });
export const reuseFavoriteSchema = z.strictObject({ date: localDateSchema, time: localTimeSchema, multiplier: z.number().positive().max(100).default(1) });
export type NutritionValues = z.infer<typeof nutritionValuesSchema>;
export type FoodInput = z.infer<typeof foodInputSchema>;
export type UpdateFoodInput = z.infer<typeof updateFoodSchema>;
export type Food = FoodInput & { id: string; createdAt: string; updatedAt: string };
export type MealItem = NutritionValues & { id: string; foodId: string | null; foodName: string; servingAmount: number; servingUnit: FoodInput['servingUnit']; quantity: number };
export type MealInput = z.infer<typeof mealInputSchema>;
export type Meal = NutritionValues & { id: string; name: string; date: string; time: string; mode: 'items' | 'direct'; items: MealItem[]; createdAt: string; updatedAt: string };
export type FavoriteMeal = NutritionValues & { id: string; name: string; mode: 'items' | 'direct'; items: MealItem[]; createdAt: string; updatedAt: string };

export const activityFactorSchema = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const manualExpenditureSchema = z.strictObject({ date: localDateSchema, mode: z.literal('manual'), totalCalories: z.number().positive().max(30000), source: z.string().trim().max(120).nullable().optional() });
export const estimatedExpenditureSchema = z.strictObject({
  date: localDateSchema, mode: z.literal('estimated'), gender: z.enum(['female', 'male']), birthDate: localDateSchema,
  heightCm: z.number().min(80).max(250), weightKg: z.number().positive().max(500), activityLevel: activityFactorSchema, exerciseCalories: z.number().min(0).max(10000),
});
export const dailyExpenditureInputSchema = z.discriminatedUnion('mode', [manualExpenditureSchema, estimatedExpenditureSchema]);
export type DailyExpenditureInput = z.infer<typeof dailyExpenditureInputSchema>;
export type DailyExpenditure = { id: string; date: string; mode: 'manual' | 'estimated'; totalCalories: number; source: string | null; basalCalories: number | null; activityCalories: number | null; exerciseCalories: number | null; formula: string | null; gender: 'female' | 'male' | null; birthDate: string | null; heightCm: number | null; weightKg: number | null; activityLevel: z.infer<typeof activityFactorSchema> | null; createdAt: string; updatedAt: string };
export type DailyEnergyEstimate = {
  source: 'automatic' | 'recorded' | 'unavailable';
  totalCalories: number | null;
  baseCalories: number | null;
  workoutCalories: number | null;
  cardioCalories: number | null;
  workoutCount: number;
  assumedWorkoutMinutes: number;
  missing: ('birthDate' | 'estimationSex' | 'heightCm' | 'weightKg' | 'supportedAge')[];
};
// balance/status use energyEstimate (automatic estimate or saved override); expenditure is only the explicit saved override.
export type DailyNutritionSummary = { energyEstimate?: DailyEnergyEstimate; consumptionGoal: import('./nutrition-goal.js').ConsumptionGoal; date: string; consumed: NutritionValues | null; expenditure: DailyExpenditure | null; balance: number | null; status: 'deficit' | 'surplus' | 'balanced' | 'incomplete'; meals: Meal[] };

const optionalMeasureSchema = z.number().positive().max(500).nullable().optional();
export const bodyMeasurementInputSchema = z.strictObject({
  date: localDateSchema, weightKg: optionalMeasureSchema, waistCm: optionalMeasureSchema, abdomenCm: optionalMeasureSchema, hipsCm: optionalMeasureSchema,
  chestCm: optionalMeasureSchema, leftArmCm: optionalMeasureSchema, rightArmCm: optionalMeasureSchema, leftThighCm: optionalMeasureSchema,
  rightThighCm: optionalMeasureSchema, notes: z.string().trim().max(500).nullable().optional(),
}).refine(value => Object.entries(value).some(([key, item]) => key !== 'date' && key !== 'notes' && item != null), 'Informe ao menos uma medida.');
export type BodyMeasurementInput = z.infer<typeof bodyMeasurementInputSchema>;
export type BodyMeasurement = BodyMeasurementInput & { id: string; createdAt: string; updatedAt: string };

export const cardioActivitySchema = z.enum(['walking', 'running', 'cycling', 'stairs', 'spinning']);
export const cardioIntensitySchema = z.enum(['light', 'moderate', 'intense']);
const cardioDurationSchema = z.number().int().min(1).max(600);
export const estimatedCardioSessionInputSchema = z.strictObject({
  date: localDateSchema,
  mode: z.literal('estimated'),
  activity: cardioActivitySchema,
  intensity: cardioIntensitySchema,
  durationMinutes: cardioDurationSchema,
  weightKg: z.number().positive().max(500),
});
export const manualCardioSessionInputSchema = z.strictObject({
  date: localDateSchema,
  mode: z.literal('manual'),
  calories: z.number().positive().max(10000),
  durationMinutes: cardioDurationSchema.nullable().optional(),
  source: z.string().trim().min(2).max(120),
});
export const cardioSessionInputSchema = z.discriminatedUnion('mode', [estimatedCardioSessionInputSchema, manualCardioSessionInputSchema]);
export type CardioActivity = z.infer<typeof cardioActivitySchema>;
export type CardioIntensity = z.infer<typeof cardioIntensitySchema>;
export type CardioSessionInput = z.infer<typeof cardioSessionInputSchema>;
export type CardioSession = {
  id: string;
  date: string;
  mode: 'estimated' | 'manual';
  activity: CardioActivity | null;
  intensity: CardioIntensity | null;
  durationMinutes: number | null;
  weightKg: number | null;
  met: number | null;
  calories: number;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export const mentalMoodSchema = z.enum(['very_low', 'low', 'neutral', 'good', 'very_good']);
export const mentalEmotionSchema = z.enum([
  'happy', 'calm', 'motivated', 'grateful', 'hopeful', 'tired',
  'anxious', 'stressed', 'sad', 'irritated', 'overwhelmed', 'lonely',
]);
export const mentalFactorSchema = z.enum([
  'sleep', 'work_study', 'family', 'relationship', 'health', 'finances',
  'training', 'nutrition', 'social', 'rest', 'other',
]);
export const mentalCheckInInputSchema = z.strictObject({
  date: localDateSchema,
  time: localTimeSchema,
  mood: mentalMoodSchema,
  emotions: z.array(mentalEmotionSchema).max(6).refine(items => new Set(items).size === items.length, 'As emoções não podem se repetir.'),
  factors: z.array(mentalFactorSchema).max(5).refine(items => new Set(items).size === items.length, 'As influências não podem se repetir.'),
  note: z.string().trim().max(2000).nullable().optional(),
});
export type MentalMood = z.infer<typeof mentalMoodSchema>;
export type MentalEmotion = z.infer<typeof mentalEmotionSchema>;
export type MentalFactor = z.infer<typeof mentalFactorSchema>;
export type MentalCheckInInput = z.infer<typeof mentalCheckInInputSchema>;
export type MentalCheckIn = MentalCheckInInput & { id: string; createdAt: string; updatedAt: string };

export const feedbackInputSchema = z.strictObject({category:z.enum(['feedback','suggestion','bug']),message:z.string().trim().min(10,'Escreva pelo menos 10 caracteres.').max(3000)});
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export const injectableUnitSchema = z.enum(['mg', 'ml', 'iu', 'clicks', 'other']);
export const injectableWeekdaySchema = z.number().int().min(1).max(7);
export const injectableInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  dose: z.number().positive().max(100000),
  unit: injectableUnitSchema,
  customUnit: z.string().trim().min(1).max(30).nullable().optional(),
  weekdays: z.array(injectableWeekdaySchema).min(1).max(7).refine(items => new Set(items).size === items.length, 'Os dias da semana não podem se repetir.'),
  halfLifeDays: z.number().positive().min(0.04).max(365).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).superRefine((value,context)=>{
  if(value.unit==='other'&&!value.customUnit)context.addIssue({code:'custom',path:['customUnit'],message:'Informe a unidade personalizada.'});
  if(value.unit!=='other'&&value.customUnit)context.addIssue({code:'custom',path:['customUnit'],message:'A unidade personalizada só pode ser usada com “Outra”.'});
});
export const updateInjectableSchema = injectableInputSchema.safeExtend({ active:z.boolean() });
export const injectableApplicationInputSchema = z.strictObject({ date:localDateSchema });
export type InjectableUnit = z.infer<typeof injectableUnitSchema>;
export type InjectableInput = z.infer<typeof injectableInputSchema>;
export type UpdateInjectableInput = z.infer<typeof updateInjectableSchema>;
export type Injectable = InjectableInput & { id:string;active:boolean;createdAt:string;updatedAt:string };
export type InjectableApplication = { id:string;injectableId:string;date:string;dose:number;unit:InjectableUnit;customUnit:string|null;appliedAt:string };
export type InjectableTodayItem = { injectable:Injectable;application:InjectableApplication|null };
export type InjectableToday = { date:string;total:number;applied:number;remaining:number;items:InjectableTodayItem[] };
export type InjectableEstimatePoint = { at:string;amount:number };
export type InjectableEstimate = { injectableId:string;asOf:string;halfLifeDays:number;unit:InjectableUnit;customUnit:string|null;estimatedAmount:number;excludedApplications:number;points:InjectableEstimatePoint[];applications:InjectableApplication[] };

export const homeShortcutSchema = z.enum(['workout', 'meal', 'cardio', 'weight', 'medication', 'supplement', 'injectable', 'mental']);
export const homeShortcutsInputSchema = z.strictObject({ items: z.array(homeShortcutSchema).max(5).refine(items => new Set(items).size === items.length, 'Os atalhos não podem se repetir.') });
export type HomeShortcut = z.infer<typeof homeShortcutSchema>;
export type HomeShortcuts = z.infer<typeof homeShortcutsInputSchema>;

export const userJsonSchema = {
  type: 'object', required: ['id', 'email', 'phone', 'firstName', 'lastName', 'birthDate', 'gender', 'estimationSex', 'heightCm', 'activityLevel', 'primaryGoal', 'username', 'displayName', 'avatarUrl'], additionalProperties: false,
  properties: { id: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, birthDate: { type: ['string', 'null'], format: 'date' }, gender: { type: ['string', 'null'] }, estimationSex: { type: ['string', 'null'], enum: ['female', 'male', null] }, heightCm: { type: ['integer', 'null'] }, activityLevel: { type: ['string', 'null'] }, primaryGoal: { type: ['string', 'null'] }, username: { type: ['string','null'] }, displayName: { type: ['string','null'] }, avatarUrl: { type: ['string','null'] } },
} as const;
export const authJsonSchema = {
  type: 'object', required: ['user', 'accessToken', 'refreshToken', 'expiresIn'], additionalProperties: false,
  properties: { user: userJsonSchema, accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'integer' } },
} as const;
export const errorJsonSchema = {
  type: 'object', required: ['code', 'message'], additionalProperties: false,
  properties: { code: { type: 'string' }, message: { type: 'string' }, fieldErrors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } } },
} as const;
export * from './portal.js';
export * from './portal-content.js';
export * from './diet.js';

export * from './pagination.js';

export * from './nutrition-goal.js';
