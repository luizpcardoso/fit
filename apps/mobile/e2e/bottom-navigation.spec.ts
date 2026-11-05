import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33329';

test('conteúdo das abas fica acima da barra inferior com área de navegação ampliada', async ({ page, request }) => {
  test.skip(process.env.FIT_NAVIGATION_E2E !== '1', 'Requer API e banco locais isolados.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local de testes.');
  const response = await request.post(`${apiURL}/auth/register`, { data: { email: `navigation-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'Navegação' } });
  expect(response.status()).toBe(201);
  const account = await response.json();
  const headers = { authorization: `Bearer ${account.accessToken}` };
  expect((await request.post(`${apiURL}/groups`, { headers, data: { name: 'Grupo navegação' } })).status()).toBe(201);
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, route => {
    const url = new URL(route.request().url());
    return route.continue({ url: apiURL + url.pathname + url.search });
  });
  await page.addInitScript(account => { localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); localStorage.setItem('fit.appearance.theme', 'dark'); }, account);
  await page.goto('/');
  const disclaimer = page.getByText('Apenas atividades autorizadas por você e pelo grupo aparecem no feed.', { exact: true });
  await expect(disclaimer).toBeAttached();
  const tabs = page.getByRole('tablist');
  const tabBar = tabs.locator('..');
  for (const width of [339, 320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 640 : 766 });
    for (const bottom of [0, 24, 48]) {
      // Grow the real bar as safe-area insets do on devices with gestures/three buttons.
      await tabBar.evaluate((element, inset) => { const bar = element as HTMLElement; bar.style.height = `${76 + inset}px`; bar.style.paddingBottom = `${7 + inset}px`; }, bottom);
      await disclaimer.scrollIntoViewIfNeeded();
      await expect.poll(async () => {
        const content = await disclaimer.boundingBox(), bar = await tabBar.boundingBox();
        return Boolean(content && bar && content.y + content.height <= bar.y);
      }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
  await page.screenshot({ path: 'artifacts/ux-review/navigation-three-buttons.png' });
  for (const name of ['Fitness', 'Social', 'Nutrição', 'Saúde', 'Início']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
  }
});
