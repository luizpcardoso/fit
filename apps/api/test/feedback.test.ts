import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.js';
test('feedback requires authentication, validates content and derives author from session',async()=>{
 const saved:Array<{userId:string;message:string}>=[];
 const app=await buildApp({jwtSecret:'feedback-test-secret-at-least-32-characters',feedbackRepository:{async create(userId,input){saved.push({userId,message:input.message});return 'receipt';}}});
 try{
 assert.equal((await app.inject({method:'POST',url:'/me/feedback',payload:{category:'bug',message:'Falha ao abrir a tela'}})).statusCode,401);
 const token=app.jwt.sign({sub:'authenticated-user'});const headers={authorization:`Bearer ${token}`};
 assert.equal((await app.inject({method:'POST',url:'/me/feedback',headers,payload:{category:'bug',message:'curto'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/me/feedback',headers,payload:{category:'bug',message:'Falha ao abrir a tela',userId:'someone-else'}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/me/feedback',headers,payload:{category:'bug',message:'Falha ao abrir a tela'}})).statusCode,201);
 assert.deepEqual(saved,[{userId:'authenticated-user',message:'Falha ao abrir a tela'}]);
 }finally{await app.close();}
});
