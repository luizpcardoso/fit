import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { analyticsBatchSchema, analyticsQuerySchema } from '@fit/contracts';
import { analyticsDay, routeAction, routeFeature, type ObservabilityStore, type RecordedAction, type RequestAggregate, type RetentionPolicy } from './observability-model.js';

export class ObservabilityCollector {
  private actions: RecordedAction[] = [];
  private requests = new Map<string, RequestAggregate>();
  private flushing: Promise<void> | null = null;
  constructor(private store: ObservabilityStore, private onError: () => void) {}
  record(method: string, route: string, status: number, elapsedMs: number, actor?: string, now = new Date()) {
    const feature = routeFeature(route);
    if (!feature || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
    const day = analyticsDay(now), key = `${day}:${method}:${route}`;
    let row = this.requests.get(key);
    if (!row) {
      if (this.requests.size >= 500) { this.onError(); return; }
      row = { day, method, route, requests: 0, clientErrors: 0, serverErrors: 0, totalMs: 0, buckets: [0, 0, 0, 0, 0, 0] };
      this.requests.set(key, row);
    }
    const ms = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(elapsedMs, 3_600_000)) : 0;
    row.requests++; row.clientErrors += Number(status >= 400 && status < 500); row.serverErrors += Number(status >= 500); row.totalMs += ms;
    const bucket = [100, 300, 1000, 3000, 10000].findIndex(bound => ms <= bound);
    row.buckets[bucket === -1 ? 5 : bucket]++;
    const action = routeAction(method, route);
    if (actor && action && status >= 200 && status < 300) {
      if (this.actions.length < 5000) this.actions.push({ id: randomUUID(), userId: actor, type: action, feature, occurredAt: now });
      else this.onError();
    }
  }
  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.actions.length && !this.requests.size) return;
    const actions = this.actions; this.actions = [];
    const requests = [...this.requests.values()]; this.requests.clear();
    this.flushing = this.store.write(actions, requests).catch(() => {
      // Bounded best-effort telemetry never makes a committed business action fail.
      // Action UUIDs remain stable across retries. Request aggregates are not retried after an ambiguous commit.
      this.actions = [...actions, ...this.actions].slice(0, 5000);
      this.onError();
    }).finally(() => { this.flushing = null; });
    return this.flushing;
  }
}
export async function registerObservability(
  app: FastifyInstance, store: ObservabilityStore,
  secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>, policy: RetentionPolicy = { rawDays: 30, aggregateMonths: 12 }, collectionEnabled = true,
) {
  let lastWarning = 0;
  const warn = () => { if (Date.now() - lastWarning > 60_000) { lastWarning = Date.now(); app.log.warn('Métricas de uso temporariamente indisponíveis; operação principal preservada.'); } };
  const collector = new ObservabilityCollector(store, warn);
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url;
    if (collectionEnabled && route) collector.record(request.method, route, reply.statusCode, reply.elapsedTime, request.user?.sub);
  });
  app.post('/me/analytics/events', { preHandler: secure, bodyLimit: 12_000, config: { rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: (request: FastifyRequest) => `analytics-events:${request.user?.sub ?? request.ip}` } } }, async (request, reply) => {
    const batch = analyticsBatchSchema.parse(request.body);
    if (!collectionEnabled) return reply.code(503).send({ code: 'ANALYTICS_DISABLED', message: 'A coleta de métricas está desativada.' });
    try { await store.ingest(request.user.sub, batch); }
    catch (error) {
      if ((error as { statusCode?: number }).statusCode === 400) return reply.code(400).send({ code: 'INVALID_INPUT', message: 'Eventos fora da janela de 24 horas. Confira o relógio do aparelho.' });
      warn(); return reply.code(503).send({ code: 'TEMPORARILY_UNAVAILABLE', message: 'Métricas temporariamente indisponíveis.' });
    }
    return reply.code(202).send({ accepted: batch.events.length });
  });
  app.get('/portal/analytics', { preHandler: secure, config: { rateLimit: { max: 12, timeWindow: '1 minute', keyGenerator: (request: FastifyRequest) => `analytics-dashboard:${request.user?.sub ?? request.ip}` } } }, async (request, reply) => {
    reply.header('cache-control', 'private, no-store');
    if (!await store.canViewDashboard(request.user.sub)) return reply.code(403).send({ code: 'FORBIDDEN', message: 'As métricas são exclusivas da administração.' });
    const { days } = analyticsQuerySchema.parse(request.query);
    if (days > policy.rawDays) return reply.code(400).send({ code: 'INVALID_INPUT', message: `Pessoas únicas podem ser consultadas por até ${policy.rawDays} dias. Consulte o histórico agregado para períodos mais antigos.` });
    await collector.flush();
    try { return await store.dashboard(days); }
    catch { warn(); return reply.code(503).send({ code: 'TEMPORARILY_UNAVAILABLE', message: 'Não foi possível consultar as métricas. Tente novamente.' }); }
  });
  const timer = setInterval(() => { void collector.flush(); }, 15_000); timer.unref();
  let maintenanceRunning = false;
  const maintenance = async () => {
    if (maintenanceRunning) return;
    maintenanceRunning = true;
    try { await store.maintain(policy); } catch { warn(); } finally { maintenanceRunning = false; }
  };
  const cleanup = setInterval(() => { void maintenance(); }, 3_600_000); cleanup.unref();
  app.decorate('flushObservability', () => collector.flush());
  app.addHook('onReady', maintenance);
  app.addHook('onClose', async () => { clearInterval(timer); clearInterval(cleanup); await collector.flush(); });
  return collector;
}

declare module 'fastify' { interface FastifyInstance { flushObservability?: () => Promise<void> } }
