import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('workout_goals', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    weekly_target: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
    mode: { type: DataTypes.ENUM('flexible', 'planned'), allowNull: false },
    schedule: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false },
  });
}
export async function down({ context }: { context: QueryInterface }) { await context.dropTable('workout_goals'); }
