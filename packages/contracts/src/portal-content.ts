import { z } from "zod";
import { dietOptionName, MAX_DIET_OPTIONS } from "./diet.js";
const name = z.string().trim().min(2).max(120),
  notes = z.string().trim().max(2000);
const nutrients = z.strictObject({
  calories: z.number().min(0).max(100000),
  protein: z.number().min(0).max(100000),
  carbs: z.number().min(0).max(100000),
  fat: z.number().min(0).max(100000),
});
const food = nutrients.extend({
  name,
  servingAmount: z.number().min(0.001).max(100000),
  servingUnit: z.enum(["g", "ml", "unit"]),
  notes: notes.default(""),
});
const exercise = z.strictObject({
  name: z.string().trim().min(2).max(100),
  catalogExerciseId: z.uuid().nullable().optional(),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1).max(30),
  load: z.number().min(0).max(2000).nullable(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  notes: z.string().max(500).default(""),
});
export const dietItemSchema = z.strictObject({
  food,
  quantity: z.number().positive().max(100000),
  substitutions: z.string().max(1000),
});
export const dietOptionSchema = z.strictObject({
  name: z.string().trim().max(122).default(""),
  items: z.array(dietItemSchema).min(1).max(30),
});
const portalContentBaseSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("goal"),
    scope: z.enum(["global", "private"]),
    name,
    data: z.strictObject({
      weeklyTarget: z.number().int().min(1).max(7),
      weekdays: z
        .array(z.number().int().min(1).max(7))
        .max(7)
        .refine((v) => new Set(v).size === v.length),
      notes,
    }),
  }),
  z.strictObject({
    kind: z.literal("food"),
    scope: z.enum(["global", "private"]),
    name,
    data: food,
  }),
  z.strictObject({
    kind: z.literal("exercise"),
    scope: z.enum(["global", "private"]),
    name: z.string().trim().min(2).max(100),
    data: z.strictObject({
      category: z.enum([
        "strength",
        "cardio",
        "mobility",
        "flexibility",
        "functional",
      ]),
      equipment: z.string().max(80),
      primaryMuscle: z.string().max(80),
      notes,
    }),
  }),
  z.strictObject({
    kind: z.literal("equipment"),
    scope: z.enum(["global", "private"]),
    name,
    data: z.strictObject({ category: z.string().max(80), notes }),
  }),
  z.strictObject({
    kind: z.literal("category"),
    scope: z.enum(["global", "private"]),
    name,
    data: z.strictObject({
      area: z.enum(["fitness", "nutrition", "mental", "general"]),
      notes,
    }),
  }),
  z.strictObject({
    kind: z.literal("workout"),
    scope: z.enum(["global", "private"]),
    name: z.string().trim().min(2).max(80),
    data: z.strictObject({
      validityDays: z.number().int().min(1).max(365).nullable(),
      divisions: z
        .array(
          z.strictObject({
            name: z.string().min(2).max(80),
            exercises: z.array(exercise).min(1).max(50),
          }),
        )
        .min(1)
        .max(5),
    }),
  }),
  z.strictObject({
    kind: z.literal("diet"),
    scope: z.enum(["global", "private"]),
    name,
    data: z.strictObject({
      objective: notes,
      validityDays: z.number().int().min(1).max(365).nullable(),
      meals: z
        .array(
          z.strictObject({
            name,
            time: z
              .string()
              .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
              .nullable(),
            items: z
              .array(
                z.strictObject({
                  food,
                  quantity: z.number().positive().max(100000),
                  substitutions: z.string().max(1000),
                }),
              )
              .min(1)
              .max(30),
            options: z.array(dietOptionSchema).max(5).optional(),
          }),
        )
        .min(1)
        .max(12),
      notes,
    }),
  }),
  z.strictObject({
    kind: z.literal("guidance"),
    scope: z.enum(["global", "private"]),
    name,
    data: z.strictObject({
      objective: notes,
      actions: z.array(z.string().trim().min(2).max(500)).min(1).max(30),
      notes,
    }),
  }),
]);
// Existing snapshots remain readable without deleting historical alternatives.
export const portalContentSnapshotSchema = portalContentBaseSchema;
export const portalContentInputSchema = portalContentBaseSchema.superRefine((input, context) => {
  if (input.kind !== "diet") return;
  input.data.meals.forEach((meal, index) => {
    if ((meal.options?.length ?? 0) > MAX_DIET_OPTIONS - 1) context.addIssue({code:"custom",path:["data","meals",index,"options"],message:"Cada refeição permite no máximo 3 opções (A, B e C)."});
  });
}).transform((input): z.infer<typeof portalContentBaseSchema> => {
  if (input.kind !== "diet") return input;
  return {...input,data:{...input.data,meals:input.data.meals.map(meal => ({...meal,options:meal.options?.map((option,index) => ({...option,name:dietOptionName(meal.name,index + 1)}))}))}};
});
export const portalAssignmentInputSchema = z
  .strictObject({
    contentId: z.uuid(),
    relationshipId: z.uuid(),
    mode: z.enum(["suggest", "manage"]),
    replaceId: z.uuid().optional(),
    replaceWorkoutPlanId: z.uuid().optional(),
    requestId: z.uuid(),
  })
  .refine(
    (input) => !(input.replaceId && input.replaceWorkoutPlanId),
    "Selecione apenas um plano para substituir.",
  );
export type PortalContentInput = z.infer<typeof portalContentInputSchema>;
export type PortalContent = PortalContentInput & {
  id: string;
  ownerId: string;
  revision: number;
  archived: boolean;
  updatedAt: string;
};
export type PortalAssignment = {
  id: string;
  authorId: string;
  authorName: string;
  studentId: string;
  relationshipId: string;
  kind: string;
  status: string;
  sourceId: string;
  sourceRevision: number;
  snapshot: PortalContentInput;
  workoutPlanId: string | null;
  createdAt: string;
};
