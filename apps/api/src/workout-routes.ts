import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { completeWorkoutSchema, createWorkoutPlanSchema, renewWorkoutPlanSchema, updateWorkoutPlanSchema, updateWorkoutSessionSchema, workoutGoalInputSchema, workoutPlanReadOnlyCode } from '@fit/contracts';
import type { WorkoutRepository } from './workout-repository.js';
import type { GroupRepository } from './group-repository.js';

const idParams = z.object({ id: z.string().uuid() });
const error = { type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}} } as const;
export async function registerWorkoutRoutes(app:FastifyInstance,repository:WorkoutRepository,secure:(request:FastifyRequest,reply:FastifyReply)=>Promise<unknown>,groups?:GroupRepository){
  const base={preHandler:secure,schema:{security:[{bearerAuth:[]}],tags:['Treinos']}};
  app.get('/exercises',{...base,schema:{...base.schema,summary:'Lista exercícios do catálogo',querystring:{type:'object',properties:{search:{type:'string',maxLength:100}}}}},async request=>repository.listCatalog((request.query as {search?:string}).search));
  app.get('/workout-plan-suggestions',{...base,schema:{...base.schema,summary:'Lista fichas sugeridas do catálogo'}},async()=>repository.listSuggestedPlans());
  app.get('/workout-plans',{...base,schema:{...base.schema,summary:'Lista fichas do usuário'}},async request=>repository.listPlans(request.user.sub));
  app.post('/workout-plans',{...base,schema:{...base.schema,summary:'Cria uma ficha com divisões e exercícios',response:{201:{type:'object',properties:{id:{type:'string'}},required:['id']},400:error,409:error}}},async(request,reply)=>{const input=createWorkoutPlanSchema.parse(request.body);const id=await repository.createPlan(request.user.sub,input);return id==='limit'?reply.code(409).send({code:'PLAN_LIMIT_REACHED',message:'Você já possui 3 fichas disponíveis. Arquive uma ficha para criar outra.'}):reply.code(201).send({id});});
  app.get('/workout-plans/:id',{...base,schema:{...base.schema,summary:'Detalha uma ficha',response:{404:error}}},async(request,reply)=>{const {id}=idParams.parse(request.params);const plan=await repository.getPlan(request.user.sub,id);return plan??reply.code(404).send({code:'NOT_FOUND',message:'Ficha não encontrada.'});});
  app.put('/workout-plans/:id', { ...base, schema: { ...base.schema, summary: 'Edita uma ficha própria preservando o histórico', response: { 400: error, 403: error, 404: error } } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const input = updateWorkoutPlanSchema.parse(request.body);
    const result = await repository.updatePlan(request.user.sub, id, input);
    if (result === 'not_found') return reply.code(404).send({ code: 'NOT_FOUND', message: 'Ficha não encontrada.' });
    if (result === 'professional') return reply.code(403).send({ code: workoutPlanReadOnlyCode, message: 'Fichas enviadas pelo seu profissional não podem ser editadas. Peça o ajuste a ele.' });
    return result;
  });
  app.post('/workout-plans/:id/renew', { ...base, schema: { ...base.schema, summary: 'Revalida a ficha a partir de agora', body: { type: 'object', required: ['days'], additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 365 } } }, response: { 400: error, 404: error } } }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { days } = renewWorkoutPlanSchema.parse(request.body);
    const plan = await repository.renew(request.user.sub, id, days);
    return plan ?? reply.code(404).send({ code: 'NOT_FOUND', message: 'Ficha não encontrada.' });
  });
  app.post('/workout-plans/:id/activate',{...base,schema:{...base.schema,summary:'Ativa uma ficha e inativa a anterior',response:{204:{type:'null'},404:error}}},async(request,reply)=>{const {id}=idParams.parse(request.params);return await repository.activate(request.user.sub,id)?reply.code(204).send():reply.code(404).send({code:'NOT_FOUND',message:'Ficha não encontrada.'});});
  app.post('/workout-plans/:id/deactivate',{...base,schema:{...base.schema,summary:'Desativa uma ficha',response:{204:{type:'null'},404:error}}},async(request,reply)=>{const {id}=idParams.parse(request.params);return await repository.deactivate(request.user.sub,id)?reply.code(204).send():reply.code(404).send({code:'NOT_FOUND',message:'Ficha não encontrada ou já está arquivada.'});});
  app.patch('/workout-plans/:id/archive',{...base,schema:{...base.schema,summary:'Arquiva ou restaura uma ficha',body:{type:'object',required:['archived'],additionalProperties:false,properties:{archived:{type:'boolean'}}},response:{204:{type:'null'},404:error}}},async(request,reply)=>{const {id}=idParams.parse(request.params);const archived=z.object({archived:z.boolean()}).parse(request.body).archived;return await repository.setArchived(request.user.sub,id,archived)?reply.code(204).send():reply.code(404).send({code:'NOT_FOUND',message:'Ficha não encontrada.'});});
  app.delete('/workout-plans/:id',{...base,schema:{...base.schema,summary:'Exclui uma ficha preservando o histórico',response:{204:{type:'null'},404:error}}},async(request,reply)=>{const {id}=idParams.parse(request.params);return await repository.deletePlan(request.user.sub,id)?reply.code(204).send():reply.code(404).send({code:'NOT_FOUND',message:'Ficha não encontrada.'});});
  app.get('/workout-sessions',{...base,schema:{...base.schema,summary:'Lista histórico de treinos'}},async request=>repository.listSessions(request.user.sub));
  app.get('/workout-goal',{...base,schema:{...base.schema,summary:'Meta semanal e progresso real',querystring:{type:'object',required:['date'],additionalProperties:false,properties:{date:{type:'string',format:'date'}}}}},async request=>{const { date }=z.object({date:z.string().date()}).parse(request.query);return repository.getGoalSummary(request.user.sub,date);});
  app.put('/workout-goal',{...base,schema:{...base.schema,summary:'Salva meta semanal',response:{204:{type:'null'},400:error,404:error}}},async(request,reply)=>{const input=workoutGoalInputSchema.parse(request.body);return await repository.saveGoal(request.user.sub,input)?reply.code(204).send():reply.code(404).send({code:'NOT_FOUND',message:'Um treino planejado não foi encontrado.'});});
  app.post('/workout-sessions', { ...base, schema: { ...base.schema, summary: 'Marca um treino como realizado', response: { 201: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, 404: error } } }, async (request, reply) => {
    const input = completeWorkoutSchema.parse(request.body);
    const id = await repository.complete(request.user.sub, input);
    if (!id) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Divisão de treino não encontrada.' });
    // New app versions ask for consent in the modal; preserve explicit legacy preferences.
    // A secondary social failure must never turn a committed workout into a failed response.
    if (input.shareAutomatically !== false && groups) {
      try {
        await groups.createActivityPosts(request.user.sub, 'workout_completed', 'workout_session', id);
        const summary = await repository.getGoalSummary(request.user.sub, input.performedOn);
        if (summary.completed === summary.weeklyTarget) {
          await groups.createActivityPosts(request.user.sub, 'weekly_goal', 'weekly_goal', summary.weekStart);
          const streak = await repository.getWeeklyStreak(request.user.sub, input.performedOn);
          if (streak >= 2) await groups.createActivityPosts(request.user.sub, 'weekly_streak', 'weekly_goal', `${summary.weekStart}:streak`);
        }
      } catch { app.log.warn('Falha na publicação automática; treino preservado.'); }
    }
    return reply.code(201).send({ id });
  });
  app.patch('/workout-sessions/:id',{...base,schema:{...base.schema,summary:'Edita ou cancela treino concluído',response:{204:{type:'null'},404:error}}},async(request,reply)=>{const {id}=idParams.parse(request.params);const input=updateWorkoutSessionSchema.parse(request.body);const updated=await repository.updateSession(request.user.sub,id,input);if(!updated)return reply.code(404).send({code:'NOT_FOUND',message:'Treino concluído não encontrado.'});if(input.status==='cancelled')await groups?.detachActivity(request.user.sub,'workout_session',id);return reply.code(204).send();});
}
