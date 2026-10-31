import { DataTypes, type QueryInterface } from 'sequelize';

// Energy formulas need a female/male reference; keep it separate from gender identity so
// people who answer "non_binary" or "prefer_not_to_say" can still opt into estimates.
export async function up({ context }: { context: QueryInterface }) {
  await context.addColumn('users', 'estimation_sex', { type: DataTypes.STRING(8), allowNull: true });
  await context.sequelize.query("UPDATE users SET estimation_sex=gender WHERE gender IN ('female','male')");
}

export async function down({ context }: { context: QueryInterface }) {
  await context.removeColumn('users', 'estimation_sex');
}
