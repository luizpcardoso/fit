import { QueryTypes, type QueryInterface } from "sequelize";

type PlanRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

type DivisionRow = {
  id: string;
  name: string;
};

type ExerciseRow = {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number | null;
};

export async function up({ context: q }: { context: QueryInterface }) {
  const [admin] = await q.sequelize.query<{ user_id: string }>(
    "SELECT user_id FROM portal_accounts WHERE role='admin' ORDER BY user_id LIMIT 1",
    { type: QueryTypes.SELECT },
  );
  if (!admin) return;

  const plans = await q.sequelize.query<PlanRow>(
    "SELECT id,name,created_at,updated_at FROM suggested_workout_plans ORDER BY created_at,id",
    { type: QueryTypes.SELECT },
  );

  for (const plan of plans) {
    const [existing] = await q.sequelize.query<{ id: string }>(
      "SELECT id FROM portal_content WHERE id=? LIMIT 1",
      { replacements: [plan.id], type: QueryTypes.SELECT },
    );
    if (existing) continue;

    const divisions = await q.sequelize.query<DivisionRow>(
      "SELECT id,name FROM suggested_workout_divisions WHERE plan_id=? ORDER BY position,id",
      { replacements: [plan.id], type: QueryTypes.SELECT },
    );
    const contentDivisions = [];
    for (const division of divisions) {
      const exercises = await q.sequelize.query<ExerciseRow>(
        `SELECT e.name,swe.sets,swe.reps,swe.rest_seconds
         FROM suggested_workout_exercises swe
         JOIN exercises e ON e.id=swe.exercise_id
         WHERE swe.division_id=?
         ORDER BY swe.position,swe.id`,
        { replacements: [division.id], type: QueryTypes.SELECT },
      );
      contentDivisions.push({
        name: division.name,
        exercises: exercises.map((exercise) => ({
          name: exercise.name,
          sets: Number(exercise.sets),
          reps: exercise.reps,
          load: null,
          restSeconds:
            exercise.rest_seconds === null
              ? null
              : Number(exercise.rest_seconds),
          notes: "",
        })),
      });
    }

    await q.sequelize.query(
      `INSERT INTO portal_content
        (id,owner_id,kind,scope,name,data,revision,archived,created_at,updated_at)
       VALUES (?,?,?,?,?,?,1,FALSE,?,?)`,
      {
        replacements: [
          plan.id,
          admin.user_id,
          "workout",
          "global",
          plan.name,
          JSON.stringify({ validityDays: 30, divisions: contentDivisions }),
          plan.created_at,
          plan.updated_at,
        ],
      },
    );
  }
}

export async function down({ context: q }: { context: QueryInterface }) {
  await q.sequelize.query(
    `DELETE pc FROM portal_content pc
     JOIN suggested_workout_plans swp ON swp.id=pc.id
     LEFT JOIN portal_content_versions pcv ON pcv.content_id=pc.id
     WHERE pc.kind='workout' AND pc.scope='global' AND pcv.id IS NULL`,
  );
}
