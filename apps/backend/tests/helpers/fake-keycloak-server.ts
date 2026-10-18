import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type FakeKeycloakUser = {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  attributes?: Record<string, string[]>;
  requiredActions?: string[];
  password?: string;
};

export type FakeKeycloakRequest = { method: string; path: string; authorization?: string; body: unknown; rawBody: string };

type Override = { status: number; body?: string; delayMs?: number; bodyDelayMs?: number };

export const FAKE_KEYCLOAK_REALM = "idambox";
export const FAKE_KEYCLOAK_CLIENT_ID = "idambox-strapi-admin";
export const FAKE_KEYCLOAK_CLIENT_SECRET = "fake-keycloak-client-secret-do-not-log";

/*
 * An in-memory Keycloak serving the client-credentials token endpoint and the
 * Admin API user operations Strapi provisioning calls, with Keycloak's
 * observable behaviour: lower-cased emails, 409 on a duplicate username or
 * email, a Location header on create and 401 for an unknown bearer token.
 * `failNext` scripts one response for the next request whose "METHOD path"
 * starts with the given prefix; `revokeTokens` invalidates issued tokens.
 */
export async function startFakeKeycloakServer(options: { tokenLifetimeSeconds?: number } = {}) {
  const users = new Map<string, FakeKeycloakUser>();
  const sessions = new Map<string, Set<string>>();
  const requests: FakeKeycloakRequest[] = [];
  const validTokens = new Set<string>();
  const overrides: Array<{ prefix: string; override: Override }> = [];
  const barriers: Array<{ prefix: string; entered: () => void; wait: Promise<void>; release: () => void }> = [];
  const held = new Set<() => void>();
  let tokenLifetimeSeconds = options.tokenLifetimeSeconds ?? 300;

  const adminPrefix = `/admin/realms/${FAKE_KEYCLOAK_REALM}/users`;
  const tokenPath = `/realms/${FAKE_KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let body: unknown = null;
    try { body = JSON.parse(rawBody); } catch { body = null; }
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://fake");
    const authorization = request.headers.authorization;
    requests.push({ method, path: url.pathname + url.search, authorization, body, rawBody });

    const send = (status: number, payload?: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { "content-type": "application/json", ...headers });
      response.end(payload === undefined ? undefined : JSON.stringify(payload));
    };

    const key = `${method} ${url.pathname}`;
    const barrierIndex = barriers.findIndex(({ prefix }) => key.startsWith(prefix));
    if (barrierIndex >= 0) {
      const [barrier] = barriers.splice(barrierIndex, 1);
      barrier.entered(); await barrier.wait; held.delete(barrier.release);
    }
    const overrideIndex = overrides.findIndex(({ prefix }) => key.startsWith(prefix));
    if (overrideIndex >= 0) {
      const [{ override }] = overrides.splice(overrideIndex, 1);
      if (override.delayMs) await new Promise((resolve) => setTimeout(resolve, override.delayMs));
      response.writeHead(override.status, { "content-type": "application/json" });
      if (override.bodyDelayMs) {
        response.flushHeaders();
        await new Promise((resolve) => setTimeout(resolve, override.bodyDelayMs));
      }
      response.end(override.body ?? "");
      return;
    }

    if (method === "POST" && url.pathname === tokenPath) {
      const form = new URLSearchParams(rawBody);
      if (form.get("grant_type") !== "client_credentials" || form.get("client_id") !== FAKE_KEYCLOAK_CLIENT_ID
        || form.get("client_secret") !== FAKE_KEYCLOAK_CLIENT_SECRET) {
        return send(401, { error: "unauthorized_client", error_description: "Invalid client or Invalid client credentials" });
      }
      const token = randomUUID();
      validTokens.add(token);
      return send(200, { access_token: token, expires_in: tokenLifetimeSeconds, token_type: "Bearer" });
    }

    if (!url.pathname.startsWith(adminPrefix)) return send(404, { error: "Not found" });
    if (!authorization?.startsWith("Bearer ") || !validTokens.has(authorization.slice(7))) {
      return send(401, { error: "HTTP 401 Unauthorized" });
    }

    const rest = url.pathname.slice(adminPrefix.length).split("/").filter(Boolean).map(decodeURIComponent);
    const input = (body ?? {}) as Partial<FakeKeycloakUser> & { credentials?: Array<{ value: string }>; value?: string };
    const conflictFor = (candidate: Partial<FakeKeycloakUser>, selfId?: string) =>
      [...users.values()].find((user) => user.id !== selfId && (
        (candidate.username !== undefined && user.username === candidate.username.toLowerCase())
        || (candidate.email !== undefined && user.email === candidate.email.toLowerCase())));

    if (method === "GET" && rest.length === 0) {
      const email = url.searchParams.get("email")?.toLowerCase();
      return send(200, [...users.values()].filter((user) => user.email === email).map(publicUser));
    }
    if (method === "POST" && rest.length === 0) {
      const conflict = conflictFor(input);
      if (conflict) {
        return send(409, { errorMessage: conflict.email === input.email?.toLowerCase() ? "User exists with same email" : "User exists with same username" });
      }
      const id = randomUUID();
      users.set(id, {
        ...input,
        id,
        username: (input.username ?? "").toLowerCase(),
        email: (input.email ?? "").toLowerCase(),
        password: input.credentials?.[0]?.value,
      } as FakeKeycloakUser);
      return send(201, undefined, { location: `http://${request.headers.host}${adminPrefix}/${id}` });
    }

    const user = users.get(rest[0] ?? "");
    if (!user) return send(404, { error: "User not found" });
    if (method === "GET" && rest.length === 1) return send(200, publicUser(user));
    if (method === "PUT" && rest.length === 1) {
      if (conflictFor(input, user.id)) return send(409, { errorMessage: "User exists with same email" });
      Object.assign(user, input, input.email ? { email: input.email.toLowerCase() } : {});
      return send(204);
    }
    if (method === "PUT" && rest[1] === "reset-password") {
      user.password = input.value;
      return send(204);
    }
    if (method === "POST" && rest.length === 2 && rest[1] === "logout") {
      sessions.delete(user.id);
      return send(204);
    }
    return send(501, { error: "Unimplemented fake route" });
  });

  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    users,
    sessions,
    requests,
    adminRequests: () => requests.filter((request) => request.path.startsWith("/admin/")),
    tokenRequests: () => requests.filter((request) => request.path === tokenPath),
    addUser(user: Omit<FakeKeycloakUser, "id"> & { id?: string }) {
      const stored = { ...user, id: user.id ?? randomUUID(), email: user.email.toLowerCase(), username: user.username.toLowerCase() };
      users.set(stored.id, stored);
      return stored;
    },
    failNext(prefix: string, override: Override) {
      overrides.push({ prefix, override });
    },
    holdNext(prefix: string) {
      let entered!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>((resolve) => { entered = resolve; });
      const wait = new Promise<void>((resolve) => { release = resolve; });
      held.add(release); barriers.push({ prefix, entered, wait, release });
      return { entered: arrived, release };
    },
    revokeTokens() {
      validTokens.clear();
    },
    setTokenLifetimeSeconds(seconds: number) {
      tokenLifetimeSeconds = seconds;
    },
    close: () => new Promise<void>((resolve, reject) => {
      for (const release of held) release();
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

function publicUser(user: FakeKeycloakUser) {
  const { password: _password, ...rest } = user;
  return rest;
}
