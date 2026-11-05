import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { QueryTypes } from 'sequelize';
import { createDatabase } from '../src/database.js';
import { migrateDatabase } from '../src/migrate.js';
import { SequelizeObservabilityStore } from '../src/observability-repository.js';
import { ObservabilityCollector } from '../src/observability-routes.js';
import { analyticsDay, dayStart, shiftDay, type RetentionPolicy } from '../src/observability-model.js';
import type { AnalyticsEvent } from '@fit/contracts';

// Creates and removes its OWN database. Retention tests must never purge a shared or user database.
test('MySQL isolado: métricas, idempotência, autorização, coortes, timezone e retenção sem dados pessoais nos agregados', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  config({ path: new URL('../.env', import.meta.url), quiet: true });
  const connection = { host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USER!, password: process.env.DB_PASS!, ssl: process.env.DB_SSL === 'true' };
  const bootstrap = createDatabase({ ...connection, database: process.env.DB_NAME! });
  const databaseName = `fit_analytics_test_${randomUUID().replaceAll('-', '')}`;
  let db: ReturnType<typeof createDatabase> | undefined;
  try {
    await bootstrap.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    db = createDatabase({ ...connection, database: databaseName });
    await migrateDatabase(db);
    let now = Date.parse('2026-11-02T15:00:00Z');
    const policy: RetentionPolicy = { rawDays: 30, aggregateMonths: 12 };
    const store = new SequelizeObservabilityStore(db, policy, () => now);
    await store.maintain(policy);
    // Collection predates these test cohorts; changing the system clock is unnecessary.
    await db.query("UPDATE analytics_metadata SET collection_started_at='2026-01-01 00:00:00' WHERE id=1");
    const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const created = ['2026-10-20 12:00:00', '2026-11-02 12:00:00', '2026-09-01 12:00:00', '2026-09-01 12:00:00'];
    for (const [index, id] of users.entries()) await db.query('INSERT INTO users (id,email,phone,first_name,last_name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', { replacements: [id, `analytics-${id}@example.com`, '71999990000', 'Sintético', 'Teste', 'not-a-real-login', created[index], created[index]] });
    await db.query("INSERT INTO portal_accounts (user_id,role,suspended) VALUES (?,'admin',FALSE),(?,'professional',FALSE)", { replacements: [users[2], users[3]] });
    assert.equal(await store.canViewDashboard(users[0]), false);
    assert.equal(await store.canViewDashboard(users[2]), true);
    assert.equal(await store.canViewDashboard(users[3]), false);
    await db.query('UPDATE portal_accounts SET suspended=TRUE WHERE user_id=?', { replacements: [users[2]] });
    assert.equal(await store.canViewDashboard(users[2]), false);
    const session = randomUUID();
    const events: AnalyticsEvent[] = [
      { id: randomUUID(), sessionId: session, type: 'session_start', occurredAt: new Date(now).toISOString(), platform: 'android', appVersion: '1.2.3' },
      { id: randomUUID(), sessionId: session, type: 'heartbeat', occurredAt: new Date(now).toISOString(), platform: 'android', appVersion: '1.2.3' },
      { id: randomUUID(), sessionId: session, type: 'screen_view', screen: 'workouts', occurredAt: new Date(now).toISOString(), platform: 'android', appVersion: '1.2.3' },
    ];
    await store.ingest(users[0], { events }); await store.ingest(users[0], { events });
    const storedTime = await db.query<any>("SELECT DATE_FORMAT(occurred_at,'%H:%i') time FROM analytics_events WHERE id=?", { replacements: [events[0].id], type: QueryTypes.SELECT });
    assert.equal(storedTime[0].time, '15:00');
    const secondScreen: AnalyticsEvent = { ...events[2], id: randomUUID(), sessionId: randomUUID(), type: 'screen_view', screen: 'diet', platform: 'ios' };
    await store.ingest(users[1], { events: [secondScreen] });
    await assert.rejects(() => store.ingest(users[0], { events: [{ ...events[0], occurredAt: new Date(now - 86_400_001).toISOString() }] }));
    await assert.rejects(() => store.ingest(users[0], { events: [{ ...events[0], occurredAt: new Date(now + 300_001).toISOString() }] }));
    // Recent successful actions are counted once by stable server event IDs.
    const action = { id: randomUUID(), userId: users[0], type: 'workout_completed', feature: 'fitness' as const, occurredAt: new Date(now) };
    await store.write([action], []); await store.write([action], []);
    // D7 return and early activation for the account created on October 20.
    await store.write([{ ...action, id: randomUUID(), occurredAt: new Date('2026-10-21T12:00:00Z') }, { ...action, id: randomUUID(), occurredAt: new Date('2026-10-27T12:00:00Z') }], []);
    const collector = new ObservabilityCollector(store, () => { throw new Error('unexpected collector failure'); });
    collector.record('POST', '/workout-sessions', 403, 350, users[0], new Date(now));
    collector.record('GET', '/workout-plans', 200, 50, users[0], new Date(now));
    collector.record('GET', '/workout-plans', 500, 1200, users[0], new Date(now));
    collector.record('GET', '/portal/analytics', 200, 1, users[2], new Date(now)); await collector.flush();
    const result = await store.dashboard(30);
    assert.equal(result.summary.totalAccounts, 4); assert.equal(result.summary.newAccounts.value, 2);
    assert.equal(result.summary.activeUsers.value, 2); assert.equal(result.summary.onlineUsers, 2);
    assert.equal(result.summary.sessions.value, 1); assert.equal(result.summary.screenViews.value, 2);
    assert.equal(result.summary.actions.value, 3); assert.equal(result.summary.returningUsers, 1);
    assert.equal(result.summary.dau, 2); assert.equal(result.summary.wau, 2); assert.equal(result.summary.mau, 2);
    assert.equal(result.features.find(row => row.feature === 'fitness')?.users, 1);
    assert.equal(result.features.find(row => row.feature === 'fitness')?.screenViews, 1);
    assert.equal(result.onboarding.eligibleAccounts, 1); assert.equal(result.onboarding.activatedWithin7Days, 1); assert.equal(result.onboarding.returnedOnDay7, 1);
    assert.equal(result.quality.requests, 3); assert.equal(result.quality.clientErrors, 1); assert.equal(result.quality.serverErrors, 1);
    assert.equal(result.quality.p95UpperBoundMs, 3000);
    assert.equal(result.daily.length, 30); assert.equal(result.daily.at(-1)?.activeUsers, 2);
    const serialized = JSON.stringify(result); for (const id of users) assert.equal(serialized.includes(id), false); assert.equal(serialized.includes('@example.com'), false);
    // 02:59 UTC belongs to the previous local day; a single person is never summed across days for MAU.
    now = Date.parse('2026-11-03T02:59:00Z');
    await store.ingest(users[0], { events: [{ ...events[2], id: randomUUID(), occurredAt: new Date(now).toISOString(), type: 'screen_view', screen: 'workouts' }] });
    assert.equal((await store.dashboard(7)).daily.at(-1)?.date, '2026-11-02');
    // Closed days older than retention are rolled up, then purged, preserving additive counts and daily distincts.
    const oldDay = shiftDay(analyticsDay(now), -31);
    await store.write([{ ...action, id: randomUUID(), occurredAt: dayStart(oldDay) }, { ...action, id: randomUUID(), occurredAt: new Date(dayStart(oldDay).getTime() + 60_000) }], []);
    await store.maintain(policy); await store.maintain(policy);
    const archived = await db.query<any>("SELECT * FROM analytics_daily WHERE day=? AND feature='all'", { replacements: [oldDay], type: QueryTypes.SELECT });
    assert.ok(archived[0], JSON.stringify(await db.query('SELECT day,feature,actions FROM analytics_daily', { type: QueryTypes.SELECT })));
    assert.equal(Number(archived[0].actions), 2);
    const afterArchive = await store.dashboard(30);
    assert.equal(afterArchive.history.find(row => row.month === oldDay.slice(0, 7))?.actions, 4); assert.equal(Number(archived[0].active_users), 1);
    assert.equal('user_id' in archived[0], false);
    const oldRaw = await db.query<any>('SELECT COUNT(*) count FROM analytics_events WHERE occurred_at< ?', { replacements: [dayStart(shiftDay(analyticsDay(now), -30))], type: QueryTypes.SELECT }); assert.equal(Number(oldRaw[0].count), 0);
    // Raw identifiers follow account deletion; anonymous aggregates contain no user foreign key.
    await db.query('DELETE FROM users WHERE id=?', { replacements: [users[0]] });
    const remaining = await db.query<any>('SELECT COUNT(*) count FROM analytics_events WHERE user_id=?', { replacements: [users[0]], type: QueryTypes.SELECT }); assert.equal(Number(remaining[0].count), 0);
    now = Date.parse('2029-01-01T12:00:00Z'); store.collectionEnabled = false; await store.maintain(policy);
    const expired = await db.query<any>('SELECT COUNT(*) count FROM analytics_daily', { type: QueryTypes.SELECT }); assert.equal(Number(expired[0].count), 0);
  } finally {
    await db?.close();
    await bootstrap.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await bootstrap.close();
  }
});
