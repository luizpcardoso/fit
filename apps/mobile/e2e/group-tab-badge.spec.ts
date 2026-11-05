import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {createConnection} from 'mysql2/promise';
import {resolve} from 'node:path';
import {waitForApiBudget} from './helpers/api-budget';
const apiURL=process.env.FIT_E2E_API_URL??'http://127.0.0.1:33318';
test('aba Grupos recebe aviso na home e limpa depois de abrir o feed',async({page,request})=>{
  const database=process.env.FIT_E2E_DB_NAME;test.skip(!database?.includes('test'),'Use banco isolado.');
  await waitForApiBudget(request,apiURL);
  config({path:resolve(__dirname,'../../api/.env'),quiet:true});
  const db=await createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASS,database});
  const users:string[]=[];let groupId='';const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    const register=async()=>{const res=await request.post(apiURL+'/auth/register',{data:{email:`tab-badge-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Indicador'}});expect(res.status()).toBe(201);const account=await res.json();users.push(account.user.id);return account;};
    const owner=await register(),viewer=await register();const ownerHeaders={authorization:`Bearer ${owner.accessToken}`},viewerHeaders={authorization:`Bearer ${viewer.accessToken}`};
    const created=await request.post(apiURL+'/groups',{headers:ownerHeaders,data:{name:'Grupo indicador E2E'}});expect(created.status()).toBe(201);groupId=(await created.json()).id;
    expect((await request.post(apiURL+`/groups/${groupId}/invites`,{headers:ownerHeaders,data:{username:viewer.user.username}})).status()).toBe(201);
    const invites=await(await request.get(apiURL+'/groups/invites',{headers:viewerHeaders})).json();
    expect((await request.patch(apiURL+`/groups/invites/${invites[0].id}`,{headers:viewerHeaders,data:{decision:'accepted'}})).status()).toBe(204);
    await request.post(apiURL+`/groups/${groupId}/seen`,{headers:viewerHeaders});
    await page.route(/^http:\/\/[^/]+:3333\//,async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:apiURL+url.pathname+url.search})});});
    await page.addInitScript(account=>localStorage.setItem('fit.auth.tokens',JSON.stringify(account)),viewer);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');
    await expect(page.getByRole('tab',{name:'Grupos',exact:true})).toBeVisible({timeout:30000});
    const post=await request.post(apiURL+`/groups/${groupId}/posts`,{headers:ownerHeaders,data:{text:'Post novo enquanto a home está aberta'}});expect(post.status()).toBe(201);
    const highlighted=page.getByRole('tab',{name:'Grupos, 1 post não lido',exact:true});
    // Real polling: no reload, local mutation or mocked dashboard to trigger the badge.
    await expect(highlighted).toBeVisible({timeout:45000});
    await expect(page.getByRole('heading',{name:'Olá, Teste',exact:true})).toBeVisible();
    await page.screenshot({path:'artifacts/ux-review/group-tab-badge-home.png'});
    await highlighted.click();
    await expect(highlighted).toBeVisible(); // Opening the list does not mark feeds as read.
    await page.getByRole('button',{name:/^Grupo indicador E2E/}).click();
    await expect(page.getByText('Post novo enquanto a home está aberta',{exact:true})).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:'Ir para o início',exact:true}).click();
    await expect(page.getByRole('tab',{name:'Grupos',exact:true})).toBeVisible({timeout:10000});
    await expect(page.getByRole('tab',{name:/Grupos,.*post.*não lido/})).toHaveCount(0);
    expect(errors).toEqual([]);
  }finally{
    if(groupId)await db.execute('DELETE FROM `groups` WHERE id=?',[groupId]);
    for(const id of users)await db.execute('DELETE FROM users WHERE id=?',[id]);await db.end();
  }
});
