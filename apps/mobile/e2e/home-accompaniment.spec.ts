import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33329';

test('acompanhamento: toque, teclado, rolagem, refeição real e balanço opcional', async ({ page, request }) => {
  test.skip(process.env.FIT_NAVIGATION_E2E !== '1', 'Requer API local com banco isolado.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local de testes.');
  const response = await request.post(`${apiURL}/auth/register`, { data: { email: `overview-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'Resumo' } });
  expect(response.status()).toBe(201);
  const account = await response.json();
  const headers = { authorization: `Bearer ${account.accessToken}` };
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(/http:\/\/[^/]+:(?:3333|33329)\//, route => { const url = new URL(route.request().url()); return route.continue({ url: apiURL + url.pathname + url.search }); });
  await page.addInitScript(account => { if (!localStorage.getItem('fit.auth.tokens')) localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); }, account);
  await page.goto('/');
  await expect(page.getByTestId('home-accompaniment')).toBeVisible({ timeout: 60000 });
  const themes = page.getByRole('tablist', { name: 'Temas do acompanhamento' });
  await expect(themes.getByRole('tab', { name: 'Treino', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Ver rotina de hoje, 0 de 1 feitas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar refeição', exact: true })).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('fit.appearance.theme', theme), theme); await page.reload();
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 844 });
      let panelHeight: number | undefined;
      let followingPosition: number | undefined;
      for (const name of ['Treino', 'Alimentação', 'Balanço']) {
        await themes.getByRole('tab', { name, exact: true }).click();
        await expect(themes.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
        await expect.poll(async () => Math.abs((await page.getByRole('tabpanel').boundingBox())!.x - (await page.getByTestId('home-topic-scroll').boundingBox())!.x)).toBeLessThan(2);
        await expect(page.getByRole('progressbar', { name: /Carregando|Atualizando/ })).toHaveCount(0);
        await expect.poll(async () => (await page.getByRole('tabpanel').boundingBox())!.height - (await page.getByTestId('home-topic-scroll').boundingBox())!.height).toBeLessThanOrEqual(1);
        const currentHeight = (await page.getByTestId('home-topic-scroll').boundingBox())!.height;
        const currentFollowing = await page.getByTestId('home-community').evaluate(element => element.getBoundingClientRect().top + window.scrollY);
        if (panelHeight != null) expect(currentHeight).toBeCloseTo(panelHeight, 0);
        if (followingPosition != null) expect(currentFollowing).toBeCloseTo(followingPosition, 0);
        panelHeight = currentHeight;
        followingPosition = currentFollowing;
        for (const card of ['home-workout-card', 'home-food-card', 'home-energy-card']) {
          expect((await page.getByTestId(card).boundingBox())!.height).toBeCloseTo(currentHeight, 0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `artifacts/ux-review/accompaniment-${theme}-${width}-${name === 'Treino' ? 'workout' : name === 'Alimentação' ? 'food' : 'balance'}.png` });
      }
    }
  }
  // Approximate enlarged native text without scaling the carousel geometry itself.
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByTestId('home-accompaniment').evaluate(element => {
    const texts = [...element.querySelectorAll<HTMLElement>('[dir="auto"]')].map(text => ({ text, size: parseFloat(getComputedStyle(text).fontSize), line: parseFloat(getComputedStyle(text).lineHeight) }));
    for (const { text, size, line } of texts) {
      text.style.fontSize = `${size * 1.5}px`;
      if (Number.isFinite(line)) text.style.lineHeight = `${line * 1.5}px`;
    }
  });
  let enlargedHeight: number | undefined;
  for (const name of ['Treino', 'Alimentação', 'Balanço']) {
    await themes.getByRole('tab', { name, exact: true }).click();
    await expect.poll(async () => Math.abs((await page.getByRole('tabpanel').boundingBox())!.x - (await page.getByTestId('home-topic-scroll').boundingBox())!.x)).toBeLessThan(2);
    const height = (await page.getByTestId('home-topic-scroll').boundingBox())!.height;
    if (enlargedHeight != null) expect(height).toBeCloseTo(enlargedHeight, 0);
    enlargedHeight = height;
    for (const tab of await themes.getByRole('tab').all()) {
      expect(await tab.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll<HTMLElement>('[dir="auto"]')].every(text => {
          const label = text.getBoundingClientRect();
          return label.left >= bounds.left && label.right <= bounds.right && text.scrollWidth <= text.clientWidth + 1;
        });
      })).toBe(true);
    }
    expect(await page.getByRole('tabpanel').evaluate(element => [...element.querySelectorAll<HTMLElement>('[dir="auto"]')].every(text => text.scrollHeight <= text.clientHeight + 1))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/ux-review/accompaniment-large-text-${name}.png` });
  }
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await themes.getByRole('tab', { name: 'Treino', exact: true }).click();
  await themes.getByRole('tab', { name: 'Treino', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(themes.getByRole('tab', { name: 'Alimentação', exact: true })).toBeFocused();
  await expect(themes.getByRole('tab', { name: 'Alimentação', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(themes.getByRole('tab', { name: 'Balanço', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(themes.getByRole('tab', { name: 'Treino', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.getByTestId('home-topic-scroll').evaluate(element => element.scrollLeft)).toBeLessThan(2);
  // Hidden cards stay mounted for stable sizing, but never participate in keyboard navigation.
  await expect(page.locator('#home-panel-food')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Definir meta semanal', exact: true }).first()).toBeFocused();
  // Browser-native horizontal scrolling exercises the same scroll events as touch and trackpads.
  await page.getByTestId('home-topic-scroll').evaluate(element => { element.scrollLeft = element.clientWidth - 16; });
  await expect(themes.getByRole('tab', { name: 'Alimentação', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Ainda sem registros hoje. Adicione sua primeira refeição para acompanhar o dia.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar refeição', exact: true }).click();
  await page.getByLabel('Nome da refeição', { exact: true }).fill('Almoço da home');
  await page.getByLabel('Calorias (kcal)', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByTestId('home-food-card').getByText('Almoço da home', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sincronizar refeições agora', exact: true }).click();
  await expect(page.getByTestId('meal-sync-status')).toHaveCount(0);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const summary = await request.get(`${apiURL}/nutrition/summary?date=${date}`, { headers });
  expect((await summary.json()).consumed.calories).toBe(500);
  // Save through the app so its local meal cache receives the expenditure invalidation.
  await page.getByRole('tab', { name: 'Nutrição', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustar gasto', exact: true }).click();
  await page.getByLabel('Gasto total (kcal)', { exact: true }).fill('2000');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Valor informado', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Início', exact: true }).click();
  expect((await request.put(`${apiURL}/workout-goal`, { headers, data: { weeklyTarget: 3, mode: 'flexible', schedule: [] } })).status()).toBe(204);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  let populatedHeight: number | undefined;
  for (const name of ['Treino', 'Alimentação', 'Balanço']) {
    await themes.getByRole('tab', { name, exact: true }).click();
    await expect.poll(async () => Math.abs((await page.getByRole('tabpanel').boundingBox())!.x - (await page.getByTestId('home-topic-scroll').boundingBox())!.x)).toBeLessThan(2);
    const height = (await page.getByTestId('home-topic-scroll').boundingBox())!.height;
    if (populatedHeight != null) expect(height).toBeCloseTo(populatedHeight, 0);
    populatedHeight = height;
  }
  await themes.getByRole('tab', { name: 'Balanço', exact: true }).click();
  await expect(page.getByTestId('home-energy-card').getByText('500 kcal', { exact: true })).toBeVisible();
  await expect(page.getByTestId('home-energy-card').getByText('Balanço parcial', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Como calculamos o balanço calórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sobre o balanço calórico', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar informações', exact: true }).click();
  await page.getByRole('button', { name: 'Ver detalhes do balanço', exact: true }).click();
  await expect(page).toHaveURL(/\/nutrition$/);
  await page.getByRole('tab', { name: 'Início', exact: true }).click();
  await expect(themes.getByRole('tab', { name: 'Balanço', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Ocultar balanço calórico do Início', exact: true }).click();
  await expect(themes.getByRole('tab')).toHaveCount(2);
  await expect(themes.getByRole('tab', { name: 'Treino', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(themes.getByRole('tab')).toHaveCount(2);
  await themes.getByRole('tab', { name: 'Alimentação', exact: true }).click();
  await expect(page.getByTestId('home-food-card').getByText('Almoço da home', { exact: true })).toBeVisible();
  await expect(page.getByTestId('home-food-card').getByText('kcal consumidas', { exact: true })).toBeVisible();
  // The last panel also takes the peek space, so its edge lines up with the selectors.
  const selectors = (await themes.boundingBox())!, lastPanel = (await page.getByTestId('home-food-card').boundingBox())!;
  expect(Math.abs(selectors.x + selectors.width - lastPanel.x - lastPanel.width)).toBeLessThan(2);
  // Wide windows: panels side by side without selectors; sheets keep a phone-sized column.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('home-topic-grid')).toBeVisible();
  await expect(themes).toHaveCount(0);
  const leftPanel = (await page.getByTestId('home-workout-card').boundingBox())!, rightPanel = (await page.getByTestId('home-food-card').boundingBox())!;
  expect(rightPanel.x).toBeGreaterThan(leftPanel.x + leftPanel.width);
  expect(rightPanel.height).toBeCloseTo(leftPanel.height, 0);
  await page.getByRole('button', { name: /^Ver rotina de hoje/ }).click();
  await expect(page.getByTestId('home-routine-sheet')).toBeVisible();
  expect((await page.getByTestId('home-routine-sheet').boundingBox())!.width).toBeLessThanOrEqual(560);
  await page.getByRole('button', { name: 'Fechar rotina de hoje', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
