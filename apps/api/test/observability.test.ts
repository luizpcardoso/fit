import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { analyticsBatchSchema, analyticsQuerySchema, type AnalyticsBatch } from '@fit/contracts';
import { buildApp } from '../src/app.js';
import { analyticsDay, dayStart, p95Bound, routeAction, routeFeature, shiftDay, type ObservabilityStore } from '../src/observability-model.js';
import { ObservabilityCollector } from '../src/observability-routes.js';
import { UsageTracker, analyticsScreenForPath, validAnalyticsVersion } from '../../mobile/src/utils/usage-tracker.js';
import { observabilityRetention, observabilityEnabled } from '../src/observability-config.js';
import { createApiClient } from '../../../packages/api-client/src/index.js';

const event = () => ({ id: randomUUID(), sessionId: randomUUID(), type: 'screen_view' as const, screen: 'workouts' as const, occurredAt: new Date().toISOString(), platform: 'android' as const, appVersion: '1.0.0' });
const store = (overrides: Partial<ObservabilityStore> = {}): ObservabilityStore => ({ canViewDashboard: async () => false, ingest: async () => {}, write: async () => {}, dashboard: async () => { throw new Error('unused'); }, maintain: async () => {}, ...overrides });

test('telemetria aceita somente taxonomia fechada e rejeita identidades, URLs, saúde e lotes excessivos', () => {
  assert.equal(analyticsBatchSchema.safeParse({ events: [event()] }).success, true);
  for (const extra of [{ userId: randomUUID() }, { properties: { weight: 80 } }, { url: '/group-detail?id=private' }, { stack: 'sensitive' }]) assert.equal(analyticsBatchSchema.safeParse({ events: [{ ...event(), ...extra }] }).success, false);
  assert.equal(analyticsBatchSchema.safeParse({ events: [{ ...event(), screen: '/group-detail?id=private' }] }).success, false);
  assert.equal(analyticsBatchSchema.safeParse({ events: [{ ...event(), type: 'workout_completed' }] }).success, false);
  assert.equal(analyticsBatchSchema.safeParse({ events: Array.from({ length: 21 }, event) }).success, false);
  assert.equal(analyticsBatchSchema.safeParse({ events: [{ ...event(), appVersion: 'user@example.com' }] }).success, false);
  for (const days of [0, -1, 100000, 'abc']) assert.equal(analyticsQuerySchema.safeParse({ days }).success, false);
  assert.equal(analyticsQuerySchema.parse({}).days, 30);
});
test('datas do painel usam Bahia, e métricas não contam polling como ação de produto', () => {
  assert.equal(analyticsDay(Date.parse('2026-11-02T02:59:59Z')), '2026-11-01');
  assert.equal(dayStart('2026-11-02').toISOString(), '2026-11-02T03:00:00.000Z');
  assert.equal(shiftDay('2026-11-01', -1), '2026-10-31');
  assert.equal(routeFeature('/me/analytics/events'), null);
  assert.equal(routeFeature('/portal/analytics'), null);
  assert.equal(routeAction('GET', '/groups/notifications'), null);
  assert.equal(routeAction('POST', '/groups/:groupId/seen'), null);
  assert.equal(routeAction('POST', '/workout-sessions'), 'workout_completed');
  assert.equal(p95Bound([95, 0, 0, 0, 0, 5]), 100);
  assert.equal(p95Bound([0, 0, 0, 0, 0, 1]), null);
});
test('coletor só registra ações bem-sucedidas, tem buckets corretos e não interrompe operações em falhas', async () => {
  const written: any[] = []; let warnings = 0;
  const collector = new ObservabilityCollector(store({ write: async (actions, requests) => { written.push({ actions, requests }); } }), () => warnings++);
  const actor = randomUUID();
  collector.record('POST', '/workout-sessions', 201, 50, actor);
  collector.record('POST', '/workout-sessions', 403, 350, actor);
  collector.record('GET', '/workout-plans', 500, 1200, actor);
  collector.record('GET', '/portal/analytics', 200, 5, actor);
  await collector.flush();
  assert.equal(written[0].actions.length, 1);
  assert.equal(written[0].actions[0].userId, actor);
  assert.equal(written[0].requests.length, 2);
  assert.deepEqual(written[0].requests[0].buckets, [1, 0, 1, 0, 0, 0]);
  assert.equal(written[0].requests[0].clientErrors, 1);
  const failed = new ObservabilityCollector(store({ write: async () => { throw new Error('database unavailable'); } }), () => warnings++);
  failed.record('POST', '/workout-sessions', 201, 1, actor);
  await failed.flush(); assert.equal(warnings, 1);
});
test('endpoint deriva ator do token, bloqueia anônimos e profissionais, valida consultas e mantém dados privados', async () => {
  const calls: any[] = []; const admin = randomUUID();
  const app = await buildApp({ jwtSecret: 'observability-tests-secret-32-characters', observabilityRetention: { rawDays: 90, aggregateMonths: 24 }, observabilityStore: store({
    canViewDashboard: async id => id === admin,
    ingest: async (actor, batch) => { calls.push({ actor, batch }); },
    dashboard: async days => ({ days } as any),
  }) });
  try {
    const user = randomUUID(), headers = { authorization: `Bearer ${app.jwt.sign({ sub: user })}` };
    const payload = { events: [event()] };
    assert.equal((await app.inject({ method: 'POST', url: '/me/analytics/events', payload })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/me/analytics/events', headers, payload })).statusCode, 202);
    assert.equal(calls[0].actor, user);
    assert.equal((await app.inject({ method: 'POST', url: '/me/analytics/events', headers, payload: { ...payload, userId: admin } })).statusCode, 400);
    assert.equal((await app.inject('/portal/analytics')).statusCode, 401);
    assert.equal((await app.inject({ url: '/portal/analytics', headers })).statusCode, 403);
    const adminHeaders = { authorization: `Bearer ${app.jwt.sign({ sub: admin })}` };
    const response = await app.inject({ url: '/portal/analytics?days=7', headers: adminHeaders });
    assert.equal(response.statusCode, 200); assert.equal(response.json().days, 7); assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal((await app.inject({ url: '/portal/analytics?days=730', headers: adminHeaders })).statusCode, 400);
    assert.equal((await app.inject({ url: '/portal/analytics?userId=other', headers: adminHeaders })).statusCode, 400);
  } finally { await app.close(); }
});
test('tracker conta navegação real, pausa no background, renova sessão e conserva IDs ao reenviar', async () => {
  let now = Date.parse('2026-11-02T12:00:00Z'), fail = true; const sent: AnalyticsBatch[] = [];
  const tracker = new UsageTracker({ now: () => now, uuid: randomUUID, platform: 'android', version: '1.0.0', send: async batch => { sent.push(batch); if (fail) throw new Error('offline'); } });
  tracker.setScreen('home'); tracker.setForeground(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent[0].events.filter(e => e.type === 'session_start').length, 1);
  tracker.setScreen('home'); tracker.setScreen('workouts');
  fail = false; await tracker.flush();
  assert.equal(sent[1].events[0].id, sent[0].events[0].id);
  assert.equal(sent[1].events.filter(e => e.type === 'screen_view').length, 2);
  tracker.setForeground(false); now += 31 * 60_000; tracker.tick();
  assert.equal(sent.length, 2);
  tracker.setForeground(true); await new Promise(resolve => setImmediate(resolve));
  assert.notEqual(sent[2].events[0].sessionId, sent[0].events[0].sessionId);
  tracker.dispose(); tracker.tick(); await tracker.flush(); assert.equal(sent.length, 3);
  assert.equal(analyticsScreenForPath('/group-detail?id=private'), 'group_detail');
  assert.equal(analyticsScreenForPath('/unknown/private-id'), null);
  assert.equal(analyticsScreenForPath('/login'), null);
  assert.equal(validAnalyticsVersion('person@example.com'), '0.0.0');
});
test('envio de métricas não invalida cache do app, não publica mutações nem renova/encerra sessão', async () => {
  const original = globalThis.fetch; const paths: string[] = []; let saves = 0, changes = 0;
  globalThis.fetch = async (url) => { const path = new URL(String(url)).pathname; paths.push(path); return path === '/me/analytics/events' ? Response.json({ message: 'expired', code: 'UNAUTHORIZED' }, { status: 401 }) : Response.json([]); };
  try {
    const client = createApiClient({ baseUrl: 'http://test', getTokens: async () => ({ accessToken: 'old', refreshToken: 'refresh' }), saveTokens: async () => { saves++; } });
    client.subscribeToChanges(() => changes++);
    await client.listGroups(); await assert.rejects(() => client.recordAnalytics({ events: [event()] })); await client.listGroups();
    assert.deepEqual(paths, ['/groups', '/me/analytics/events']); assert.equal(saves, 0); assert.equal(changes, 0);
  } finally { globalThis.fetch = original; }
});

test('retenção padrão segue a escolha de 30 dias e 12 meses, sem aceitar configurações parciais', () => {
  assert.deepEqual(observabilityRetention({}), { rawDays: 30, aggregateMonths: 12 });
  assert.equal(observabilityEnabled({ ANALYTICS_ENABLED: 'false' }), false);
  assert.equal(observabilityEnabled({}), true);
  assert.throws(() => observabilityRetention({ ANALYTICS_RAW_RETENTION_DAYS: '10' }));
  assert.throws(() => observabilityRetention({ ANALYTICS_RAW_RETENTION_DAYS: '90' }));
  assert.deepEqual(observabilityRetention({ ANALYTICS_RAW_RETENTION_DAYS: '30', ANALYTICS_AGGREGATE_RETENTION_MONTHS: '12' }), { rawDays: 30, aggregateMonths: 12 });
});

test('logout cancela a fila e batches inválidos não são reenviados indefinidamente', async () => {
  let signal: AbortSignal | undefined;
  const tracker = new UsageTracker({ uuid: randomUUID, platform: 'web', version: '1.0.0', send: async (_batch, abort) => { signal = abort; await new Promise<void>(resolve => abort.addEventListener('abort', () => resolve(), { once: true })); } });
  tracker.setForeground(true); tracker.dispose();
  assert.equal(signal?.aborted, true);
  let attempts = 0;
  const invalid = new UsageTracker({ uuid: randomUUID, platform: 'web', version: '1.0.0', send: async () => { attempts++; throw { status: 400 }; } });
  invalid.setForeground(true); await new Promise(resolve => setImmediate(resolve)); await invalid.flush();
  assert.equal(attempts, 1); invalid.dispose();
});
test('desligar coleta bloqueia ingestão mas preserva o agendamento de retenção', async () => {
  let maintained = 0, ingested = 0;
  const app = await buildApp({ jwtSecret: 'disabled-analytics-test-secret-32-characters', observabilityEnabled: false,
    observabilityStore: store({ maintain: async policy => { assert.deepEqual(policy, { rawDays: 30, aggregateMonths: 12 }); maintained++; }, ingest: async () => { ingested++; } }) });
  try {
    const headers = { authorization: `Bearer ${app.jwt.sign({ sub: randomUUID() })}` };
    const response = await app.inject({ method: 'POST', url: '/me/analytics/events', headers, payload: { events: [event()] } });
    assert.equal(response.statusCode, 503); assert.equal(ingested, 0); assert.equal(maintained, 1);
  } finally { await app.close(); }
});

test('limite de ingestão é por conta para não misturar usuários atrás da mesma rede', async () => {
  const app = await buildApp({ jwtSecret: 'analytics-rate-limit-test-secret-32-characters', observabilityStore: store() });
  try {
    const headers = { authorization: `Bearer ${app.jwt.sign({ sub: randomUUID() })}` };
    for (let attempt = 0; attempt < 30; attempt++) assert.equal((await app.inject({ method: 'POST', url: '/me/analytics/events', headers, payload: { events: [event()] } })).statusCode, 202);
    assert.equal((await app.inject({ method: 'POST', url: '/me/analytics/events', headers, payload: { events: [event()] } })).statusCode, 429);
    const other = { authorization: `Bearer ${app.jwt.sign({ sub: randomUUID() })}` };
    assert.equal((await app.inject({ method: 'POST', url: '/me/analytics/events', headers: other, payload: { events: [event()] } })).statusCode, 202);
  } finally { await app.close(); }
});
