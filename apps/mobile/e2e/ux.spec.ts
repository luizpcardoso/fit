import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33317';
if (!['localhost','127.0.0.1'].includes(new URL(apiURL).hostname)) throw new Error('E2E somente em API local isolada');
let headers: Record<string,string>;
// Pace full browser reloads against the real local API limits.
test.beforeEach(async () => { await new Promise(resolve => setTimeout(resolve, 12000)); });
const date = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
async function post(request: APIRequestContext, path: string, data: unknown) { const r = await request.post(apiURL + path, { headers, data }); expect(r.ok(), await r.text()).toBeTruthy(); return r.status() === 204 ? null : r.json(); }
async function login(page: Page, request: APIRequestContext) {
  // Expo's development bundle may retain the device API URL. Forward real HTTP
  // calls to the explicitly selected isolated test API; no response is mocked.
  if (process.env.FIT_E2E_API_URL) await page.route(/^http:\/\/[^/]+:3333\//, async route => {
    const original = new URL(route.request().url());
    const response = await route.fetch({url:apiURL+original.pathname+original.search});
    await route.fulfill({response});
  });
  const data = { email: `e2e-${crypto.randomUUID()}@example.com`, password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'UX' };
  let result = await request.post(apiURL+'/auth/register', { data });
  if (result.status() === 429) {
    // Respect the real authentication rate limit when suites run consecutively.
    await new Promise(resolve => setTimeout(resolve, Math.min(60, Number(result.headers()['retry-after']) || 60) * 1000));
    result = await request.post(apiURL+'/auth/register', { data });
  }
  expect(result.status()).toBe(201); const account=await result.json(); headers={authorization:`Bearer ${account.accessToken}`};
  await page.addInitScript(account => { localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); if(!localStorage.getItem('fit.appearance.theme'))localStorage.setItem('fit.appearance.theme', 'dark'); },account);
  const errors: string[]=[];page.on('pageerror', error=>errors.push(error.message));
  return errors;
}
test('compartilhamento conclui, permite escolher grupo, fecha sem crash e preserva treino',async({page,request})=>{
  const errors=await login(page,request);
  const group=await post(request,'/groups',{name:'Grupo escolhido'});
  await request.put(apiURL+`/groups/${group.id}/events`,{headers,data:{workout_completed:true,cardio_completed:false,weekly_goal:false,weekly_streak:false,member_joined:false}});
  const created=await post(request,'/workout-plans',{name:'Ficha E2E',divisions:[{name:'Treino A',exercises:[{name:'Agachamento',sets:3,reps:'10'}]}]});
  const plan=await(await request.get(apiURL+`/workout-plans/${created.id}`,{headers})).json();
  await page.goto(`/workout-run?planId=${plan.id}&divisionId=${plan.divisions[0].id}`);
  await page.getByRole('checkbox').click();await page.getByRole('button',{name:'Finalizar treino',exact:true}).click();
  await expect(page.getByText('Compartilhar conquista?')).toBeVisible();
  await expect(page.getByRole('button',{name:'Compartilhar',exact:true})).toBeDisabled();
  await page.getByRole('checkbox').filter({hasText:'Grupo escolhido'}).click();
  await page.route('**/groups/share-activity', route => route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({code:'INTERNAL_ERROR',message:'Falha simulada'}) }), { times:1 });
  await page.getByRole('button',{name:'Compartilhar',exact:true}).click();
  await expect(page.getByText(/Compartilhamento não enviado/)).toBeVisible();
  expect((await(await request.get(apiURL+'/workout-sessions',{headers})).json()).length).toBe(1);
  await page.getByRole('button',{name:'Compartilhar',exact:true}).click();
  await expect(page.getByText('Treino finalizado!',{exact:true})).toBeVisible();
  expect((await(await request.get(apiURL+'/workout-sessions',{headers})).json()).length).toBe(1);
  expect(errors).toEqual([]);
});
test('medicamentos: cinco por página, busca, exclusão cancelada e confirmada',async({page,request})=>{
  const errors=await login(page,request);
  for(let i=0;i<12;i++)await post(request,'/medications',{name:`Medicamento ${String(i).padStart(2,'0')}`,dailyFrequency:1,times:['08:00']});
  await page.goto('/health-routine?kind=medication');
  await expect(page.getByText('Página 1 de 3')).toBeVisible();
  await page.getByRole('button',{name:'Editar Medicamento 00',exact:true}).first().click();
  await expect(page.getByRole('switch',{name:'Cadastro ativo'})).toBeVisible();
  await page.getByRole('switch',{name:'Cadastro ativo'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/ux-review/health-switch-dark-390.png',fullPage:true,animations:'disabled'});
  await page.getByText('Fechar',{exact:true}).click();
  await expect(page.getByRole('button',{name:/^Excluir Medicamento/})).toHaveCount(5);
  await page.getByRole('button',{name:'Próxima página'}).click();await expect(page.getByText('Página 2 de 3')).toBeVisible();
  await page.getByLabel('Buscar medicamentos').fill('Medicamento 11');await expect(page.getByText('Página 1 de 1')).toBeVisible();
  await page.getByRole('button',{name:'Excluir Medicamento 11',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Excluir Medicamento 11',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Excluir Medicamento 11',exact:true}).click();await page.getByRole('button',{name:'Excluir medicamento',exact:true}).click();
  await expect(page.getByText('Medicamento 11 excluído.')).toBeVisible();expect(errors).toEqual([]);
});
test('Home: conclusão direta e refeição atualizam dados persistidos',async({page,request})=>{
  const errors=await login(page,request);
  await post(request,'/supplements',{name:'Suplemento E2E',dailyFrequency:1,times:['08:00']});
  await request.put(apiURL+'/nutrition/goal',{headers,data:{targetCalories:2000}});
  await page.goto('/');await page.getByRole('button',{name:/atividades de hoje/i}).click();
  await page.route('**/supplements/*/intakes', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'INTERNAL_ERROR',message:'Falha simulada'})}),{times:1});
  await page.getByRole('checkbox',{name:'Registrar tomada de Suplemento E2E'}).click();
  await expect(page.getByText(/Não foi possível confirmar a alteração/)).toBeVisible();
  expect((await(await request.get(apiURL+`/supplements/today?date=${date()}`,{headers})).json()).consumed).toBe(0);
  await page.getByRole('checkbox',{name:'Registrar tomada de Suplemento E2E'}).click();
  await expect(page.getByRole('checkbox',{name:'Desfazer tomada de Suplemento E2E'})).toBeChecked();
  await page.getByLabel('Fechar atividades de hoje').click();await page.getByRole('button',{name:'Adicionar refeição',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Rápida',exact:true})).toBeChecked();
  await expect(page.getByLabel('Proteínas (g)',{exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:/Informar proteínas, carboidratos e gorduras/}).click();
  await expect(page.getByLabel('Proteínas (g)',{exact:true})).toBeVisible();
  await page.getByLabel('Proteínas (g)',{exact:true}).fill('35');
  await page.getByRole('checkbox',{name:/Informar proteínas, carboidratos e gorduras/}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Almoço E2E');
  await page.getByLabel('Calorias (kcal)',{exact:true}).fill('500');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText('Refeição registrada.',{exact:true})).toBeVisible();
  const summary=await(await request.get(apiURL+`/nutrition/summary?date=${date()}`,{headers})).json();expect(summary.consumed.calories).toBe(500);expect(summary.consumed.protein).toBe(0);expect(summary.consumptionGoal.remainingCalories).toBe(1500);expect(errors).toEqual([]);
});
test('injetáveis: gráfico abre, alterna e fecha',async({page,request})=>{
  const errors=await login(page,request);for(const name of ['Injetável A','Injetável B'])await post(request,'/injectables',{name,dose:1,unit:'mg',weekdays:[1],halfLifeDays:5});
  await page.goto('/injectables');await page.getByRole('button',{name:'Ver quantidade estimada no organismo'}).click();
  await expect(page.getByRole('heading',{name:'Quantidade estimada no organismo'})).toBeVisible();
  await page.getByRole('radio',{name:'Injetável B'}).click();await expect(page.getByRole('radio',{name:'Injetável B'})).toBeChecked();
  await page.getByLabel('Fechar gráfico').click();await expect(page.getByLabel('Fechar gráfico')).toHaveCount(0);expect(errors).toEqual([]);
});
test('Mente: atalho, ação única e persistência',async({page,request})=>{
  const errors=await login(page,request);await page.goto('/');await page.getByRole('button',{name:/^Mente/}).click();
  await expect(page.getByText('Fazer check-in',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Como se sente hoje?'}).click();await page.getByText('Bem',{exact:true}).click();await page.getByText('Salvar',{exact:true}).first().click();
  await expect(page.getByText('Seu check-in de hoje')).toBeVisible();expect(errors).toEqual([]);
});
test('layouts nos dois temas: 320, 360, 390, 430 e desktop',async({page,request})=>{
  const errors=await login(page,request);await post(request,'/medications',{name:'Medicamento com nome longo para conferir o layout',dailyFrequency:1,times:['08:00']});
  for(const theme of ['light','dark'])for(const width of [320,360,390,430,1280]){
    await page.setViewportSize({width,height:844});await page.goto('/health-routine?kind=medication');await page.evaluate(t=>localStorage.setItem('fit.appearance.theme',t),theme);await page.reload();
    await expect(page.getByLabel('Buscar medicamentos')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:`artifacts/ux-review/medications-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  expect(errors).toEqual([]);
});

test('medidas: paginação e guia do campo selecionado',async({page,request})=>{
 const errors=await login(page,request);
 for(let i=0;i<12;i++)await post(request,'/body-measurements',{date:date(),weightKg:70+i});
 await page.goto('/body-measurements');await expect(page.getByText('Página 1 de 3')).toBeVisible();
 await page.getByRole('button',{name:'Próxima página'}).click();await expect(page.getByText('Página 2 de 3')).toBeVisible();
 await page.getByText('+ Registrar',{exact:true}).click();await page.getByText('Peso e medidas',{exact:true}).click();
 await page.getByRole('radio',{name:'Braço esquerdo',exact:true}).click();
 await expect(page.getByRole('img',{name:/Corpo de frente. Região destacada: Braço esquerdo/})).toBeVisible();
 await page.screenshot({path:'artifacts/ux-review/body-guide-dark-390.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});
test('Home e Alimentação: capturas claro e escuro',async({page,request})=>{
 const errors=await login(page,request);await post(request,'/nutrition/meals',{name:'Almoço',date:date(),time:'12:30',directNutrition:{calories:500,protein:25,carbs:60,fat:18}});
 for(const theme of ['light','dark'])for(const route of ['/','/food-tracking']){
  await page.goto(route);await page.evaluate(t=>localStorage.setItem('fit.appearance.theme',t),theme);
  const probe = await request.get(apiURL+'/auth/me',{headers});
  if(probe.status()===429)await new Promise(resolve=>setTimeout(resolve,(Math.min(60,Number(probe.headers()['retry-after'])||60)+1)*1000));
  await page.reload();await expect(page.getByRole('button',{name:route === '/' ? 'Adicionar refeição' : 'Registrar refeição',exact:true})).toBeVisible();
  await page.screenshot({path:`artifacts/ux-review/${route==='/'?'home':'nutrition'}-${theme}-390.png`,fullPage:true,animations:'disabled'});
 }expect(errors).toEqual([]);
});


test('Home: balanço estimado explica cálculo e registra somente calorias', async ({page,request}) => {
  const errors = await login(page,request);
  const profile = await request.patch(apiURL+'/auth/me',{headers,data:{birthDate:'1990-10-28',gender:'male',estimationSex:'male',heightCm:180,activityLevel:'very_active'}});
  expect(profile.ok(), await profile.text()).toBeTruthy();
  await post(request,'/body-measurements',{date:date(),weightKg:80});
  await post(request,'/cardio-sessions',{date:date(),mode:'estimated',activity:'cycling',intensity:'moderate',durationMinutes:30,weightKg:80});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Balanço calórico',exact:true})).toBeVisible();
  await expect(page.getByText('2.340 kcal',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Como calculamos o balanço calórico'}).click();
  await page.getByRole('button',{name:/Detalhes do cálculo/}).click();
  await expect(page.getByText(/45 minutos a 3,5 MET/)).toBeVisible();
  await page.getByLabel('Fechar informações').click();
  await page.getByRole('button',{name:'Adicionar refeição',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Refeição rápida');
  await page.getByLabel('Calorias (kcal)',{exact:true}).fill('500');
  await expect(page.getByLabel('Proteínas (g)',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText('−1.840 kcal',{exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'Balanço calórico',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/ux-review/home-energy-dark-390.png',fullPage:true,animations:'disabled'});
  await page.goto('/nutrition');
  await expect(page.getByText('−1.840 kcal',{exact:true})).toBeVisible();
  await expect(page.getByText('2.340 kcal',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('Estimativa automática do dia',{exact:true})).toBeVisible();
  await page.getByText('−1.840 kcal',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/ux-review/nutrition-unified-energy-390.png',animations:'disabled'});
  await page.getByRole('button',{name:'Ajustar gasto',exact:true}).click();
  await page.getByRole('radio',{name:/Informar valor/}).click();
  await page.getByLabel('Gasto total (kcal)',{exact:true}).fill('2400');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText('−1.900 kcal',{exact:true})).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('−1.900 kcal',{exact:true})).toBeVisible();
  await expect(page.getByText('2.400 kcal',{exact:true})).toBeVisible();
  const removed=await request.delete(apiURL+`/nutrition/expenditures/${date()}`,{headers});
  expect(removed.status()).toBe(204);
  await page.goto('/nutrition');
  await expect(page.getByText('−1.840 kcal',{exact:true})).toBeVisible();
  await page.getByLabel('Dia anterior',{exact:true}).click();
  await expect(page.getByText('Gasto indisponível',{exact:true})).toBeVisible();
  await expect(page.getByText('−1.840 kcal',{exact:true})).toHaveCount(0);
  await page.getByText('Voltar para hoje',{exact:true}).click();
  await expect(page.getByText('−1.840 kcal',{exact:true})).toBeVisible();

  expect(errors).toEqual([]);
});

test('grupo: posts primeiro, menus acompanham rolagem e publicação preserva rascunho', async ({page,request}) => {
  page.setDefaultTimeout(15000);
  const errors = await login(page,request);
  const group = await post(request,'/groups',{name:'Feed compacto E2E',description:'Descrição disponível nas configurações, sem ocupar o feed.'});
  for (let index=0; index<12; index++) await post(request,`/groups/${group.id}/posts`,{text:`Publicação ${String(index).padStart(2,'0')} — Compartilhando a rotina do grupo e celebrando os resultados da semana.`});
  await page.goto(`/group-detail?id=${group.id}`);
  const write = page.getByRole('button',{name:'Escrever publicação',exact:true});
  const newest = page.getByText(/^Publicação 11 —/);
  await expect(newest).toBeInViewport();
  expect((await newest.boundingBox())!.y).toBeLessThan(220);
  await expect(write).toBeInViewport();
  await expect(page.getByRole('button',{name:'Ir para o topo do feed'})).toHaveCount(0);
  await expect(page.getByPlaceholder('Compartilhe uma conquista...')).toHaveCount(0);
  await expect(page.getByText('Convidar pessoas',{exact:true})).toHaveCount(0);
  await page.screenshot({path:'artifacts/ux-review/group-feed-top-dark-390.png',animations:'disabled'});
  await page.evaluate(() => localStorage.setItem('fit.appearance.theme','light'));
  await page.reload();
  await expect(newest).toBeInViewport();
  await page.screenshot({path:'artifacts/ux-review/group-feed-top-light-390.png',animations:'disabled'});
  await newest.hover();
  await page.mouse.wheel(0,1100);
  await expect(write).not.toBeInViewport();
  await page.mouse.wheel(0,-250);
  await expect(write).toBeInViewport();
  await page.getByRole('button',{name:'Ir para o topo do feed'}).click();
  await expect(newest).toBeInViewport();
  await expect(page.getByRole('button',{name:'Ir para o topo do feed'})).toHaveCount(0);
  await write.click();
  await page.getByLabel('Texto da publicação',{exact:true}).fill('Rascunho preservado E2E');
  await page.getByRole('button',{name:'Fechar editor de publicação'}).click();
  await expect(page.getByText('Continuar rascunho',{exact:true})).toBeVisible();
  await write.click();
  await expect(page.getByLabel('Texto da publicação',{exact:true})).toHaveValue('Rascunho preservado E2E');
  await page.route('**/groups/*/posts',route => route.request().method()==='POST' ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'INTERNAL_ERROR',message:'Falha simulada'})}) : route.continue(),{times:1});
  await page.getByRole('button',{name:'Publicar no grupo',exact:true}).click();
  await expect(page.getByText(/Seu rascunho foi mantido/)).toBeVisible();
  await expect(page.getByLabel('Texto da publicação',{exact:true})).toHaveValue('Rascunho preservado E2E');
  await page.getByRole('button',{name:'Publicar no grupo',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nova publicação',exact:true})).toHaveCount(0);
  await expect(page.getByText('Rascunho preservado E2E',{exact:true})).toBeInViewport();
  const feed = await (await request.get(apiURL+`/groups/${group.id}/posts`,{headers})).json();
  expect(feed.items.filter((item:{text:string})=>item.text==='Rascunho preservado E2E')).toHaveLength(1);
  await page.getByRole('button',{name:'Configurações do grupo',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Configurações do feed',exact:true})).toBeVisible();
  await expect(page.getByText('Suas preferências',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('Grupos: avatar e badge legíveis nos temas claro e escuro', async ({page,request}) => {
  const errors = await login(page,request);
  await post(request,'/groups',{name:'Grupos contraste E2E',description:'Avatares, ícones e identificação de proprietário com contraste.'});
  const contrast = async (element: import('@playwright/test').Locator) => element.evaluate(node => {
    const foreground = getComputedStyle(node).color;
    let parent: Element | null = node, background = '';
    while (parent) {
      const color = getComputedStyle(parent).backgroundColor;
      if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {background=color;break;}
      parent=parent.parentElement;
    }
    const luminance = (color:string) => {
      const values = (color.match(/[\d.]+/g) ?? []).slice(0,3).map(Number).map(value => value/255).map(value => value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
      return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
    };
    const values = [luminance(foreground),luminance(background)].sort((a,b)=>a-b);
    return (values[1]+0.05)/(values[0]+0.05);
  });
  for (const theme of ['dark','light']) {
    await page.goto('/groups');
    await page.evaluate(value => localStorage.setItem('fit.appearance.theme',value),theme);
    await page.reload();
    const badge = page.getByText('Proprietário',{exact:true});
    const avatar = page.getByText('GR',{exact:true});
    await expect(badge).toBeVisible();
    await expect(avatar).toBeVisible();
    expect(await contrast(badge)).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(avatar)).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({path:`artifacts/ux-review/group-contrast-${theme}-390.png`,animations:'disabled'});
  }
  expect(errors).toEqual([]);
});
