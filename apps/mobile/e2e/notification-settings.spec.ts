import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {createConnection} from 'mysql2/promise';
import {resolve} from 'node:path';
import {waitForApiBudget} from './helpers/api-budget';
const apiURL=process.env.FIT_E2E_API_URL??'http://127.0.0.1:33318';
test('configurações explicam notificações nativas e mantêm acesso ao lembrete de check-in',async({page,request})=>{
  const database=process.env.FIT_E2E_DB_NAME;test.skip(!database?.includes('test'),'Use banco isolado.');
  await waitForApiBudget(request,apiURL);
  config({path:resolve(__dirname,'../../api/.env'),quiet:true});
  const db=await createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASS,database});
  let userId='';const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    const response=await request.post(apiURL+'/auth/register',{data:{email:`notification-settings-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Lembretes'}});expect(response.status()).toBe(201);const account=await response.json();userId=account.user.id;
    await page.route(/^http:\/\/[^/]+:3333\//,async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:apiURL+url.pathname+url.search})});});
    await page.addInitScript(account=>localStorage.setItem('fit.auth.tokens',JSON.stringify(account)),account);
    await page.goto('/settings');
    await expect(page.getByRole('heading',{name:'Lembretes nos horários',exact:true})).toBeVisible({timeout:30000});
    await expect(page.getByRole('switch',{name:'Ativar lembretes da rotina',exact:true})).toBeDisabled();
    await expect(page.getByText('Configure no aplicativo instalado para receber notificações mesmo com o app fechado.',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Resumo fixo nas notificações',exact:true})).toBeVisible();
    await page.screenshot({path:'artifacts/ux-review/notification-settings-web.png'});
    await page.getByRole('button',{name:'Configurar lembrete do check-in na área Mente',exact:true}).click();
    await expect(page).toHaveURL(/mental-wellbeing/);
    await expect(page.getByRole('switch',{name:'Ativar lembrete diário',exact:true})).toBeDisabled();
    expect(errors).toEqual([]);
  }finally{if(userId)await db.execute('DELETE FROM users WHERE id=?',[userId]);await db.end();}
});
