import {waitForApiBudget} from './helpers/api-budget';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const apiURL=process.env.FIT_E2E_API_URL??'http://127.0.0.1:33318';
test('Social reúne grupos, preserva interações e oferece gestão e publicação com destino explícito',async({page,request})=>{
 test.skip(process.env.FIT_SOCIAL_ISOLATED!=='1','Requer API efêmera isolada.');
 await waitForApiBudget(request,apiURL);
 const register=async(firstName:string)=>{
  const data={email:`social-e2e-${randomUUID()}@example.com`,password:'test-password-123',phone:'71999990000',firstName,lastName:'Teste'};
  let res=await request.post(apiURL+'/auth/register',{data});
  // Cadastro tem limite próprio de cinco contas/minuto, independente do orçamento global.
  if(res.status()===429){
   await new Promise(resolve=>setTimeout(resolve,Math.min(60250,Number(res.headers()['retry-after']??60)*1000+250)));
   res=await request.post(apiURL+'/auth/register',{data});
  }
  expect(res.status()).toBe(201);return res.json();
 };
 const owner=await register('Marina'),viewer=await register('Luiz');const ownerHeaders={authorization:`Bearer ${owner.accessToken}`},viewerHeaders={authorization:`Bearer ${viewer.accessToken}`};
 const groups=[];
 for(const name of ['Amigos em movimento','Equipe da manhã']){
  const res=await request.post(apiURL+'/groups',{headers:ownerHeaders,data:{name}});expect(res.status()).toBe(201);const id=(await res.json()).id;groups.push({id,name});
  expect((await request.post(apiURL+`/groups/${id}/invites`,{headers:ownerHeaders,data:{username:viewer.user.username}})).status()).toBe(201);
  const invites=await(await request.get(apiURL+'/groups/invites',{headers:viewerHeaders})).json();
  expect((await request.patch(apiURL+`/groups/invites/${invites[0].id}`,{headers:viewerHeaders,data:{decision:'accepted'}})).status()).toBe(204);
  expect((await request.post(apiURL+`/groups/${id}/posts`,{headers:ownerHeaders,data:{text:`Um novo começo com ${name}`}})).status()).toBe(201);
 }
 let failFeed=true;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^http:\/\/[^/]+:3333\//,async route=>{const url=new URL(route.request().url());if(failFeed&&url.pathname==='/social/feed'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'UNAVAILABLE',message:'Feed temporariamente indisponível.'})});return;}await route.fulfill({response:await route.fetch({url:apiURL+url.pathname+url.search})});});
 await page.addInitScript(account=>localStorage.setItem('fit.auth.tokens',JSON.stringify(account)),viewer);
 await page.goto('/groups');
 await expect(page.getByRole('heading',{name:'Social',exact:true})).toBeVisible({timeout:60000});
 await expect(page.getByRole('alert')).toContainText('Feed temporariamente indisponível.');failFeed=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 for(const group of groups)await expect(page.getByRole('button',{name:`Abrir grupo ${group.name}`,exact:true}).first()).toBeVisible();
 const post = page.getByTestId(/^feed-post-/).first();
 const beforeLike = await post.boundingBox();
 await page.getByRole('button',{name:'Reagir: Curtir',exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Reagir: Curtir',exact:true}).first()).toHaveAttribute('aria-selected','true');
 expect((await post.boundingBox())!.height).toBe(beforeLike!.height);
 await page.getByRole('button',{name:'Comentar',exact:true}).first().click();
 await expect(page.getByText('Comentários',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Escrever comentário',exact:true}).fill('Vamos juntos nessa!');
 await page.getByRole('button',{name:'Enviar comentário',exact:true}).click();
 await expect(page.getByText('Vamos juntos nessa!',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Fechar comentários',exact:true}).click();
 expect((await post.boundingBox())!.height).toBe(beforeLike!.height);
 for(const scheme of ['light','dark'] as const){await page.emulateMedia({colorScheme:scheme});for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.screenshot({path:`artifacts/ux-review/social-${scheme}-${width}.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();}}
 await page.getByRole('button',{name:'Configurações do Social',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Configurações do Social',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Pessoas ocultadas',exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:`Preferências de ${groups[0].name}`,exact:true})).toBeVisible();
 await page.goBack();await page.getByRole('button',{name:'Meus grupos',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Meus grupos',exact:true})).toBeVisible();
 await page.goBack();await page.getByRole('button',{name:'Criar publicação',exact:true}).click();
 await page.getByRole('textbox',{name:'Texto da publicação',exact:true}).fill('Primeira publicação no novo Social');
 await page.getByRole('checkbox',{name:groups[0].name,exact:true}).click();
 await page.getByRole('button',{name:'Publicar nos grupos selecionados',exact:true}).click();
 await expect(page.getByText('Primeira publicação no novo Social',{exact:true})).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:'Configurações do Social',exact:true}).click();await page.getByRole('button',{name:`Preferências de ${groups[0].name}`,exact:true}).click();
 await expect(page.getByRole('heading',{name:'Configurações do feed',exact:true})).toBeVisible();
 await expect(page.getByRole('switch',{name:'Treino concluído',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
