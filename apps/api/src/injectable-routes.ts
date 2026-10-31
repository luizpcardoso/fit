import type { FastifyInstance,FastifyReply,FastifyRequest } from 'fastify';
import { injectableApplicationInputSchema,injectableInputSchema,localDateSchema,updateInjectableSchema } from '@fit/contracts';
import { z } from 'zod';
import type { InjectableStore } from './injectable-repository.js';

const idParams=z.strictObject({id:z.string().uuid()});const dateQuery=z.strictObject({date:localDateSchema});const estimateQuery=z.strictObject({days:z.coerce.number().int().min(7).max(90).default(30)});
export async function registerInjectableRoutes(app:FastifyInstance,repo:InjectableStore,secure:(request:FastifyRequest,reply:FastifyReply)=>Promise<unknown>){
  const base={preHandler:secure,schema:{security:[{bearerAuth:[]}],tags:['Injetáveis']}};const notFound=(reply:FastifyReply)=>reply.code(404).send({code:'NOT_FOUND',message:'Injetável não encontrado.'});
  app.get('/injectables',{...base,schema:{...base.schema,summary:'Lista injetáveis privados'}},request=>repo.list(request.user.sub));
  app.post('/injectables',{...base,schema:{...base.schema,summary:'Cadastra injetável'}},async(request,reply)=>reply.code(201).send({id:await repo.create(request.user.sub,injectableInputSchema.parse(request.body))}));
  app.put('/injectables/:id',{...base,schema:{...base.schema,summary:'Edita ou pausa injetável'}},async(request,reply)=>await repo.update(request.user.sub,idParams.parse(request.params).id,updateInjectableSchema.parse(request.body))?reply.code(204).send():notFound(reply));
  app.delete('/injectables/:id',{...base,schema:{...base.schema,summary:'Exclui injetável e aplicações'}},async(request,reply)=>await repo.delete(request.user.sub,idParams.parse(request.params).id)?reply.code(204).send():notFound(reply));
  app.get('/injectables/today',{...base,schema:{...base.schema,summary:'Lista aplicações previstas para a data'}},request=>repo.today(request.user.sub,dateQuery.parse(request.query).date));
  app.post('/injectables/:id/applications',{...base,schema:{...base.schema,summary:'Registra aplicação prevista'}},async(request,reply)=>await repo.apply(request.user.sub,idParams.parse(request.params).id,injectableApplicationInputSchema.parse(request.body).date)?reply.code(204).send():notFound(reply));
  app.delete('/injectables/:id/applications',{...base,schema:{...base.schema,summary:'Desfaz aplicação'}},async(request,reply)=>await repo.undo(request.user.sub,idParams.parse(request.params).id,injectableApplicationInputSchema.parse(request.body).date)?reply.code(204).send():notFound(reply));
  app.get('/injectables/:id/estimate',{...base,schema:{...base.schema,summary:'Estima quantidade remanescente pelo decaimento de meia-vida'}},async(request,reply)=>await repo.estimate(request.user.sub,idParams.parse(request.params).id,estimateQuery.parse(request.query).days)??notFound(reply));
}
