import { DataTypes, type QueryInterface } from "sequelize";
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn("professional_assignments", "replace_workout_plan_id", {
    type: DataTypes.STRING(36),
    allowNull: true,
  });
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeColumn("professional_assignments", "replace_workout_plan_id");
}
