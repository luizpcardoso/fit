import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { nutritionGoalInputSchema, pageQuerySchema, bodyMeasurementInputSchema, dailyExpenditureInputSchema, favoriteUpdateSchema, foodInputSchema, localDateSchema, mealInputSchema, reuseFavoriteSchema, updateFoodSchema } from '@fit/contracts';
import { z } from 'zod';
import {dietMealInputSchema} from '@fit/contracts';
import type { NutritionRepository } from './nutrition-repository.js';

const idParams = z.strictObject({ id: z.string().uuid() });
const dateParams = z.strictObject({ date: localDateSchema });
const dateQuery = z.strictObject({ date: localDateSchema });

export async function registerNutritionRoutes(app: FastifyInstance, repo: NutritionRepository, secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) {
  const base = { preHandler: secure, schema: { security: [{ bearerAuth: [] }], tags: ['Nutrição e corpo'] } };
  const notFound = (reply: FastifyReply, message = 'Registro não encontrado.') => reply.code(404).send({ code: 'NOT_FOUND', message });
  app.get('/nutrition/diets',base,request=>repo.listDiets(request.user.sub));
  app.post('/nutrition/diet-meals',base,async(request,reply)=>{
    const result=await repo.recordDietMeal(request.user.sub,dietMealInputSchema.parse(request.body));
    if(result==='missing')return notFound(reply,'Dieta não encontrada ou substituída. Atualize suas dietas.');
    if(result==='invalid')return reply.code(400).send({code:'INVALID_INPUT',message:'Revise a opção e as quantidades da refeição.'});
    if(result==='conflict')return reply.code(409).send({code:'CONFLICT',message:'Não foi possível reutilizar esta solicitação.'});
    return reply.code(201).send(result);
  });

  app.get('/nutrition/foods', { ...base, schema: { ...base.schema, summary: 'Lista os alimentos privados' } }, request => repo.listFoods(request.user.sub));
  app.post('/nutrition/foods', { ...base, schema: { ...base.schema, summary: 'Cadastra um alimento' } }, async (request, reply) => reply.code(201).send({ id: await repo.createFood(request.user.sub, foodInputSchema.parse(request.body)) }));
  app.patch('/nutrition/foods/:id', { ...base, schema: { ...base.schema, summary: 'Edita um alimento' } }, async (request, reply) => await repo.updateFood(request.user.sub, idParams.parse(request.params).id, updateFoodSchema.parse(request.body)) ? reply.code(204).send() : notFound(reply, 'Alimento não encontrado.'));
  app.delete('/nutrition/foods/:id', { ...base, schema: { ...base.schema, summary: 'Exclui um alimento sem alterar o histórico' } }, async (request, reply) => await repo.deleteFood(request.user.sub, idParams.parse(request.params).id) ? reply.code(204).send() : notFound(reply, 'Alimento não encontrado.'));

  app.get('/nutrition/meals', { ...base, schema: { ...base.schema, summary: 'Lista refeições da data local' } }, request => repo.listMeals(request.user.sub, dateQuery.parse(request.query).date));
  app.post('/nutrition/meals', { ...base, schema: { ...base.schema, summary: 'Registra uma refeição com snapshots nutricionais' } }, async (request, reply) => { const id = await repo.createMeal(request.user.sub, mealInputSchema.parse(request.body)); return id ? reply.code(201).send({ id }) : notFound(reply, 'Um alimento selecionado não foi encontrado.'); });
  app.put('/nutrition/meals/:id', { ...base, schema: { ...base.schema, summary: 'Substitui uma refeição' } }, async (request, reply) => await repo.updateMeal(request.user.sub, idParams.parse(request.params).id, mealInputSchema.parse(request.body)) ? reply.code(204).send() : notFound(reply, 'Refeição ou alimento não encontrado.'));
  app.delete('/nutrition/meals/:id', { ...base, schema: { ...base.schema, summary: 'Exclui uma refeição' } }, async (request, reply) => await repo.deleteMeal(request.user.sub, idParams.parse(request.params).id) ? reply.code(204).send() : notFound(reply, 'Refeição não encontrada.'));
  app.post('/nutrition/meals/:id/favorite', { ...base, schema: { ...base.schema, summary: 'Cria uma favorita a partir do snapshot da refeição' } }, async (request, reply) => { const id = await repo.createFavoriteFromMeal(request.user.sub, idParams.parse(request.params).id); return id ? reply.code(201).send({ id }) : notFound(reply, 'Refeição não encontrada.'); });

  app.get('/nutrition/favorites', { ...base, schema: { ...base.schema, summary: 'Lista refeições favoritas' } }, request => repo.listFavorites(request.user.sub));
  app.patch('/nutrition/favorites/:id', { ...base, schema: { ...base.schema, summary: 'Renomeia uma favorita sem alterar refeições passadas' } }, async (request, reply) => await repo.renameFavorite(request.user.sub, idParams.parse(request.params).id, favoriteUpdateSchema.parse(request.body).name) ? reply.code(204).send() : notFound(reply, 'Favorita não encontrada.'));
  app.delete('/nutrition/favorites/:id', { ...base, schema: { ...base.schema, summary: 'Exclui uma favorita' } }, async (request, reply) => await repo.deleteFavorite(request.user.sub, idParams.parse(request.params).id) ? reply.code(204).send() : notFound(reply, 'Favorita não encontrada.'));
  app.post('/nutrition/favorites/:id/use', { ...base, schema: { ...base.schema, summary: 'Reutiliza uma favorita com ajuste proporcional' } }, async (request, reply) => { const input = reuseFavoriteSchema.parse(request.body); const id = await repo.reuseFavorite(request.user.sub, idParams.parse(request.params).id, input.date, input.time, input.multiplier); return id ? reply.code(201).send({ id }) : notFound(reply, 'Favorita não encontrada.'); });

  app.get('/nutrition/expenditures/:date', { ...base, schema: { ...base.schema, summary: 'Obtém o gasto efetivo da data' } }, request => repo.getExpenditure(request.user.sub, dateParams.parse(request.params).date));
  app.put('/nutrition/expenditures', { ...base, schema: { ...base.schema, summary: 'Cria ou substitui o gasto efetivo da data' } }, async (request, reply) => { try { return await repo.saveExpenditure(request.user.sub, dailyExpenditureInputSchema.parse(request.body)); } catch (error) { if (error instanceof RangeError) return reply.code(400).send({ code: 'INVALID_INPUT', message: error.message }); throw error; } });
  app.delete('/nutrition/expenditures/:date', { ...base, schema: { ...base.schema, summary: 'Exclui o gasto efetivo da data' } }, async (request, reply) => await repo.deleteExpenditure(request.user.sub, dateParams.parse(request.params).date) ? reply.code(204).send() : notFound(reply, 'Gasto não encontrado.'));
  app.put('/nutrition/goal', base, async (request, reply) => { await repo.saveGoal(request.user.sub, nutritionGoalInputSchema.parse(request.body)); return reply.code(204).send(); });
  app.get('/nutrition/summary', { ...base, schema: { ...base.schema, summary: 'Resumo nutricional e calórico diário' } }, request => repo.summary(request.user.sub, dateQuery.parse(request.query).date));

  app.get('/body-measurements', { ...base, schema: { ...base.schema, summary: 'Lista o histórico corporal' } }, request => repo.listMeasurements(request.user.sub));
  app.get('/body-measurements/page', base, request => repo.measurementsPage(request.user.sub, pageQuerySchema.parse(request.query)));
  app.post('/body-measurements', { ...base, schema: { ...base.schema, summary: 'Registra medidas corporais' } }, async (request, reply) => reply.code(201).send({ id: await repo.createMeasurement(request.user.sub, bodyMeasurementInputSchema.parse(request.body)) }));
  app.put('/body-measurements/:id', { ...base, schema: { ...base.schema, summary: 'Substitui um registro corporal' } }, async (request, reply) => await repo.updateMeasurement(request.user.sub, idParams.parse(request.params).id, bodyMeasurementInputSchema.parse(request.body)) ? reply.code(204).send() : notFound(reply, 'Medida não encontrada.'));
  app.delete('/body-measurements/:id', { ...base, schema: { ...base.schema, summary: 'Exclui um registro corporal' } }, async (request, reply) => await repo.deleteMeasurement(request.user.sub, idParams.parse(request.params).id) ? reply.code(204).send() : notFound(reply, 'Medida não encontrada.'));
}
