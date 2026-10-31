import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import type { PortalStore } from "../src/portal.js";
import type {
  ProfessionalType,
  PortalAccess,
} from "../../../packages/contracts/src/portal.js";

test("portal nega acesso por padrão, aplica papel atual e valida tipos profissionais", async () => {
  const roles = new Map<string, PortalAccess>();
  const types: ProfessionalType[] = [];
  const store: PortalStore = {
    access: async (id) => roles.get(id) ?? null,
    types: async () => types,
    createType: async (_actor, input) => {
      const result = { ...input, id: randomUUID() };
      types.push(result);
      return result;
    },
  };
  const app = await buildApp({
    jwtSecret: "portal-test-secret-more-than-32-characters",
    portalStore: store,
  });
  try {
    const admin = app.jwt.sign({ sub: randomUUID() });
    const professionalId = randomUUID();
    const professional = app.jwt.sign({ sub: professionalId });
    const adminId = app.jwt.decode<{ sub: string }>(admin)!.sub;
    const headers = { authorization: `Bearer ${admin}` };
    assert.equal((await app.inject("/portal/access")).statusCode, 401);
    assert.equal(
      (await app.inject({ url: "/portal/access", headers })).statusCode,
      403,
    );
    roles.set(adminId, { role: "admin" });
    roles.set(professionalId, { role: "professional" });
    assert.equal(
      (await app.inject({ url: "/portal/access", headers })).json().role,
      "admin",
    );
    assert.equal(
      (
        await app.inject({
          url: "/portal/professional-types",
          headers: { authorization: `Bearer ${professional}` },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/portal/professional-types",
          headers,
          payload: { name: "Personal", capabilities: ["unknown"] },
        })
      ).statusCode,
      400,
    );
    const created = await app.inject({
      method: "POST",
      url: "/portal/professional-types",
      headers,
      payload: { name: "Personal", capabilities: ["fitness.manage"] },
    });
    assert.equal(created.statusCode, 201);
    assert.deepEqual(created.json().capabilities, ["fitness.manage"]);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/portal/professional-types",
          headers,
          payload: { name: "Personal", capabilities: [] },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await app.inject({ url: "/portal/professional-types", headers })).json()
        .length,
      1,
    );
    roles.delete(adminId);
    assert.equal(
      (await app.inject({ url: "/portal/professional-types", headers }))
        .statusCode,
      403,
    );
    assert.equal((await app.inject("/portal")).statusCode, 200);
  } finally {
    await app.close();
  }
});
