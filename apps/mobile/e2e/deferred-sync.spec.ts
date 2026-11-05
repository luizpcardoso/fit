import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { waitForApiBudget } from './helpers/api-budget';
const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33329';
async function register(request: APIRequestContext) {
  await waitForApiBudget(request, apiURL);
  const response = await request.post(`${apiURL}/auth/register`, { data: { email: `local-${randomUUID()}@example.com`, password: 'integration-test-123', phone: '71999990000', firstName: 'Teste', lastName: 'Local' } });
  expect(response.status()).toBe(201); return response.json();
}
function checkEnvironment() {
  test.skip(process.env.FIT_DEFERRED_SYNC_E2E !== '1', 'Requer API local com banco exclusivo de testes.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local isolada.');
  test.setTimeout(240000);
}
async function meal(page: Page, name: string, calories: string) {
  await page.getByRole('button', { name: 'Adicionar refeição', exact: true }).click();
  await page.getByRole('radio', { name: 'Almoço', exact: true }).click();
  await page.getByLabel('Nome da refeição', { exact: true }).fill(name);
  await page.getByLabel('Calorias (kcal)', { exact: true }).fill(calories);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByTestId('home-scroll').getByText('Refeição salva neste aparelho.', { exact: true })).toBeVisible();
}

for (const theme of ['light', 'dark']) test(`refeições locais, recuperação offline e lote idempotente: ${theme}`, async ({ page, request }) => {
  checkEnvironment(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  const account = await register(request), headers = { authorization: `Bearer ${account.accessToken}` };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const stored = async () => (await request.get(`${apiURL}/nutrition/meals?date=${today}`, { headers })).json();
  let offline = false, loseAcknowledgement = false;
  const uploads: unknown[] = [];
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, async route => {
    const url = new URL(route.request().url()), target = `${apiURL}${url.pathname}${url.search}`;
    if (url.pathname === '/nutrition/meal-sync') uploads.push(route.request().postDataJSON());
    if (offline) return route.abort('internetdisconnected');
    if (loseAcknowledgement && url.pathname === '/nutrition/meal-sync') { loseAcknowledgement = false; const result = await route.fetch({ url: target }); expect(result.status()).toBe(200); return route.abort('failed'); }
    return route.continue({ url: target });
  });
  await page.addInitScript(({ account, theme }) => { if (!localStorage.getItem('fit.auth.tokens')) localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); localStorage.setItem('fit.appearance.theme', theme); }, { account, theme });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  // Warm the private references once; all input changes below remain local.
  await page.getByRole('button', { name: 'Adicionar refeição', exact: true }).click();
  await expect(page.getByText('Buscando dieta vinculada…', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  offline = true;
  await meal(page, 'Marmita offline', '500'); await meal(page, 'Fruta offline', '80');
  expect(uploads).toHaveLength(0); expect(await stored()).toHaveLength(0);
  await expect(page.getByTestId('meal-sync-status')).toContainText('2 registros salvos neste aparelho');
  await page.reload();
  await expect(page.getByTestId('meal-sync-status')).toContainText('2 registros salvos neste aparelho');
  expect(await stored()).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByTestId('meal-sync-status').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/ux-review/meal-local-${theme}-320.png` });
  offline = false; loseAcknowledgement = true;
  await page.getByRole('button', { name: 'Sincronizar refeições agora', exact: true }).click();
  await expect(page.getByTestId('meal-sync-status')).toContainText('O envio será tentado novamente');
  await expect.poll(async () => (await stored()).length).toBe(2);
  await page.getByRole('button', { name: 'Sincronizar refeições agora', exact: true }).click();
  await expect(page.getByTestId('meal-sync-status')).toHaveCount(0);
  expect(await stored()).toHaveLength(2);
  const successful = uploads.slice(-2) as { entries: { id: string }[] }[];
  expect(successful[0].entries).toHaveLength(2); expect(successful[1].entries.map(e => e.id)).toEqual(successful[0].entries.map(e => e.id));
  await page.getByRole('button', { name: 'Ver alimentação do dia', exact: true }).click();
  await expect(page.getByText('12:30 · Marmita offline', { exact: true })).toBeVisible();
  await expect(page.getByText('12:30 · Fruta offline', { exact: true })).toBeVisible();
  await expect(page.getByText('Salvo neste aparelho · envio pendente', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ir para o início', exact: true }).click();
  await meal(page, 'Antes de sair', '90');
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(page.getByText('Há registros só neste aparelho', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar no app', exact: true }).click();
  await expect(page.getByTestId('meal-sync-status')).toContainText('1 registro salvo neste aparelho');
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await page.getByRole('button', { name: 'Sair e apagar dados locais', exact: true }).click();
  await expect.poll(() => page.evaluate(owner => Object.keys(localStorage).filter(key => key.startsWith(`fit.nutrition.${owner}`)).length, account.user.id)).toBe(0);
  expect((await request.get(`${apiURL}/nutrition/meals?date=${today}`, {headers})).status()).toBe(401);

  expect(errors).toEqual([]);
});

for (const theme of ['light', 'dark']) test(`treino persiste séries sem enviar cada interação: ${theme}`, async ({ page, request }) => {
  checkEnvironment(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  const account = await register(request), headers = { authorization: `Bearer ${account.accessToken}` };
  const response = await request.post(`${apiURL}/workout-plans`, { headers, data: { name: 'Ficha local', divisions: [{ name: 'Costas', exercises: [{ name: 'Remada local', sets: 3, reps: '12', restSeconds: 60 }, { name: 'Puxada local', sets: 2, reps: '10' }] }] } });
  expect(response.status()).toBe(201); const plan = await response.json();
  const uploads: string[] = [];
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, route => { const url = new URL(route.request().url()); if (/^\/workout-runs\//.test(url.pathname) && route.request().method() === 'PUT') uploads.push(url.pathname); return route.continue({ url: `${apiURL}${url.pathname}${url.search}` }); });
  await page.addInitScript(({ account, theme }) => { localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); localStorage.setItem('fit.appearance.theme', theme); }, { account, theme });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/workout-run?planId=${plan.id}`);
  await page.getByRole('button', { name: 'Iniciar treino A', exact: true }).click();
  // The sync state lives in the options sheet; the training screen only shows problems.
  const expectSync = async (text: string) => { await page.getByRole('button', { name: 'Opções do treino', exact: true }).click(); await expect(page.getByText(text, { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Fechar', exact: true }).click(); };
  const synced = 'Sincronizado com sua conta.', pending = 'Salvo neste celular; envio pendente para a conta.';
  await expectSync(synced);
  expect(uploads).toHaveLength(1);
  const primary = page.getByTestId('complete-exercise-button');
  for (let i = 0; i < 3; i++) {
    await primary.click();
    await page.getByRole('checkbox', { name: 'Série 1 concluída', exact: true }).click();
  }
  await primary.click();
  await expect(page.getByLabel('1 de 3 séries concluídas', { exact: true })).toBeVisible();
  await expectSync(pending);
  expect(uploads).toHaveLength(1);
  const remote = await (await request.get(`${apiURL}/workout-runs/active`, { headers })).json();
  expect(remote.progress.exercises[0].completedSets).toEqual([]);
  await page.reload();
  await expect(page.getByLabel('1 de 3 séries concluídas', { exact: true })).toBeVisible();
  await expectSync(synced);
  expect(uploads).toHaveLength(2);
  await page.getByRole('button', { name: /^Mais ações para / }).click();
  await page.getByRole('button', { name: /^Concluir todas as séries/ }).click();
  await expect(page.getByLabel('3 de 3 séries concluídas', { exact: true })).toBeVisible();
  expect(uploads).toHaveLength(2);
  await page.getByRole('button', { name: 'Opções do treino', exact: true }).click();
  await page.getByRole('button', { name: 'Sincronizar agora', exact: true }).click();
  await expect(page.getByText(synced, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  expect(uploads).toHaveLength(3);
  expect((await (await request.get(`${apiURL}/workout-runs/active`, { headers })).json()).progress.exercises[0].completedSets).toEqual([0, 1, 2]);
  expect(errors).toEqual([]);
});
