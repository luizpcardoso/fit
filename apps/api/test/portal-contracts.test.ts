import assert from 'node:assert/strict';
import test from 'node:test';
import {activateProfessionalSchema,createProfessionalSchema,portalContentInputSchema,portalAssignmentInputSchema} from '@fit/contracts';
import {randomUUID} from 'node:crypto';
test('contratos profissionais rejeitam escalada de papel, conteúdo inválido e substituição ambígua',()=>{
 assert.equal(createProfessionalSchema.safeParse({firstName:'Teste',lastName:'Personal',email:'test@example.com',phone:'71999990000',typeId:randomUUID(),capabilities:[],role:'admin'}).success,false);
 assert.equal(activateProfessionalSchema.safeParse({password:'new-password-123',acceptTerms:false}).success,false);
 assert.equal(portalContentInputSchema.safeParse({kind:'food',scope:'private',name:'Alimento',data:{name:'Arroz',servingAmount:0,servingUnit:'g',calories:-1,protein:0,carbs:0,fat:0}}).success,false);
 assert.equal(portalAssignmentInputSchema.safeParse({contentId:randomUUID(),relationshipId:randomUUID(),mode:'manage',requestId:randomUUID(),replaceId:randomUUID(),replaceWorkoutPlanId:randomUUID()}).success,false);
 assert.equal(portalContentInputSchema.safeParse({kind:'workout',scope:'private',name:'Ficha',data:{validityDays:30,divisions:[]}}).success,false);
});


test('listas do portal validam paginação limitada e escopo sem aceitar propriedade enviada pelo cliente', async () => {
 const {portalListQuerySchema,portalContentListQuerySchema}=await import('@fit/contracts');
 assert.deepEqual(portalListQuerySchema.parse({}),{offset:0});
 assert.equal(portalListQuerySchema.parse({offset:'200'}).offset,200);
 for(const offset of [-1,1.5,'abc',1000001]) assert.equal(portalListQuerySchema.safeParse({offset}).success,false);
 assert.equal(portalListQuerySchema.safeParse({offset:0,professionalId:randomUUID()}).success,false);
 assert.equal(portalContentListQuerySchema.safeParse({kind:'workout',scope:'private',offset:'200'}).success,true);
 assert.equal(portalContentListQuerySchema.safeParse({kind:'workout',scope:'other'}).success,false);
 assert.equal(portalContentListQuerySchema.safeParse({kind:'workout',ownerId:randomUUID()}).success,false);
});
