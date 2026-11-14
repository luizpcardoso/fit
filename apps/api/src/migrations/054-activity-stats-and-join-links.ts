import { DataTypes, type QueryInterface } from 'sequelize';

const notificationTypes = ['invite', 'comment', 'role_changed', 'removed', 'report_resolved', 'reaction'];

/**
 * - Activity numbers on achievement posts: allowed per group (off) and chosen per person and group (off); the post keeps a snapshot.
 * - Joining by code: a group keeps one active code (only its hash is stored) and the requests wait for the administration.
 */
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('groups', 'allow_activity_stats', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  await q.addColumn('group_share_preferences', 'share_activity_stats', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  await q.addColumn('group_posts', 'activity_stats', { type: DataTypes.JSON, allowNull: true });
  await q.createTable('group_invite_links', {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    group_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'groups', key: 'id' }, onDelete: 'CASCADE' },
    code_hash: { type: DataTypes.STRING(64), allowNull: false },
    created_by_user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    expires_at: { type: DataTypes.DATE(6), allowNull: false },
    revoked_at: { type: DataTypes.DATE(6), allowNull: true },
    created_at: { type: DataTypes.DATE(6), allowNull: false },
  });
  await q.addIndex('group_invite_links', ['code_hash'], { name: 'group_invite_links_code_uq', unique: true });
  await q.addIndex('group_invite_links', ['group_id', 'revoked_at'], { name: 'group_invite_links_group_idx' });
  await q.createTable('group_join_requests', {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    group_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'groups', key: 'id' }, onDelete: 'CASCADE' },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    link_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'group_invite_links', key: 'id' }, onDelete: 'CASCADE' },
    status: { type: DataTypes.ENUM('pending', 'approved', 'declined'), allowNull: false },
    decided_by_user_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    decided_at: { type: DataTypes.DATE(6), allowNull: true },
    created_at: { type: DataTypes.DATE(6), allowNull: false },
  });
  await q.addIndex('group_join_requests', ['group_id', 'status', 'created_at'], { name: 'group_join_requests_group_idx' });
  await q.addIndex('group_join_requests', ['user_id', 'group_id', 'status'], { name: 'group_join_requests_user_idx' });
  await q.changeColumn('group_notifications', 'type', { type: DataTypes.ENUM(...notificationTypes, 'join_request'), allowNull: false });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.bulkDelete('group_notifications', { type: 'join_request' });
  await q.changeColumn('group_notifications', 'type', { type: DataTypes.ENUM(...notificationTypes), allowNull: false });
  await q.dropTable('group_join_requests');
  await q.dropTable('group_invite_links');
  await q.removeColumn('group_posts', 'activity_stats');
  await q.removeColumn('group_share_preferences', 'share_activity_stats');
  await q.removeColumn('groups', 'allow_activity_stats');
}
