import assert from "node:assert/strict";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import type * as Registration from "../../src/iam/identity/source-registration";
import type * as Tokens from "../../src/iam/scim/token-service";
import { startAuthorizationHttpHarness } from "./strapi-http-harness";

const appDir = path.resolve(__dirname, "../../../..");

/** Load the running application's modules so private instance authority stays in one module graph. */
export function backendModule<T>(relativePath: string): T {
  return require(path.join(appDir, "dist/src", relativePath)) as T;
}

export async function startScimHttpHarness(options: { ipLimit?: number; sourceLimit?: number } = {}) {
  const saved = new Map(["IDAMBOX_SEED_IAM", "CSRM_AUTH_OIDC_ENABLED", "IDAMBOX_SCIM_IP_LIMIT", "IDAMBOX_SCIM_SOURCE_LIMIT"]
    .map(key => [key, process.env[key]]));
  Object.assign(process.env, { IDAMBOX_SEED_IAM: "false", CSRM_AUTH_OIDC_ENABLED: "false",
    IDAMBOX_SCIM_IP_LIMIT: String(options.ipLimit ?? 1200), IDAMBOX_SCIM_SOURCE_LIMIT: String(options.sourceLimit ?? 600) });
  const http = await startAuthorizationHttpHarness({ internalErrorMiddleware: true });
  let sequence = 0;
  async function source() {
    return http.withBackendFixture(async (backend) => {
      const registration = backendModule<typeof Registration>("iam/identity/source-registration");
      const tokens = backendModule<typeof Tokens>("iam/scim/token-service");
      const name = `scim-http-${++sequence}`;
      const record = await registration.registerIdentitySource(backend, {
        name, username: `${name}-service`, email: `${name}@scim.test`, displayName: name,
      });
      const credential = await tokens.administerSourceToken(backend, record.documentId);
      assert.ok("token" in credential);
      return { documentId: record.documentId, serviceUserId: record.serviceUser.documentId, token: credential.token };
    });
  }
  let primary: Awaited<ReturnType<typeof source>>;
  try { primary = await source(); }
  catch (error) {
    await http.close();
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    throw error;
  }
  return {
    http, source, primary,
    backend: <T>(work: (backend: Core.Strapi) => Promise<T>) => http.withBackendFixture(work),
    async capture<T>(work: () => Promise<T>) {
      return http.withBackendFixture(async backend => {
        const events: Record<string, unknown>[] = [];
        const mutations: Record<string, unknown>[] = [];
        const original = backend.log.info;
        backend.log.info = ((message: unknown) => {
          if (typeof message === "string" && message.startsWith("IAM identity ")) mutations.push(JSON.parse(message.slice("IAM identity ".length)));
          if (typeof message === "string" && message.startsWith("{")) {
            const event = JSON.parse(message) as Record<string, unknown>;
            if (typeof event.event === "string" && event.event.startsWith("scim.")) events.push(event);
          }
        }) as typeof original;
        try { return { result: await work(), events, mutations }; }
        finally { backend.log.info = original; }
      });
    },
    raw(requestPath: string, method: string, body: string, headers: Record<string, string> = {}, token = primary.token) {
      return http.request({ path: requestPath, omitApiToken: true, init: { method,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/scim+json",
          "Content-Type": "application/scim+json", ...headers }, body,
      } });
    },
    request(requestPath: string, method = "GET", body?: unknown, options: { token?: string | null; headers?: Record<string, string> } = {}) {
      const token = options.token === undefined ? primary.token : options.token;
      return http.request({ path: requestPath, omitApiToken: true, init: { method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: "application/scim+json",
          ...(body === undefined ? {} : { "Content-Type": "application/scim+json" }), ...options.headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      } });
    },
    wire(request: ScimReplayRequest) {
      return http.request({ path: request.path, omitApiToken: true, init: { method: request.method,
        headers: { Authorization: `Bearer ${primary.token}`, ...request.headers },
        ...(request.body === null ? {} : { body: JSON.stringify(request.body) }),
      } });
    },
    async layers() {
      return http.withBackendFixture(async backend => backend.server.listRoutes()
        .map(layer => ({ path: layer.path, methods: [...layer.methods] })));
    },
    async close() {
      try { await http.close(); }
      finally {
        for (const [key, value] of saved) {
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
      }
    },
  };
}

export type ScimReplayRequest = {
  method: string; path: string; headers: Record<string, string>; body: unknown;
};

/** Observe the mounted listener, retaining only the capture's safe request fields. */
export async function observeScimRequests<T>(harness: Awaited<ReturnType<typeof startScimHttpHarness>>,
  work: () => Promise<T>) {
  return harness.backend(async backend => {
    const requests: ScimReplayRequest[] = [];
    const middleware: (typeof backend.server.app.middleware)[number] = async (context, next) => {
      if (!context.path.startsWith("/scim/v2/")) return next();
      const request: ScimReplayRequest = { method: context.method, path: context.originalUrl,
        headers: Object.fromEntries(["accept", "content-type", "retry-after"]
          .flatMap(key => context.get(key) ? [[key, context.get(key)]] : [])), body: null };
      requests.push(request);
      await next();
      request.body = context.request.length > 0 ? context.request.body : null;
    };
    backend.server.app.middleware.unshift(middleware);
    try { return { result: await work(), requests }; }
    finally {
      const index = backend.server.app.middleware.indexOf(middleware);
      assert.ok(index >= 0);
      backend.server.app.middleware.splice(index, 1);
    }
  });
}

/** Keep the capture's manual candidates and bind unrelated harness people to another source. */
export async function prepareScimReplay(harness: Awaited<ReturnType<typeof startScimHttpHarness>>,
  candidates: ReadonlyArray<{ userName: string; displayName: string; active: boolean;
    emails: Array<{ value: string }>; name: { givenName: string; familyName: string } }>) {
  const other = await harness.source();
  await harness.backend(async backend => {
    const { resolveSourcePrincipal } = backendModule<typeof import("../../src/iam/identity/source-principal")>("iam/identity/source-principal");
    const { createIdentityService } = backendModule<typeof import("../../src/iam/identity/identity-service")>("iam/identity/identity-service");
    const principal = await resolveSourcePrincipal(backend, other.documentId);
    assert.ok(principal);
    const users = backend.documents("api::idambox-user.idambox-user");
    for (const row of await users.findMany({ limit: 1000 })) {
      if (row.protected || candidates.some(candidate => candidate.userName === row.username)) continue;
      const outcome: import("../../src/iam/identity/identity-input").IdentityOutcome = await createIdentityService(backend).replaceFromSource(principal, row.documentId, {
        username: row.username!, email: row.email!, displayName: row.displayName!, accountStatus: row.accountStatus!,
        sourceExternalId: `replay-baseline-${row.documentId}`,
      });
      assert.equal(outcome.ok, true, "unrelated harness user must belong to the other source");
    }
    for (const candidate of candidates) {
      const found = await users.findFirst({ filters: { username: candidate.userName } });
      if (found) continue;
      await users.create({ data: { username: candidate.userName, email: candidate.emails[0].value,
        displayName: candidate.displayName, firstName: candidate.name.givenName, lastName: candidate.name.familyName,
        accountStatus: candidate.active ? "active" : "inactive", protected: false, roles: [] } });
    }
  });
  return other;
}
