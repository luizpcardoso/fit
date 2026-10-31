import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { QueryTypes, UniqueConstraintError, type Sequelize } from "sequelize";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  professionalTypeInputSchema,
  professionalTypeSchema,
  type PortalAccess,
  type ProfessionalType,
} from "@fit/contracts";

export interface PortalStore {
  access(userId: string): Promise<PortalAccess | null>;
  types(): Promise<ProfessionalType[]>;
  createType(
    actorId: string,
    input: Omit<ProfessionalType, "id">,
  ): Promise<ProfessionalType>;
}
export class SequelizePortalStore implements PortalStore {
  constructor(private database: Sequelize) {}
  async access(userId: string) {
    const rows = await this.database.query<PortalAccess>(
      "SELECT role FROM portal_accounts WHERE user_id=? AND suspended=FALSE",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows[0] ?? null;
  }
  async types() {
    const rows = await this.database.query<ProfessionalType>(
      "SELECT id,name,capabilities FROM professional_types ORDER BY name LIMIT 200",
      { type: QueryTypes.SELECT },
    );
    return rows.map((row) =>
      professionalTypeSchema.parse({
        ...row,
        capabilities:
          typeof row.capabilities === "string"
            ? JSON.parse(row.capabilities)
            : row.capabilities,
      }),
    );
  }
  async createType(actorId: string, input: Omit<ProfessionalType, "id">) {
    const result = { ...input, id: randomUUID() };
    await this.database.transaction(async (transaction) => {
      await this.database.query(
        "INSERT INTO professional_types (id,name,capabilities) VALUES (?,?,?)",
        {
          replacements: [
            result.id,
            result.name,
            JSON.stringify(result.capabilities),
          ],
          transaction,
        },
      );
      await this.database.query(
        "INSERT INTO portal_audit (id,actor_id,action,resource_id,created_at) VALUES (?,?,?,?,?)",
        {
          replacements: [
            randomUUID(),
            actorId,
            "professional_type.created",
            result.id,
            new Date(),
          ],
          transaction,
        },
      );
    });
    return result;
  }
}

export async function registerPortalRoutes(
  app: FastifyInstance,
  store: PortalStore,
  secure: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  const permitted =
    (admin: boolean) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const access = await store.access(request.user.sub);
      if (!access || (admin && access.role !== "admin"))
        return reply
          .code(403)
          .send({
            code: "FORBIDDEN",
            message: "Seu perfil não possui acesso a esta área.",
          });
    };
  app.get(
    "/portal/access",
    { preHandler: [secure, permitted(false)] },
    (request) => store.access(request.user.sub),
  );
  app.get(
    "/portal/professional-types",
    { preHandler: [secure, permitted(true)] },
    () => store.types(),
  );
  app.post(
    "/portal/professional-types",
    {
      preHandler: [secure, permitted(true)],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const input = professionalTypeInputSchema.parse(request.body);
      if (
        (await store.types()).some(
          (item) =>
            item.name.toLocaleLowerCase() === input.name.toLocaleLowerCase(),
        )
      )
        return reply
          .code(409)
          .send({
            code: "CONFLICT",
            message: "Já existe um tipo com esse nome.",
          });
      try {
        return reply
          .code(201)
          .send(
            professionalTypeSchema.parse(
              await store.createType(request.user.sub, input),
            ),
          );
      } catch (error) {
        if (error instanceof UniqueConstraintError)
          return reply
            .code(409)
            .send({
              code: "CONFLICT",
              message: "Já existe um tipo com esse nome.",
            });
        throw error;
      }
    },
  );
  for (const [route, file, mime] of [
    ["/", "home.html", "text/html"],
    ["/theme.css", "theme.css", "text/css"],
    ["/home/style.css", "home.css", "text/css"],
    ["/home/home.js", "dist/home.js", "text/javascript"],
    ["/portal/", "index.html", "text/html"],
    ["/portal", "index.html", "text/html"],
    ["/portal/main.js", "dist/main.js", "text/javascript"],
    ["/portal/management.js", "dist/management.js", "text/javascript"],
    ["/portal/library.js", "dist/library.js", "text/javascript"],
    ["/portal/style.css", "style.css", "text/css"],
  ] as const) {
    app.get(route, async (_request, reply) =>
      reply
        .header("content-type", `${mime}; charset=utf-8`)
        .header("cache-control", "no-store")
        .header("x-content-type-options", "nosniff")
        .header("referrer-policy", "no-referrer")
        .header(
          "content-security-policy",
          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        )
        .send(await readFile(new URL(`../../web/${file}`, import.meta.url))),
    );
  }
}
