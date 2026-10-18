import assert from "node:assert/strict";
import test from "node:test";

import type { Core } from "@strapi/strapi";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";

import { summariseEffectiveAccess } from "../src/api/csrm-current-user/services/effective-access";
import { createAccessTokenVerifier } from "../src/keycloak/access-token-verifier";
import { DEVELOPMENT_FIXTURE_SUBJECTS, developmentFixtureSubject } from "../src/keycloak/development-fixture-subjects";
import {
  DEFAULT_JWKS_TIMEOUT_MS,
  KeycloakTokenVerificationConfigurationError,
  readKeycloakTokenVerificationConfig,
  type KeycloakTokenVerificationConfig,
} from "../src/keycloak/token-verification-config";
import csrmDevelopmentIdentity from "../src/middlewares/csrm-development-identity";
import { createKeycloakIdentityMiddleware, IDENTITY_TOKEN_HEADER } from "../src/middlewares/csrm-keycloak-identity";

const ISSUER = "https://keycloak.example.test/realms/idambox";
const CLIENT_ID = "idambox-csrm";
const SUBJECT = "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e02";

const config: KeycloakTokenVerificationConfig = { issuer: ISSUER, clientId: CLIENT_ID, requestTimeoutMs: 1000 };

const completeEnv = {
  IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "true",
  KEYCLOAK_ISSUER: `${ISSUER}/`,
  KEYCLOAK_TOKEN_CLIENT_ID: CLIENT_ID,
};

async function signingKeys() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "realm-key", alg: "RS256", use: "sig" };
  return { privateKey, keys: createLocalJWKSet({ keys: [jwk] }) };
}

type Claims = Record<string, unknown>;

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

async function accessToken(privateKey: SigningKey, overrides: Claims = {}, expiresIn = "5m"): Promise<string> {
  const claims: Claims = { iss: ISSUER, typ: "Bearer", azp: CLIENT_ID, aud: CLIENT_ID, sub: SUBJECT, ...overrides };
  const jwt = new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "realm-key" }).setIssuedAt();
  return jwt.setExpirationTime(expiresIn).sign(privateKey);
}

test("token verification config is inert unless the flag is true", () => {
  assert.equal(readKeycloakTokenVerificationConfig({}), null);
  assert.equal(readKeycloakTokenVerificationConfig({ IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "false" }), null);
  assert.throws(
    () => readKeycloakTokenVerificationConfig({ IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION: "yes" }),
    KeycloakTokenVerificationConfigurationError,
  );
});

test("token verification config requires every value and never echoes one", () => {
  assert.deepEqual(readKeycloakTokenVerificationConfig(completeEnv), {
    issuer: ISSUER,
    clientId: CLIENT_ID,
    requestTimeoutMs: DEFAULT_JWKS_TIMEOUT_MS,
  });
  for (const key of ["KEYCLOAK_ISSUER", "KEYCLOAK_TOKEN_CLIENT_ID"] as const) {
    assert.throws(
      () => readKeycloakTokenVerificationConfig({ ...completeEnv, [key]: " " }),
      new RegExp(`${key} is not configured`),
    );
  }
  assert.throws(
    () => readKeycloakTokenVerificationConfig({ ...completeEnv, KEYCLOAK_ISSUER: "https://user:secret@kc.test/realms/x" }),
    (error: Error) => !error.message.includes("secret"),
  );
  assert.throws(
    () => readKeycloakTokenVerificationConfig({ ...completeEnv, KEYCLOAK_ISSUER: "http://kc.test/realms/idambox", NODE_ENV: "production" }),
    /https:\/\/ in production/,
  );
  assert.equal(
    readKeycloakTokenVerificationConfig({ ...completeEnv, KEYCLOAK_ISSUER: "http://localhost:8080/realms/idambox" })?.issuer,
    "http://localhost:8080/realms/idambox",
  );
});

test("the verifier accepts a CSRM access token and returns its subject", async () => {
  const { privateKey, keys } = await signingKeys();
  const verify = createAccessTokenVerifier(config, keys);
  assert.equal(await verify(await accessToken(privateKey)), SUBJECT);
});

test("the verifier rejects ID tokens, other clients, other issuers, expired and unsigned tokens", async () => {
  const { privateKey, keys } = await signingKeys();
  const other = await signingKeys();
  const verify = createAccessTokenVerifier(config, keys);

  const rejected: Array<[string, Promise<string>]> = [
    ["id token", accessToken(privateKey, { typ: "ID" })],
    ["other audience", accessToken(privateKey, { aud: "account" })],
    ["other authorized party", accessToken(privateKey, { azp: "idambox-strapi-admin" })],
    ["no subject", accessToken(privateKey, { sub: undefined })],
    ["other issuer", accessToken(privateKey, { iss: "https://evil.example.test/realms/idambox" })],
    ["expired", accessToken(privateKey, {}, "-1m")],
    ["other signing key", accessToken(other.privateKey)],
  ];

  for (const [label, token] of rejected) {
    await assert.rejects(verify(await token), `${label} must be rejected`);
  }
  await assert.rejects(verify("not-a-jwt"));
});

type Identity = { documentId: string; accountStatus?: string; externalSubject?: string };

function fakeStrapi(identities: Identity[], warnings: string[] = []): Core.Strapi {
  return {
    documents: () => ({
      findMany: async ({ filters }: { filters: Record<string, { $eq: string }> }) =>
        identities.filter((identity) =>
          Object.entries(filters).every(([key, value]) => (identity as Record<string, unknown>)[key] === value.$eq),
        ),
    }),
    log: { warn: (message: string) => warnings.push(message), info: () => undefined },
  } as unknown as Core.Strapi;
}

function context(headers: Record<string, string>) {
  return {
    get: (name: string) => headers[name.toLowerCase()] ?? "",
    state: {} as Record<string, unknown>,
  };
}

test("a verified subject resolves only an active IdamBox User by externalSubject", async () => {
  const identities = [
    { documentId: "doc-bob", accountStatus: "active", externalSubject: SUBJECT },
    { documentId: "doc-gone", accountStatus: "inactive", externalSubject: "inactive-subject" },
  ];
  const cases: Array<[string, string | undefined]> = [
    [SUBJECT, "doc-bob"],
    ["inactive-subject", undefined],
    ["unknown-subject", undefined],
  ];

  for (const [subject, expected] of cases) {
    const middleware = createKeycloakIdentityMiddleware(fakeStrapi(identities), async () => subject);
    const ctx = context({ [IDENTITY_TOKEN_HEADER]: "token" });
    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.deepEqual(ctx.state.idamboxUser, expected === undefined ? undefined : { documentId: expected });
  }
});

test("a rejected token leaves the identity unset and logs no token", async () => {
  const warnings: string[] = [];
  const middleware = createKeycloakIdentityMiddleware(fakeStrapi([], warnings), async () => {
    throw Object.assign(new Error("secret-token-value"), { name: "JWTExpired" });
  });
  const ctx = context({ [IDENTITY_TOKEN_HEADER]: "secret-token-value" });
  await middleware(ctx, async () => undefined);

  assert.equal(ctx.state.idamboxUser, undefined);
  assert.deepEqual(warnings, ["CSRM Keycloak identity failed closed (JWTExpired)."]);
});

test("no header means no verification and no identity", async () => {
  let verified = false;
  const middleware = createKeycloakIdentityMiddleware(fakeStrapi([]), async () => {
    verified = true;
    return SUBJECT;
  });
  const ctx = context({});
  await middleware(ctx, async () => undefined);
  assert.equal(verified, false);
  assert.equal(ctx.state.idamboxUser, undefined);
});

test("the development identity header is ignored while token verification is on", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: "development",
    CSRM_ENVIRONMENT: "development",
    CSRM_DEV_IDENTITY: "true",
  });
  const strapi = fakeStrapi([{ documentId: "doc-bob", accountStatus: "active" }]);
  // The fake matches every identity, so any lookup would resolve doc-bob.
  (strapi as unknown as { documents: () => unknown }).documents = () => ({
    findMany: async () => [{ documentId: "doc-bob", accountStatus: "active" }],
  });

  try {
    const middleware = csrmDevelopmentIdentity(undefined, { strapi });

    process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = "false";
    const bridged = context({ "x-csrm-dev-identity": "bob.doe@idambox.com" });
    await middleware(bridged, async () => undefined);
    assert.deepEqual(bridged.state.idamboxUser, { documentId: "doc-bob" });

    process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = "true";
    const ignored = context({ "x-csrm-dev-identity": "bob.doe@idambox.com" });
    await middleware(ignored, async () => undefined);
    assert.equal(ignored.state.idamboxUser, undefined);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("effective access lists birthright and explicit grants, and human-only operations only for the human analyst", () => {
  const release = "POST:/api/v1/risk_assessments/{assessmentId}/release";
  const requestorRole = {
    name: "Requestor",
    functions: [
      { name: "My Requests", menuPath: "Risk Assessment Requests:My Requests", functionApis: [{ url: "GET:/api/v1/assessment_requests" }] },
      { name: "Current User Access API", menuPath: null, functionApis: [{ url: "GET:/api/v1/me/access" }] },
    ],
  };
  const analystFunctions = [
    { name: "Risk Register", menuPath: "Risk Register:Risk Register", functionApis: [{ url: "GET:/api/v1/risks" }] },
    { name: "Risk Assessment Details", menuPath: "Risk Assessments:Risk Assessment Details", functionApis: [{ url: release }] },
  ];

  const requestor = summariseEffectiveAccess({
    registeredSourceService: false,
    displayName: "Jane Doe",
    explicitRoles: [],
    requestorRoles: [requestorRole],
    requestorId: 1,
  });
  assert.deepEqual(requestor, {
    displayName: "Jane Doe",
    functions: [{ name: "My Requests", menuPath: "Risk Assessment Requests:My Requests" }],
    operations: ["GET:/api/v1/assessment_requests", "GET:/api/v1/me/access"],
  });

  const analyst = summariseEffectiveAccess({
    registeredSourceService: false,
    displayName: "Bob Doe",
    explicitRoles: [{ name: "Security Analyst", functions: analystFunctions }],
    requestorRoles: [requestorRole],
    requestorId: 2,
  });
  assert.ok(analyst.operations.includes(release));
  assert.ok(analyst.operations.includes("GET:/api/v1/risks"));
  assert.deepEqual(analyst.functions.map((f) => f.menuPath), [
    "Risk Assessment Requests:My Requests",
    "Risk Assessments:Risk Assessment Details",
    "Risk Register:Risk Register",
  ]);

  const agent = summariseEffectiveAccess({
    registeredSourceService: false,
    displayName: "Agent",
    explicitRoles: [{ name: "Security Analyst Agent", functions: analystFunctions }],
    requestorRoles: [requestorRole],
    requestorId: 3,
  });
  assert.equal(agent.operations.includes(release), false);
});

test("effective access offers the My requests export to every person through the birthright, and never to the service agent the policy refuses (19-07)", () => {
  const exportMine = "GET:/api/v1/my_requests/export";
  const requestorRole = {
    name: "Requestor",
    functions: [
      { name: "My Requests", menuPath: "Risk Assessment Requests:My Requests", functionApis: [{ url: "GET:/api/v1/my_requests" }] },
      { name: "My List Export API", menuPath: null, functionApis: [{ url: exportMine }] },
    ],
  };
  const analystFunctions = [{ name: "Risk Register", menuPath: "Risk Register:Risk Register", functionApis: [{ url: "GET:/api/v1/risks" }] }];
  const summarise = (displayName: string, explicitRoles: Array<{ name: string; functions: typeof analystFunctions }>, requestorId: number) =>
    summariseEffectiveAccess({ registeredSourceService: false, displayName, explicitRoles, requestorRoles: [requestorRole], requestorId });

  const jane = summarise("Jane Doe", [], 1);
  assert.ok(jane.operations.includes(exportMine), "JANE_NOT_OFFERED_HER_EXPORT");
  const bob = summarise("Bob Doe", [{ name: "Security Analyst", functions: analystFunctions }], 2);
  assert.ok(bob.operations.includes(exportMine), "BOB_NOT_OFFERED_HIS_EXPORT");
  const agent = summarise("Agent", [{ name: "Security Analyst Agent", functions: analystFunctions }], 3);
  assert.equal(agent.operations.includes(exportMine), false, "THE_AGENT_IS_OFFERED_AN_EXPORT_THE_POLICY_REFUSES");
  // The birthright's other operations stay offered to the agent: only the refused export is withheld.
  assert.ok(agent.operations.includes("GET:/api/v1/my_requests"), "THE_AGENT_LOST_ITS_BIRTHRIGHT_LIST");
});

test("the development seed links fixture people to their local Keycloak ids only in development and never under provisioning", () => {
  const saved = { ...process.env };
  const restore = () => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  };
  try {
    Object.assign(process.env, { NODE_ENV: "development", CSRM_ENVIRONMENT: "development", CSRM_DEV_IDENTITY: "true", IDAMBOX_KEYCLOAK_PROVISIONING: "false" });
    assert.deepEqual(developmentFixtureSubject("bob.doe@idambox.com"), { externalSubject: DEVELOPMENT_FIXTURE_SUBJECTS["bob.doe@idambox.com"] });

    process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "true";
    assert.deepEqual(developmentFixtureSubject("bob.doe@idambox.com"), {});

    process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
    process.env.NODE_ENV = "production";
    assert.deepEqual(developmentFixtureSubject("jane.doe@idambox.com"), {});
  } finally {
    restore();
  }
});

test("the fixture ids match the local realm import", async () => {
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const realm = JSON.parse(
    readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "..", "docker", "keycloak", "import", "idambox-realm.json"), "utf8"),
  ) as { users: Array<{ id?: string; email?: string }> };

  for (const [email, id] of Object.entries(DEVELOPMENT_FIXTURE_SUBJECTS)) {
    assert.equal(realm.users.find((user) => user.email === email)?.id, id, email);
  }
});
