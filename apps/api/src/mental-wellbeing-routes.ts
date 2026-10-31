import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { localDateSchema, mentalCheckInInputSchema } from '@fit/contracts';
import { z } from 'zod';
import type { MentalWellbeingStore } from './mental-wellbeing-repository.js';

const listQuery = z.strictObject({ from: localDateSchema, to: localDateSchema }).refine(value => value.from <= value.to, 'O período informado é inválido.');
const idParams = z.strictObject({ id: z.string().uuid() });

export async function registerMentalWellbeingRoutes(app: FastifyInstance, repo: MentalWellbeingStore, secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) {
  const base = { preHandler:secure,schema:{security:[{bearerAuth:[]}],tags:['Bem-estar mental']} };
  app.get('/mental-check-ins',{...base,schema:{...base.schema,summary:'Lista check-ins emocionais privados'}},request=>{
    const query=listQuery.parse(request.query);return repo.list(request.user.sub,query.from,query.to);
  });
  app.post('/mental-check-ins',{...base,schema:{...base.schema,summary:'Cria ou substitui o check-in privado de um dia'}},async(request,reply)=>reply.code(201).send(await repo.create(request.user.sub,mentalCheckInInputSchema.parse(request.body))));
  app.put('/mental-check-ins/:id',{...base,schema:{...base.schema,summary:'Atualiza um check-in do usuário'}},async(request,reply)=>{
    const item=await repo.update(request.user.sub,idParams.parse(request.params).id,mentalCheckInInputSchema.parse(request.body));
    return item??reply.code(404).send({code:'NOT_FOUND',message:'Registro emocional não encontrado.'});
  });
  app.delete('/mental-check-ins/:id',{...base,schema:{...base.schema,summary:'Exclui um check-in do usuário'}},async(request,reply)=>await repo.delete(request.user.sub,idParams.parse(request.params).id)?reply.code(204).send():reply.code(404).send({code:'NOT_FOUND',message:'Registro emocional não encontrado.'}));
}
