import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { waitForApiBudget } from './helpers/api-budget';

const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33318';
test('grupo por código: administração gera o código, convidado pede para entrar e só entra após aprovação', async ({ page, request }) => {
  test.skip(process.env.FIT_SOCIAL_ISOLATED !== '1', 'Requer API efêmera isolada.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local isolada.');
  await waitForApiBudget(request, apiURL);
  const register = async (firstName: string) => {
    const response = await request.post(`${apiURL}/auth/register`, { data: { email: `join-e2e-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName, lastName: 'Código' } });
    expect(response.status()).toBe(201); return response.json();
  };
  const owner = await register('Dona'), visitor = await register('Visita');
  const ownerHeaders = { authorization: `Bearer ${owner.accessToken}` }, visitorHeaders = { authorization: `Bearer ${visitor.accessToken}` };
  const group = await (await request.post(`${apiURL}/groups`, { headers: ownerHeaders, data: { name: 'Grupo por código' } })).json();
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, route => { const url = new URL(route.request().url()); return route.continue({ url: apiURL + url.pathname + url.search }); });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));

  // Administração: gera o código na tela de gerenciamento.
  await page.addInitScript(account => { if (!localStorage.getItem('fit.auth.tokens')) localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); }, owner);
  await page.goto(`/group-manage?id=${group.id}`);
  const admin = page.getByTestId('group-join-admin');
  await admin.getByRole('button', { name: 'Gerar código', exact: true }).click();
  const codeLabel = await admin.getByLabel(/^Código do grupo: /).getAttribute('aria-label');
  const code = codeLabel!.replace('Código do grupo: ', '').replaceAll(' ', '');
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  await expect(admin.getByRole('button', { name: 'Compartilhar código', exact: true })).toBeVisible();

  // Convidado: vê só nome e tamanho do grupo e pede para entrar.
  await page.evaluate(account => localStorage.setItem('fit.auth.tokens', JSON.stringify(account)), visitor);
  await page.goto('/group-join');
  await page.getByLabel('Código do grupo', { exact: true }).fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Buscar grupo', exact: true }).click();
  const preview = page.getByTestId('group-join-preview');
  await expect(preview.getByText('Grupo por código', { exact: true })).toBeVisible();
  await expect(preview.getByText('1 membro · grupo privado', { exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Pedir para entrar', exact: true }).click();
  await expect(preview.getByText(/Pedido enviado/)).toBeVisible();
  // Pedir não dá acesso.
  expect((await request.get(`${apiURL}/groups/${group.id}/posts`, { headers: visitorHeaders })).status()).toBe(404);

  // Administração: aprova o pedido pela mesma tela.
  await page.evaluate(account => localStorage.setItem('fit.auth.tokens', JSON.stringify(account)), owner);
  await page.goto(`/group-manage?id=${group.id}`);
  await page.getByTestId('group-join-admin').getByRole('button', { name: 'Aprovar pedido de Visita Código', exact: true }).click();
  await expect(page.getByTestId('group-join-admin').getByText(/Pedidos para entrar/)).toHaveCount(0);
  expect((await request.get(`${apiURL}/groups/${group.id}/posts`, { headers: visitorHeaders })).status()).toBe(200);
  expect(errors).toEqual([]);
});
