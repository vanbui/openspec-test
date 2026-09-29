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
  ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "DATABASE_CLIENT", "DATABASE_FILENAME", "STRAPI_ADMIN_AUTO_OPEN", "IDAMBOX_KEYCLOAK_PROVISIONING"]
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
