import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { healthPageQuerySchema, supplementInputSchema, supplementIntakeInputSchema, updateSupplementSchema } from '@fit/contracts';
import { z } from 'zod';
import type { SupplementRepository } from './supplement-repository.js';

const params = z.strictObject({ id: z.string().uuid() });
const query = z.strictObject({ date: z.string().date() });

export async function registerSupplementRoutes(app: FastifyInstance, repo: SupplementRepository, secure: (r: FastifyRequest, p: FastifyReply) => Promise<unknown>) {
  const medication = repo.kind === 'medication';
  const prefix = medication ? '/medications' : '/supplements';
  const label = medication ? 'Medicamento' : 'Suplemento';
  const base = { preHandler: secure, schema: { security: [{ bearerAuth: [] }], tags: [medication ? 'Medicamentos' : 'Suplementos'] } };
  const notFound = (reply: FastifyReply) => reply.code(404).send({ code: 'NOT_FOUND', message: `${label} não encontrado.` });
  app.get(prefix, { ...base, schema: { ...base.schema, summary: `Lista ${label.toLowerCase()}s privados` } }, request => repo.list(request.user.sub));
  app.get(`${prefix}/page`, base, request => repo.page(request.user.sub, healthPageQuerySchema.parse(request.query)));
  app.post(prefix, { ...base, schema: { ...base.schema, summary: `Cadastra ${label.toLowerCase()}` } }, async (request, reply) => reply.code(201).send({ id: await repo.create(request.user.sub, supplementInputSchema.parse(request.body)) }));
  app.patch(`${prefix}/:id`, { ...base, schema: { ...base.schema, summary: `Edita ou pausa ${label.toLowerCase()}` } }, async (request, reply) => await repo.update(request.user.sub, params.parse(request.params).id, updateSupplementSchema.parse(request.body)) ? reply.code(204).send() : notFound(reply));
  app.delete(`${prefix}/:id`, base, async (request, reply) => await repo.delete(request.user.sub, params.parse(request.params).id) ? reply.code(204).send() : notFound(reply));
  app.get(`${prefix}/today`, { ...base, schema: { ...base.schema, summary: 'Resumo diário' } }, async request => {
    const daily = await repo.today(request.user.sub, query.parse(request.query).date);
    return medication ? { ...daily, items: daily.items.map(({ supplement, ...item }) => ({ ...item, medication: supplement })) } : daily;
  });
  app.post(`${prefix}/:id/intakes`, { ...base, schema: { ...base.schema, summary: 'Registra tomada' } }, async (request, reply) => {
    const input = supplementIntakeInputSchema.parse(request.body);
    return await repo.consume(request.user.sub, params.parse(request.params).id, input.date, input.slot) ? reply.code(204).send() : notFound(reply);
  });
  app.delete(`${prefix}/:id/intakes`, { ...base, schema: { ...base.schema, summary: 'Desfaz tomada' } }, async (request, reply) => {
    const input = supplementIntakeInputSchema.parse(request.body);
    return await repo.undo(request.user.sub, params.parse(request.params).id, input.date, input.slot) ? reply.code(204).send() : notFound(reply);
  });
}
