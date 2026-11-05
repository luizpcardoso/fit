import { QueryTypes, type Sequelize, type Transaction } from 'sequelize';
import { screenFeatures, type AnalyticsBatch, type AnalyticsDashboard, type AnalyticsFeature, type AnalyticsPlatform } from '@fit/contracts';
import { analyticsDay, DAY_MS, dayStart, meaningfulActions, p95Bound, shiftDay, type ObservabilityStore, type RecordedAction, type RequestAggregate, type RetentionPolicy } from './observability-model.js';

const localDay = 'DATE(DATE_SUB(occurred_at,INTERVAL 3 HOUR))';
const actionCondition = "event_type NOT IN ('screen_view','session_start','heartbeat')";
// Sequelize positional Date replacements use the host timezone; serialize UTC explicitly.
const sqlDate = (date: Date) => date.toISOString().slice(0, 23).replace('T', ' ');
const sqlValues = (values: unknown[]) => values.map(value => value instanceof Date ? sqlDate(value) : value);
const iso = (date: string | Date) => new Date(date).toISOString();
export class SequelizeObservabilityStore implements ObservabilityStore {
  constructor(private db: Sequelize, public policy: RetentionPolicy = { rawDays: 30, aggregateMonths: 12 }, private now: () => number = Date.now, public collectionEnabled = true) {}
  async canViewDashboard(actor: string) {
    const rows = await this.db.query("SELECT user_id FROM portal_accounts WHERE user_id=? AND role='admin' AND suspended=FALSE", { replacements: [actor], type: QueryTypes.SELECT });
    return rows.length === 1;
  }
  async ingest(actor: string, batch: AnalyticsBatch) {
    const now = this.now();
    // Enforced against server time, not a client-provided timezone or clock.
    if (batch.events.some(event => Date.parse(event.occurredAt) < now - DAY_MS || Date.parse(event.occurredAt) > now + 300_000))
      throw Object.assign(new Error('Eventos devem ter ocorrido nas últimas 24 horas. Confira o relógio do aparelho.'), { statusCode: 400 });
    const rows = batch.events.map(event => [event.id, actor, event.sessionId, event.type, event.type === 'screen_view' ? screenFeatures[event.screen] : 'home', event.type === 'screen_view' ? event.screen : null, event.platform, event.appVersion, new Date(Math.min(Date.parse(event.occurredAt), now)), new Date(now)]);
    await this.insertEvents(rows);
  }
  private async insertEvents(rows: unknown[][], transaction?: Transaction) {
    if (!rows.length) return;
    await this.db.query(`INSERT IGNORE INTO analytics_events (id,user_id,session_id,event_type,feature,screen,platform,app_version,occurred_at,received_at) VALUES ${rows.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',')}`, { replacements: sqlValues(rows.flat()), transaction });
  }
  async write(actions: RecordedAction[], requests: RequestAggregate[]) {
    await this.db.transaction(async transaction => {
      await this.insertEvents(actions.map(event => [event.id, event.userId, null, event.type, event.feature, null, 'other', null, event.occurredAt, new Date(this.now())]), transaction);
      if (!requests.length) return;
      await this.db.query(`INSERT INTO analytics_requests_daily (day,method,route,requests,client_errors,server_errors,total_ms,le_100,le_300,le_1000,le_3000,le_10000,over_10000) VALUES ${requests.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')} ON DUPLICATE KEY UPDATE requests=requests+VALUES(requests),client_errors=client_errors+VALUES(client_errors),server_errors=server_errors+VALUES(server_errors),total_ms=total_ms+VALUES(total_ms),le_100=le_100+VALUES(le_100),le_300=le_300+VALUES(le_300),le_1000=le_1000+VALUES(le_1000),le_3000=le_3000+VALUES(le_3000),le_10000=le_10000+VALUES(le_10000),over_10000=over_10000+VALUES(over_10000)`, {
        replacements: requests.flatMap(row => [row.day, row.method, row.route, row.requests, row.clientErrors, row.serverErrors, row.totalMs, ...row.buckets]), transaction,
      });
    });
  }
  async maintain(policy: RetentionPolicy) {
    this.policy = policy;
    const today = analyticsDay(this.now());
    const cutoff = dayStart(shiftDay(today, -(policy.rawDays - 1)));
    const aggregateCutoff = dayStart(today); aggregateCutoff.setUTCMonth(aggregateCutoff.getUTCMonth() - policy.aggregateMonths);
    await this.db.transaction(async transaction => {
      // Serialize snapshot + purge across API processes. Never sum daily uniques into a monthly unique metric.
      await this.db.query('SELECT id FROM analytics_metadata WHERE id=1 FOR UPDATE', { transaction });
      if (this.collectionEnabled) await this.db.query('UPDATE analytics_metadata SET collection_started_at=COALESCE(collection_started_at,?) WHERE id=1', { replacements: [sqlDate(new Date(this.now()))], transaction });
      for (const grouped of [false, true]) {
        await this.db.query(`INSERT INTO analytics_daily (day,feature,active_users,sessions,screen_views,actions,updated_at) SELECT ${localDay},${grouped ? 'feature' : "'all'"},COUNT(DISTINCT user_id),COUNT(DISTINCT CASE WHEN event_type='session_start' THEN CONCAT(user_id,':',session_id) END),SUM(event_type='screen_view'),SUM(${actionCondition}),UTC_TIMESTAMP() FROM analytics_events WHERE occurred_at< ? ${grouped ? "AND event_type NOT IN ('session_start','heartbeat')" : ''} GROUP BY ${localDay}${grouped ? ',feature' : ''} ON DUPLICATE KEY UPDATE active_users=VALUES(active_users),sessions=VALUES(sessions),screen_views=VALUES(screen_views),actions=VALUES(actions),updated_at=VALUES(updated_at)`, { replacements: [sqlDate(cutoff)], transaction });
      }
      await this.db.query('DELETE FROM analytics_events WHERE occurred_at< ?', { replacements: [sqlDate(cutoff)], transaction });
      await this.db.query('DELETE FROM analytics_daily WHERE day< ?', { replacements: [analyticsDay(aggregateCutoff)], transaction });
      await this.db.query('DELETE FROM analytics_requests_daily WHERE day< ?', { replacements: [analyticsDay(aggregateCutoff)], transaction });
    });
  }
  async dashboard(days: number): Promise<AnalyticsDashboard> {
    const now = this.now(), today = analyticsDay(now), from = shiftDay(today, -(days - 1)), previousFrom = shiftDay(from, -days), until = shiftDay(today, 1);
    const start = dayStart(from), end = dayStart(until), previousStart = dayStart(previousFrom);
    const query = <T extends object>(sql: string, replacements: unknown[] = []) => this.db.query<T>(sql, { replacements: sqlValues(replacements), type: QueryTypes.SELECT });
    const rawCutoff = this.policy ? dayStart(shiftDay(today, -(this.policy.rawDays - 1))) : new Date(0);
    const metadata = await query<{ collectionStartedAt: Date | null }>('SELECT collection_started_at collectionStartedAt FROM analytics_metadata WHERE id=1');
    const collectionStartedAt = metadata[0].collectionStartedAt ? iso(metadata[0].collectionStartedAt) : new Date(now).toISOString();
    const coverage = new Date(Math.max(new Date(collectionStartedAt).getTime(), rawCutoff.getTime()));
    const historyStart = dayStart(today);
    historyStart.setUTCDate(1); historyStart.setUTCMonth(historyStart.getUTCMonth() - ((this.policy?.aggregateMonths ?? 12) - 1));
    const historySince = new Date(Math.max(historyStart.getTime(), new Date(collectionStartedAt).getTime()));
    const [accounts, activity, dailyActivity, archived, registrations, features, platforms, versions, online, recurring, quality, qualityRoutes, onboarding, historyRaw, historyArchived, historyRequests, historyAccounts] = await Promise.all([
      query<{ total: number; current: number; previous: number }>('SELECT COUNT(*) total,COALESCE(SUM(created_at>= ? AND created_at< ?),0) current,COALESCE(SUM(created_at>= ? AND created_at< ?),0) previous FROM users', [start, end, previousStart, start]),
      query<any>(`SELECT CASE WHEN occurred_at>= ? THEN 'current' ELSE 'previous' END period,COUNT(DISTINCT user_id) users,COUNT(DISTINCT CASE WHEN event_type='session_start' THEN CONCAT(user_id,':',session_id) END) sessions,SUM(event_type='screen_view') screens,SUM(${actionCondition}) actions FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? GROUP BY period`, [start, previousStart, end]),
      query<any>(`SELECT ${localDay} day,COUNT(DISTINCT user_id) users,COUNT(DISTINCT CASE WHEN event_type='session_start' THEN CONCAT(user_id,':',session_id) END) sessions,SUM(event_type='screen_view') screens,SUM(${actionCondition}) actions FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? GROUP BY ${localDay}`, [start, end]),
      query<any>('SELECT day,active_users users,sessions,screen_views screens,actions FROM analytics_daily WHERE feature=\'all\' AND day>= ? AND day< ?', [from, analyticsDay(rawCutoff)]),
      query<any>('SELECT DATE(DATE_SUB(created_at,INTERVAL 3 HOUR)) day,COUNT(*) count FROM users WHERE created_at>= ? AND created_at< ? GROUP BY day', [start, end]),
      query<any>(`SELECT feature,COUNT(DISTINCT user_id) users,SUM(event_type='screen_view') screenViews,SUM(${actionCondition}) actions FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? AND event_type NOT IN ('session_start','heartbeat') GROUP BY feature ORDER BY users DESC,screenViews DESC`, [start, end]),
      query<any>(`SELECT platform,COUNT(DISTINCT user_id) users,COUNT(DISTINCT CASE WHEN event_type='session_start' THEN CONCAT(user_id,':',session_id) END) sessions FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? AND app_version IS NOT NULL GROUP BY platform ORDER BY users DESC`, [start, end]),
      query<any>('SELECT app_version version,COUNT(DISTINCT user_id) users FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? AND app_version IS NOT NULL GROUP BY app_version ORDER BY users DESC LIMIT 10', [start, end]),
      query<any>(`SELECT COUNT(DISTINCT CASE WHEN occurred_at>= ? THEN user_id END) dau,COUNT(DISTINCT CASE WHEN occurred_at>= ? THEN user_id END) wau,COUNT(DISTINCT CASE WHEN occurred_at>= ? THEN user_id END) mau FROM analytics_events WHERE occurred_at>= ?`, [dayStart(today), dayStart(shiftDay(today, -6)), dayStart(shiftDay(today, -29)), dayStart(shiftDay(today, -29))]),
      query<any>(`SELECT COUNT(*) count FROM (SELECT user_id FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? GROUP BY user_id HAVING COUNT(DISTINCT ${localDay})>=2) returning_users`, [start, end]),
      query<any>('SELECT COALESCE(SUM(requests),0) requests,COALESCE(SUM(client_errors),0) clientErrors,COALESCE(SUM(server_errors),0) serverErrors,COALESCE(SUM(total_ms),0) totalMs,COALESCE(SUM(le_100),0) b0,COALESCE(SUM(le_300),0) b1,COALESCE(SUM(le_1000),0) b2,COALESCE(SUM(le_3000),0) b3,COALESCE(SUM(le_10000),0) b4,COALESCE(SUM(over_10000),0) b5 FROM analytics_requests_daily WHERE day>= ? AND day< ?', [from, until]),
      query<any>('SELECT method,route,SUM(requests) requests,SUM(client_errors) clientErrors,SUM(server_errors) serverErrors,SUM(total_ms)/SUM(requests) averageMs FROM analytics_requests_daily WHERE day>= ? AND day< ? GROUP BY method,route ORDER BY serverErrors DESC,averageMs DESC LIMIT 15', [from, until]),
      query<any>(`SELECT COUNT(*) eligible,SUM(EXISTS(SELECT 1 FROM analytics_events e WHERE e.user_id=u.id AND e.event_type IN (${meaningfulActions.map(() => '?').join(',')}) AND e.occurred_at>=u.created_at AND e.occurred_at<DATE_ADD(u.created_at,INTERVAL 7 DAY))) activated,SUM(EXISTS(SELECT 1 FROM analytics_events e WHERE e.user_id=u.id AND ${localDay.replaceAll('occurred_at', 'e.occurred_at')}=DATE_ADD(DATE(DATE_SUB(u.created_at,INTERVAL 3 HOUR)),INTERVAL 7 DAY))) retained FROM users u WHERE u.created_at>= ? AND u.created_at< ? AND u.created_at< ?`, [...meaningfulActions, new Date(Math.max(start.getTime(), coverage.getTime())), end, dayStart(shiftDay(today, -7))]),
      query<any>(`SELECT DATE_FORMAT(DATE_SUB(occurred_at,INTERVAL 3 HOUR),'%Y-%m') month,COUNT(DISTINCT CASE WHEN event_type='session_start' THEN CONCAT(user_id,':',session_id) END) sessions,SUM(event_type='screen_view') screens,SUM(${actionCondition}) actions FROM analytics_events WHERE occurred_at>= ? AND occurred_at< ? GROUP BY month`, [historySince, end]),
      query<any>("SELECT DATE_FORMAT(day,'%Y-%m') month,SUM(sessions) sessions,SUM(screen_views) screens,SUM(actions) actions FROM analytics_daily WHERE feature='all' AND day>= ? GROUP BY month", [analyticsDay(historySince)]),
      query<any>("SELECT DATE_FORMAT(day,'%Y-%m') month,SUM(requests) requests,SUM(server_errors) serverErrors FROM analytics_requests_daily WHERE day>= ? GROUP BY month", [analyticsDay(historySince)]),
      query<any>("SELECT DATE_FORMAT(DATE_SUB(created_at,INTERVAL 3 HOUR),'%Y-%m') month,COUNT(*) count FROM users WHERE created_at>= ? AND created_at< ? GROUP BY month", [historySince, end]),
    ]);
    // Online is separate from MAU: background polling does not emit events and cannot increase either count.
    const currentOnline = await query<any>("SELECT COUNT(DISTINCT user_id) count FROM analytics_events WHERE occurred_at>= ? AND event_type IN ('session_start','screen_view','heartbeat')", [new Date(now - 300_000)]);
    const current = activity.find((row: any) => row.period === 'current') || {}, previous = activity.find((row: any) => row.period === 'previous') || {};
    const metric = (key: string) => ({ value: Number(current[key] || 0), previous: Number(previous[key] || 0) });
    const daily = Array.from({ length: days }, (_, index) => {
      const date = shiftDay(from, index);
      const row = dailyActivity.find((r: any) => String(r.day).slice(0, 10) === date) || archived.find((r: any) => String(r.day).slice(0, 10) === date) || {};
      return { date, activeUsers: Number(row.users || 0), newAccounts: Number(registrations.find((r: any) => String(r.day).slice(0, 10) === date)?.count || 0), sessions: Number(row.sessions || 0), screenViews: Number(row.screens || 0), actions: Number(row.actions || 0) };
    });
    const history: AnalyticsDashboard['history'] = [];
    const firstMonth = new Date(`${analyticsDay(historySince).slice(0, 7)}-01T12:00:00Z`);
    for (let monthIndex = 0; monthIndex < (this.policy?.aggregateMonths ?? 12); monthIndex++) {
      const monthDate = new Date(firstMonth); monthDate.setUTCMonth(monthDate.getUTCMonth() + monthIndex);
      const month = monthDate.toISOString().slice(0, 7);
      if (month > today.slice(0, 7)) break;
      const raw = historyRaw.find((row: any) => row.month === month) || {}, archived = historyArchived.find((row: any) => row.month === month) || {}, requests = historyRequests.find((row: any) => row.month === month) || {};
      history.push({ month, newAccounts: Number(historyAccounts.find((row: any) => row.month === month)?.count || 0), sessions: Number(raw.sessions || 0) + Number(archived.sessions || 0), screenViews: Number(raw.screens || 0) + Number(archived.screens || 0), actions: Number(raw.actions || 0) + Number(archived.actions || 0), requests: Number(requests.requests || 0), serverErrors: Number(requests.serverErrors || 0) });
    }
    const q = quality[0], live = online[0];
    return {
      collectionEnabled: this.collectionEnabled, generatedAt: new Date(now).toISOString(), timezone: 'America/Bahia', days, collectionStartedAt, coverageFrom: coverage.toISOString(), periodFrom: from, periodTo: today,
      partialCoverage: coverage.getTime() > previousStart.getTime(), retention: { rawDays: this.policy?.rawDays ?? null, aggregateMonths: this.policy?.aggregateMonths ?? null },
      summary: { totalAccounts: Number(accounts[0].total), newAccounts: { value: Number(accounts[0].current), previous: Number(accounts[0].previous) }, activeUsers: metric('users'), onlineUsers: Number(currentOnline[0].count), dau: Number(live.dau), wau: Number(live.wau), mau: Number(live.mau), sessions: metric('sessions'), screenViews: metric('screens'), actions: metric('actions'), returningUsers: Number(recurring[0].count), stickiness: Number(live.mau) ? Number(live.dau) / Number(live.mau) : null },
      onboarding: { eligibleAccounts: Number(onboarding[0].eligible), activatedWithin7Days: Number(onboarding[0].activated || 0), returnedOnDay7: Number(onboarding[0].retained || 0) },
      daily, history, features: features.map((row: any) => ({ feature: row.feature as AnalyticsFeature, users: Number(row.users), screenViews: Number(row.screenViews), actions: Number(row.actions) })),
      platforms: platforms.map((row: any) => ({ platform: row.platform as AnalyticsPlatform, users: Number(row.users), sessions: Number(row.sessions) })), versions: versions.map((row: any) => ({ version: row.version, users: Number(row.users) })),
      quality: { requests: Number(q.requests), clientErrors: Number(q.clientErrors), serverErrors: Number(q.serverErrors), averageMs: Number(q.requests) ? Number(q.totalMs) / Number(q.requests) : null, p95UpperBoundMs: p95Bound([q.b0, q.b1, q.b2, q.b3, q.b4, q.b5].map(Number)), routes: qualityRoutes.map((row: any) => ({ method: row.method, route: row.route, requests: Number(row.requests), clientErrors: Number(row.clientErrors), serverErrors: Number(row.serverErrors), averageMs: Number(row.averageMs) })) },
    };
  }
}
