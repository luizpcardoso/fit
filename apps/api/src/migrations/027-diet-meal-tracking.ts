import { DataTypes, type QueryInterface } from "sequelize";
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn("meals", "diet_assignment_id", {
    type: DataTypes.STRING(36),
    allowNull: true,
  });
  await q.addColumn("meals", "diet_meal_index", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
  await q.addColumn("meals", "diet_option_index", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
  await q.addColumn("meals", "diet_request_id", {
    type: DataTypes.STRING(36),
    allowNull: true,
    unique: true,
  });
}
export async function down({ context: q }: { context: QueryInterface }) {
  for (const field of [
    "diet_request_id",
    "diet_option_index",
    "diet_meal_index",
    "diet_assignment_id",
  ])
    await q.removeColumn("meals", field);
}
