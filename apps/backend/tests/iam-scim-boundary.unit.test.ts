import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import { once } from "node:events";
import http from "node:http";
import type { Core } from "@strapi/strapi";
import boundary, { type ScimBoundaryContext } from "../src/middlewares/scim-boundary";
import policy from "../src/policies/scim-source-bearer";
import { hashSourceToken } from "../src/iam/scim/token-service";
import { readScimConfig } from "../src/iam/scim/config";
import { scimFailure, ERROR_URN } from "../src/iam/scim/errors";
import middlewareConfig from "../config/middlewares";

const coreRequire = createRequire(createRequire(require.resolve("@strapi/strapi")).resolve("@strapi/core"));
const Koa = coreRequire("koa");
const bodyFactory = require(path.join(path.dirname(coreRequire.resolve("@strapi/core/package.json")), "dist/middlewares/body.js")).body;
const sourceId = "a".repeat(24);
const targetId = "b".repeat(24);
const token = `idb_scim_v1.${sourceId}.${Buffer.alloc(32, 8).toString("base64url")}`;

function fixture() {
  const events: string[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const fn = { name: "Identity Provisioning", menuPath: null, application: { slug: "idambox-iam", applicationStatus: "active" },
    functionApis: [{ url: "POST:/scim/v2/Users" }] };
  const user = { documentId: "service", accountStatus: "active", protected: true, password: null, externalSubject: null,
    identitySource: null, sourceExternalId: null, sourceIdentityKey: null, roles: [{ name: "Identity Provisioning", functions: [fn] }] };
  const source = { documentId: sourceId, sourceStatus: "active", tokenHash: hashSourceToken(token), serviceUser: { documentId: "service" } };
  let activityFailure = false;
  const strapi = { middleware: () => bodyFactory, plugin: () => undefined,
    documents: (uid: string) => ({
      findOne: async () => { events.push("lookup"); return uid.includes("identity-source") ? source : user; },
      findMany: async () => [source], update: async () => { events.push("activity"); if (activityFailure) throw new Error("private"); return source; },
    }), db: { inTransaction: () => false, transaction: async (work: () => Promise<unknown>) => work() },
    log: { info: (message: string) => logs.push(JSON.parse(message)), error: (message: string) => logs.push(JSON.parse(message)) },
  } as unknown as Core.Strapi;
  return { strapi, events, logs, fn, failActivity: () => { activityFailure = true; } };
}
async function serve(f: ReturnType<typeof fixture>, run: (url: string) => Promise<void>, options = { ipLimit: 1200, sourceLimit: 600 },
  handler?: (ctx: ScimBoundaryContext) => Promise<void>) {
  const app = new Koa();
  app.use(boundary({ limits: options }, { strapi: f.strapi }));
  app.use(bodyFactory({ formLimit: "6mb", formidable: { maxFileSize: 52_428_800, maxTotalFileSize: 262_144_000 } }, { strapi: f.strapi }));
  app.use(async (ctx: ScimBoundaryContext) => {
    f.events.push("parsed");
    if (handler) return handler(ctx);
    if (ctx.path !== "/scim/v2" && !ctx.path.startsWith("/scim/v2/")) { ctx.body = ctx.request.body; return; }
    await policy(ctx, { operation: "POST:/scim/v2/Users" }, { strapi: f.strapi });
    ctx.body = { schemas: [], parsed: ctx.request.body };
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => error ? reject(error) : resolve())); }
}
function headers(extra: Record<string, string> = {}) {
  return { authorization: `Bearer ${token}`, "content-type": "application/scim+json", ...extra };
}
async function errorResponse(response: Response, expected: number) {
  assert.equal(response.status, expected);
  assert.match(response.headers.get("content-type")!, /^application\/scim\+json/);
  const body = await response.json() as Record<string, unknown>;
  assert.deepEqual(body.schemas, [ERROR_URN]); assert.equal(body.status, String(expected));
  assert.equal(JSON.stringify(body).includes("private"), false);
  return body;
}
test("middleware order wraps identities, security, query and existing parser without changing CSRM limits", () => {
  const env = ((_: string, fallback: unknown) => fallback) as Core.Config.Shared.ConfigParams["env"];
  const config = middlewareConfig({ env });
  const names = config.map(entry => typeof entry === "string" ? entry : entry.name);
  assert.ok(names.indexOf("global::scim-boundary") < names.indexOf("global::csrm-development-identity"));
  assert.ok(names.indexOf("global::scim-boundary") < names.indexOf("strapi::body"));
  const parser = config.find(entry => typeof entry !== "string" && entry.name === "strapi::body");
  assert.deepEqual(parser, { name: "strapi::body", config: { formLimit: "6mb", formidable: { maxFileSize: 52_428_800, maxTotalFileSize: 262_144_000 } } });
  assert.deepEqual(readScimConfig({}), { ipLimit: 1200, sourceLimit: 600 });
});
test("SCIM and compatible JSON parse once after independently recorded activity; success has one safe log", async () => {
  const f = fixture();
  await serve(f, async url => {
    for (const media of ["application/scim+json", "application/json; charset=utf-8"]) {
      const response = await fetch(`${url}/scim/v2/Users?private=person`, { method: "POST", headers: headers({ "content-type": media, "x-request-id": "private" }), body: '{"active":true}' });
      assert.equal(response.status, 200); assert.match(response.headers.get("content-type")!, /^application\/scim\+json/);
      assert.deepEqual((await response.json() as { parsed: unknown }).parsed, { active: true });
    }
  });
  assert.ok(f.events.indexOf("activity") < f.events.indexOf("parsed"));
  assert.equal(f.events.filter(e => e === "activity").length, 2);
  assert.equal(f.logs.length, 2);
  for (const log of f.logs) {
    assert.deepEqual(Object.keys(log).sort(), ["event", "source", "operation", "target", "outcome", "status", "requestId"].sort());
    assert.equal(log.event, "scim.request"); assert.equal(log.source, sourceId); assert.equal(log.operation, "POST:/scim/v2/Users");
    assert.equal(log.target, null); assert.equal(log.outcome, "success"); assert.match(String(log.requestId), /^[a-f0-9-]{36}$/);
  }
  assert.equal(JSON.stringify(f.logs).includes("private"), false);
  assert.equal(JSON.stringify(f.logs).includes(token), false);
});
test("malformed, oversized, unsupported-media and incompatible-Accept bodies preserve activity before denial", async () => {
  const f = fixture();
  await serve(f, async url => {
    const cases: Array<[number, string, Record<string, string>]> = [
      [400, '{"private":', {}], [413, '"' + "x".repeat(1_048_576) + '"', {}],
      [415, "private", { "content-type": "text/plain" }], [406, "{}", { accept: "text/html" }],
      [406, "{}", { accept: "application/scim+json;q=0, application/json;q=0, */*;q=1" }],
    ];
    for (const [status, body, extra] of cases) await errorResponse(await fetch(`${url}/scim/v2/Users`, { method: "POST", headers: headers(extra), body }), status);
  });
  assert.equal(f.events.filter(e => e === "activity").length, 5);
  assert.equal(f.events.includes("parsed"), false);
  assert.equal(f.logs.length, 5);
});
test("the pinned connector's Accept: application/json is served as JSON; SCIM media stays preferred", async () => {
  const f = fixture();
  await serve(f, async url => {
    // The exact headers the SCIM2 connector 1.2.9 sends, observed live against midPoint 4.8.14.
    const connector = await fetch(`${url}/scim/v2/Users`, { method: "POST",
      headers: headers({ accept: "application/json", "content-type": "application/json" }), body: '{"active":true}' });
    assert.equal(connector.status, 200); assert.match(connector.headers.get("content-type")!, /^application\/json/);
    for (const accept of ["application/scim+json", "*/*", "application/json, application/scim+json", "application/scim+json;q=0, */*;q=1"]) {
      const response = await fetch(`${url}/scim/v2/Users`, { method: "POST", headers: headers({ accept }), body: '{"active":true}' });
      assert.equal(response.status, 200);
      const expected = accept.startsWith("application/scim+json;q=0") ? /^application\/json/ : /^application\/scim\+json/;
      assert.match(response.headers.get("content-type")!, expected);
    }
  });
});
test("IP rejects before authentication; valid sources share a budget across operations after activity", async () => {
  const g = fixture();
  await serve(g, async url => {
    const denied = await fetch(`${url}/scim/v2/Users`, { headers: { authorization: "Bearer private" } });
    await errorResponse(denied, 401); assert.equal(denied.headers.get("www-authenticate"), "Bearer");
    const limited = await fetch(`${url}/scim/v2/Schemas`, { headers: headers() });
    await errorResponse(limited, 429); assert.equal(limited.headers.get("retry-after"), "60");
  }, { ipLimit: 1, sourceLimit: 600 });
  assert.equal(g.events.length, 0); assert.equal(g.logs.length, 2); assert.equal(g.logs[1].source, null);
  const h = fixture();
  await serve(h, async url => {
    assert.equal((await fetch(`${url}/scim/v2/Users`, { method: "POST", headers: headers(), body: "{}" })).status, 200);
    const limited = await fetch(`${url}/scim/v2/Schemas`, { headers: headers() });
    await errorResponse(limited, 429); assert.match(limited.headers.get("retry-after")!, /^\d+$/);
  }, { ipLimit: 1200, sourceLimit: 1 });
  assert.equal(h.events.filter(e => e === "activity").length, 2);
  assert.equal(h.logs[1].source, sourceId);
});
test("fresh policy denial, unknown routes, unsupported writes and unexpected errors are safe and logged once", async () => {
  for (const status of [401, 403, 404, 501, 500, 503]) {
    const f = fixture();
    await serve(f, async url => {
      const response = await fetch(`${url}/scim/v2/unknown/private?private=value`, { headers: headers() });
      await errorResponse(response, status);
      if (status === 401) assert.equal(response.headers.get("www-authenticate"), "Bearer");
      if (status === 503) assert.equal(response.headers.get("retry-after"), "30");
    }, undefined, async () => { throw Object.assign(new Error("private"), { status }); });
    assert.equal(f.logs.length, 1); assert.equal(f.logs[0].operation, "GET:/scim/v2"); assert.equal(f.logs[0].target, null);
  }
  const f = fixture(); f.fn.functionApis = [];
  await serve(f, async url => { await errorResponse(await fetch(`${url}/scim/v2/Users`, { method: "POST", headers: headers(), body: "{}" }), 403); });
  assert.equal(f.events.filter(e => e === "activity").length, 1); assert.equal(f.logs.length, 1);
});
test("returned errors, DELETE 204 and validated targets use safe canonical responses", async () => {
  const f = fixture();
  await serve(f, async url => {
    const response = await fetch(`${url}/scim/v2/Users/${targetId}`, { method: "DELETE", headers: headers() });
    assert.equal(response.status, 204); assert.equal(await response.text(), "");
    assert.equal(response.headers.get("content-type"), null);
  }, undefined, async ctx => { ctx.status = 204; });
  assert.equal(f.logs[0].operation, "DELETE:/scim/v2/Users/:id"); assert.equal(f.logs[0].target, targetId);
  const g = fixture();
  await serve(g, async url => { await errorResponse(await fetch(`${url}/scim/v2/absent`, { headers: headers() }), 404); }, undefined, async () => {});
  assert.equal(g.logs.length, 1);
});
test("CSRM and lookalike namespaces retain JSON, form limits and errors without SCIM authentication or logs", async () => {
  const f = fixture();
  await serve(f, async url => {
    for (const route of ["/api/echo", "/scim/v20/Users", "/api/scim/v2/Users"]) {
      const response = await fetch(url + route, { method: "POST", headers: { "content-type": "application/json" }, body: '{"active":true}' });
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { active: true });
    }
    const response = await fetch(`${url}/api/form`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "value=" + "x".repeat(1_100_000) });
    assert.equal(response.status, 200); assert.equal((await response.json() as { value: string }).value.length, 1_100_000);
  });
  assert.equal(f.events.includes("lookup"), false); assert.equal(f.logs.length, 0);
});
test("activity failure fails closed and keeps its separate event distinct", async () => {
  const f = fixture(); f.failActivity();
  await serve(f, async url => { await errorResponse(await fetch(`${url}/scim/v2/Users`, { headers: headers() }), 500); });
  assert.deepEqual(f.logs.map(log => log.event), ["scim.activity", "scim.request"]);
  assert.equal(f.events.includes("parsed"), false);
});
test("chunked overflow is bounded for writes and DELETE without trusting Content-Length", async () => {
  for (const method of ["POST", "PUT", "PATCH", "GET", "DELETE", "OPTIONS"]) {
    const f = fixture();
    await serve(f, async url => {
      const status = await new Promise<number>((resolve, reject) => {
        const request = http.request(url + "/scim/v2/Users", { method, headers: headers({ "transfer-encoding": "chunked" }) }, response => {
          response.resume(); response.on("end", () => resolve(response.statusCode!));
        });
        request.on("error", reject);
        request.write('"' + "x".repeat(600_000)); request.end("x".repeat(600_000) + '"');
      });
      assert.equal(status, 413);
    });
    assert.equal(f.events.filter(e => e === "activity").length, 1);
    assert.equal(f.logs.length, 1);
  }
});

test("the exact 1 MiB JSON boundary is accepted and one additional byte is refused", async () => {
  const f = fixture();
  await serve(f, async url => {
    const body = JSON.stringify({ x: "x".repeat(1_048_576 - 8) });
    assert.equal(Buffer.byteLength(body), 1_048_576);
    assert.equal((await fetch(`${url}/scim/v2/Users`, { method: "POST", headers: headers(), body })).status, 200);
    await errorResponse(await fetch(`${url}/scim/v2/Users`, { method: "POST", headers: headers(), body: body + " " }), 413);
  });
  assert.equal(f.events.filter(e => e === "activity").length, 2);
  assert.equal(f.logs.length, 2);
});
test("closed SCIM failure types survive returned errors without caller details", async () => {
  const codes = ["invalidInput", "syntax", "filter", "path", "noTarget", "forbiddenWrite", "uniqueness"] as const;
  const f = fixture();
  let index = 0;
  await serve(f, async url => {
    for (const code of codes) {
      const expected = scimFailure(code).error;
      const response = await fetch(`${url}/scim/v2/Users`, { headers: headers() });
      const body = await errorResponse(response, expected.status);
      assert.deepEqual(body, expected.body);
    }
  }, undefined, async ctx => {
    const error = scimFailure(codes[index++]).error;
    ctx.status = error.status; ctx.body = { ...error.body, detail: "private", extra: "private" };
  });
  assert.equal(f.logs.length, codes.length);
  assert.equal(JSON.stringify(f.logs).includes("private"), false);
});
test("only validated schema and document identifiers can appear in request logs", async () => {
  const f = fixture();
  const schema = "urn:ietf:params:scim:schemas:core:2.0:User";
  await serve(f, async url => {
    for (const suffix of ["Users/private-person", "Schemas/" + encodeURIComponent(schema), "Users/%ZZ", "ResourceTypes/User"]) {
      await errorResponse(await fetch(`${url}/scim/v2/${suffix}?private=person`, { headers: headers() }), 404);
    }
  }, undefined, async () => {});
  assert.deepEqual(f.logs.map(log => log.target), [null, schema, null, "User"]);
  assert.equal(JSON.stringify(f.logs).includes("private"), false);
});

test("credential source hints and unrelated identity headers never become logged source authority", async () => {
  const f = fixture();
  const forged = `idb_scim_v1.${sourceId}.${Buffer.alloc(32, 9).toString("base64url")}`;
  await serve(f, async url => {
    for (const authorization of ["", `Bearer ${forged}`]) {
      await errorResponse(await fetch(`${url}/scim/v2/Users?private=person`, { headers: {
        authorization, "x-csrm-dev-identity": "private", "x-csrm-identity-token": "private", "x-source-id": sourceId,
      } }), 401);
    }
  });
  assert.equal(f.events.includes("activity"), false);
  assert.deepEqual(f.logs.map(log => log.source), [null, null]);
  assert.equal(JSON.stringify(f.logs).includes("private"), false);
  assert.equal(JSON.stringify(f.logs).includes(forged), false);
});
