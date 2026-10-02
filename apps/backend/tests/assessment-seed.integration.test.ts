import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { seedAssessmentWorkflow, ASSESSMENT_RISK_TYPE_SEEDS } from "../src/bootstrap/seed-assessment-workflow";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";
import { seedQuestionnaireWorkflow } from "../src/bootstrap/seed-questionnaire-workflow";
import { DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES } from "../src/api/csrm-assessment/services/deterministic-assessment-draft-provider";

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = {
  count: (input?: Record<string, unknown>) => Promise<number>;
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
};
type RunningStrapi = {
  dirs: { app: { root: string } };
  documents: (uid: string) => DocumentService;
  destroy: () => Promise<void>;
};

const appDir = path.resolve(__dirname, "..", "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "assessment-seed-tests");
const databaseFilename = path.join(databaseDir, `assessment-seed-${process.pid}.sqlite`);
const originalEnvironment = new Map(
  ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "DATABASE_CLIENT", "DATABASE_FILENAME", "STRAPI_ADMIN_AUTO_OPEN", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION"]
    .map((name) => [name, process.env[name]] as const),
);

let strapi: RunningStrapi;

async function withSeedEnvironment(
  values: { nodeEnv?: string; environment?: string; identity?: string; seed?: string },
  action: () => Promise<void>,
) {
  const entries = [
    ["NODE_ENV", values.nodeEnv],
    ["CSRM_ENVIRONMENT", values.environment],
    ["CSRM_DEV_IDENTITY", values.identity],
    ["IDAMBOX_SEED_CSRM", values.seed],
  ] as const;
  const previous = new Map(entries.map(([name]) => [name, process.env[name]]));
  for (const [name, value] of entries) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    await action();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function findBy(uid: string, filters: Record<string, unknown>, populate?: Record<string, unknown>) {
  return strapi.documents(uid).findMany({ filters, ...(populate ? { populate } : {}), limit: 100 });
}

before(async () => {
  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "assessment-seed-test-1,assessment-seed-test-2";
  process.env.ADMIN_JWT_SECRET = "assessment-seed-admin";
  process.env.API_TOKEN_SALT = "assessment-seed-api";
  process.env.TRANSFER_TOKEN_SALT = "assessment-seed-transfer";
  process.env.ENCRYPTION_KEY = "assessment-seed-encryption";
  process.env.JWT_SECRET = "assessment-seed-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  // Tests never reach Keycloak, whatever the developer .env enables.
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
  process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = "false";
  process.env.STRAPI_ADMIN_AUTO_OPEN = "false";

  const strapiPackage = require("@strapi/strapi") as {
    compileStrapi: (options: { appDir: string }) => Promise<{ appDir: string; distDir: string }>;
    createStrapi: (options: { appDir: string; distDir: string }) => RunningStrapi & { load: () => Promise<RunningStrapi> };
  };
  const compiled = await strapiPackage.compileStrapi({ appDir });
  strapi = await strapiPackage.createStrapi(compiled).load();
  (strapi as unknown as { cron?: { destroy?: () => void } }).cron?.destroy?.();

  process.env.IDAMBOX_SEED_CSRM = "true";
  await seedCsrmData(strapi as never);
});

after(async () => {
  if (strapi) await strapi.destroy();
  await rm(databaseFilename, { force: true });
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function seededControl(controlNumber: string): Promise<Document> {
  const [control] = await findBy("api::csrm-control.csrm-control", { controlNumber: { $eq: controlNumber } });
  assert.ok(control, `${controlNumber} is seeded`);
  return control;
}

/*
 * D-36, D-44 (UI-SPEC §16.3): the Australian Privacy Principles read as Schedule 1 titles them, in sentence
 * case, and the fragment of each truncated title no longer opens its legal text (the seed copies legalText
 * into the description). APP-7's text opens with its own heading, which is not a leak.
 */
test("ADMIN-05 the seeded Privacy Principles carry their complete titles and legal text", async () => {
  assert.equal((await seededControl("APP-1")).name, "APP-1 — Open and transparent management of personal information");
  assert.equal((await seededControl("APP-2")).name, "APP-2 — Anonymity and pseudonymity");
  const app11 = await seededControl("APP-11");
  assert.equal(app11.name, "APP-11 — Security of personal information");
  assert.ok(String(app11.description).startsWith("11.1 If an APP entity holds"), String(app11.description).slice(0, 60));
  assert.ok(String((await seededControl("APP-7")).description).startsWith("Direct marketing 7.1"));
});

test("ADMIN-05 a seeded start corrects a Privacy Principle an earlier seed stored truncated", async () => {
  const app11 = await seededControl("APP-11");
  await strapi.documents("api::csrm-control.csrm-control").update({
    documentId: app11.documentId,
    data: { name: "APP-11 — security of personal", description: "information 11.1 If an APP entity holds personal information" },
  });
  await seedCsrmData(strapi as never);
  const corrected = await seededControl("APP-11");
  assert.equal(corrected.documentId, app11.documentId);
  assert.equal(corrected.name, "APP-11 — Security of personal information");
  assert.ok(String(corrected.description).startsWith("11.1 If an APP entity holds"));
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

test("assessment workflow RiskType seed requires every exact development gate", async () => {
  for (const values of [
    { nodeEnv: "production", environment: "development", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "production", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "false", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "true", seed: "false" },
  ]) await withSeedEnvironment(values, () => seedAssessmentWorkflow(strapi as never));
  assert.deepEqual(await findBy("api::csrm-risk-type.csrm-risk-type", { name: { $in: [...DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES] } }), []);
});

test("assessment workflow seed is idempotent and preserves controls and Phase 3 fixtures", async () => {
  const enabled = { nodeEnv: "development", environment: "development", identity: "true", seed: "true" };
  await withSeedEnvironment(enabled, () => seedQuestionnaireWorkflow(strapi as never));
  await withSeedEnvironment(enabled, () => seedAssessmentWorkflow(strapi as never));
  await withSeedEnvironment(enabled, () => seedAssessmentWorkflow(strapi as never));

  const riskTypes = await findBy(
    "api::csrm-risk-type.csrm-risk-type",
    { name: { $in: [...DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES] } },
    { applicableControls: true },
  );
  assert.equal(riskTypes.length, 3);
  assert.deepEqual(riskTypes.map((riskType) => riskType.name).sort(), [...DETERMINISTIC_ASSESSMENT_RISK_TYPE_NAMES]);
  for (const riskType of riskTypes) {
    const name = riskType.name as keyof typeof ASSESSMENT_RISK_TYPE_SEEDS;
    const actual = ((riskType.applicableControls as Document[] | undefined) ?? [])
      .map((control) => String(control.controlNumber)).sort();
    assert.deepEqual(actual, [...ASSESSMENT_RISK_TYPE_SEEDS[name].controlNumbers].sort(), name);
  }
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
  assert.equal((await findBy("api::csrm-assessment-request.csrm-assessment-request", { requestNumber: { $eq: "RAR-DEV-QUES-001" } })).length, 1);
  assert.equal((await findBy("api::csrm-questionnaire.csrm-questionnaire", { questionnaireNumber: { $eq: "QUES-DEV-001" } })).length, 1);
});

test("assessment workflow rerun repairs managed fields and applicable-Control relations", async () => {
  const [riskType] = await findBy("api::csrm-risk-type.csrm-risk-type", { name: { $eq: "Internet Exposure" } }, { applicableControls: true });
  assert.ok(riskType);
  await strapi.documents("api::csrm-risk-type.csrm-risk-type").update({
    documentId: riskType.documentId,
    data: { description: "Stale description", applicableControls: [] },
  });
  await withSeedEnvironment(
    { nodeEnv: "development", environment: "development", identity: "true", seed: "true" },
    () => seedAssessmentWorkflow(strapi as never),
  );
  const [repaired] = await findBy("api::csrm-risk-type.csrm-risk-type", { name: { $eq: "Internet Exposure" } }, { applicableControls: true });
  assert.equal(repaired.description, ASSESSMENT_RISK_TYPE_SEEDS["Internet Exposure"].description);
  assert.deepEqual(
    ((repaired.applicableControls as Document[] | undefined) ?? []).map((control) => String(control.controlNumber)).sort(),
    [...ASSESSMENT_RISK_TYPE_SEEDS["Internet Exposure"].controlNumbers].sort(),
  );
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

/* D-36 (UI-SPEC §16.3): each seeded Risk Type tells an analyst which risks it covers. */
const RISK_TYPE_DESCRIPTIONS = {
  "Internet Exposure": "Risks from services that can be reached from the internet or are hosted by an external provider, such as exposed interfaces, unpatched software and weak authentication.",
  "Personal Information Handling": "Risks from collecting, storing, using or sharing personal information, including privacy obligations, who can access the information and how long it is kept.",
  "Third-Party Dependency": "Risks from relying on an external provider for a service, such as the provider’s own security, its staff’s access to your systems and data, and the continuity of its service.",
} as const;

test("ADMIN-05 a seeded start gives each Risk Type its user-facing description", async () => {
  await withSeedEnvironment(
    { nodeEnv: "development", environment: "development", identity: "true", seed: "true" },
    () => seedAssessmentWorkflow(strapi as never),
  );
  for (const [name, description] of Object.entries(RISK_TYPE_DESCRIPTIONS)) {
    const [riskType] = await findBy("api::csrm-risk-type.csrm-risk-type", { name: { $eq: name } });
    assert.ok(riskType, `${name} is seeded`);
    assert.equal(riskType.description, description, name);
  }
});
