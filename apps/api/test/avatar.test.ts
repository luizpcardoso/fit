import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {processAvatar} from '../src/avatar.js';
import {buildApp} from '../src/app.js';
test('avatar validates image and compresses to mobile dimensions without metadata',async()=>{
 const original=await sharp({create:{width:1800,height:1200,channels:3,background:'red'}}).jpeg().toBuffer();
 const output=await processAvatar(`data:image/jpeg;base64,${original.toString('base64')}`);
 const metadata=await sharp(Buffer.from(output.split(',')[1],'base64')).metadata();
 assert.equal(metadata.width,512);assert.equal(metadata.height,512);assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);
 await assert.rejects(()=>processAvatar('data:image/jpeg;base64,aGVsbG8='));
 const app=await buildApp({jwtSecret:'avatar-test-secret-more-than-32-characters'});try{assert.equal((await app.inject({method:'PUT',url:'/me/avatar',payload:{photoDataUrl:null}})).statusCode,401)}finally{await app.close()}
});
