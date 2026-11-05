import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
const reviewDir = resolve(__dirname, '../../../artifacts/ux-review');
const capabilities = ['fitness.view', 'fitness.manage', 'nutrition.view', 'nutrition.suggest', 'groups.manage'];
const workout = { id: 'workout-1', kind: 'workout', name: 'Hipertrofia • iniciante', scope: 'private', revision: 1, archived: false, data: { validityDays: 30, divisions: [{ name: 'A • Corpo inteiro', exercises: [{ name: 'Agachamento', sets: 3, reps: '12', load: null, restSeconds: 60, notes: '' }] }] } };
const diet = { id: 'diet-1', kind: 'diet', name: 'Plano alimentar inicial', scope: 'private', revision: 1, archived: false, data: { objective: 'Organização alimentar', validityDays: 30, meals: [{ name: 'Café da manhã', time: '08:00', items: [{ food: { name: 'Banana', servingAmount: 100, servingUnit: 'g', calories: 90, protein: 1, carbs: 23, fat: 0, notes: '' }, quantity: 100, substitutions: '' }] }], notes: '' } };
async function setup(page: Page, role = 'professional') {
  const assignments: any[] = [];
  const requests: any[] = [];
  const links = Array.from({ length: 205 }, (_, i) => ({ id: `relation-${i}`, studentName: i === 204 ? 'Zélia Última' : `Aluno ${String(i).padStart(3, '0')}`, status: 'active', capabilities: i === 203 ? ['fitness.view'] : capabilities }));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('.js') || path.endsWith('.css') || path === '/portal' || path === '/portal/') return route.continue();
    if (url.origin !== 'http://127.0.0.1:3341') return route.abort();
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === '/auth/login') return reply({ accessToken: 'browser-test', refreshToken: 'refresh' });
    if (path === '/portal/profile') return reply({ role, capabilities });
    if (path === '/portal/professional-types') return reply([]);
    if (path === '/portal/relationships') { const offset = Number(url.searchParams.get('offset') || 0); return reply(links.slice(offset, offset + 200)); }
    if (path === '/portal/content') return reply(Number(url.searchParams.get('offset')) ? [] : url.searchParams.get('kind') === 'workout' ? [workout] : url.searchParams.get('kind') === 'diet' ? [diet] : []);
    if (path === '/portal/assignments') { const data = route.request().postDataJSON(); requests.push(data); assignments.push({ id: 'assignment-1', kind: data.contentId === 'diet-1' ? 'diet' : 'workout', status: data.mode === 'suggest' ? 'pending' : 'active', snapshot: data.contentId === 'diet-1' ? diet : workout, createdAt: '2026-11-02', sourceRevision: 1 }); return reply({ id: 'assignment-1', status: 'active' }); }
    if (path.endsWith('/assignments')) return reply(assignments);
    if (path.endsWith('/progress')) return reply({ goal: { weeklyTarget: 3 }, sessions: [], plans: [] });
    if (path === '/portal/groups') return reply([{ id: 'group-1', name: 'Turma da manhã', description: 'Treino e evolução em equipe.', active: true, members: 2 }]);
    if (path.endsWith('/members')) return reply([{ id: 'owner', displayName: 'Profissional', username: 'personal', role: 'owner' }, { id: 'member', displayName: 'Mariana Silva', username: 'mariana', role: 'member' }]);
    if (path.endsWith('/invites')) { requests.push(route.request().postDataJSON()); return reply({ ok: true }); }
    return reply({ ok: true });
  });
  await page.goto('/portal');
  await page.getByLabel('E-mail', { exact: true }).fill('personal@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: /Entrar no portal/ }).click();
  if (role === 'admin') await page.getByRole('navigation').getByRole('button', { name: 'Tipos profissionais', exact: true }).click();
  await expect(page.getByRole('heading', { name: role === 'admin' ? 'Novo tipo profissional' : 'Meus alunos', exact: true, level: 2 })).toBeVisible();
  return { requests };
}
test('diretório completo, painel, prescrição e biblioteca profissional', async ({ page }) => {
  const { requests } = await setup(page);
  await expect(page.locator('#student-count')).toContainText('205');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Exercícios', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Alimentos', exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar alunos').fill('zelia');
  await expect(page.getByRole('heading', { name: 'Zélia Última', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir painel →' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral do acompanhamento' })).toBeVisible();
  await page.screenshot({ path: `${reviewDir}/portal-student-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Atribuir ficha', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Modelo', exact: true })).toHaveValue('workout-1');
  await page.getByRole('button', { name: 'Enviar plano', exact: true }).click();
  await expect(page.locator('.plan-line')).toContainText(workout.name);
  expect(requests[0]).toMatchObject({ contentId: 'workout-1', relationshipId: 'relation-204', mode: 'manage' });
  await page.getByRole('button', { name: 'Planos e histórico', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustar plano', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral do acompanhamento' })).toBeVisible();
  await page.getByRole('button', { name: 'Minhas fichas', exact: true }).click();
  await expect(page.locator('#library-scope').locator('..')).toBeHidden();
  await page.getByRole('button', { name: 'Atribuir a aluno', exact: true }).click();
  await page.getByLabel('Buscar aluno', { exact: true }).fill('Zélia');
  await page.getByRole('button', { name: 'Selecionar →' }).click();
  await expect(page.getByRole('combobox', { name: 'Modelo', exact: true })).toHaveValue('workout-1');
  await page.screenshot({ path: `${reviewDir}/portal-assignment-desktop.png`, fullPage: true });
});
test('grupos separam membros, convites e configurações', async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Grupos', exact: true }).click();
  await page.getByRole('button', { name: 'Gerenciar grupo →' }).click();
  await expect(page.getByRole('heading', { name: 'Mariana Silva' })).toBeVisible();
  await expect(page.getByText('Proprietário', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Convidar', exact: true }).click();
  await page.getByLabel('Nome de usuário', { exact: true }).fill('@novousuario');
  await page.getByRole('button', { name: 'Enviar convite', exact: true }).click();
  expect(requests.at(-1)).toEqual({ username: 'novousuario' });
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Turma da manhã');
  await page.screenshot({ path: `${reviewDir}/portal-group-desktop.png`, fullPage: true });
});
test('catálogos globais continuam na navegação administrativa', async ({ page }) => {
  await setup(page, 'admin');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Exercícios', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Alimentos', exact: true })).toBeVisible();
});
test('painel e lista funcionam em 390px sem overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(page.getByRole('heading', { name: 'Meus alunos', exact: true, level: 2 })).toBeVisible();
  await page.screenshot({ path: `${reviewDir}/portal-students-mobile.png`, fullPage: true });
  await page.getByLabel('Buscar alunos').fill('zelia');
  await page.getByRole('button', { name: 'Abrir painel →' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral do acompanhamento' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${reviewDir}/portal-student-mobile.png`, fullPage: true });
});

test('dieta respeita sugestão, progresso abre automaticamente e acesso somente leitura não prescreve', async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByLabel('Buscar alunos').fill('zelia');
  await page.getByRole('button', { name: 'Abrir painel →' }).click();
  await page.getByRole('button', { name: 'Treinos e metas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meta semanal: 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Atribuir dieta', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Operação', exact: true })).toHaveValue('suggest');
  await page.getByRole('button', { name: 'Enviar plano', exact: true }).click();
  await expect(page.locator('.plan-line')).toContainText('Aguardando aceite');
  expect(requests[0]).toMatchObject({ contentId: 'diet-1', mode: 'suggest' });
  await page.getByRole('button', { name: '← Meus alunos', exact: true }).click();
  await page.getByLabel('Buscar alunos').fill('Aluno 203');
  await page.getByRole('button', { name: 'Abrir painel →' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral do acompanhamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atribuir ficha', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar novo', exact: true })).toHaveCount(0);
});
test('falha na lista permite tentar novamente e estados vazios orientam o usuário', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#student-count')).toContainText('205');
  await page.route('**/portal/relationships?*', route => route.fulfill({ status: 503, json: { message: 'Serviço indisponível.' } }), { times: 1 });
  await page.getByRole('navigation').getByRole('button', { name: 'Meus alunos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar seus alunos' })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('#student-count')).toContainText('205');
  await page.locator('#student-filter').selectOption('pending');
  await expect(page.getByRole('heading', { name: 'Nenhum convite pendente' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Minhas metas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum resultado encontrado' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Criar meta', exact: true })).toBeVisible();
});
