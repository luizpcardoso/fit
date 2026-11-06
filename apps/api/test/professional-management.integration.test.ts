import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { QueryTypes } from "sequelize";
import sharp from "sharp";
import { buildApp } from "../src/app.js";
import { createDatabase } from "../src/database.js";
import { migrateDatabase } from "../src/migrate.js";
import { SequelizeAuthRepository } from "../src/repository.js";
import { SequelizePortalStore } from "../src/portal.js";
import { GroupRepository } from "../src/group-repository.js";
import {
  ProfessionalManagement,
  registerProfessionalManagement,
} from "../src/professional-management.js";
import {
  PortalContentService,
  registerPortalContent,
} from "../src/portal-content.js";

test(
  "MySQL: criação, ativação única, restrições, convite, consentimento e revogação",
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
      typeId = randomUUID();
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
      await migrateDatabase(db);
      app = await buildApp({
        repository: new SequelizeAuthRepository(db),
        portalStore: new SequelizePortalStore(db),
        jwtSecret: "test-professional-management-secret-32",
      });
      const service = new ProfessionalManagement(db);
      await registerProfessionalManagement(app, service, async (req, reply) => {
        try {
          await req.jwtVerify();
        } catch {
          return reply
            .code(401)
            .send({ code: "UNAUTHORIZED", message: "Sessão inválida." });
        }
      });
      await registerPortalContent(
        app,
        new PortalContentService(service),
        async (req, reply) => {
          try {
            await req.jwtVerify();
          } catch {
            return reply
              .code(401)
              .send({ code: "UNAUTHORIZED", message: "Sessão inválida." });
          }
        },
      );
      const call = (
        method: any,
        url: string,
        token?: string,
        payload?: unknown,
      ) =>
        app!.inject({
          method,
          url,
          headers: token ? { authorization: `Bearer ${token}` } : {},
          ...(payload ? { payload } : {}),
        });
      const register = async () => {
        const response = await call("POST", "/auth/register", undefined, {
          email: `portal-${randomUUID()}@example.com`,
          password: "test-password-123",
          phone: "71999990000",
          firstName: "Teste",
          lastName: "Integração",
        });
        assert.equal(response.statusCode, 201);
        const auth = response.json();
        users.push(auth.user.id);
        return auth;
      };
      const admin = await register(),
        student = await register(),
        other = await register();
      await db.query(
        "INSERT INTO portal_accounts (user_id,role,suspended) VALUES (?,'admin',FALSE)",
        { replacements: [admin.user.id] },
      );
      const createdGroup = await call('POST','/portal/groups',admin.accessToken,{name:'Grupo integração portal',description:'Grupo temporário de teste'});
      assert.equal(createdGroup.statusCode,200,createdGroup.body);
      const groupId=createdGroup.json().id;
      assert.equal((await call('GET',`/portal/groups/${groupId}/members`,other.accessToken)).statusCode,403);
      assert.equal((await call('GET',`/portal/groups/${groupId}/members`,admin.accessToken)).json()[0].role,'owner');
      assert.equal((await call('PATCH',`/portal/groups/${groupId}/members`,admin.accessToken,{userId:admin.user.id,action:'remove'})).statusCode,409);
      assert.equal((await call('POST',`/portal/groups/${groupId}/invites`,admin.accessToken,{username:student.user.username})).statusCode,200);
      // A student's private group: the admin may manage it but must not invite their own account into the feed.
      const privateGroupId=await new GroupRepository(db).create(student.user.id,{name:'Grupo privado do aluno'});
      assert.equal((await call('POST',`/portal/groups/${privateGroupId}/invites`,admin.accessToken,{username:admin.user.username})).statusCode,400);
      assert.equal((await call('PATCH',`/portal/groups/${groupId}`,admin.accessToken,{name:'Grupo teste atualizado',description:'Teste',active:false})).statusCode,200);
      await db.query(
        "INSERT INTO professional_types (id,name,capabilities) VALUES (?,?,?)",
        {
          replacements: [
            typeId,
            `Personal ${typeId}`,
            JSON.stringify([
              "fitness.view",
              "fitness.manage",
              "body.view",
              "nutrition.suggest",
              "nutrition.view",
            ]),
          ],
        },
      );
      assert.equal(
        (await call("GET", "/portal/professionals")).statusCode,
        401,
      );
      assert.equal(
        (await call("GET", "/portal/professionals", student.accessToken))
          .statusCode,
        403,
      );
      const input = {
        email: `professional-${randomUUID()}@example.com`,
        firstName: "Personal",
        lastName: "Teste",
        phone: "71999990000",
        typeId,
        capabilities: [
          "fitness.view",
          "fitness.manage",
          "nutrition.suggest",
          "nutrition.view",
        ],
      };
      assert.equal(
        (
          await call("POST", "/portal/professionals", admin.accessToken, {
            ...input,
            capabilities: ["nutrition.manage"],
          })
        ).statusCode,
        400,
      );
      const created = await call(
        "POST",
        "/portal/professionals",
        admin.accessToken,
        input,
      );
      assert.equal(created.statusCode, 201);
      const professional = created.json();
      users.push(professional.id);
      const auth = (
        await call("POST", "/auth/login", undefined, {
          email: input.email,
          password: professional.temporaryPassword,
        })
      ).json();
      assert.equal(
        (await call("GET", "/portal/relationships", auth.accessToken))
          .statusCode,
        403,
      );
      const activation = {
        password: "definitive-password-123",
        acceptTerms: true,
      };
      assert.equal(
        (await call("POST", "/portal/activate", auth.accessToken, activation))
          .statusCode,
        200,
      );
      assert.equal(
        (await call("POST", "/portal/activate", auth.accessToken, activation))
          .statusCode,
        401,
      );
      assert.equal(
        (
          await call("POST", "/auth/login", undefined, {
            email: input.email,
            password: professional.temporaryPassword,
          })
        ).statusCode,
        401,
      );
      const login = (
        await call("POST", "/auth/login", undefined, {
          email: input.email,
          password: activation.password,
        })
      ).json();
      const exercise = await call(
        "POST",
        "/portal/content",
        admin.accessToken,
        {
          kind: "exercise",
          scope: "global",
          name: "Exercício com imagem",
          data: {
            category: "strength",
            equipment: "",
            primaryMuscle: "peitoral",
            notes: "",
          },
        },
      );
      assert.equal(exercise.statusCode, 201, exercise.body);
      const exerciseId = exercise.json().id;
      const imageBuffer = await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: { r: 20, g: 120, b: 90 },
        },
      })
        .png()
        .toBuffer();
      const imagePayload = {
        imageDataUrl: `data:image/png;base64,${imageBuffer.toString("base64")}`,
      };
      assert.equal(
        (await call("PUT", `/portal/content/${exerciseId}/image`, undefined, imagePayload))
          .statusCode,
        401,
      );
      assert.equal(
        (
          await call(
            "PUT",
            `/portal/content/${exerciseId}/image`,
            other.accessToken,
            imagePayload,
          )
        ).statusCode,
        403,
      );
      assert.equal((await call("PUT", `/portal/content/${exerciseId}/image`, login.accessToken, imagePayload)).statusCode, 403);
      assert.equal((await call("PUT", `/portal/content/${exerciseId}/image`, login.accessToken, { imageDataUrl: null })).statusCode, 403);
      const uploadedImage = await call(
        "PUT",
        `/portal/content/${exerciseId}/image`,
        admin.accessToken,
        imagePayload,
      );
      assert.equal(uploadedImage.statusCode, 200, uploadedImage.body);
      assert.match(uploadedImage.json().imageUrl, /^\/media\/exercises\//);
      const imageResponse = await call("GET", uploadedImage.json().imageUrl);
      assert.equal(imageResponse.statusCode, 200);
      assert.match(String(imageResponse.headers["content-type"]), /image\/webp/);
      assert.equal(
        (
          await call(
            "GET",
            "/portal/content?kind=exercise",
            login.accessToken,
          )
        )
          .json()
          .find((row: any) => row.id === exerciseId).data.imageUrl,
        uploadedImage.json().imageUrl,
      );
      assert.equal(
        (
          await call(
            "DELETE",
            `/portal/content/${exerciseId}`,
            admin.accessToken,
          )
        ).statusCode,
        204,
      );
      assert.equal(
        (
          await call("POST", "/portal/invitations", login.accessToken, {
            email: student.user.email,
            capabilities: ["nutrition.manage"],
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await call("POST", "/portal/invitations", login.accessToken, {
            email: student.user.email,
            capabilities: [
              "fitness.view",
              "fitness.manage",
              "nutrition.suggest",
              "nutrition.view",
            ],
          })
        ).statusCode,
        200,
      );
      const invitations = (
        await call("GET", "/me/professionals", student.accessToken)
      ).json();
      assert.equal(invitations.length, 1);
      const relation = invitations[0];
      assert.equal((await call('GET','/me/notifications')).statusCode,401);
      assert.equal((await call('GET','/me/notifications',other.accessToken)).json().unreadCount,0);
      const noticeResponse = await call('GET','/me/notifications',student.accessToken);
      assert.equal(noticeResponse.headers['cache-control'],'private, no-store');
      const notice = noticeResponse.json();
      assert.equal(notice.unreadCount,1); assert.equal(notice.items[0].id,relation.id);
      assert.equal((await call('PATCH',`/me/notifications/${relation.id}/read`)).statusCode,401);
      assert.equal((await call('PATCH',`/me/notifications/${relation.id}/read`,other.accessToken)).statusCode,404);
      assert.equal((await call('PATCH','/me/notifications/invalid/read',student.accessToken)).statusCode,400);
      assert.equal((await call('PATCH',`/me/notifications/${relation.id}/read`,student.accessToken)).statusCode,200);
      const read = (await call('GET','/me/notifications',student.accessToken)).json();
      assert.equal(read.unreadCount,0); assert.ok(read.items[0].readAt);
      await call('PATCH',`/me/notifications/${relation.id}/read`,student.accessToken);
      assert.equal((await call('GET','/me/notifications',student.accessToken)).json().items[0].readAt,read.items[0].readAt);
      // E-mail is not verified: an address registered only after the invitation cannot claim it; sending again reaches it.
      const lateEmail=`portal-late-${randomUUID()}@example.com`;
      assert.equal((await call('POST','/portal/invitations',login.accessToken,{email:lateEmail,capabilities:['fitness.view']})).statusCode,200);
      await new Promise(resolve=>setTimeout(resolve,1100)); // DATETIME columns keep whole seconds
      const late=(await call('POST','/auth/register',undefined,{email:lateEmail,password:'test-password-123',phone:'71999990000',firstName:'Tardio',lastName:'Teste'})).json();
      users.push(late.user.id);
      assert.deepEqual((await call('GET','/me/professionals',late.accessToken)).json(),[]);
      assert.equal((await call('GET','/me/notifications',late.accessToken)).json().unreadCount,0);
      const [lateInvite]=await db.query<{id:string}>('SELECT id FROM professional_relationships WHERE invited_email=?',{replacements:[lateEmail],type:QueryTypes.SELECT});
      assert.equal((await call('PATCH',`/me/notifications/${lateInvite.id}/read`,late.accessToken)).statusCode,404);
      assert.equal((await call('POST',`/me/professionals/${lateInvite.id}/consent`,late.accessToken,{action:'accept',capabilities:['fitness.view']})).statusCode,404);
      assert.equal((await call('POST','/portal/invitations',login.accessToken,{email:lateEmail,capabilities:['fitness.view']})).statusCode,200);
      assert.equal((await call('GET','/me/professionals',late.accessToken)).json()[0].id,lateInvite.id);
      await db.query('DELETE FROM professional_relationships WHERE id=?',{replacements:[lateInvite.id]}); // keeps the pagination counts below exact

      assert.equal(
        (
          await call(
            "POST",
            `/me/professionals/${relation.id}/consent`,
            other.accessToken,
            { action: "accept", capabilities: ["fitness.view"] },
          )
        ).statusCode,
        404,
      );
      assert.equal(
        (
          await call(
            "POST",
            `/me/professionals/${relation.id}/consent`,
            student.accessToken,
            { action: "accept", capabilities: ["nutrition.manage"] },
          )
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await call(
            "POST",
            `/me/professionals/${relation.id}/consent`,
            student.accessToken,
            {
              action: "accept",
              capabilities: [
                "fitness.view",
                "fitness.manage",
                "nutrition.suggest",
                "nutrition.view",
              ],
            },
          )
        ).statusCode,
        200,
      );
      assert.equal(
        await service.studentAccess(
          professional.id,
          relation.id,
          "fitness.manage",
        ),
        student.user.id,
      );
      const model = {
        kind: "workout",
        scope: "private",
        name: "Ficha profissional",
        data: {
          validityDays: 30,
          divisions: [
            {
              name: "Treino A",
              exercises: [
                {
                  name: "Agachamento",
                  sets: 3,
                  reps: "12",
                  load: null,
                  restSeconds: 60,
                  notes: "",
                },
              ],
            },
          ],
        },
      };
      const template = await call(
        "POST",
        "/portal/content",
        login.accessToken,
        model,
      );
      assert.equal(template.statusCode, 201, template.body);
      const templateId = template.json().id;
      assert.equal(
        (await call("GET", "/portal/content?kind=workout", other.accessToken))
          .statusCode,
        403,
      );
      // Scope is applied before the 200-row boundary and never grants another owner's private data.
      const globalModel = await call("POST", "/portal/content", admin.accessToken, { ...model, scope: "global", name: "Modelo global de teste" });
      assert.equal(globalModel.statusCode, 201, globalModel.body);
      const privateModels = await call("GET", "/portal/content?kind=workout&scope=private&offset=0", login.accessToken);
      assert.equal(privateModels.statusCode, 200);
      assert.ok(privateModels.json().some((row: any) => row.id === templateId));
      assert.ok(privateModels.json().every((row: any) => row.scope === "private" && row.ownerId === professional.id));
      const globalModels = (await call("GET", "/portal/content?kind=workout&scope=global", login.accessToken)).json();
      assert.ok(globalModels.some((row: any) => row.id === globalModel.json().id));
      assert.ok(globalModels.every((row: any) => row.scope === "global"));
      assert.deepEqual((await call("GET", "/portal/content?kind=workout&scope=private&offset=200", login.accessToken)).json(), []);
      assert.equal((await call("GET", "/portal/content?kind=workout&scope=other", login.accessToken)).statusCode, 400);
      assert.equal((await call("GET", "/portal/relationships?offset=-1", login.accessToken)).statusCode, 400);
      assert.equal((await call("GET", "/portal/relationships?offset=0")).statusCode, 401);
      assert.equal((await call("GET", "/portal/groups?offset=-1", admin.accessToken)).statusCode, 400);
      // A directory with more than 200 links is retrieved fully, without duplicate page boundaries.
      const extraLinks = Array.from({ length: 201 }, () => randomUUID());
      await db.query(`INSERT INTO professional_relationships (id,professional_id,invited_email,status,capabilities,expires_at,created_at,updated_at) VALUES ${extraLinks.map(() => "(?,?,?,'ended',JSON_ARRAY(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())").join(",")}`, {
        replacements: extraLinks.flatMap(id => [id, professional.id, `portal-${id}@example.com`]),
      });
      const firstPage = (await call("GET", "/portal/relationships?offset=0", login.accessToken)).json();
      const secondPage = (await call("GET", "/portal/relationships?offset=200", login.accessToken)).json();
      assert.equal(firstPage.length, 200);
      assert.equal(secondPage.length, 2);
      assert.equal(new Set([...firstPage, ...secondPage].map((row: any) => row.id)).size, 202);
      assert.ok([...firstPage, ...secondPage].every((row: any) => row.professionalId === professional.id));
      assert.deepEqual((await call("GET", "/portal/relationships?offset=0", admin.accessToken)).json(), []);
      const assignmentInput = {
        contentId: templateId,
        relationshipId: relation.id,
        mode: "manage",
        requestId: randomUUID(),
      };
      const assignment = await call(
        "POST",
        "/portal/assignments",
        login.accessToken,
        assignmentInput,
      );
      assert.equal(assignment.statusCode, 200, assignment.body);
      assert.equal(
        (
          await call(
            "POST",
            "/portal/assignments",
            login.accessToken,
            assignmentInput,
          )
        ).json().id,
        assignment.json().id,
      );
      const delivered = (
        await call("GET", "/me/professional-assignments", student.accessToken)
      ).json();
      assert.equal(delivered.length, 1);
      assert.ok(delivered[0].workoutPlanId);
      assert.equal(
        (
          await call("GET", "/me/professional-assignments", other.accessToken)
        ).json().length,
        0,
      );
      const replacement = await call(
        "POST",
        "/portal/assignments",
        login.accessToken,
        {
          ...assignmentInput,
          requestId: randomUUID(),
          replaceId: assignment.json().id,
        },
      );
      assert.equal(replacement.statusCode, 200, replacement.body);
      const [oldPlan] = await db.query<{ status: string }>(
        "SELECT status FROM workout_plans WHERE id=?",
        { replacements: [delivered[0].workoutPlanId], type: QueryTypes.SELECT },
      );
      assert.equal(oldPlan.status, "archived");
      const diet = {
        kind: "diet",
        scope: "private",
        name: "Dieta teste",
        data: {
          objective: "Planejamento",
          validityDays: 30,
          notes: "Orientação de teste",
          meals: [
            {
              name: "Almoço",
              time: "12:00",
              items: [
                {
                  food: {
                    name: "Arroz",
                    servingAmount: 100,
                    servingUnit: "g",
                    calories: 130,
                    protein: 3,
                    carbs: 28,
                    fat: 0,
                    notes: "",
                  },
                  quantity: 150,
                  substitutions: "Batata em porção equivalente",
                },
              ],
            },
          ],
        },
      };
      const dietTemplate = await call(
        "POST",
        "/portal/content",
        login.accessToken,
        diet,
      );
      assert.equal(dietTemplate.statusCode, 201, dietTemplate.body);
      const meal = diet.data.meals[0];
      const withOptions = {...diet,data:{...diet.data,meals:[{...meal,options:[{name:'Personalizado B',items:meal.items},{name:'Personalizado C',items:meal.items}]}]}};
      const savedOptions=await call('PUT',`/portal/content/${dietTemplate.json().id}`,login.accessToken,{revision:1,content:withOptions});
      assert.equal(savedOptions.statusCode,200,savedOptions.body);
      const storedDiet=(await call('GET','/portal/content?kind=diet',login.accessToken)).json().find((item:{id:string})=>item.id===dietTemplate.json().id);
      assert.deepEqual(storedDiet.data.meals[0].options.map((option:{name:string})=>option.name),['Almoço B','Almoço C']);
      const overLimit={...withOptions,data:{...withOptions.data,meals:[{...meal,options:[...withOptions.data.meals[0].options,{name:'Quarta opção',items:meal.items}]}]}};
      assert.equal((await call('PUT',`/portal/content/${dietTemplate.json().id}`,login.accessToken,{revision:storedDiet.revision,content:overLimit})).statusCode,400);
      assert.equal((await call('POST','/portal/content',undefined,withOptions)).statusCode,401);
      assert.equal((await call('POST','/portal/content',other.accessToken,withOptions)).statusCode,403);
      const dietAssignment = await call(
        "POST",
        "/portal/assignments",
        login.accessToken,
        {
          contentId: dietTemplate.json().id,
          relationshipId: relation.id,
          mode: "suggest",
          requestId: randomUUID(),
        },
      );
      assert.equal(dietAssignment.statusCode, 200, dietAssignment.body);
      assert.equal(dietAssignment.json().status, "pending");
      assert.equal(
        (
          await call(
            "POST",
            `/me/professional-assignments/${dietAssignment.json().id}/respond`,
            other.accessToken,
            { accept: true },
          )
        ).statusCode,
        404,
      );
      assert.equal(
        (
          await call(
            "POST",
            `/me/professional-assignments/${dietAssignment.json().id}/respond`,
            student.accessToken,
            { accept: true },
          )
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await call(
            "POST",
            `/me/professional-assignments/${dietAssignment.json().id}/respond`,
            student.accessToken,
            { accept: true },
          )
        ).statusCode,
        404,
      );
      const edited = await call(
        "PUT",
        `/portal/content/${templateId}`,
        login.accessToken,
        { revision: 1, content: { ...model, name: "Ficha editada" } },
      );
      assert.equal(edited.statusCode, 200, edited.body);
      assert.equal(
        (await call("GET", "/me/professional-assignments", student.accessToken))
          .json()
          .find((row: any) => row.id === assignment.json().id).snapshot.name,
        "Ficha profissional",
      );
      assert.equal(
        (
          await call(
            "PUT",
            `/portal/content/${templateId}`,
            login.accessToken,
            { revision: 1, content: model },
          )
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await call(
            "GET",
            `/portal/relationships/${relation.id}/progress?area=body&from=2026-01-01&to=2026-01-02`,
            login.accessToken,
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await call(
            "POST",
            `/me/professionals/${relation.id}/consent`,
            student.accessToken,
            { action: "reduce", capabilities: ["fitness.view"] },
          )
        ).statusCode,
        200,
      );
      await assert.rejects(() =>
        service.studentAccess(professional.id, relation.id, "fitness.manage"),
      );
      assert.equal(
        (
          await call(
            "POST",
            `/me/professionals/${relation.id}/consent`,
            student.accessToken,
            { action: "revoke", capabilities: [] },
          )
        ).statusCode,
        200,
      );
      await assert.rejects(() =>
        service.studentAccess(professional.id, relation.id, "fitness.view"),
      );
      assert.equal(
        (
          await call("GET", "/me/professional-assignments", student.accessToken)
        ).json().length,
        3,
      );
      assert.equal(
        (
          await call("POST", "/portal/assignments", login.accessToken, {
            ...assignmentInput,
            requestId: randomUUID(),
          })
        ).statusCode,
        403,
      );
      assert.equal((await call("GET", "/portal/groups?offset=0", login.accessToken)).statusCode, 403);
      await db.query("UPDATE professional_types SET capabilities=JSON_ARRAY_APPEND(capabilities,'$','groups.manage') WHERE id=?", { replacements: [typeId] });
      await db.query("UPDATE portal_accounts SET capabilities=JSON_ARRAY_APPEND(capabilities,'$','groups.manage') WHERE user_id=?", { replacements: [professional.id] });
      const ownedGroup = await call("POST", "/portal/groups", login.accessToken, { name: "Grupo do profissional", description: "Teste de isolamento" });
      assert.equal(ownedGroup.statusCode, 200, ownedGroup.body);
      const manageableGroups = (await call("GET", "/portal/groups?offset=0", login.accessToken)).json();
      assert.equal(manageableGroups.length, 1);
      assert.equal(manageableGroups[0].id, ownedGroup.json().id);
      assert.equal(manageableGroups[0].ownerId, professional.id);
      assert.deepEqual((await call("GET", "/portal/groups?offset=200", login.accessToken)).json(), []);
      assert.equal((await call("GET", `/portal/groups/${groupId}/members`, login.accessToken)).statusCode, 403);
      const suspended = await call(
        "PATCH",
        `/portal/professionals/${professional.id}`,
        admin.accessToken,
        { ...input, typeId, capabilities: ["fitness.view"], suspended: true },
      );
      assert.equal(suspended.statusCode, 200, suspended.body);
      assert.equal(
        (await call("GET", "/portal/profile", login.accessToken)).statusCode,
        401,
      );
      const [audit] = await db.query<{ total: number }>(
        "SELECT COUNT(*) total FROM portal_audit WHERE actor_id=?",
        { replacements: [admin.user.id], type: QueryTypes.SELECT },
      );
      assert.ok(audit.total >= 2);
    } finally {
      await app?.close();
      for (const user of users) {
        await db.query('DELETE FROM `groups` WHERE owner_user_id=?',{replacements:[user]});
        await db.query(
          "DELETE FROM professional_assignments WHERE author_id=? OR student_id=?",
          { replacements: [user, user] },
        );
        await db.query("DELETE FROM portal_content_versions WHERE actor_id=?", {
          replacements: [user],
        });
        await db.query("DELETE FROM portal_content WHERE owner_id=?", {
          replacements: [user],
        });
        await db.query('DELETE FROM exercises WHERE owner_user_id=?',{replacements:[user]});
        await db.query("DELETE FROM professional_consents WHERE actor_id=?", {
          replacements: [user],
        });
        await db.query(
          "DELETE FROM professional_relationships WHERE professional_id=? OR student_id=?",
          { replacements: [user, user] },
        );
        await db.query("DELETE FROM portal_audit WHERE actor_id=?", {
          replacements: [user],
        });
        await db.query("DELETE FROM users WHERE id=?", {
          replacements: [user],
        });
      }
      await db.query("DELETE FROM professional_types WHERE id=?", {
        replacements: [typeId],
      });
      await db.close();
    }
  },
);
