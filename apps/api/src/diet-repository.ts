import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize } from "sequelize";
import {
  dietMacros,
  dietMealOptions,
  portalContentSnapshotSchema,
  type DietMealInput,
  type DietView,
} from "@fit/contracts";
export class DietRepository {
  constructor(private db: Sequelize) {}
  async list(userId: string): Promise<DietView[]> {
    const rows = await this.db.query<{
      id: string;
      authorName: string;
      status: string;
      snapshot: unknown;
      createdAt: Date;
    }>(
      "SELECT a.id,CONCAT(u.first_name,' ',u.last_name) authorName,a.status,a.snapshot,a.created_at createdAt FROM professional_assignments a JOIN users u ON u.id=a.author_id WHERE a.student_id=? AND a.kind='diet' AND a.status IN ('active','superseded') ORDER BY a.created_at DESC,a.id LIMIT 100",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows.map((row) => {
      const snapshot = portalContentSnapshotSchema.parse(
        typeof row.snapshot === "string"
          ? JSON.parse(row.snapshot)
          : row.snapshot,
      );
      if (snapshot.kind !== "diet") throw new Error("Invalid diet snapshot");
      const meals = snapshot.data.meals.map((meal) => ({
        name: meal.name,
        time: meal.time,
        options: dietMealOptions(meal),
      }));
      const min = { calories: 0, protein: 0, carbs: 0, fat: 0 },
        max = { ...min };
      for (const meal of meals)
        for (const key of ["calories", "protein", "carbs", "fat"] as const) {
          min[key] += Math.min(
            ...meal.options.map((option) => option.macros[key]),
          );
          max[key] += Math.max(
            ...meal.options.map((option) => option.macros[key]),
          );
        }
      const expiresAt = snapshot.data.validityDays
        ? new Date(
            new Date(row.createdAt).getTime() +
              snapshot.data.validityDays * 86400000,
          ).toISOString()
        : null;
      return {
        id: row.id,
        name: snapshot.name,
        authorName: row.authorName,
        status: row.status,
        createdAt: new Date(row.createdAt).toISOString(),
        expiresAt,
        expired: expiresAt !== null && Date.now() >= Date.parse(expiresAt),
        objective: snapshot.data.objective,
        notes: snapshot.data.notes,
        meals,
        dailyRange: { min, max },
      };
    });
  }
  async record(
    userId: string,
    input: DietMealInput,
  ): Promise<{ id: string } | "missing" | "invalid" | "conflict"> {
    return this.db.transaction(async (transaction) => {
      await this.db.query("SELECT id FROM users WHERE id=? FOR UPDATE", {
        replacements: [userId],
        type: QueryTypes.SELECT,
        transaction,
      });
      const [existing] = await this.db.query<{ id: string; user_id: string }>(
        "SELECT id,user_id FROM meals WHERE diet_request_id=?",
        {
          replacements: [input.requestId],
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      if (existing)
        return existing.user_id === userId ? { id: existing.id } : "conflict";
      const [row] = await this.db.query<{ snapshot: unknown }>(
        "SELECT snapshot FROM professional_assignments WHERE id=? AND student_id=? AND kind='diet' AND status='active' FOR UPDATE",
        {
          replacements: [input.assignmentId, userId],
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      if (!row) return "missing";
      const snapshot = portalContentSnapshotSchema.parse(
        typeof row.snapshot === "string"
          ? JSON.parse(row.snapshot)
          : row.snapshot,
      );
      if (snapshot.kind !== "diet") return "missing";
      const meal = snapshot.data.meals[input.mealIndex];
      const option = meal
        ? dietMealOptions(meal)[input.optionIndex]
        : undefined;
      if (!option || option.items.length !== input.quantities.length)
        return "invalid";
      const totals = dietMacros(option.items, input.quantities),
        id = randomUUID();
      if (
        Object.values(totals).some(
          (value) => !Number.isFinite(value) || value > 100000,
        )
      )
        return "invalid";
      await this.db.query(
        "INSERT INTO meals (id,user_id,name,meal_date,meal_time,mode,calories,protein,carbs,fat,fiber,diet_assignment_id,diet_meal_index,diet_option_index,diet_request_id,created_at,updated_at) VALUES (?,?,?,?,?,'items',?,?,?,?,NULL,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        {
          replacements: [
            id,
            userId,
            meal.name,
            input.date,
            input.time,
            totals.calories,
            totals.protein,
            totals.carbs,
            totals.fat,
            input.assignmentId,
            input.mealIndex,
            input.optionIndex,
            input.requestId,
          ],
          transaction,
        },
      );
      for (const [index, item] of option.items.entries()) {
        const macros = dietMacros([item], [input.quantities[index]]);
        await this.db.query(
          "INSERT INTO meal_items (id,meal_id,food_id,food_name,serving_amount,serving_unit,quantity,calories,protein,carbs,fat,fiber,created_at) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,NULL,UTC_TIMESTAMP())",
          {
            replacements: [
              randomUUID(),
              id,
              item.food.name,
              item.food.servingAmount,
              item.food.servingUnit,
              input.quantities[index],
              macros.calories,
              macros.protein,
              macros.carbs,
              macros.fat,
            ],
            transaction,
          },
        );
      }
      return { id };
    });
  }
}
