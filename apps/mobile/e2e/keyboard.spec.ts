import { test, expect, type Page, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33317';
if (!['localhost', '127.0.0.1'].includes(new URL(apiURL).hostname)) throw new Error('Use API local isolada');

// Emulate browsers whose visual viewport shrinks while layout viewport stays tall.
// This is deliberately distinct from resizing the entire browser window.
async function keyboard(page: Page, height: number) {
  await page.evaluate(height => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: height });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  }, height);
}
async function writeVisible(page: Page, input: Locator, value: string) {
  await input.focus();
  await input.fill(value);
  await expect(input).toBeFocused();
  await expect.poll(() => input.evaluate(element => {
    const viewport = window.visualViewport!;
    let top = viewport.offsetTop;
    let bottom = top + viewport.height;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (!/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY)) continue;
      const rect = parent.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
    const bounds = element.getBoundingClientRect();
    return bounds.top >= top - 1 && bounds.bottom <= bottom + 1;
  }), 'O campo inteiro deve estar dentro da área visível, incluindo cabeçalhos e rodapés').toBe(true);
  await expect(input).toBeFocused();
}

for (const width of [320, 390]) test(`escrita com teclado e troca de campo: ${width}px`, async ({page, request}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(30000);
  // Forward a cached development API origin to the isolated real API.
  await page.route(/^http:\/\/[^/]+:3333\//, async route => {
    const url = new URL(route.request().url());
    await route.fulfill({response: await route.fetch({url: apiURL + url.pathname + url.search})});
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width, height:844});
  await page.goto('/login');
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('E-mail', {exact:true}), 'teclado@example.com');
  await writeVisible(page, page.getByLabel('Senha', {exact:true}), 'senha-teste-123');
  await keyboard(page, 844);
  await page.goto('/register');
  await keyboard(page, 360);
  await writeVisible(page, page.getByLabel('Senha', {exact:true}), 'senha-teste-123');
  await writeVisible(page, page.getByLabel('Nome', {exact:true}), 'Teclado');
  await writeVisible(page, page.getByLabel('Telefone', {exact:true}), '71999990000');
  await keyboard(page, 844);

  const email = `keyboard-${randomUUID()}@example.com`;
  const response = await request.post(apiURL+'/auth/register', {data:{email,password:'test-password-123',phone:'71999990000',firstName:'Teste',lastName:'Teclado'}});
  expect(response.status(), await response.text()).toBe(201);
  const account = await response.json();
  const headers = {authorization:`Bearer ${account.accessToken}`};
  await page.addInitScript(({account,width}) => {
    localStorage.setItem('fit.auth.tokens', JSON.stringify(account));
    localStorage.setItem('fit.appearance.theme', width === 320 ? 'light' : 'dark');
  }, {account,width});
  const groupResponse = await request.post(apiURL+'/groups', {headers,data:{name:'Grupo teste de teclado'}});
  expect(groupResponse.ok()).toBeTruthy();
  const group = await groupResponse.json();

  await page.goto('/mental-wellbeing');
  await page.getByRole('button',{name:'Como se sente hoje?'}).click();
  await keyboard(page, 380);
  const note = page.getByLabel('Anotação do diário');
  await writeVisible(page, note, 'Reflexão sobre meu dia.\n'.repeat(25));
  await note.press('End');
  await note.pressSequentially('Continuo vendo o que escrevo.', {delay:5});
  await expect(note).toBeFocused();
  await page.screenshot({path:`artifacts/ux-review/keyboard-mental-${width}.png`});
  await keyboard(page, 844);
  await page.getByLabel('Fechar check-in').click();

  await page.goto('/profile-details');
  await keyboard(page, 360);
  await writeVisible(page, page.getByPlaceholder('Ex.: 174'), '175');
  await keyboard(page, 844);

  await page.goto('/feedback');
  await keyboard(page, 360);
  await writeVisible(page, page.getByLabel('Mensagem de feedback'), 'Mensagem longa para verificar a escrita.\n'.repeat(25));
  await keyboard(page, 844);

  await page.goto('/groups');
  await page.getByLabel('Criar grupo', {exact:true}).click();
  await keyboard(page, 360);
  await writeVisible(page, page.getByLabel('Descrição do grupo'), 'Descrição visível com teclado aberto.');
  await writeVisible(page, page.getByLabel('Nome do grupo'), 'Grupo novo');
  await page.screenshot({path:`artifacts/ux-review/keyboard-group-${width}.png`});
  await keyboard(page, 844);

  await page.goto(`/group-detail?id=${group.id}`);
  await page.getByRole('button',{name:'Escrever publicação',exact:true}).click();
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('Texto da publicação'), 'Texto de uma publicação com teclado aberto.\n'.repeat(10));
  await keyboard(page, 844);

  await page.goto('/health-routine?kind=medication');
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('Buscar medicamentos'), 'Teste');
  await keyboard(page, 844);
  await page.getByRole('button',{name:'Cadastrar medicamento',exact:true}).click();
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('Observações',{exact:true}), 'Anotação do cadastro.\n'.repeat(10));
  await writeVisible(page, page.getByLabel('Nome do medicamento'), 'Medicamento teste');
  await keyboard(page, 844);

  await page.goto('/injectables');
  await page.getByRole('button',{name:'Cadastrar injetável',exact:true}).click();
  await keyboard(page, 390);
  await writeVisible(page, page.getByPlaceholder('Ex.: Aplicar conforme orientação médica.'), 'Anotação de teste de teclado');
  await keyboard(page, 844);

  await page.goto('/food-tracking');
  await page.getByRole('button',{name:'Registrar refeição',exact:true}).first().click();
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('Calorias (kcal)',{exact:true}), '500');
  await writeVisible(page, page.getByLabel('Nome',{exact:true}), 'Almoço teste');
  await keyboard(page, 844);

  await page.goto('/body-measurements');
  await page.getByText('+ Registrar',{exact:true}).click();
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('Observações · opcional',{exact:true}), 'Observação para verificar a rolagem.');
  await keyboard(page, 844);

  await page.goto('/workout-create');
  await page.getByRole('button',{name:/Criar minha ficha/}).click();
  await keyboard(page, 390);
  await writeVisible(page, page.getByLabel('Nome do treino A'), 'Treino com teclado');
  await writeVisible(page, page.getByLabel('Nome da ficha'), 'Ficha com teclado');
  await expect(page.getByRole('button',{name:'Salvar ficha',exact:true})).toBeInViewport();
  await page.screenshot({path:`artifacts/ux-review/keyboard-workout-${width}.png`});
  await keyboard(page, 844);
  expect(errors).toEqual([]);
});
