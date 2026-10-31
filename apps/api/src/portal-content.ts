import { randomUUID } from "node:crypto";
import { QueryTypes, type Transaction } from "sequelize";
import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createWorkoutPlanSchema,
  portalAssignmentInputSchema,
  portalContentInputSchema,
  portalContentSnapshotSchema,
  type PortalContentInput,
} from "@fit/contracts";
import {
  ProfessionalManagement,
  PortalError,
  json,
} from "./professional-management.js";
import { WorkoutRepository } from "./workout-repository.js";
import { NutritionRepository } from "./nutrition-repository.js";
import { MentalWellbeingRepository } from "./mental-wellbeing-repository.js";
import { GroupRepository } from "./group-repository.js";
import { processExerciseImage } from "./exercise-image.js";
import { readMedia, removeMedia, saveMedia } from "./media-storage.js";

const exerciseImageUrl = (key: string | null | undefined) =>
  key ? `/media/exercises/${key}` : null;

export const areaFor = (kind: string) =>
  ["food", "diet"].includes(kind)
    ? "nutrition"
    : kind === "guidance"
      ? "mental"
      : "fitness";
export class PortalContentService {
  constructor(public management: ProfessionalManagement) {}
  get db() {
    return this.management.db;
  }
  async groupAccess(actor: string, id: string, t?: Transaction) {
    const account = await this.management.require(actor, false, t);
    const [row] = await this.db.query<any>(
      "SELECT id,name,owner_user_id,active FROM `groups` WHERE id=?" +
        (t ? " FOR UPDATE" : ""),
      { replacements: [id], type: QueryTypes.SELECT, transaction: t },
    );
    if (!row) throw new PortalError(404, "Grupo não encontrado.");
    if (
      account.role !== "admin" &&
      (!account.capabilities.includes("groups.manage") ||
        row.owner_user_id !== actor)
    )
      throw new PortalError(403, "Sem permissão para este grupo.");
    return row;
  }
  async editable(actor: string, kind: string, scope: string, t?: Transaction) {
    const account = await this.management.require(actor, false, t);
    if (scope === "global" && account.role !== "admin")
      throw new PortalError(
        403,
        "Somente administradores podem publicar no catálogo global.",
      );
    if (
      account.role !== "admin" &&
      !account.capabilities.some((cap) => cap.startsWith(`${areaFor(kind)}.`))
    )
      throw new PortalError(403, "Seu perfil não possui acesso a esta área.");
    return account;
  }
  async content(actor: string, id: string, t?: Transaction) {
    const [row] = await this.db.query<any>(
      "SELECT pc.id,pc.owner_id ownerId,pc.kind,pc.scope,pc.name,pc.data,pc.revision,pc.archived,pc.updated_at updatedAt,(SELECT e.image_url FROM exercises e WHERE e.id=pc.id) imageKey FROM portal_content pc WHERE pc.id=? AND (pc.owner_id=? OR pc.scope='global')" +
        (t ? " FOR UPDATE" : ""),
      { replacements: [id, actor], type: QueryTypes.SELECT, transaction: t },
    );
    if (!row) throw new PortalError(404, "Conteúdo não encontrado.");
    const data = json(row.data);
    return {
      ...row,
      data:
        row.kind === "exercise"
          ? { ...data, imageUrl: exerciseImageUrl(row.imageKey) }
          : data,
      archived: Boolean(row.archived),
    };
  }
  async list(actor: string, kind: string) {
    await this.editable(actor, kind, "private");
    const rows = await this.db.query<any>(
      "SELECT pc.id,pc.owner_id ownerId,pc.kind,pc.scope,pc.name,pc.data,pc.revision,pc.archived,pc.updated_at updatedAt,e.image_url imageKey FROM portal_content pc LEFT JOIN exercises e ON e.id=pc.id WHERE pc.kind=? AND (pc.owner_id=? OR pc.scope='global') ORDER BY pc.archived,pc.updated_at DESC LIMIT 200",
      { replacements: [kind, actor], type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({
      ...row,
      data:
        row.kind === "exercise"
          ? { ...json(row.data), imageUrl: exerciseImageUrl(row.imageKey) }
          : json(row.data),
      archived: Boolean(row.archived),
    }));
  }
  async setExerciseImage(
    actor: string,
    target: string,
    imageDataUrl: string | null,
  ) {
    const row = await this.content(actor, target);
    if (row.kind !== "exercise")
      throw new PortalError(400, "A imagem só pode ser anexada a um exercício.");
    const account = await this.editable(actor, row.kind, row.scope);
    if (
      row.ownerId !== actor &&
      !(row.scope === "global" && account.role === "admin")
    )
      throw new PortalError(403, "Sem permissão para alterar este exercício.");

    let nextKey: string | null = null;
    if (imageDataUrl) {
      let processed: Buffer;
      try {
        processed = await processExerciseImage(imageDataUrl);
      } catch {
        throw new PortalError(
          400,
          "Envie uma imagem JPEG, PNG ou WebP válida de até 8 MB.",
        );
      }
      nextKey = await saveMedia(processed);
    }

    let previousKey: string | null = null;
    try {
      await this.db.transaction(async (t) => {
        const [exercise] = await this.db.query<{ image_url: string | null }>(
          "SELECT image_url FROM exercises WHERE id=? FOR UPDATE",
          { replacements: [target], type: QueryTypes.SELECT, transaction: t },
        );
        if (!exercise)
          throw new PortalError(404, "Exercício não encontrado.");
        previousKey = exercise.image_url;
        await this.db.query(
          "UPDATE exercises SET image_url=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          { replacements: [nextKey, target], transaction: t },
        );
        await this.management.audit(actor, "exercise.image.updated", target, t);
      });
    } catch (error) {
      if (nextKey) await removeMedia(nextKey).catch(() => {});
      throw error;
    }
    if (previousKey && previousKey !== nextKey)
      await removeMedia(previousKey).catch(() => {});
    return { imageUrl: exerciseImageUrl(nextKey) };
  }
  async save(
    actor: string,
    input: PortalContentInput,
    target?: string,
    revision?: number,
  ) {
    input = portalContentInputSchema.parse(input);
    return this.db.transaction(async (t) => {
      const account = await this.editable(actor, input.kind, input.scope, t);
      const id = target || randomUUID();
      let next = 1;
      if (target) {
        const old = await this.content(actor, target, t);
        if (old.kind !== input.kind)
          throw new PortalError(
            400,
            "Não é possível alterar a categoria do conteúdo.",
          );
        if (
          old.ownerId !== actor &&
          !(old.scope === "global" && account.role === "admin")
        )
          throw new PortalError(
            403,
            "Este conteúdo pertence a outro profissional.",
          );
        if (old.revision !== revision)
          throw new PortalError(
            409,
            "Conteúdo alterado por outra sessão. Recarregue antes de salvar.",
          );
        next = Number(old.revision) + 1;
        await this.db.query(
          "UPDATE portal_content SET scope=?,name=?,data=?,revision=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          {
            replacements: [
              input.scope,
              input.name,
              JSON.stringify(input.data),
              next,
              id,
            ],
            transaction: t,
          },
        );
      } else
        await this.db.query(
          "INSERT INTO portal_content (id,owner_id,kind,scope,name,data,revision,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,1,FALSE,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
          {
            replacements: [
              id,
              actor,
              input.kind,
              input.scope,
              input.name,
              JSON.stringify(input.data),
            ],
            transaction: t,
          },
        );
      await this.db.query(
        "INSERT INTO portal_content_versions (id,content_id,revision,snapshot,actor_id,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())",
        {
          replacements: [randomUUID(), id, next, JSON.stringify(input), actor],
          transaction: t,
        },
      );
      if (input.kind === "exercise")
        await this.db.query(
          "INSERT INTO exercises (id,owner_user_id,name,source,category,equipment,primary_muscle,created_at,updated_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id),name=VALUES(name),source=VALUES(source),category=VALUES(category),equipment=VALUES(equipment),primary_muscle=VALUES(primary_muscle),updated_at=UTC_TIMESTAMP()",
          {
            replacements: [
              id,
              input.scope === "global" ? null : actor,
              input.name,
              input.scope === "global" ? "catalog" : "custom",
              input.data.category,
              input.data.equipment,
              input.data.primaryMuscle,
            ],
            transaction: t,
          },
        );
      await this.management.audit(
        actor,
        target ? "content.updated" : "content.created",
        id,
        t,
      );
      return { id, revision: next };
    });
  }
  async materialize(student: string, assignment: any, t: Transaction) {
    const snapshot = portalContentSnapshotSchema.parse(json(assignment.snapshot));
    if (snapshot.kind === "workout") {
      const input = createWorkoutPlanSchema.parse({
        name: snapshot.name,
        ...snapshot.data,
      });
      // All exercises are snapshots: a private library item never grants another user's exercise ID.
      const result = await new WorkoutRepository(this.db).createPlan(
        student,
        input,
        t,
        assignment.author_id,
      );
      if (result === "limit")
        throw new PortalError(
          409,
          "O aluno já possui 3 fichas disponíveis. Ele precisa arquivar uma antes de receber outra.",
        );
      await this.db.query(
        "UPDATE professional_assignments SET workout_plan_id=? WHERE id=?",
        { replacements: [result, assignment.id], transaction: t },
      );
    } else if (snapshot.kind === "goal") {
      const days = snapshot.data.weekdays;
      if (days.length && days.length !== snapshot.data.weeklyTarget)
        throw new PortalError(
          400,
          "A quantidade de dias deve corresponder à meta semanal.",
        );
      await this.db.query(
        "INSERT INTO workout_goals (id,user_id,weekly_target,mode,schedule,created_at,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE weekly_target=VALUES(weekly_target),mode=VALUES(mode),schedule=VALUES(schedule),updated_at=UTC_TIMESTAMP()",
        {
          replacements: [
            randomUUID(),
            student,
            snapshot.data.weeklyTarget,
            days.length ? "planned" : "flexible",
            JSON.stringify(
              days.map((weekday) => ({ weekday, divisionId: null })),
            ),
          ],
          transaction: t,
        },
      );
    }
  }
  async supersede(assignment: any, t: Transaction) {
    if (assignment.replace_workout_plan_id) {
      if (assignment.kind !== "workout")
        throw new PortalError(
          400,
          "Apenas uma ficha pode substituir outra ficha.",
        );
      const [plan] = await this.db.query(
        "SELECT id FROM workout_plans WHERE id=? AND user_id=? AND status='available' FOR UPDATE",
        {
          replacements: [
            assignment.replace_workout_plan_id,
            assignment.student_id,
          ],
          type: QueryTypes.SELECT,
          transaction: t,
        },
      );
      if (!plan)
        throw new PortalError(
          409,
          "A ficha anterior já foi arquivada ou não pertence ao aluno.",
        );
      await this.db.query(
        "UPDATE workout_plans SET status='archived',is_active=FALSE,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?",
        {
          replacements: [
            assignment.replace_workout_plan_id,
            assignment.student_id,
          ],
          transaction: t,
        },
      );
      await this.db.query(
        "UPDATE professional_assignments SET status='superseded',updated_at=UTC_TIMESTAMP() WHERE workout_plan_id=? AND student_id=? AND status='active'",
        {
          replacements: [
            assignment.replace_workout_plan_id,
            assignment.student_id,
          ],
          transaction: t,
        },
      );
    }
    if (!assignment.replace_id) return;
    const [previous] = await this.db.query<any>(
      "SELECT id,workout_plan_id FROM professional_assignments WHERE id=? AND student_id=? AND author_id=? AND kind=? AND status='active' FOR UPDATE",
      {
        replacements: [
          assignment.replace_id,
          assignment.student_id,
          assignment.author_id,
          assignment.kind,
        ],
        type: QueryTypes.SELECT,
        transaction: t,
      },
    );
    if (!previous)
      throw new PortalError(
        409,
        "O plano anterior já foi substituído ou não pertence a este vínculo.",
      );
    await this.db.query(
      "UPDATE professional_assignments SET status='superseded',updated_at=UTC_TIMESTAMP() WHERE id=?",
      { replacements: [previous.id], transaction: t },
    );
    if (previous.workout_plan_id)
      await this.db.query(
        "UPDATE workout_plans SET status='archived',is_active=FALSE,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?",
        {
          replacements: [previous.workout_plan_id, assignment.student_id],
          transaction: t,
        },
      );
  }
  async assign(
    actor: string,
    input: z.infer<typeof portalAssignmentInputSchema>,
  ) {
    return this.db.transaction(async (t) => {
      const source = await this.content(actor, input.contentId, t);
      if (
        source.archived ||
        !["workout", "diet", "goal", "guidance"].includes(source.kind)
      )
        throw new PortalError(
          400,
          "Selecione um modelo ativo de ficha, dieta, meta ou orientação.",
        );
      const student = await this.management.studentAccess(
        actor,
        input.relationshipId,
        `${areaFor(source.kind)}.${input.mode}`,
        t,
      );
      const [existing] = await this.db.query<any>(
        "SELECT id,author_id FROM professional_assignments WHERE request_id=? FOR UPDATE",
        {
          replacements: [input.requestId],
          type: QueryTypes.SELECT,
          transaction: t,
        },
      );
      if (existing) {
        if (existing.author_id !== actor)
          throw new PortalError(409, "Requisição já utilizada.");
        return { id: existing.id };
      }
      const snapshot = portalContentInputSchema.parse({
        kind: source.kind,
        scope: source.scope,
        name: source.name,
        data: source.data,
      });
      const id = randomUUID(),
        status = input.mode === "suggest" ? "pending" : "active";
      const row = {
        id,
        student_id: student,
        author_id: actor,
        kind: source.kind,
        replace_id: input.replaceId || null,
        replace_workout_plan_id: input.replaceWorkoutPlanId || null,
        snapshot,
      };
      await this.db.query(
        "INSERT INTO professional_assignments (id,author_id,student_id,relationship_id,kind,status,source_id,source_revision,snapshot,replace_id,request_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        {
          replacements: [
            id,
            actor,
            student,
            input.relationshipId,
            source.kind,
            status,
            source.id,
            source.revision,
            JSON.stringify(snapshot),
            input.replaceId || null,
            input.requestId,
          ],
          transaction: t,
        },
      );
      if (input.replaceWorkoutPlanId)
        await this.db.query(
          "UPDATE professional_assignments SET replace_workout_plan_id=? WHERE id=?",
          { replacements: [input.replaceWorkoutPlanId, id], transaction: t },
        );
      if (status === "active") {
        await this.supersede(row, t);
        await this.materialize(student, row, t);
      }
      await this.management.audit(actor, `assignment.${status}`, id, t);
      return { id, status };
    });
  }
  async assignments(actor: string, relationship?: string) {
    const rows = await this.db.query<any>(
      `SELECT a.id,a.author_id authorId,CONCAT(u.first_name,' ',u.last_name) authorName,a.student_id studentId,a.relationship_id relationshipId,a.kind,a.status,a.source_id sourceId,a.source_revision sourceRevision,a.snapshot,a.workout_plan_id workoutPlanId,a.created_at createdAt FROM professional_assignments a JOIN users u ON u.id=a.author_id WHERE ${relationship ? "a.relationship_id=? AND a.author_id=?" : "a.student_id=?"} ORDER BY a.created_at DESC LIMIT 200`,
      {
        replacements: relationship ? [relationship, actor] : [actor],
        type: QueryTypes.SELECT,
      },
    );
    if (relationship) {
      const allowed = [];
      for (const row of rows) {
        try {
          await this.management.studentAccess(
            actor,
            relationship,
            `${areaFor(row.kind)}.view`,
          );
          allowed.push(row);
        } catch {
          try {
            await this.management.studentAccess(
              actor,
              relationship,
              `${areaFor(row.kind)}.manage`,
            );
            allowed.push(row);
          } catch {
            try {
              await this.management.studentAccess(
                actor,
                relationship,
                `${areaFor(row.kind)}.suggest`,
              );
              allowed.push(row);
            } catch {}
          }
        }
      }
      return allowed.map((row) => ({ ...row, snapshot: json(row.snapshot) }));
    }
    return rows.map((row) => ({ ...row, snapshot: json(row.snapshot) }));
  }
}

export async function registerPortalContent(
  app: FastifyInstance,
  service: PortalContentService,
  secure: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  const run =
    (fn: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        return await fn(req, reply);
      } catch (error) {
        if (error instanceof PortalError)
          return reply
            .code(error.status)
            .send({
              code: error.status === 403 ? "FORBIDDEN" : "INVALID_INPUT",
              message: error.message,
            });
        throw error;
      }
    };
  const id = (req: FastifyRequest) =>
    z.strictObject({ id: z.uuid() }).parse(req.params).id;
  app.get("/media/exercises/:key", async (req, reply) => {
    const { key } = z
      .strictObject({ key: z.string().regex(/^[a-f0-9-]{36}\.webp$/) })
      .parse(req.params);
    try {
      return reply
        .header("content-type", "image/webp")
        .header("cache-control", "public, max-age=86400, immutable")
        .header("x-content-type-options", "nosniff")
        .send(await readMedia(key));
    } catch {
      return reply.code(404).send({
        code: "NOT_FOUND",
        message: "Imagem não encontrada.",
      });
    }
  });
  app.get(
    "/portal/content",
    { preHandler: secure },
    run((req) => {
      const { kind } = z
        .strictObject({
          kind: z.enum([
            "food",
            "exercise",
            "equipment",
            "category",
            "workout",
            "diet",
            "goal",
            "guidance",
          ]),
        })
        .parse(req.query);
      return service.list(req.user.sub, kind);
    }),
  );
  app.post(
    "/portal/content",
    { preHandler: secure },
    run(async (req, reply) =>
      reply
        .code(201)
        .send(
          await service.save(
            req.user.sub,
            portalContentInputSchema.parse(req.body),
          ),
        ),
    ),
  );
  app.put(
    "/portal/content/:id",
    { preHandler: secure },
    run((req) => {
      const { revision, content } = z
        .strictObject({
          revision: z.number().int().positive(),
          content: portalContentInputSchema,
        })
        .parse(req.body);
      return service.save(req.user.sub, content, id(req), revision);
    }),
  );
  app.put(
    "/portal/content/:id/image",
    {
      preHandler: secure,
      bodyLimit: 11_500_000,
      config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
    },
    run((req) => {
      const { imageDataUrl } = z
        .strictObject({
          imageDataUrl: z.string().max(11_000_000).nullable(),
        })
        .parse(req.body);
      return service.setExerciseImage(req.user.sub, id(req), imageDataUrl);
    }),
  );
  app.patch(
    "/portal/content/:id/archive",
    { preHandler: secure },
    run(async (req) => {
      const { archived } = z
        .strictObject({ archived: z.boolean() })
        .parse(req.body);
      await service.db.transaction(async (t) => {
        const row = await service.content(req.user.sub, id(req), t);
        const account = await service.editable(
          req.user.sub,
          row.kind,
          row.scope,
          t,
        );
        if (
          row.ownerId !== req.user.sub &&
          !(row.scope === "global" && account.role === "admin")
        )
          throw new PortalError(403, "Sem permissão para este conteúdo.");
        await service.db.query(
          "UPDATE portal_content SET archived=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          { replacements: [archived, row.id], transaction: t },
        );
        await service.management.audit(
          req.user.sub,
          archived ? "content.archived" : "content.restored",
          row.id,
          t,
        );
      });
      return { ok: true };
    }),
  );
  app.delete(
    "/portal/content/:id",
    { preHandler: secure },
    run(async (req, reply) => {
      const target = id(req);
      let imageKey: string | null = null;
      await service.db.transaction(async (t) => {
        const account = await service.management.require(req.user.sub, false, t);
        const row = await service.content(req.user.sub, target, t);
        if (row.ownerId !== req.user.sub && !(row.scope === "global" && account.role === "admin"))
          throw new PortalError(403, "Este conteúdo pertence a outro profissional.");
        const [assignment] = await service.db.query(
          "SELECT id FROM professional_assignments WHERE source_id=? LIMIT 1",
          { replacements: [target], type: QueryTypes.SELECT, transaction: t },
        );
        if (assignment)
          throw new PortalError(409, "Este cadastro já foi usado em um plano. Desative-o em vez de excluir.");
        if (row.kind === "exercise") {
          const [exercise] = await service.db.query<{ image_url: string | null }>(
            "SELECT image_url FROM exercises WHERE id=? LIMIT 1",
            { replacements: [target], type: QueryTypes.SELECT, transaction: t },
          );
          imageKey = exercise?.image_url ?? null;
          const [suggestion] = await service.db.query(
            "SELECT id FROM suggested_workout_exercises WHERE exercise_id=? LIMIT 1",
            { replacements: [target], type: QueryTypes.SELECT, transaction: t },
          );
          if (suggestion)
            throw new PortalError(409, "Este exercício faz parte de uma sugestão de treino. Desative-o em vez de excluir.");
        }
        if (row.kind === "workout") {
          const [suggestion] = await service.db.query(
            "SELECT id FROM suggested_workout_plans WHERE id=? LIMIT 1",
            { replacements: [target], type: QueryTypes.SELECT, transaction: t },
          );
          if (suggestion)
            throw new PortalError(
              409,
              "Esta ficha pertence ao catálogo de sugestões. Desative-a em vez de excluir.",
            );
        }
        await service.db.query("DELETE FROM portal_content_versions WHERE content_id=?", {
          replacements: [target], transaction: t,
        });
        await service.db.query("DELETE FROM portal_content WHERE id=?", {
          replacements: [target], transaction: t,
        });
        if (row.kind === "exercise")
          await service.db.query("DELETE FROM exercises WHERE id=?", {
            replacements: [target], transaction: t,
          });
        await service.management.audit(req.user.sub, "content.deleted", target, t);
      });
      if (imageKey) await removeMedia(imageKey).catch(() => {});
      return reply.code(204).send();
    }),
  );
  app.get(
    "/portal/content/:id/versions",
    { preHandler: secure },
    run(async (req) => {
      const row = await service.content(req.user.sub, id(req));
      await service.editable(req.user.sub, row.kind, "private");
      return service.db
        .query(
          "SELECT revision,snapshot,created_at createdAt FROM portal_content_versions WHERE content_id=? ORDER BY revision DESC LIMIT 100",
          { replacements: [row.id], type: QueryTypes.SELECT },
        )
        .then((rows: any[]) =>
          rows.map((row) => ({ ...row, snapshot: json(row.snapshot) })),
        );
    }),
  );
  app.post(
    "/portal/assignments",
    { preHandler: secure },
    run((req) =>
      service.assign(req.user.sub, portalAssignmentInputSchema.parse(req.body)),
    ),
  );
  app.get(
    "/portal/relationships/:id/assignments",
    { preHandler: secure },
    run(async (req) => {
      await service.management.require(req.user.sub);
      return service.assignments(req.user.sub, id(req));
    }),
  );
  app.get(
    "/me/professional-assignments",
    { preHandler: secure },
    run((req) => service.assignments(req.user.sub)),
  );
  app.post(
    "/me/professional-assignments/:id/respond",
    { preHandler: secure },
    run(async (req) => {
      const { accept } = z
        .strictObject({ accept: z.boolean() })
        .parse(req.body);
      return service.db.transaction(async (t) => {
        const [row] = await service.db.query<any>(
          "SELECT * FROM professional_assignments WHERE id=? AND student_id=? AND status='pending' FOR UPDATE",
          {
            replacements: [id(req), req.user.sub],
            type: QueryTypes.SELECT,
            transaction: t,
          },
        );
        if (!row)
          throw new PortalError(
            404,
            "Sugestão não encontrada ou já respondida.",
          );
        if (accept) {
          await service.management.studentAccess(
            row.author_id,
            row.relationship_id,
            `${areaFor(row.kind)}.suggest`,
            t,
          );
          await service.supersede(row, t);
          await service.materialize(req.user.sub, row, t);
        }
        await service.db.query(
          "UPDATE professional_assignments SET status=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          {
            replacements: [accept ? "active" : "declined", row.id],
            transaction: t,
          },
        );
        await service.management.audit(
          req.user.sub,
          accept ? "assignment.accepted" : "assignment.declined",
          row.id,
          t,
        );
        return { ok: true };
      });
    }),
  );
  app.get(
    "/portal/relationships/:id/progress",
    { preHandler: secure },
    run(async (req) => {
      const { area, from, to } = z
        .strictObject({
          area: z.enum(["fitness", "nutrition", "body", "mental"]),
          from: z.string().date(),
          to: z.string().date(),
        })
        .parse(req.query);
      if (
        from > to ||
        new Date(to).getTime() - new Date(from).getTime() > 366 * 86400000
      )
        throw new PortalError(400, "Selecione um período de até 366 dias.");
      const student = await service.management.studentAccess(
        req.user.sub,
        id(req),
        `${area}.view`,
      );
      // Only the explicitly requested and consented area is returned.
      if (area === "fitness") {
        const workouts = new WorkoutRepository(service.db);
        return {
          plans: await workouts.listPlans(student),
          sessions: (await workouts.listSessions(student)).filter(
            (item) => item.performedOn >= from && item.performedOn <= to,
          ),
          goal: await workouts.getGoalSummary(student, to),
        };
      }
      if (area === "body")
        return {
          measurements: (
            await new NutritionRepository(service.db).listMeasurements(student)
          ).filter((item) => item.date >= from && item.date <= to),
        };
      if (area === "mental")
        return {
          checkIns: await new MentalWellbeingRepository(service.db).list(
            student,
            from,
            to,
          ),
        };
      const nutrition = new NutritionRepository(service.db);
      return { meals: await nutrition.listMeals(student, to), date: to };
    }),
  );
  const groups = new GroupRepository(service.db);
  app.get(
    "/portal/groups/:id/members",
    { preHandler: secure },
    run(async (req) => {
      await service.groupAccess(req.user.sub, id(req));
      return service.db.query(
        "SELECT u.id,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,m.role FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.status='active' ORDER BY m.role,u.first_name LIMIT 500",
        { replacements: [id(req)], type: QueryTypes.SELECT },
      );
    }),
  );
  app.patch(
    "/portal/groups/:id/members",
    { preHandler: secure },
    run(async (req) => {
      const input = z
        .strictObject({
          userId: z.uuid(),
          action: z.enum(["role", "remove"]),
          role: z.enum(["admin", "moderator", "member"]).optional(),
        })
        .parse(req.body);
      await service.db.transaction(async (t) => {
        await service.groupAccess(req.user.sub, id(req), t);
        const [member] = await service.db.query<any>(
          "SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='active' FOR UPDATE",
          {
            replacements: [id(req), input.userId],
            type: QueryTypes.SELECT,
            transaction: t,
          },
        );
        if (!member) throw new PortalError(404, "Membro não encontrado.");
        if (member.role === "owner")
          throw new PortalError(
            409,
            "O proprietário não pode ser removido ou rebaixado por esta ação.",
          );
        if (input.action === "role") {
          if (!input.role) throw new PortalError(400, "Selecione um papel.");
          await service.db.query(
            "UPDATE group_members SET role=?,updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
            {
              replacements: [input.role, id(req), input.userId],
              transaction: t,
            },
          );
        } else
          await service.db.query(
            "UPDATE group_members SET status='removed',left_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
            { replacements: [id(req), input.userId], transaction: t },
          );
        await service.management.audit(
          req.user.sub,
          `group.member_${input.action}`,
          input.userId,
          t,
        );
      });
      return { ok: true };
    }),
  );
  app.post(
    "/portal/groups/:id/invites",
    {
      preHandler: secure,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    run(async (req) => {
      const { username } = z
        .strictObject({ username: z.string().trim().min(3).max(30) })
        .parse(req.body);
      await service.db.transaction(async (t) => {
        const group = await service.groupAccess(req.user.sub, id(req), t);
        if (!group.active)
          throw new PortalError(409, "Reative o grupo antes de convidar.");
        const [user] = await service.db.query<{ id: string }>(
          "SELECT id FROM users WHERE username=?",
          { replacements: [username], type: QueryTypes.SELECT, transaction: t },
        );
        if (!user) throw new PortalError(404, "Usuário não encontrado.");
        const [existing] = await service.db.query(
          "SELECT id FROM group_members WHERE group_id=? AND user_id=? AND status='active'",
          {
            replacements: [group.id, user.id],
            type: QueryTypes.SELECT,
            transaction: t,
          },
        );
        const [pending] = await service.db.query(
          "SELECT id FROM group_invites WHERE group_id=? AND invited_user_id=? AND status='pending' AND expires_at>UTC_TIMESTAMP(6)",
          {
            replacements: [group.id, user.id],
            type: QueryTypes.SELECT,
            transaction: t,
          },
        );
        if (existing || pending)
          throw new PortalError(
            409,
            "Este usuário já é membro ou possui um convite pendente.",
          );
        await service.db.query(
          "INSERT INTO group_invites (id,group_id,invited_user_id,invited_by_user_id,status,expires_at,created_at,updated_at) VALUES (?,?,?,?,'pending',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 14 DAY),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
          {
            replacements: [randomUUID(), group.id, user.id, req.user.sub],
            transaction: t,
          },
        );
        await service.db.query(
          "INSERT INTO group_notifications (id,user_id,type,title,message,group_id,created_at) VALUES (?,?,'invite','Novo convite',?,?,UTC_TIMESTAMP(6))",
          {
            replacements: [
              randomUUID(),
              user.id,
              `Você foi convidado para ${group.name}.`,
              group.id,
            ],
            transaction: t,
          },
        );
        await service.management.audit(
          req.user.sub,
          "group.invited",
          group.id,
          t,
        );
      });
      return { ok: true };
    }),
  );
  app.get(
    "/portal/groups",
    { preHandler: secure },
    run(async (req) => {
      const account = await service.management.require(req.user.sub);
      if (account.role === "admin")
        return service.db.query(
          "SELECT g.id,g.name,g.description,g.active,g.owner_user_id ownerId,(SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id AND m.status='active') members FROM `groups` g ORDER BY g.updated_at DESC LIMIT 200",
          { type: QueryTypes.SELECT },
        );
      if (!account.capabilities.includes("groups.manage"))
        throw new PortalError(403, "Sem permissão para grupos.");
      return groups.list(req.user.sub);
    }),
  );
  app.post(
    "/portal/groups",
    { preHandler: secure },
    run(async (req) => {
      const account = await service.management.require(req.user.sub);
      if (
        account.role !== "admin" &&
        !account.capabilities.includes("groups.manage")
      )
        throw new PortalError(403, "Sem permissão para grupos.");
      const input = z
        .strictObject({
          name: z.string().min(2).max(80),
          description: z.string().max(500),
        })
        .parse(req.body);
      const groupId = await groups.create(req.user.sub, input);
      await service.management.audit(req.user.sub, "group.created", groupId);
      return { id: groupId };
    }),
  );
  app.patch(
    "/portal/groups/:id",
    { preHandler: secure },
    run(async (req) => {
      const input = z
        .strictObject({
          name: z.string().min(2).max(80),
          description: z.string().max(500),
          active: z.boolean(),
        })
        .parse(req.body);
      await service.db.transaction(async (t) => {
        const account = await service.management.require(
          req.user.sub,
          false,
          t,
        );
        const [row] = await service.db.query<any>(
          "SELECT owner_user_id FROM `groups` WHERE id=? FOR UPDATE",
          { replacements: [id(req)], type: QueryTypes.SELECT, transaction: t },
        );
        if (!row) throw new PortalError(404, "Grupo não encontrado.");
        if (
          account.role !== "admin" &&
          (!account.capabilities.includes("groups.manage") ||
            row.owner_user_id !== req.user.sub)
        )
          throw new PortalError(
            403,
            "Sem permissão para gerenciar este grupo.",
          );
        await service.db.query(
          "UPDATE `groups` SET name=?,description=?,active=?,deactivated_at=IF(?=FALSE,UTC_TIMESTAMP(6),NULL),updated_at=UTC_TIMESTAMP(6) WHERE id=?",
          {
            replacements: [
              input.name,
              input.description,
              input.active,
              input.active,
              id(req),
            ],
            transaction: t,
          },
        );
        await service.management.audit(
          req.user.sub,
          "group.updated",
          id(req),
          t,
        );
      });
      return { ok: true };
    }),
  );
}
