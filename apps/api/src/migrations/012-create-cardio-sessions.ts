import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('cardio_sessions', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    session_date: { type: DataTypes.DATEONLY, allowNull: false },
    mode: { type: DataTypes.ENUM('estimated', 'manual'), allowNull: false },
    activity: { type: DataTypes.ENUM('walking', 'running', 'cycling', 'stairs', 'spinning'), allowNull: true },
    intensity: { type: DataTypes.ENUM('light', 'moderate', 'intense'), allowNull: true },
    duration_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    weight_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    met: { type: DataTypes.DECIMAL(4, 1), allowNull: true },
    calories: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    source: { type: DataTypes.STRING(120), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addIndex('cardio_sessions', ['user_id', 'session_date', 'created_at'], { name: 'cardio_sessions_user_date_idx' });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.dropTable('cardio_sessions');
}
