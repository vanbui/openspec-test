import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after } from "node:test";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { keycloakSubjects, startAuthorizationHttpHarness, type AuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Keycloak access-token identity end to end through the mounted Strapi (docs/adr/0004): a local
 * JWKS stands in for the realm, the harness boots with verification on, and every call carries the
 * API token plus x-csrm-identity-token, exactly as the web's OIDC transport sends them.
 */

const CLIENT_ID = "idambox-csrm";
const ACCESS = "/api/v1/me/access";

type Claims = Record<string, unknown>;

const keysPromise = generateKeyPair("RS256");
let jwksServer: Server | undefined;

async function startJwksServer(): Promise<string> {
  const { publicKey } = await keysPromise;
  const jwk = { ...(await exportJWK(publicKey)), kid: "realm-key", alg: "RS256", use: "sig" };
  jwksServer = createServer((request, response) => {
    if (request.url === "/realms/idambox/protocol/openid-connect/certs") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => jwksServer!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/realms/idambox`;
}

const issuerPromise = startJwksServer();
const harnessPromise = issuerPromise.then((issuer) =>
  startAuthorizationHttpHarness({ keycloakTokenVerification: { issuer, clientId: CLIENT_ID } }),
);

after(async () => {
  await (await harnessPromise).close();
  await new Promise<void>((resolve) => (jwksServer ? jwksServer.close(() => resolve()) : resolve()));
});

async function accessToken(subject: string, overrides: Claims = {}, expiresIn = "5m"): Promise<string> {
  const { privateKey } = await keysPromise;
  const claims: Claims = { iss: await issuerPromise, typ: "Bearer", azp: CLIENT_ID, aud: CLIENT_ID, sub: subject, ...overrides };
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "realm-key" }).setIssuedAt().setExpirationTime(expiresIn).sign(privateKey);
}

async function get(harness: AuthorizationHttpHarness, path: string, headers: Record<string, string>): Promise<Response> {
  return harness.request({ path, init: { headers } });
}

async function readAccess(response: Response): Promise<{ displayName: string; functions: Array<{ menuPath: string }>; operations: string[] }> {
  assert.equal(response.status, 200);
  return ((await response.json()) as { data: { displayName: string; functions: Array<{ menuPath: string }>; operations: string[] } }).data;
}

test("a verified Requestor token resolves Jane and reports only the Requestor birthright", async () => {
  const harness = await harnessPromise;
  const access = await readAccess(await get(harness, ACCESS, { "x-csrm-identity-token": await accessToken(keycloakSubjects.owner) }));

  assert.equal(access.displayName, "Jane Doe");
  assert.ok(access.operations.includes("GET:/api/v1/me/access"));
  assert.ok(access.operations.includes("GET:/api/csrm-assessment-requests"));
  assert.ok(access.operations.includes("POST:/api/csrm-assessment-requests"));
  assert.equal(access.operations.includes("GET:/api/v1/risks"), false);
  assert.equal(access.operations.includes("GET:/api/v1/assessment_requests"), false);
  assert.ok(access.functions.some((fn) => fn.menuPath === "Risk Assessment Requests:My Requests"));
  assert.equal(access.functions.some((fn) => fn.menuPath === "Risk Register:Risk Register"), false);
});

test("a verified Security Analyst token resolves Bob with the analyst grants, human-only operations included", async () => {
  const harness = await harnessPromise;
  const access = await readAccess(await get(harness, ACCESS, { "x-csrm-identity-token": await accessToken(keycloakSubjects.analyst) }));

  assert.equal(access.displayName, "Bob Doe");
  for (const operation of [
    "GET:/api/csrm-assessment-requests",
    "GET:/api/v1/assessment_requests",
    "GET:/api/v1/risks",
    "GET:/api/v1/risk_types",
    "POST:/api/v1/risk_assessments/{assessmentId}/release",
  ]) {
    assert.ok(access.operations.includes(operation), operation);
  }
});

test("the service agent's token never lists a human-analyst-only operation", async () => {
  const harness = await harnessPromise;
  const access = await readAccess(await get(harness, ACCESS, { "x-csrm-identity-token": await accessToken(keycloakSubjects.serviceAnalystAgent) }));

  assert.equal(access.operations.includes("POST:/api/v1/risk_assessments/{assessmentId}/release"), false);
  assert.equal(access.operations.includes("GET:/api/v1/dashboard/summary"), false);
});

test("the token-resolved identity is enforced by the ordinary policy on other operations", async () => {
  const harness = await harnessPromise;
  const jane = { "x-csrm-identity-token": await accessToken(keycloakSubjects.owner) };
  const bob = { "x-csrm-identity-token": await accessToken(keycloakSubjects.analyst) };

  // Record-level authorisation follows the token's person: Jane reads her own request, not another requestor's.
  assert.equal((await get(harness, `/api/csrm-assessment-requests/${harness.requests.owner}`, jane)).status, 200);
  assert.equal((await get(harness, `/api/csrm-assessment-requests/${harness.requests.otherRequestor}`, jane)).status, 403);
  assert.equal((await get(harness, "/api/v1/risks", jane)).status, 403);
  assert.equal((await get(harness, "/api/v1/risks", bob)).status, 200);
});

test("every unusable token is refused with the ordinary 403, and nothing says why", async () => {
  const harness = await harnessPromise;
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT({ iss: await issuerPromise, typ: "Bearer", azp: CLIENT_ID, aud: CLIENT_ID, sub: keycloakSubjects.analyst })
    .setProtectedHeader({ alg: "RS256", kid: "realm-key" })
    .setExpirationTime("5m")
    .sign(other.privateKey);

  const refused: Array<[string, string]> = [
    ["expired", await accessToken(keycloakSubjects.analyst, {}, "-1m")],
    ["id token", await accessToken(keycloakSubjects.analyst, { typ: "ID" })],
    ["other audience", await accessToken(keycloakSubjects.analyst, { aud: "account" })],
    ["other client", await accessToken(keycloakSubjects.analyst, { azp: "idambox-strapi-admin" })],
    ["other issuer", await accessToken(keycloakSubjects.analyst, { iss: "http://127.0.0.1:1/realms/idambox" })],
    ["forged signature", forged],
    ["inactive user", await accessToken(keycloakSubjects.inactiveAnalyst)],
    ["unknown subject", await accessToken("kc-subject-nobody")],
    ["not a jwt", "not-a-jwt"],
  ];

  for (const [label, token] of refused) {
    const response = await get(harness, ACCESS, { "x-csrm-identity-token": token });
    assert.equal(response.status, 403, label);
    const body = await response.text();
    for (const leak of ["expired", "audience", "signature", "issuer", "inactive", "JWT"]) {
      assert.equal(body.includes(leak), false, `${label} must not say ${leak}`);
    }
  }

  assert.equal((await get(harness, ACCESS, {})).status, 403, "no identity at all");
});

test("the development identity header is ignored while token verification is on", async () => {
  const harness = await harnessPromise;
  const saved = { NODE_ENV: process.env.NODE_ENV, CSRM_ENVIRONMENT: process.env.CSRM_ENVIRONMENT, CSRM_DEV_IDENTITY: process.env.CSRM_DEV_IDENTITY };
  Object.assign(process.env, { NODE_ENV: "development", CSRM_ENVIRONMENT: "development", CSRM_DEV_IDENTITY: "true" });
  try {
    assert.equal((await get(harness, ACCESS, { "x-csrm-dev-identity": harness.developmentEmails.bob })).status, 403);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("the access operation still needs the API token", async () => {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: ACCESS,
    omitApiToken: true,
    init: { headers: { "x-csrm-identity-token": await accessToken(keycloakSubjects.analyst) } },
  });

  assert.equal(response.status, 401);
});
