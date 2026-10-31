import { z } from "zod";

export const portalCapabilities = [
  "fitness.view",
  "fitness.suggest",
  "fitness.manage",
  "nutrition.view",
  "nutrition.suggest",
  "nutrition.manage",
  "body.view",
  "mental.view",
  "mental.suggest",
  "mental.manage",
  "groups.manage",
] as const;
export const professionalTypeInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  capabilities: z
    .array(z.enum(portalCapabilities))
    .max(portalCapabilities.length)
    .refine((values) => new Set(values).size === values.length),
});
export const professionalTypeSchema = professionalTypeInputSchema.extend({
  id: z.uuid(),
});
export const portalAccessSchema = z.strictObject({
  role: z.enum(["admin", "professional"]),
});
export type ProfessionalType = z.infer<typeof professionalTypeSchema>;
export type PortalAccess = z.infer<typeof portalAccessSchema>;

const capabilitiesSchema = z
  .array(z.enum(portalCapabilities))
  .max(portalCapabilities.length)
  .refine((values) => new Set(values).size === values.length);
export const createProfessionalSchema = z.strictObject({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  phone: z.string().min(10).max(20),
  typeId: z.uuid(),
  capabilities: capabilitiesSchema,
});
export const updateProfessionalSchema = z.strictObject({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().min(10).max(20),
  typeId: z.uuid(),
  capabilities: capabilitiesSchema,
  suspended: z.boolean(),
});
export const changePortalPasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(12).max(72),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "A nova senha deve ser diferente da senha atual.",
    path: ["newPassword"],
  });
export const activateProfessionalSchema = z.strictObject({
  password: z.string().min(12).max(72),
  acceptTerms: z.literal(true),
});
export const invitationInputSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  capabilities: capabilitiesSchema.min(1),
});
export const consentInputSchema = z.strictObject({
  action: z.enum(["accept", "decline", "revoke", "reduce"]),
  capabilities: capabilitiesSchema,
});
export type ProfessionalProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  typeId: string;
  typeName: string;
  capabilities: string[];
  suspended: boolean;
  activatedAt: string | null;
  temporaryExpiresAt: string | null;
};
export type ProfessionalRelationship = {
  id: string;
  professionalId: string;
  professionalName: string;
  studentId: string | null;
  studentName: string | null;
  status: string;
  capabilities: string[];
  expiresAt: string;
  createdAt: string;
};
