import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { QueryTypes } from "sequelize";
import { buildApp } from "../src/app.js";
import { createDatabase } from "../src/database.js";
import { migrateDatabase } from "../src/migrate.js";
import { SequelizeAuthRepository } from "../src/repository.js";
import { NutritionRepository } from "../src/nutrition-repository.js";
test(
  "MySQL: dieta privada, alternativas, macros, registro idempotente e histórico imutável",
  { skip: process.env.RUN_DB_TESTS !== "1" },
  async () => {
    config({ path: new URL("../.env", import.meta.url), quiet: true });
    const db = createDatabase({
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      database: process.env.DB_NAME!,
      ssl: process.env.DB_SSL === "true",
    });
    const users: string[] = [],
      assignmentId = randomUUID();
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
      await migrateDatabase(db);
      const repo = new NutritionRepository(db);
      app = await buildApp({
        repository: new SequelizeAuthRepository(db),
        nutritionRepository: repo,
        jwtSecret: "diet-integration-secret-with-32-characters",
      });
      const accounts: import("@fit/contracts").AuthResponse[] = [];
      for (const role of ["student", "author"]) {
        const result: import("light-my-request").Response = await app.inject({
          method: "POST",
          url: "/auth/register",
          payload: {
            email: `diet-${role}-${randomUUID()}@example.com`,
            password: "integration-password-123",
            phone: "71999990000",
            firstName: "Teste",
            lastName: "Dieta",
          },
        });
        assert.equal(result.statusCode, 201);
        accounts.push(result.json());
        users.push(result.json().user.id);
      }
      const headers = { authorization: `Bearer ${accounts[0].accessToken}` },
        other = { authorization: `Bearer ${accounts[1].accessToken}` };
      const item = {
        food: {
          name: "Arroz",
          servingAmount: 100,
          servingUnit: "g",
          calories: 130,
          protein: 3,
          carbs: 28,
          fat: 1,
          notes: "",
        },
        quantity: 150,
        substitutions: "",
      };
      const alternative = {
        food: {
          ...item.food,
          name: "Batata",
          calories: 80,
          protein: 2,
          carbs: 18,
          fat: 0,
        },
        quantity: 200,
        substitutions: "",
      };
      const snapshot = {
        kind: "diet",
        scope: "private",
        name: "Dieta profissional",
        data: {
          objective: "Plano alimentar",
          notes: "Orientações do profissional",
          validityDays: 30,
          meals: [
            {
              name: "Almoço",
              time: "12:00",
              items: [item],
              options: [{ name: "Opção com batata", items: [alternative] }],
            },
          ],
        },
      };
      await db.query(
        "INSERT INTO professional_assignments (id,author_id,student_id,relationship_id,kind,status,source_id,source_revision,snapshot,request_id,created_at,updated_at) VALUES (?,?,?,?,'diet','active',?,1,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        {
          replacements: [
            assignmentId,
            users[1],
            users[0],
            randomUUID(),
            randomUUID(),
            JSON.stringify(snapshot),
            randomUUID(),
          ],
        },
      );
      assert.equal((await app.inject("/nutrition/diets")).statusCode, 401);
      const diets = await app.inject({ url: "/nutrition/diets", headers });
      assert.equal(diets.statusCode, 200);
      assert.equal(diets.json().length, 1);
      const diet = diets.json()[0];
      assert.equal(diet.meals[0].options.length, 2);
      assert.deepEqual(diet.meals[0].options.map((option:{name:string})=>option.name),['Almoço A','Almoço B']);
      assert.equal(diet.meals[0].options[0].macros.calories, 195);
      assert.equal(diet.meals[0].options[1].macros.calories, 160);
      assert.equal(diet.dailyRange.min.calories, 160);
      assert.equal(diet.dailyRange.max.calories, 195);
      assert.deepEqual(
        (await app.inject({ url: "/nutrition/diets", headers: other })).json(),
        [],
      );
      const input = {
        assignmentId,
        mealIndex: 0,
        optionIndex: 1,
        quantities: [150],
        date: "2026-10-29",
        time: "13:00",
        requestId: randomUUID(),
      };
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/nutrition/diet-meals",
            payload: input,
          })
        ).statusCode,
        401,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/nutrition/diet-meals",
            headers: other,
            payload: input,
          })
        ).statusCode,
        404,
      );
      for (const invalid of [
        { ...input, optionIndex: 5 },
        { ...input, quantities: [] },
        { ...input, quantities: [-1] },
        { ...input, calories: 1 },
      ])
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/nutrition/diet-meals",
              headers,
              payload: invalid,
            })
          ).statusCode,
          400,
        );
      const [recorded, repeat] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/nutrition/diet-meals",
          headers,
          payload: input,
        }),
        app.inject({
          method: "POST",
          url: "/nutrition/diet-meals",
          headers,
          payload: input,
        }),
      ]);
      assert.equal(recorded.statusCode, 201, recorded.body);
      assert.equal(repeat.statusCode, 201, repeat.body);
      assert.equal(recorded.json().id, repeat.json().id);
      let meals = await repo.listMeals(users[0], input.date);
      assert.equal(meals.length, 1);
      assert.equal(meals[0].calories, 120);
      assert.equal(meals[0].carbs, 27);
      assert.equal(meals[0].items[0].foodName, "Batata");
      assert.equal(meals[0].items[0].quantity, 150);
      assert.equal(meals[0].items[0].foodId, null);
      const summary = await repo.summary(users[0], input.date);
      assert.equal(summary.consumed?.calories, 120);
      snapshot.data.meals[0].options[0].items[0].food.calories = 999;
      await db.query(
        "UPDATE professional_assignments SET snapshot=?,status='superseded' WHERE id=?",
        { replacements: [JSON.stringify(snapshot), assignmentId] },
      );
      meals = await repo.listMeals(users[0], input.date);
      assert.equal(meals[0].calories, 120);
      assert.equal(meals[0].items[0].calories, 120);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/nutrition/diet-meals",
            headers,
            payload: { ...input, requestId: randomUUID() },
          })
        ).statusCode,
        404,
      );
      assert.equal(
        (await app.inject({ url: "/nutrition/diets", headers })).json()[0]
          .status,
        "superseded",
      );
      await db.query(
        "UPDATE professional_assignments SET status='pending' WHERE id=?",
        { replacements: [assignmentId] },
      );
      assert.deepEqual(
        (await app.inject({ url: "/nutrition/diets", headers })).json(),
        [],
      );
    } finally {
      await db.query("DELETE FROM professional_assignments WHERE id=?", {
        replacements: [assignmentId],
      });
      if (users.length)
        await db.query("DELETE FROM users WHERE id IN (?)", {
          replacements: [users],
          type: QueryTypes.DELETE,
        });
      await app?.close();
      await db.close();
    }
  },
);
