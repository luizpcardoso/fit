import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const apiURL = process.env.FIT_E2E_API_URL ?? 'http://127.0.0.1:33317';
test('eventuais, imagens e gaveta integram com a API sem alterar 7/10 da rotina', async ({ page, request }) => {
  test.setTimeout(240000);
  test.skip(process.env.FIT_HEALTH_E2E !== '1', 'Requer API e banco locais isolados.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiURL).hostname)) throw new Error('Use API local isolada.');
  const registration = await request.post(`${apiURL}/auth/register`, { data: { email: `health-${randomUUID()}@example.com`, password: 'test-password-123', phone: '71999990000', firstName: 'Teste', lastName: 'Saúde' } });
  expect(registration.status()).toBe(201); const account = await registration.json();
  const headers = { authorization: `Bearer ${account.accessToken}` };
  expect((await request.patch(`${apiURL}/auth/me`, { headers, data: { countMentalCheckIn: false } })).ok()).toBeTruthy();
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
  const post = async (path: string, data: unknown) => { const response = await request.post(apiURL + path, { headers, data }); expect(response.ok(), await response.text()).toBeTruthy(); return response.status() === 204 ? null : response.json(); };
  for (const [index, frequency] of [6, 4].entries()) {
    const item = await post('/medications', { name: `Rotina ${index}`, dailyFrequency: frequency, times: [], illustration: index ? 'capsule' : 'tablet' });
    for (let slot = 0; slot < (index ? 1 : 6); slot++) await post(`/medications/${item.id}/intakes`, { date, slot });
  }
  const settle = () => page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(/^http:\/\/[^/]+:3333\//, route => { const url = new URL(route.request().url()); return route.continue({ url: apiURL + url.pathname + url.search }); });
  await page.addInitScript(account => { localStorage.setItem('fit.auth.tokens', JSON.stringify(account)); if (!localStorage.getItem('fit.appearance.theme')) localStorage.setItem('fit.appearance.theme', 'dark'); }, account);
  await page.goto('/health-routine?kind=medication');
  await page.getByRole('button', { name: 'Cadastrar medicamento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome do medicamento', exact: true }).fill('Dor eventual');
  await page.getByRole('radio', { name: 'Eventual', exact: true }).click();
  await expect(page.getByText('Quantas tomadas por dia?')).toHaveCount(0);
  const gallery = page.getByRole('radiogroup', { name: 'Imagem do medicamento ou suplemento', exact: true });
  const geometry = await gallery.getByRole('radio').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height, top: r.top }; }));
  expect(geometry).toHaveLength(7);
  for (const option of geometry) { expect(option.width).toBe(geometry[0].width); expect(option.height).toBe(geometry[0].height); expect(option.top).toBe(geometry[0].top); }
  await page.getByRole('radio', { name: 'Gotas', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Gotas', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: 'artifacts/ux-review/health-gallery-dark.png' });
  await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
  await expect(page.getByText('Eventual · registrar quando usar')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar tomada de Dor eventual', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Eventuais', exact: true })).toHaveAttribute('aria-checked', 'true');
  const time = page.getByRole('textbox', { name: 'Horário da tomada eventual', exact: true });
  await time.fill('10:30');
  const register = page.getByRole('button', { name: 'Registrar tomada eventual de Dor eventual', exact: true });
  // A lost response after the real write must retry with the same operation identifier.
  await page.route('**/medications/*/occasional-intakes', async route => { const url = new URL(route.request().url()); await route.fetch({ url: apiURL + url.pathname + url.search }); await route.abort(); }, { times: 1 });
  await register.click();
  await expect(page.getByText('Tentar novamente a mesma tomada')).toBeVisible();
  await register.click();
  await expect(page.getByText('10:30 · tomada registrada')).toHaveCount(1);
  await expect(page.getByText('Tentar novamente a mesma tomada')).toHaveCount(0);
  await time.fill('14:45'); await register.click();
  await expect(page.getByText('14:45 · tomada registrada')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer tomada de Dor eventual às 10:30', exact: true }).click();
  await expect(page.getByText('10:30 · tomada registrada')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar registro diário', exact: true }).click();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Ver rotina de hoje, 7 de 10 feitas', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('1 tomada eventual', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver rotina de hoje, 7 de 10 feitas', exact: true }).click();
  await expect(page.locator('img[src*="health-tablet"]')).not.toHaveCount(0);
  await settle();
  await page.screenshot({ path: 'artifacts/ux-review/health-routine-dark.png' });
  await page.getByRole('button', { name: 'Fechar rotina de hoje', exact: true }).click();
  for (const [theme, width] of [['dark', 320], ['light', 390]] as const) {
    await page.evaluate(theme => localStorage.setItem('fit.appearance.theme', theme), theme);
    await page.setViewportSize({ width, height: 844 }); await page.reload();
    await page.getByRole('button', { name: 'Ações rápidas: treino, refeição, cardio e mais', exact: true }).click();
    const title = page.getByText('Ações rápidas', { exact: true }); await expect(title).toBeVisible();
    await settle();
    await title.evaluate(element => { (element as HTMLElement).style.fontSize = '26px'; });
    await page.getByText('Escolha o que deseja fazer ou acompanhar', { exact: true }).evaluate(element => { (element as HTMLElement).style.fontSize = '18px'; });
    const header = title.locator('../..'), close = header.getByRole('button', { name: 'Fechar', exact: true });
    const { h, b } = await header.evaluate(element => ({ h: element.getBoundingClientRect().toJSON(), b: element.querySelector('[role=button]')!.getBoundingClientRect().toJSON() }));
    expect(b!.width).toBeGreaterThanOrEqual(44); expect(b!.height).toBeGreaterThanOrEqual(44);
    expect(b!.x + b!.width).toBeLessThanOrEqual(width);
    expect(Math.abs((b!.y + b!.height / 2) - (h!.y + h!.height / 2))).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/ux-review/health-register-${theme}-${width}.png` });
    await close.click();
  }
  // The existing retroactive flow also exposes separate occasional entries.
  await page.goto('/health-routine?kind=medication');
  await page.getByRole('button', { name: 'Registrar em data anterior', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Registrar tomada eventual de Dor eventual', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Horário da tomada eventual', exact: true }).fill('22:00');
  await page.getByRole('button', { name: 'Registrar tomada eventual de Dor eventual', exact: true }).click();
  await expect(page.getByText('22:00 · tomada registrada')).toBeVisible();
  expect(errors).toEqual([]);
});
