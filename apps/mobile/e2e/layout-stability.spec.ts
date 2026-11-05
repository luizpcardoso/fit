import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { waitForApiBudget } from './helpers/api-budget';

const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33329';
for (const theme of ['light', 'dark']) test(`foto mantém o espaço ao falhar, tentar novamente e carregar: ${theme}`, async ({page, request}) => {
  test.skip(process.env.FIT_LAYOUT_E2E !== '1', 'Use API local com banco isolado de testes.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local isolada.');
  await waitForApiBudget(request, apiURL);
  const registered = await request.post(apiURL + '/auth/register', {data: {email: `layout-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'Layout'}});
  expect(registered.status()).toBe(201);
  const account = await registered.json(), headers = {authorization: `Bearer ${account.accessToken}`};
  const group = await request.post(apiURL + '/groups', {headers, data: {name: 'Fotos estáveis'}});
  expect(group.status()).toBe(201);
  const groupId = (await group.json()).id;
  const image = await sharp({create: {width: 600, height: 1200, channels: 3, background: '#164e63'}}).png().toBuffer();
  const created = await request.post(`${apiURL}/groups/${groupId}/posts`, {headers, data: {text: 'Foto vertical', photoDataUrl: `data:image/png;base64,${image.toString('base64')}`}});
  expect(created.status()).toBe(201);
  const postId = (await created.json()).id;
  let fail = true;
  let release!: () => void;
  const ready = new Promise<void>(resolve => {release = resolve;});
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/photo-access')) {
      if (fail) {await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({code: 'UNAVAILABLE', message: 'Falha temporária de teste.'})}); return;}
      await ready;
    }
    await route.continue({url: apiURL + url.pathname + url.search});
  });
  await page.addInitScript(({account, theme}) => {localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); localStorage.setItem('fit.appearance.theme', theme);}, {account, theme});
  await page.setViewportSize({width: 320, height: 740});
  await page.goto(`/group-detail?id=${groupId}`);
  const card = page.getByTestId(`feed-post-${postId}`);
  await expect(card.getByText('A foto não carregou ou a publicação expirou.')).toBeVisible();
  const failedHeight = (await card.boundingBox())!.height;
  fail = false;
  await card.getByRole('button', {name: 'Tentar novamente', exact: true}).click();
  await expect(card.getByText('Carregando foto…')).toBeVisible();
  expect((await card.boundingBox())!.height).toBe(failedHeight);
  release();
  await expect(card.getByTestId('group-post-photo')).toBeVisible();
  expect((await card.boundingBox())!.height).toBe(failedHeight);
  await card.screenshot({path: `artifacts/ux-review/photo-stability-${theme}-320.png`});
});
