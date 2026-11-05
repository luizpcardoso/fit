import { test, expect, type Page } from '@playwright/test';
import type { AnalyticsDashboard } from '@fit/contracts';
import { resolve } from 'node:path';
const reviewDir = resolve(__dirname, '../../../artifacts/ux-review');
function dashboard(days = 30): AnalyticsDashboard {
  return {
    collectionEnabled: true, generatedAt: '2026-11-02T15:30:00Z', timezone: 'America/Bahia', days, collectionStartedAt: '2026-08-01T12:00:00Z', coverageFrom: '2026-08-01T12:00:00Z', periodFrom: new Date(Date.UTC(2026, 10, 2 - (days - 1))).toISOString().slice(0, 10), periodTo: '2026-11-02', partialCoverage: false, retention: { rawDays: 30, aggregateMonths: 12 },
    summary: { totalAccounts: 100, newAccounts: { value: 9, previous: 6 }, activeUsers: { value: 12, previous: 10 }, onlineUsers: 3, dau: 3, wau: 8, mau: 12, sessions: { value: 22, previous: 18 }, screenViews: { value: 50, previous: 40 }, actions: { value: 30, previous: 20 }, returningUsers: 7, stickiness: .25 },
    onboarding: { eligibleAccounts: 5, activatedWithin7Days: 3, returnedOnDay7: 2 },
    daily: Array.from({ length: days }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 2 - (days - 1) + i)).toISOString().slice(0, 10), activeUsers: 2 + i % 8, newAccounts: i % 3, sessions: 5 + i % 6, screenViews: 10 + i, actions: 3 + i % 5 })),
    history: [{ month: '2026-11', newAccounts: 9, sessions: 22, screenViews: 50, actions: 30, requests: 100, serverErrors: 2 }],
    features: [{ feature: 'fitness', users: 7, screenViews: 20, actions: 15 }, { feature: 'nutrition', users: 5, screenViews: 12, actions: 10 }],
    platforms: [{ platform: 'android', users: 10, sessions: 18 }, { platform: 'web', users: 2, sessions: 4 }], versions: [{ version: '1.0.0', users: 12 }],
    quality: { requests: 100, clientErrors: 4, serverErrors: 2, averageMs: 50, p95UpperBoundMs: 300, routes: [{ method: 'GET', route: '/workout-plans/:id', requests: 20, clientErrors: 1, serverErrors: 2, averageMs: 100 }] },
  };
}
async function setup(page: Page, options: { failFirst?: boolean; empty?: boolean } = {}) {
  const periods: string[] = []; let failures = options.failFirst ? 1 : 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (url.origin !== 'http://127.0.0.1:3341') return route.abort();
    if (path === '/portal' || path.endsWith('.js') || path.endsWith('.css')) return route.continue();
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === '/auth/login') return reply({ accessToken: 'test-admin', refreshToken: 'test-refresh' });
    if (path === '/portal/profile') return reply({ role: 'admin', capabilities: [] });
    if (path === '/portal/analytics') {
      periods.push(url.searchParams.get('days') || '30');
      if (failures > 0) { failures--; return route.fulfill({ status: 503, json: { message: 'Métricas temporariamente indisponíveis.' } }); }
      const data = dashboard(Number(periods.at(-1)));
      if (options.empty) { data.partialCoverage = true; data.collectionEnabled = false; data.features = []; data.versions = []; data.platforms = []; data.summary.activeUsers = { value: 0, previous: 0 }; data.summary.mau = 0; data.summary.stickiness = null; data.onboarding = { eligibleAccounts: 0, activatedWithin7Days: 0, returnedOnDay7: 0 }; }
      return reply(data);
    }
    if (path === '/portal/professional-types') return reply([]);
    return reply({ ok: true });
  });
  await page.goto('/portal'); await page.getByLabel('E-mail', { exact: true }).fill('admin@example.com'); await page.getByLabel('Senha', { exact: true }).fill('test-password'); await page.getByRole('button', { name: /Entrar no portal/ }).click();
  await expect(page.getByRole('heading', { name: 'Métricas do app', level: 2 })).toBeVisible();
  return periods;
}
test('admin abre métricas, consulta funcionalidades e troca período sem acessar dados de pessoas', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const periods = await setup(page);
  await expect(page.getByText('Contas cadastradas', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Funcionalidades mais usadas' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Treinos e cardio', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Período', exact: true }).selectOption('7');
  await expect.poll(() => periods.at(-1)).toBe('7');
  await expect(page.locator('#analytics-updated')).toContainText('Atualizado às');
  await page.getByText('Consultar dados diários', { exact: true }).click();
  await expect(page.getByRole('cell', { name: '02/11/2026', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${reviewDir}/analytics-admin-desktop.png`, fullPage: true });
  expect(errors).toEqual([]);
  await page.getByRole('navigation').getByRole('button', { name: 'Tipos profissionais', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Novo tipo profissional' })).toBeVisible();
});
test('falhas do painel podem ser recuperadas sem inventar métricas', async ({ page }) => {
  await setup(page, { failFirst: true });
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar as métricas' })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Funcionalidades mais usadas' })).toBeVisible();
});
test('painel em 390px mantém tabelas contidas e explica ausência de coleta/coortes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page, { empty: true });
  await expect(page.getByText('Coleta de uso ainda não habilitada', { exact: true })).toBeVisible();
  await expect(page.getByText('Ainda não há uso registrado.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ativação e retenção de novas contas' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${reviewDir}/analytics-admin-mobile.png`, fullPage: true });
});
