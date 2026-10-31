import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  QueryTypes,
  UniqueConstraintError,
  type Sequelize,
  type Transaction,
} from "sequelize";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  activateProfessionalSchema,
  changePortalPasswordSchema,
  consentInputSchema,
  createProfessionalSchema,
  invitationInputSchema,
  professionalTypeInputSchema,
  updateProfessionalSchema,
} from "@fit/contracts";

export class PortalError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = <T>(value: T | string): T =>
  typeof value === "string" ? JSON.parse(value) : value;
export class ProfessionalManagement {
  constructor(public db: Sequelize) {}
  async audit(
    actor: string,
    action: string,
    resource: string,
    transaction?: Transaction,
  ) {
    await this.db.query(
      "INSERT INTO portal_audit (id,actor_id,action,resource_id,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())",
      { replacements: [randomUUID(), actor, action, resource], transaction },
    );
  }
  async account(id: string, transaction?: Transaction) {
    const [row] = await this.db.query<{
      role: string;
      suspended: number;
      activatedAt: Date | null;
      temporaryExpiresAt: Date | null;
      capabilities: string[];
      typeCapabilities: string[];
    }>(
      "SELECT a.role,a.suspended,a.activated_at activatedAt,a.temporary_expires_at temporaryExpiresAt,a.capabilities,t.capabilities typeCapabilities FROM portal_accounts a LEFT JOIN professional_types t ON t.id=a.type_id WHERE a.user_id=?" +
        (transaction ? " FOR UPDATE" : ""),
      { replacements: [id], type: QueryTypes.SELECT, transaction },
    );
    if (!row || row.suspended)
      throw new PortalError(403, "Seu perfil não possui acesso a esta área.");
    return {
      ...row,
      capabilities:
        row.role === "admin"
          ? []
          : json<string[]>(row.capabilities ?? []).filter((cap) =>
              json<string[]>(row.typeCapabilities ?? []).includes(cap),
            ),
    };
  }
  async require(id: string, admin = false, transaction?: Transaction) {
    const account = await this.account(id, transaction);
    if (admin && account.role !== "admin")
      throw new PortalError(403, "Acesso restrito à administração.");
    if (account.role === "professional" && !account.activatedAt)
      throw new PortalError(403, "Ative sua conta antes de continuar.");
    return account;
  }
  async profiles() {
    const rows = await this.db.query<any>(
      "SELECT a.user_id id,u.first_name firstName,u.last_name lastName,u.email,u.phone,a.type_id typeId,t.name typeName,a.capabilities,a.suspended,a.activated_at activatedAt,a.temporary_expires_at temporaryExpiresAt FROM portal_accounts a JOIN users u ON u.id=a.user_id JOIN professional_types t ON t.id=a.type_id WHERE a.role='professional' ORDER BY u.first_name LIMIT 200",
      { type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({
      ...row,
      capabilities: json(row.capabilities),
      suspended: Boolean(row.suspended),
    }));
  }
  async checkType(
    typeId: string,
    capabilities: string[],
    transaction: Transaction,
  ) {
    const [type] = await this.db.query<{ capabilities: string[] }>(
      "SELECT capabilities FROM professional_types WHERE id=? FOR UPDATE",
      { replacements: [typeId], transaction, type: QueryTypes.SELECT },
    );
    if (
      !type ||
      capabilities.some(
        (cap) => !json<string[]>(type.capabilities).includes(cap),
      )
    )
      throw new PortalError(
        400,
        "Selecione um tipo válido e capacidades permitidas por ele.",
      );
  }
  async create(actor: string, input: z.infer<typeof createProfessionalSchema>) {
    const id = randomUUID(),
      temporaryPassword = `Fit!${randomBytes(18).toString("base64url")}`;
    const hash = await bcrypt.hash(temporaryPassword, 12);
    await this.db.transaction(async (transaction) => {
      await this.require(actor, true, transaction);
      await this.checkType(input.typeId, input.capabilities, transaction);
      const [existing] = await this.db.query(
        "SELECT id FROM users WHERE email=?",
        { replacements: [input.email], type: QueryTypes.SELECT, transaction },
      );
      if (existing)
        throw new PortalError(
          409,
          "Este e-mail já está cadastrado. Use outro e-mail para o novo profissional.",
        );
      await this.db.query(
        "INSERT INTO users (id,email,phone,first_name,last_name,username,display_name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        {
          replacements: [
            id,
            input.email,
            input.phone,
            input.firstName,
            input.lastName,
            `prof.${randomBytes(8).toString("hex")}`,
            `${input.firstName} ${input.lastName}`,
            hash,
          ],
          transaction,
        },
      );
      await this.db.query(
        "INSERT INTO portal_accounts (user_id,role,suspended,type_id,capabilities,temporary_expires_at) VALUES (?,'professional',FALSE,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 48 HOUR))",
        {
          replacements: [id, input.typeId, JSON.stringify(input.capabilities)],
          transaction,
        },
      );
      await this.audit(actor, "professional.created", id, transaction);
    });
    return { id, email: input.email, temporaryPassword, expiresInHours: 48 };
  }
  async relationships(actor: string, student: boolean) {
    const rows = await this.db.query<any>(
      `SELECT r.id,r.professional_id professionalId,CONCAT(p.first_name,' ',p.last_name) professionalName,r.student_id studentId,CASE WHEN r.status='active' THEN CONCAT(s.first_name,' ',s.last_name) ELSE NULL END studentName,r.status,r.capabilities,r.expires_at expiresAt,r.created_at createdAt FROM professional_relationships r JOIN users p ON p.id=r.professional_id LEFT JOIN users s ON s.id=r.student_id WHERE ${student ? "(r.student_id=? OR (r.invited_email=(SELECT email FROM users WHERE id=?) AND r.status='pending'))" : "r.professional_id=?"} ORDER BY r.created_at DESC LIMIT 200`,
      {
        replacements: student ? [actor, actor] : [actor],
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row) => ({
      ...row,
      capabilities: json(row.capabilities),
      status:
        row.status === "pending" &&
        new Date(row.expiresAt).getTime() <= Date.now()
          ? "expired"
          : row.status,
    }));
  }
  async consent(
    actor: string,
    id: string,
    input: z.infer<typeof consentInputSchema>,
  ) {
    return this.db.transaction(async (transaction) => {
      const [row] = await this.db.query<any>(
        "SELECT r.*,u.email FROM professional_relationships r JOIN users u ON u.id=? WHERE r.id=? FOR UPDATE",
        { replacements: [actor, id], type: QueryTypes.SELECT, transaction },
      );
      if (!row || (row.student_id !== actor && row.invited_email !== row.email))
        throw new PortalError(404, "Vínculo não encontrado.");
      if (input.action === "accept" || input.action === "decline") {
        if (
          row.status !== "pending" ||
          new Date(row.expires_at).getTime() <= Date.now()
        )
          throw new PortalError(409, "Este convite não está mais disponível.");
      } else if (row.status !== "active" || row.student_id !== actor)
        throw new PortalError(409, "Este vínculo não está ativo.");
      const current = json<string[]>(row.capabilities);
      if (input.capabilities.some((cap) => !current.includes(cap)))
        throw new PortalError(
          400,
          "Não é possível ampliar o consentimento por esta ação.",
        );
      if (input.action === "accept") {
        if (row.professional_id === actor)
          throw new PortalError(
            400,
            "Não é possível aceitar seu próprio convite.",
          );
        const account = await this.require(
          row.professional_id,
          false,
          transaction,
        );
        if (
          !input.capabilities.length ||
          input.capabilities.some((cap) => !account.capabilities.includes(cap))
        )
          throw new PortalError(
            400,
            "As permissões do profissional mudaram. Solicite um novo convite.",
          );
      }
      const status =
        input.action === "accept" || input.action === "reduce"
          ? "active"
          : input.action === "decline"
            ? "declined"
            : "ended";
      if (status === "active" && !input.capabilities.length)
        throw new PortalError(
          400,
          "Selecione uma permissão ou encerre o vínculo.",
        );
      await this.db.query(
        "UPDATE professional_relationships SET student_id=?,status=?,capabilities=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
        {
          replacements: [
            actor,
            status,
            JSON.stringify(status === "active" ? input.capabilities : []),
            id,
          ],
          transaction,
        },
      );
      if (status === "ended")
        await this.db.query(
          "UPDATE professional_assignments SET status='cancelled',updated_at=UTC_TIMESTAMP() WHERE relationship_id=? AND status='pending'",
          { replacements: [id], transaction },
        );
      await this.db.query(
        "INSERT INTO professional_consents (id,relationship_id,actor_id,action,capabilities,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())",
        {
          replacements: [
            randomUUID(),
            id,
            actor,
            input.action,
            JSON.stringify(input.capabilities),
          ],
          transaction,
        },
      );
      await this.audit(actor, `relationship.${input.action}`, id, transaction);
      return { ok: true };
    });
  }
  async studentAccess(
    actor: string,
    relationshipId: string,
    capability: string,
    transaction?: Transaction,
  ) {
    const account = await this.require(actor, false, transaction);
    const [row] = await this.db.query<any>(
      "SELECT student_id,capabilities FROM professional_relationships WHERE id=? AND professional_id=? AND status='active'" +
        (transaction ? " FOR UPDATE" : ""),
      {
        replacements: [relationshipId, actor],
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    if (
      !row ||
      !account.capabilities.includes(capability) ||
      !json<string[]>(row.capabilities).includes(capability)
    )
      throw new PortalError(
        403,
        "O aluno não autorizou esta operação ou o vínculo foi encerrado.",
      );
    return row.student_id as string;
  }
}

export async function registerProfessionalManagement(
  app: FastifyInstance,
  service: ProfessionalManagement,
  secure: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  const run =
    (handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        return await handler(req, reply);
      } catch (error) {
        if (error instanceof PortalError)
          return reply
            .code(error.status)
            .send({
              code: error.status === 403 ? "FORBIDDEN" : "INVALID_INPUT",
              message: error.message,
            });
        if (error instanceof UniqueConstraintError)
          return reply
            .code(409)
            .send({
              code: "CONFLICT",
              message: "Já existe um cadastro com esses dados.",
            });
        throw error;
      }
    };
  const id = (req: FastifyRequest) =>
    z.strictObject({ id: z.uuid() }).parse(req.params).id;
  app.get(
    "/portal/profile",
    { preHandler: secure },
    run(async (req) => {
      const account = await service.account(req.user.sub);
      return {
        role: account.role,
        capabilities: account.capabilities,
        requiresActivation:
          account.role === "professional" && !account.activatedAt,
      };
    }),
  );
  app.post(
    "/portal/activate",
    {
      preHandler: secure,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    run(async (req) => {
      const input = activateProfessionalSchema.parse(req.body);
      const hash = await bcrypt.hash(input.password, 12);
      await service.db.transaction(async (transaction) => {
        const account = await service.account(req.user.sub, transaction);
        if (
          account.role !== "professional" ||
          account.activatedAt ||
          !account.temporaryExpiresAt ||
          new Date(account.temporaryExpiresAt).getTime() <= Date.now()
        )
          throw new PortalError(
            409,
            "Ativação indisponível ou expirada. Solicite uma nova credencial ao administrador.",
          );
        const [user] = await service.db.query<{ password_hash: string }>(
          "SELECT password_hash FROM users WHERE id=? FOR UPDATE",
          {
            replacements: [req.user.sub],
            type: QueryTypes.SELECT,
            transaction,
          },
        );
        if (await bcrypt.compare(input.password, user.password_hash))
          throw new PortalError(
            400,
            "Escolha uma senha diferente da senha temporária.",
          );
        await service.db.query(
          "UPDATE users SET password_hash=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          { replacements: [hash, req.user.sub], transaction },
        );
        await service.db.query(
          "UPDATE portal_accounts SET activated_at=UTC_TIMESTAMP(),temporary_expires_at=NULL WHERE user_id=?",
          { replacements: [req.user.sub], transaction },
        );
        await service.db.query(
          "UPDATE sessions SET revoked_at=? WHERE user_id=?",
          { replacements: [Date.now(), req.user.sub], transaction },
        );
        await service.audit(
          req.user.sub,
          "professional.activated_terms_accepted",
          req.user.sub,
          transaction,
        );
      });
      return { ok: true };
    }),
  );
  app.get(
    "/portal/professionals",
    { preHandler: secure },
    run(async (req) => {
      await service.require(req.user.sub, true);
      return service.profiles();
    }),
  );
  app.post(
    "/portal/professionals",
    { preHandler: secure },
    run(async (req, reply) =>
      reply
        .code(201)
        .header("cache-control", "no-store")
        .send(
          await service.create(
            req.user.sub,
            createProfessionalSchema.parse(req.body),
          ),
        ),
    ),
  );
  app.patch(
    "/portal/professionals/:id",
    { preHandler: secure },
    run(async (req) => {
      const input = updateProfessionalSchema.parse(req.body),
        target = id(req);
      await service.db.transaction(async (transaction) => {
        await service.require(req.user.sub, true, transaction);
        await service.checkType(input.typeId, input.capabilities, transaction);
        const [row] = await service.db.query(
          "SELECT user_id FROM portal_accounts WHERE user_id=? AND role='professional' FOR UPDATE",
          { replacements: [target], type: QueryTypes.SELECT, transaction },
        );
        if (!row) throw new PortalError(404, "Profissional não encontrado.");
        await service.db.query(
          "UPDATE users SET first_name=?,last_name=?,email=?,phone=?,display_name=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          {
            replacements: [
              input.firstName,
              input.lastName,
              input.email,
              input.phone,
              `${input.firstName} ${input.lastName}`,
              target,
            ],
            transaction,
          },
        );
        await service.db.query(
          "UPDATE portal_accounts SET type_id=?,capabilities=?,suspended=? WHERE user_id=?",
          {
            replacements: [
              input.typeId,
              JSON.stringify(input.capabilities),
              input.suspended,
              target,
            ],
            transaction,
          },
        );
        if (input.suspended)
          await service.db.query(
            "UPDATE sessions SET revoked_at=? WHERE user_id=?",
            { replacements: [Date.now(), target], transaction },
          );
        await service.audit(
          req.user.sub,
          "professional.updated",
          target,
          transaction,
        );
      });
      return { ok: true };
    }),
  );
  app.patch(
    "/portal/password",
    {
      preHandler: secure,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    run(async (req) => {
      const input = changePortalPasswordSchema.parse(req.body);
      await service.db.transaction(async (transaction) => {
        await service.require(req.user.sub, false, transaction);
        const [user] = await service.db.query<{ password_hash: string }>(
          "SELECT password_hash FROM users WHERE id=? FOR UPDATE",
          { replacements: [req.user.sub], type: QueryTypes.SELECT, transaction },
        );
        if (!user || !(await bcrypt.compare(input.currentPassword, user.password_hash)))
          throw new PortalError(400, "A senha atual está incorreta.");
        const hash = await bcrypt.hash(input.newPassword, 12);
        await service.db.query(
          "UPDATE users SET password_hash=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
          { replacements: [hash, req.user.sub], transaction },
        );
        await service.db.query(
          "UPDATE sessions SET revoked_at=? WHERE user_id=?",
          { replacements: [Date.now(), req.user.sub], transaction },
        );
        await service.audit(req.user.sub, "password.changed", req.user.sub, transaction);
      });
      return { ok: true };
    }),
  );
  app.post(
    "/portal/professionals/:id/reset-activation",
    { preHandler: secure },
    run(async (req, reply) => {
      const target = id(req),
        temporaryPassword = `Fit!${randomBytes(18).toString("base64url")}`,
        hash = await bcrypt.hash(temporaryPassword, 12);
      await service.db.transaction(async (transaction) => {
        await service.require(req.user.sub, true, transaction);
        const [row] = await service.db.query(
          "SELECT user_id FROM portal_accounts WHERE user_id=? AND role='professional' AND activated_at IS NULL FOR UPDATE",
          { replacements: [target], type: QueryTypes.SELECT, transaction },
        );
        if (!row)
          throw new PortalError(
            409,
            "Apenas contas aguardando ativação podem receber nova credencial.",
          );
        await service.db.query("UPDATE users SET password_hash=? WHERE id=?", {
          replacements: [hash, target],
          transaction,
        });
        await service.db.query(
          "UPDATE portal_accounts SET temporary_expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 48 HOUR) WHERE user_id=?",
          { replacements: [target], transaction },
        );
        await service.db.query(
          "UPDATE sessions SET revoked_at=? WHERE user_id=?",
          { replacements: [Date.now(), target], transaction },
        );
        await service.audit(
          req.user.sub,
          "professional.activation_reset",
          target,
          transaction,
        );
      });
      return reply
        .header("cache-control", "no-store")
        .send({ temporaryPassword, expiresInHours: 48 });
    }),
  );
  app.patch(
    "/portal/professional-types/:id",
    { preHandler: secure },
    run(async (req) => {
      const input = professionalTypeInputSchema.parse(req.body),
        target = id(req);
      await service.db.transaction(async (transaction) => {
        await service.require(req.user.sub, true, transaction);
        const [row] = await service.db.query(
          "SELECT id FROM professional_types WHERE id=? FOR UPDATE",
          { replacements: [target], type: QueryTypes.SELECT, transaction },
        );
        if (!row) throw new PortalError(404, "Tipo não encontrado.");
        await service.db.query(
          "UPDATE professional_types SET name=?,capabilities=? WHERE id=?",
          {
            replacements: [
              input.name,
              JSON.stringify(input.capabilities),
              target,
            ],
            transaction,
          },
        );
        await service.audit(
          req.user.sub,
          "professional_type.updated",
          target,
          transaction,
        );
      });
      return { ok: true };
    }),
  );
  app.get(
    "/portal/relationships",
    { preHandler: secure },
    run(async (req) => {
      await service.require(req.user.sub);
      return service.relationships(req.user.sub, false);
    }),
  );
  app.post(
    "/portal/invitations",
    {
      preHandler: secure,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    run(async (req) => {
      const input = invitationInputSchema.parse(req.body);
      await service.db.transaction(async (transaction) => {
        const account = await service.require(req.user.sub, false, transaction);
        if (
          account.role !== "professional" ||
          input.capabilities.some((cap) => !account.capabilities.includes(cap))
        )
          throw new PortalError(
            403,
            "Selecione apenas permissões concedidas ao seu perfil.",
          );
        const [self] = await service.db.query<{ email: string }>(
          "SELECT email FROM users WHERE id=?",
          {
            replacements: [req.user.sub],
            type: QueryTypes.SELECT,
            transaction,
          },
        );
        if (self.email === input.email)
          throw new PortalError(400, "Não é possível convidar a si mesmo.");
        const [existing] = await service.db.query(
          "SELECT id FROM professional_relationships WHERE professional_id=? AND invited_email=? AND (status='active' OR (status='pending' AND expires_at>UTC_TIMESTAMP())) FOR UPDATE",
          {
            replacements: [req.user.sub, input.email],
            type: QueryTypes.SELECT,
            transaction,
          },
        );
        if (!existing) {
          const invitationId = randomUUID();
          await service.db.query(
            "INSERT INTO professional_relationships (id,professional_id,invited_email,status,capabilities,expires_at,created_at,updated_at) VALUES (?,?,?,'pending',?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY),UTC_TIMESTAMP(),UTC_TIMESTAMP())",
            {
              replacements: [
                invitationId,
                req.user.sub,
                input.email,
                JSON.stringify(input.capabilities),
              ],
              transaction,
            },
          );
          await service.audit(
            req.user.sub,
            "relationship.invited",
            invitationId,
            transaction,
          );
        }
      });
      return {
        message:
          "Convite processado. O aluno poderá responder pelo aplicativo.",
      };
    }),
  );
  app.post(
    "/portal/relationships/:id/end",
    { preHandler: secure },
    run(async (req) => {
      const target = id(req);
      await service.db.transaction(async (transaction) => {
        await service.require(req.user.sub, false, transaction);
        const [row] = await service.db.query(
          "SELECT id FROM professional_relationships WHERE id=? AND professional_id=? AND status IN ('active','pending') FOR UPDATE",
          {
            replacements: [target, req.user.sub],
            type: QueryTypes.SELECT,
            transaction,
          },
        );
        if (!row) throw new PortalError(404, "Vínculo não encontrado.");
        await service.db.query(
          "UPDATE professional_relationships SET status='ended',capabilities=JSON_ARRAY(),updated_at=UTC_TIMESTAMP() WHERE id=?",
          { replacements: [target], transaction },
        );
        await service.db.query(
          "UPDATE professional_assignments SET status='cancelled',updated_at=UTC_TIMESTAMP() WHERE relationship_id=? AND status='pending'",
          { replacements: [target], transaction },
        );
        await service.audit(
          req.user.sub,
          "relationship.ended",
          target,
          transaction,
        );
      });
      return { ok: true };
    }),
  );
  app.get(
    "/me/professionals",
    { preHandler: secure },
    run((req) => service.relationships(req.user.sub, true)),
  );
  app.post(
    "/me/professionals/:id/consent",
    { preHandler: secure },
    run((req) =>
      service.consent(
        req.user.sub,
        id(req),
        consentInputSchema.parse(req.body),
      ),
    ),
  );
  app.get(
    "/portal/audit",
    { preHandler: secure },
    run(async (req) => {
      await service.require(req.user.sub, true);
      return service.db.query(
        "SELECT id,actor_id actorId,action,resource_id resourceId,created_at createdAt FROM portal_audit ORDER BY created_at DESC LIMIT 200",
        { type: QueryTypes.SELECT },
      );
    }),
  );
}
