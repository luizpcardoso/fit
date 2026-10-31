import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('mental_check_ins', {
    id: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    check_in_date: { type: DataTypes.DATEONLY, allowNull: false },
    check_in_time: { type: DataTypes.TIME, allowNull: false },
    mood: { type: DataTypes.ENUM('very_low', 'low', 'neutral', 'good', 'very_good'), allowNull: false },
    emotions_json: { type: DataTypes.TEXT, allowNull: false },
    factors_json: { type: DataTypes.TEXT, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addConstraint('mental_check_ins', {
    fields: ['user_id', 'check_in_date'],
    type: 'unique',
    name: 'mental_check_ins_user_date_unique',
  });
  await context.addIndex('mental_check_ins', ['user_id', 'check_in_date'], { name: 'mental_check_ins_user_date_idx' });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.dropTable('mental_check_ins');
}
