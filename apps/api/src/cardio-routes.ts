import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { cardioSessionInputSchema, localDateSchema } from '@fit/contracts';
import { z } from 'zod';
import type { CardioRepository } from './cardio-repository.js';
import type { GroupRepository } from './group-repository.js';

const dateQuery = z.strictObject({ date: localDateSchema });
const idParams = z.strictObject({ id: z.string().uuid() });

export async function registerCardioRoutes(app: FastifyInstance, repo: CardioRepository, secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,groups?:GroupRepository) {
  const base = { preHandler: secure, schema: { security: [{ bearerAuth: [] }], tags: ['Cardio'] } };
  app.get('/cardio-sessions', { ...base, schema: { ...base.schema, summary: 'Lista o cardio privado de uma data' } }, request => repo.list(request.user.sub, dateQuery.parse(request.query).date));
  app.post('/cardio-sessions', { ...base, schema: { ...base.schema, summary: 'Registra cardio estimado ou informado por uma fonte externa' } }, async (request, reply) => {const created=await repo.create(request.user.sub, cardioSessionInputSchema.parse(request.body));await groups?.createActivityPosts(request.user.sub,'cardio_completed','cardio_session',created.id);return reply.code(201).send(created);});
  app.delete('/cardio-sessions/:id', { ...base, schema: { ...base.schema, summary: 'Exclui um registro de cardio do usuário' } }, async (request, reply) => {const id=idParams.parse(request.params).id;if(!await repo.delete(request.user.sub,id))return reply.code(404).send({ code: 'NOT_FOUND', message: 'Registro de cardio não encontrado.' });await groups?.detachActivity(request.user.sub,'cardio_session',id);return reply.code(204).send();});
}
