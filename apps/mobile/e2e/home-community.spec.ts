import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33329';
test('home apresenta comunidade vazia, falha, convite, grupos e novidades com destinos reais', async ({ page, request }) => {
  test.skip(process.env.FIT_NAVIGATION_E2E !== '1', 'Requer API e banco locais isolados.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local de testes.');
  const register = async () => {
    const response = await request.post(`${apiURL}/auth/register`, { data: { email: `home-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'Comunidade' } });
    expect(response.status()).toBe(201); return response.json();
  };
  const owner = await register(), viewer = await register();
  const ownerHeaders = { authorization: `Bearer ${owner.accessToken}` }, viewerHeaders = { authorization: `Bearer ${viewer.accessToken}` };
  await page.addInitScript(account => { if (!localStorage.getItem('fit.auth.tokens')) localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); }, viewer);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, route => { const url = new URL(route.request().url()); return route.continue({ url: apiURL + url.pathname + url.search }); });
  await page.goto('/');
  const card = page.getByTestId('home-community');
  await expect(card.getByRole('button', { name: 'Conhecer comunidade' })).toBeVisible();
  await expect(page.getByText('Meus atalhos', { exact: true })).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('fit.appearance.theme', theme), theme); await page.reload();
    for (const width of [320, 390, 412]) {
      await page.setViewportSize({ width, height: 844 });
      await card.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const tab = page.getByRole('tab', { name: 'Nutrição', exact: true });
      await expect(tab.getByText('Nutrição', { exact: true })).toBeVisible();
      await page.screenshot({ path: `artifacts/ux-review/home-${theme}-${width}.png` });
    }
  }
  await page.route('**/groups', route => route.request().method() === 'GET' ? route.abort() : route.continue());
  await page.reload();
  await expect(card.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await page.unroute('**/groups');
  await card.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(card.getByRole('button', { name: 'Conhecer comunidade' })).toBeVisible();
  const response = await request.post(`${apiURL}/groups`, { headers: ownerHeaders, data: { name: 'Grupo home' } });
  expect(response.status()).toBe(201); const group = await response.json();
  expect((await request.post(`${apiURL}/groups/${group.id}/invites`, { headers: ownerHeaders, data: { username: viewer.user.username } })).status()).toBe(201);
  await page.reload();
  await card.getByRole('button', { name: 'Ver convite', exact: true }).click();
  await expect(page).toHaveURL(/\/social-groups$/);
  const invites = await (await request.get(`${apiURL}/groups/invites`, { headers: viewerHeaders })).json();
  expect((await request.patch(`${apiURL}/groups/invites/${invites[0].id}`, { headers: viewerHeaders, data: { decision: 'accepted' } })).status()).toBe(204);
  await page.goto('/');
  // Entrar no grupo não conta como novidade para a própria pessoa: sem publicações de outros, está tudo em dia.
  await expect(card.getByRole('button', { name: 'Abrir meus grupos', exact: true })).toBeVisible();
  expect((await request.post(`${apiURL}/groups/${group.id}/posts`, { headers: ownerHeaders, data: { text: 'Conquista de hoje' } })).status()).toBe(201);
  await page.goto('/');
  const joinedGroups = await (await request.get(`${apiURL}/groups`, { headers: viewerHeaders })).json();
  const unreadBefore = joinedGroups.find((item: { id: string }) => item.id === group.id).unseenCount;
  expect(unreadBefore).toBeGreaterThan(0);
  const secondResponse = await request.post(`${apiURL}/groups`, { headers: ownerHeaders, data: { name: 'Grupo convite' } });
  expect(secondResponse.status()).toBe(201); const secondGroup = await secondResponse.json();
  expect((await request.post(`${apiURL}/groups/${secondGroup.id}/invites`, { headers: ownerHeaders, data: { username: viewer.user.username } })).status()).toBe(201);
  await page.goto('/');
  await expect(card.getByText('Convite · Grupo convite', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: /^Abrir Grupo home,/ })).toBeVisible();
  const afterPreview = await (await request.get(`${apiURL}/groups`, { headers: viewerHeaders })).json();
  expect(afterPreview.find((item: { id: string }) => item.id === group.id).unseenCount).toBe(unreadBefore);
  // A publicação aparece no Início e aceita reação em um toque, ainda sem marcar o grupo como lido.
  const preview = card.getByTestId(/^home-community-post-/).first();
  await expect(preview.getByText('Conquista de hoje', { exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Reagir: Curtir', exact: true }).click();
  await expect(preview.getByRole('button', { name: 'Reagir: Curtir', exact: true })).toHaveAttribute('aria-selected', 'true');
  const afterReaction = await (await request.get(`${apiURL}/groups`, { headers: viewerHeaders })).json();
  expect(afterReaction.find((item: { id: string }) => item.id === group.id).unseenCount).toBe(unreadBefore);
  await card.getByRole('button', { name: /^Abrir Grupo home,/ }).click();
  await expect(page).toHaveURL(/\/group-detail\?id=/);
  await expect(page.getByTestId(/^feed-post-/).getByText('Conquista de hoje', { exact: true })).toBeVisible();
  // O convite pode ser aceito direto no Início, por um toque explícito.
  await page.goto('/');
  await card.getByRole('button', { name: 'Aceitar convite para Grupo convite', exact: true }).click();
  await expect(card.getByText('Convite · Grupo convite', { exact: true })).toHaveCount(0);
  const joinedAfterAccept = await (await request.get(`${apiURL}/groups`, { headers: viewerHeaders })).json();
  expect(joinedAfterAccept.some((item: { id: string }) => item.id === secondGroup.id)).toBe(true);
  expect(errors).toEqual([]);
});
