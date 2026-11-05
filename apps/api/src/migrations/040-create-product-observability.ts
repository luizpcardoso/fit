import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: q }: { context: QueryInterface }) {
  await q.createTable('analytics_metadata', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    collection_started_at: { type: DataTypes.DATE, allowNull: true },
  });
  await q.sequelize.query('INSERT INTO analytics_metadata (id) VALUES (1)');
  await q.createTable('analytics_events', {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    session_id: { type: DataTypes.STRING(36), allowNull: true },
    event_type: { type: DataTypes.STRING(48), allowNull: false },
    feature: { type: DataTypes.STRING(24), allowNull: false },
    screen: { type: DataTypes.STRING(40), allowNull: true },
    platform: { type: DataTypes.STRING(8), allowNull: false },
    app_version: { type: DataTypes.STRING(40), allowNull: true },
    occurred_at: { type: DataTypes.DATE, allowNull: false },
    received_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.addIndex('analytics_events', ['occurred_at', 'user_id'], { name: 'analytics_events_time_user_idx' });
  await q.addIndex('analytics_events', ['user_id', 'occurred_at'], { name: 'analytics_events_user_time_idx' });
  await q.addIndex('analytics_events', ['feature', 'occurred_at'], { name: 'analytics_events_feature_time_idx' });
  await q.createTable('analytics_daily', {
    day: { type: DataTypes.DATEONLY, primaryKey: true },
    feature: { type: DataTypes.STRING(24), primaryKey: true },
    active_users: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    sessions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    screen_views: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    actions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await q.createTable('analytics_requests_daily', {
    day: { type: DataTypes.DATEONLY, primaryKey: true },
    method: { type: DataTypes.STRING(8), primaryKey: true },
    route: { type: DataTypes.STRING(100), primaryKey: true },
    requests: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    client_errors: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    server_errors: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    total_ms: { type: DataTypes.DOUBLE, allowNull: false },
    le_100: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    le_300: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    le_1000: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    le_3000: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    le_10000: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    over_10000: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  });
}
export async function down({ context: q }: { context: QueryInterface }) {
  for (const table of ['analytics_requests_daily', 'analytics_daily', 'analytics_events', 'analytics_metadata']) await q.dropTable(table);
}
