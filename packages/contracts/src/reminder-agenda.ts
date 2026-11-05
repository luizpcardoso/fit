import {z} from 'zod';
export const reminderKindSchema=z.enum(['medication','supplement','workout','injectable']);
export type ReminderKind=z.infer<typeof reminderKindSchema>;
export const reminderAgendaQuerySchema=z.strictObject({from:z.string().date(),to:z.string().date()}).refine(value=>{
  const days=(Date.parse(value.to)-Date.parse(value.from))/86400000;
  return days>=0&&days<=6;
},'Consulte no máximo sete dias por vez.');
export const reminderAgendaSchema=z.strictObject({
  from:z.string().date(),to:z.string().date(),
  days:z.array(z.strictObject({date:z.string().date(),entries:z.array(z.strictObject({kind:reminderKindSchema,time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),pending:z.number().int().positive()}))})).max(7),
});
export type ReminderAgenda=z.infer<typeof reminderAgendaSchema>;
