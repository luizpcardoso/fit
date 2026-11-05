import type { AnalyticsDashboard } from '@fit/contracts';
import { api } from './main.js';
import { button, content, node } from './management.js';

const featureLabels: Record<string, string> = { home: 'Início', fitness: 'Treinos e cardio', nutrition: 'Alimentação', health: 'Rotina de saúde', body: 'Medidas corporais', mental: 'Bem-estar', groups: 'Grupos', professionals: 'Acompanhamento profissional', account: 'Conta e preferências' };
const platforms: Record<string, string> = { android: 'Android', ios: 'iOS', web: 'Web', other: 'Outras plataformas' };
const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const percent = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' });
function section(parent: Element, title: string, description: string) {
  const card = node('section', '', parent); card.className = 'card analytics-section';
  node('h3', title, card); node('p', description, card).className = 'muted'; return card;
}
function metric(parent: Element, label: string, value: string, description: string, comparison?: { value: number; previous: number }) {
  const card = node('article', '', parent); card.className = 'analytics-metric';
  node('small', label, card); node('strong', value, card); node('p', description, card).className = 'muted';
  if (comparison) {
    const change = comparison.previous ? (comparison.value - comparison.previous) / comparison.previous : null;
    node('span', change === null ? 'Sem base no período anterior' : `${change > 0 ? '+' : ''}${percent(change)} em relação ao período anterior`, card).className = 'metric-comparison';
  }
}
function table(parent: Element, headings: string[], rows: (string | number)[][], emptyText: string) {
  if (!rows.length) { node('p', emptyText, parent).className = 'analytics-empty'; return; }
  const wrap = node('div', '', parent); wrap.className = 'analytics-table-scroll';
  const table = node('table', '', wrap); table.className = 'analytics-table';
  const head = node('tr', '', node('thead', '', table));
  for (const heading of headings) node('th', heading, head).setAttribute('scope', 'col');
  const body = node('tbody', '', table);
  for (const values of rows) { const row = node('tr', '', body); for (const value of values) node('td', typeof value === 'number' ? number(value) : value, row); }
}
function chart(parent: Element, data: AnalyticsDashboard['daily'], lines: { key: 'activeUsers' | 'newAccounts' | 'sessions' | 'actions'; label: string; color: string }[]) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 700 240'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${lines.map(line => line.label).join(' e ')} por dia. Valores completos na tabela abaixo.`); svg.classList.add('analytics-chart');
  const add = (tag: string, attributes: Record<string, string>, text = '') => { const element = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value); element.textContent = text; svg.append(element); return element; };
  const max = Math.max(4, Math.ceil(Math.max(0, ...data.flatMap(day => lines.map(line => day[line.key]))) / 4) * 4);
  const x = (index: number) => 46 + index / Math.max(1, data.length - 1) * 630;
  const y = (value: number) => 200 - value / max * 170;
  for (let index = 0; index <= 4; index++) {
    const value = max * index / 4;
    add('line', { x1: '46', x2: '676', y1: String(y(value)), y2: String(y(value)), stroke: 'var(--line)' });
    add('text', { x: '38', y: String(y(value) + 4), 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': '11' }, number(Math.ceil(value)));
  }
  for (const line of lines) {
    add('polyline', { points: data.map((row, index) => `${x(index)},${y(row[line.key])}`).join(' '), fill: 'none', stroke: line.color, 'stroke-width': '2.5', 'stroke-linejoin': 'round' });
    data.forEach((row, index) => { const point = add('circle', { cx: String(x(index)), cy: String(y(row[line.key])), r: '3', fill: line.color }); const title = document.createElementNS(ns, 'title'); title.textContent = `${date(row.date)} · ${line.label}: ${number(row[line.key])}`; point.append(title); });
  }
  data.forEach((row, index) => { if (index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 6) === 0) add('text', { x: String(x(index)), y: '226', 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': '11' }, date(row.date).slice(0, 5)); });
  parent.append(svg);
  const legend = node('div', '', parent); legend.className = 'analytics-legend';
  for (const line of lines) { const label = node('span', '', legend); const dot = node('i', '', label); dot.style.background = line.color; node('span', line.label, label); }
}
export async function analytics() {
  content(`<section class="analytics-page"><div class="page-heading"><div><p class="section-kicker">Visão de produto</p><h2>Métricas do app</h2><p class="muted">Entenda a adoção, o uso e a qualidade da experiência.</p></div><div class="analytics-controls"><label>Período<select id="analytics-period"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label><button id="analytics-refresh" class="quiet" type="button">Atualizar</button></div></div><p id="analytics-updated" class="muted" role="status"></p><div id="analytics-content" aria-live="polite"></div></section>`);
  document.querySelector('header .muted')!.textContent = 'Indicadores agregados, exclusivos da administração.';
  const root = document.querySelector('.analytics-page')!, target = root.querySelector('#analytics-content')!;
  const period = root.querySelector<HTMLSelectElement>('#analytics-period')!, refresh = root.querySelector<HTMLButtonElement>('#analytics-refresh')!;
  let loading = false;
  const load = async () => {
    if (loading || !root.isConnected) return;
    loading = true; refresh.disabled = true; period.disabled = true; target.setAttribute('aria-busy', 'true');
    target.innerHTML = '<div class="analytics-loading" role="status">Carregando indicadores…</div>';
    try {
      const data: AnalyticsDashboard = await api(`/portal/analytics?days=${period.value}`);
      if (!root.isConnected) return;
      render(data);
      root.querySelector('#analytics-updated')!.textContent = `${date(data.periodFrom)} a ${date(data.periodTo)} · Atualizado às ${new Date(data.generatedAt).toLocaleTimeString('pt-BR', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' })} · Horário de Brasília`;
    } catch (error) {
      if (!root.isConnected) return;
      target.replaceChildren(); const card = section(target, 'Não foi possível carregar as métricas', (error as Error).message); button('Tentar novamente', card, load);
    } finally { loading = false; refresh.disabled = false; period.disabled = false; target.setAttribute('aria-busy', 'false'); }
  };
  const render = (data: AnalyticsDashboard) => {
    target.replaceChildren(); const s = data.summary;
    const longPeriod = [...period.options].find(option => option.value === '90');
    if (longPeriod) { longPeriod.disabled = (data.retention.rawDays ?? 90) < 90; longPeriod.hidden = longPeriod.disabled; }
    if (!data.collectionEnabled) {
      const banner = node('div', '', target); banner.className = 'analytics-info';
      node('strong', 'Coleta de uso ainda não habilitada', banner);
      node('p', 'A coleta de uso está desativada no serviço. Os cadastros e o histórico já existente permanecem disponíveis; a política de retenção continua sendo aplicada.', banner);
    }
    if (data.collectionEnabled && data.partialCoverage) {
      const banner = node('div', '', target); banner.className = 'analytics-info';
      node('strong', 'Histórico de uso em formação', banner);
      node('p', `A medição de uso está disponível desde ${date(data.coverageFrom)}. Indicadores e comparações que dependem de dados anteriores ainda são parciais. Cadastros vêm da base de contas e incluem o histórico existente.`, banner);
    }
    const grid = node('div', '', target); grid.className = 'analytics-metrics';
    metric(grid, 'Contas cadastradas', number(s.totalAccounts), 'Total de contas existentes na base.');
    metric(grid, 'Novas contas', number(s.newAccounts.value), 'Contas criadas no período selecionado.', s.newAccounts);
    metric(grid, 'Usuários ativos', number(s.activeUsers.value), 'Pessoas únicas com uso observado no período.', data.partialCoverage ? undefined : s.activeUsers);
    metric(grid, 'Em uso agora', number(s.onlineUsers), 'App em primeiro plano nos últimos 5 minutos.');
    metric(grid, 'Sessões iniciadas', number(s.sessions.value), 'Uma nova sessão após 30 minutos fora do app.', data.partialCoverage ? undefined : s.sessions);
    metric(grid, 'Ações com sucesso', number(s.actions.value), 'Operações de produto confirmadas pela API.', data.partialCoverage ? undefined : s.actions);
    const active = section(target, 'Frequência e retorno', 'Usuários únicos: uma pessoa que acessa várias vezes conta uma vez em cada janela.');
    const activeGrid = node('div', '', active); activeGrid.className = 'analytics-inline-metrics';
    metric(activeGrid, 'Ativos hoje · DAU', number(s.dau), 'Desde 00h, no horário de Brasília.');
    metric(activeGrid, 'Ativos em 7 dias · WAU', number(s.wau), 'Hoje e os 6 dias anteriores.');
    metric(activeGrid, 'Ativos em 30 dias · MAU', number(s.mau), 'Hoje e os 29 dias anteriores.');
    metric(activeGrid, 'Frequência · DAU/MAU', percent(s.stickiness), `${number(s.returningUsers)} pessoas usaram em 2 ou mais dias do período.`);
    const trend = section(target, 'Adoção ao longo dos dias', 'Compare usuários ativos e novas contas. Ausência de telemetria anterior à implantação não significa ausência de uso.');
    chart(trend, data.daily, [{ key: 'activeUsers', label: 'Usuários ativos', color: 'var(--primary-strong)' }, { key: 'newAccounts', label: 'Novas contas', color: 'var(--fit-success)' }]);
    const detail = node('details', '', trend); node('summary', 'Consultar dados diários', detail);
    table(detail, ['Data', 'Ativos', 'Novas contas', 'Sessões', 'Telas vistas', 'Ações'], data.daily.map(row => [date(row.date), row.activeUsers, row.newAccounts, row.sessions, row.screenViews, row.actions]), 'Nenhum dia disponível.');
    const usage = section(target, 'Funcionalidades mais usadas', 'Ordenadas por pessoas únicas. Telas vistas medem navegação; ações medem operações bem-sucedidas. Consultas automáticas não entram neste ranking.');
    table(usage, ['Funcionalidade', 'Pessoas únicas', 'Adoção entre ativos', 'Telas vistas', 'Ações com sucesso'], data.features.map(row => [featureLabels[row.feature] || row.feature, row.users, s.activeUsers.value ? percent(row.users / s.activeUsers.value) : '—', row.screenViews, row.actions]), 'Ainda não há uso registrado. O ranking aparecerá após o app atualizado começar a enviar eventos.');
    const history = section(target, `Histórico agregado · até ${data.retention.aggregateMonths ?? 12} meses`, 'Totais mensais preservados após a remoção dos eventos individuais. Pessoas únicas não são somadas entre dias ou meses.');
    table(history, ['Mês', 'Novas contas', 'Sessões', 'Telas vistas', 'Ações', 'Requisições', 'Erros 5xx'], data.history.map(row => [row.month.split('-').reverse().join('/'), row.newAccounts, row.sessions, row.screenViews, row.actions, row.requests, row.serverErrors]), 'O histórico será formado a partir do início da coleta.');
    const onboarding = section(target, 'Ativação e retenção de novas contas', 'Coortes com 7 dias completos de observação. Ativação é a primeira ação principal em até 7 dias, como concluir treino, registrar refeição ou publicar no grupo. Retenção D7 mede retorno no sétimo dia após o cadastro.');
    const o = data.onboarding, onboardingGrid = node('div', '', onboarding); onboardingGrid.className = 'analytics-inline-metrics';
    metric(onboardingGrid, 'Contas elegíveis', number(o.eligibleAccounts), 'Cadastros do período com janela completa.');
    metric(onboardingGrid, 'Ativação em 7 dias', o.eligibleAccounts ? percent(o.activatedWithin7Days / o.eligibleAccounts) : '—', `${number(o.activatedWithin7Days)} contas fizeram uma ação principal.`);
    metric(onboardingGrid, 'Retenção no dia 7', o.eligibleAccounts ? percent(o.returnedOnDay7 / o.eligibleAccounts) : '—', `${number(o.returnedOnDay7)} contas voltaram no sétimo dia.`);
    const deviceGrid = node('div', '', target); deviceGrid.className = 'analytics-two-columns';
    const platform = section(deviceGrid, 'Plataformas', 'Uma pessoa pode usar mais de uma plataforma.');
    table(platform, ['Plataforma', 'Pessoas', 'Sessões'], data.platforms.map(row => [platforms[row.platform], row.users, row.sessions]), 'Aguardando eventos do app.');
    const versions = section(deviceGrid, 'Versões em uso', 'Até 10 versões com mais usuários no período.');
    table(versions, ['Versão', 'Pessoas'], data.versions.map(row => [row.version, row.users]), 'Aguardando eventos de versão.');
    const q = data.quality, quality = section(target, 'Qualidade da API', 'Requisições das funcionalidades instrumentadas, incluindo consultas automáticas. Latência é medida no servidor; não representa o tempo total percebido no aparelho nem monitoramento de falhas nativas.');
    const qualityGrid = node('div', '', quality); qualityGrid.className = 'analytics-inline-metrics';
    metric(qualityGrid, 'Requisições', number(q.requests), 'Rotas de produto; painel e telemetria excluídos.');
    metric(qualityGrid, 'Erros do servidor · 5xx', q.requests ? percent(q.serverErrors / q.requests) : '—', `${number(q.serverErrors)} respostas 5xx.`);
    metric(qualityGrid, 'Latência média', q.averageMs === null ? '—' : `${number(Math.round(q.averageMs))} ms`, `${number(q.clientErrors)} respostas 4xx, incluindo validação e autenticação.`);
    metric(qualityGrid, 'Latência p95 estimada', !q.requests ? '—' : q.p95UpperBoundMs === null ? '> 10 s' : `≤ ${number(q.p95UpperBoundMs)} ms`, 'Limite superior do bucket com 95% das respostas.');
    const routeDetails = node('details', '', quality); node('summary', 'Rotas que merecem atenção', routeDetails);
    table(routeDetails, ['Rota', 'Requisições', '4xx', '5xx', 'Latência média'], q.routes.map(row => [`${row.method} ${row.route}`, row.requests, row.clientErrors, row.serverErrors, `${number(Math.round(row.averageMs))} ms`]), 'Nenhuma requisição instrumentada neste período.');
    node('p', `Coleta própria, sem SDK externo. Dados de uso são agregados neste painel; não são coletados nomes, e-mails, conteúdo dos planos, fotos ou valores de saúde. Eventos individuais: ${data.retention.rawDays ?? 'retenção ainda não configurada'}${data.retention.rawDays ? ' dias' : ''}; agregados: ${data.retention.aggregateMonths ?? 'retenção ainda não configurada'}${data.retention.aggregateMonths ? ' meses' : ''}. Atualização automática a cada minuto enquanto esta tela está visível.`, target).className = 'muted analytics-footnote';
  };
  refresh.onclick = () => { void load(); }; period.onchange = () => { void load(); };
  const timer = setInterval(() => { if (!root.isConnected) { clearInterval(timer); return; } if (document.visibilityState === 'visible') void load(); }, 60_000);
  await load();
}
