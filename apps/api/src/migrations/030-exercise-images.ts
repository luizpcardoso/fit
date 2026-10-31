import { DataTypes, QueryTypes, type QueryInterface } from "sequelize";

type PortalWorkoutRow = { id: string; data: unknown };

function parseData(value: unknown): any {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function up({ context: q }: { context: QueryInterface }) {
  const exerciseColumns = await q.describeTable("exercises");
  if (!exerciseColumns.image_url)
    await q.addColumn("exercises", "image_url", {
      type: DataTypes.STRING(120),
      allowNull: true,
    });

  const planExerciseColumns = await q.describeTable("workout_plan_exercises");
  if (!planExerciseColumns.image_url)
    await q.addColumn("workout_plan_exercises", "image_url", {
      type: DataTypes.STRING(120),
      allowNull: true,
    });

  const catalog = await q.sequelize.query<{ id: string; name: string }>(
    "SELECT id,name FROM exercises WHERE source='catalog'",
    { type: QueryTypes.SELECT },
  );
  const byName = new Map(
    catalog.map((exercise) => [exercise.name.toLocaleLowerCase("pt-BR"), exercise.id]),
  );
  const workouts = await q.sequelize.query<PortalWorkoutRow>(
    "SELECT id,data FROM portal_content WHERE kind='workout'",
    { type: QueryTypes.SELECT },
  );
  for (const workout of workouts) {
    const data = parseData(workout.data);
    if (!data?.divisions || !Array.isArray(data.divisions)) continue;
    let changed = false;
    for (const division of data.divisions) {
      if (!Array.isArray(division?.exercises)) continue;
      for (const exercise of division.exercises) {
        if (exercise.catalogExerciseId) continue;
        const id = byName.get(
          String(exercise.name || "").toLocaleLowerCase("pt-BR"),
        );
        if (id) {
          exercise.catalogExerciseId = id;
          changed = true;
        }
      }
    }
    if (changed)
      await q.sequelize.query("UPDATE portal_content SET data=? WHERE id=?", {
        replacements: [JSON.stringify(data), workout.id],
      });
  }
}

export async function down({ context: q }: { context: QueryInterface }) {
  await q.removeColumn("workout_plan_exercises", "image_url");
  await q.removeColumn("exercises", "image_url");
}
