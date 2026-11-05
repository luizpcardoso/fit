import {expect,test} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {config} from 'dotenv';
import {createConnection} from 'mysql2/promise';
import {resolve} from 'node:path';
import {waitForApiBudget} from './helpers/api-budget';

const apiURL=process.env.FIT_E2E_API_URL??'http://127.0.0.1:33318';

test('grupo exibe identidade privada e a prévia da foto preserva o enquadramento do post',async({page,request})=>{
  const database=process.env.FIT_E2E_DB_NAME;test.skip(!database?.includes('test'),'Use banco isolado.');
  await waitForApiBudget(request,apiURL);
  config({path:resolve(__dirname,'../../api/.env'),quiet:true});
  const db=await createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASS,database});
  let userId='',groupId='',postId='',accessToken='';const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    const registered=await request.post(apiURL+'/auth/register',{data:{email:`group-images-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Imagens'}});expect(registered.status()).toBe(201);
    const account=await registered.json();userId=account.user.id;accessToken=account.accessToken;const headers={authorization:`Bearer ${accessToken}`};
    const created=await request.post(apiURL+'/groups',{headers,data:{name:'Grupo com identidade'}});expect(created.status()).toBe(201);groupId=(await created.json()).id;
    const avatar=await sharp({create:{width:700,height:500,channels:3,background:'#0f766e'}}).png().toBuffer();
    const cover=await sharp({create:{width:1200,height:450,channels:3,background:'#164e63'}}).png().toBuffer();
    expect((await request.put(apiURL+`/groups/${groupId}/media/avatar`,{headers,data:{photoDataUrl:`data:image/png;base64,${avatar.toString('base64')}`}})).status()).toBe(204);
    expect((await request.put(apiURL+`/groups/${groupId}/media/cover`,{headers,data:{photoDataUrl:`data:image/png;base64,${cover.toString('base64')}`}})).status()).toBe(204);
    await page.route(/^http:\/\/[^/]+:3333\//,async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:apiURL+url.pathname+url.search})});});
    await page.addInitScript(value=>localStorage.setItem('fit.auth.tokens',JSON.stringify(value)),account);
    await page.goto(`/group-detail?id=${groupId}`);
    await expect(page.getByRole('heading',{name:'Grupo com identidade'})).toBeVisible({timeout:30000});
    await expect(page.getByTestId('group-cover-image')).toBeVisible({timeout:30000});
    await expect(page.getByTestId('group-avatar-image')).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:'Configurações do grupo'}).click();
    await expect(page.getByText('Identidade do grupo',{exact:true})).toBeVisible({timeout:30000});
    await expect(page.getByRole('button',{name:'Trocar imagem',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Trocar capa',exact:true})).toBeVisible();
    await page.goBack();await expect(page.getByRole('heading',{name:'Grupo com identidade'})).toBeVisible({timeout:30000});
    const portrait=await sharp({create:{width:600,height:1200,channels:3,background:'#f97316'}}).png().toBuffer();
    const chooserPromise=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Publicar foto',exact:true}).click();
    const chooser=await chooserPromise;await chooser.setFiles({name:'retrato.png',mimeType:'image/png',buffer:portrait});
    const preview=page.getByTestId('group-post-photo-preview');await expect(preview).toBeVisible({timeout:30000});
    const previewBox=await preview.boundingBox();expect(previewBox).not.toBeNull();
    await page.getByRole('button',{name:'Publicar no grupo',exact:true}).click();
    const published=page.getByTestId('group-post-photo').first();await expect(published).toBeVisible({timeout:30000});
    const publishedBox=await published.boundingBox();expect(publishedBox).not.toBeNull();
    expect(Math.abs(previewBox!.width/previewBox!.height-publishedBox!.width/publishedBox!.height)).toBeLessThan(.03);
    const feed=await request.get(apiURL+`/groups/${groupId}/posts`,{headers});postId=(await feed.json()).items[0].id;
    await page.screenshot({path:'artifacts/ux-review/group-images-and-photo-preview.png',fullPage:true});
    expect(errors).toEqual([]);
  }finally{
    if(postId){const headers={authorization:`Bearer ${accessToken}`};await request.delete(apiURL+`/groups/${groupId}/posts/${postId}`,{headers}).catch(()=>{});await request.get(apiURL+`/groups/${groupId}/posts`,{headers}).catch(()=>{});}
    if(groupId){const headers={authorization:`Bearer ${accessToken}`};await request.put(apiURL+`/groups/${groupId}/media/avatar`,{headers,data:{photoDataUrl:null}}).catch(()=>{});await request.put(apiURL+`/groups/${groupId}/media/cover`,{headers,data:{photoDataUrl:null}}).catch(()=>{});await db.execute('DELETE FROM `groups` WHERE id=?',[groupId]);}
    if(userId)await db.execute('DELETE FROM users WHERE id=?',[userId]);await db.end();
  }
});
