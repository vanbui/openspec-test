import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import {
  RISK_REGISTER_FIXTURE_KEYS,
  seedRiskRegisterWorkflow,
} from "../src/bootstrap/seed-risk-register-workflow";
import { seedAssessmentWorkflow } from "../src/bootstrap/seed-assessment-workflow";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";
import {
  createStrapiRiskRegisterRepository,
  getRiskRegisterDetail,
  listRiskRegister,
} from "../src/api/csrm-risk/services/risk-register";

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = {
  count: (input?: Record<string, unknown>) => Promise<number>;
  create: (input: { data: Record<string, unknown> }) => Promise<Document>;
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
};
type RunningStrapi = {
  dirs: { app: { root: string } };
  documents: (uid: string) => DocumentService;
  destroy: () => Promise<void>;
};

const appDir = path.resolve(__dirname, "..", "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "risk-register-seed-tests");
const databaseFilename = path.join(databaseDir, `risk-register-seed-${process.pid}.sqlite`);
const enabled = { nodeEnv: "development", environment: "development", identity: "true", seed: "true" };
const originalEnvironment = new Map(
  ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "DATABASE_CLIENT", "DATABASE_FILENAME", "STRAPI_ADMIN_AUTO_OPEN"]
    .map((name) => [name, process.env[name]] as const),
);

let strapi: RunningStrapi;
let releasedSnapshot: string;
let controlsSnapshot: string;

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

async function singleBy(uid: string, filters: Record<string, unknown>, populate?: Record<string, unknown>) {
  const rows = await findBy(uid, filters, populate);
  assert.equal(rows.length, 1);
  return rows[0];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

async function snapshotControls(): Promise<string> {
  const controls = await strapi.documents("api::csrm-control.csrm-control").findMany({
    fields: ["controlNumber", "controlReference", "description", "framework", "frameworkSource", "frameworkVersion", "name", "sourceData"],
    sort: ["controlNumber:asc"],
    limit: 3_000,
  });
  assert.equal(controls.length, 2_646);
  return stableJson(controls.map(({ documentId: _documentId, ...control }) => control));
}

async function snapshotReleasedFixture(): Promise<string> {
  const assessment = await singleBy(
    "api::csrm-assessment.csrm-assessment",
    { assessmentNumber: { $eq: "ASM-2026-33SAEN" } },
    { assessmentRequest: true, approvedBy: true, generatedBy: true, reviewedBy: true, risks: true },
  );
  return stableJson(assessment);
}

before(async () => {
  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "risk-register-seed-test-1,risk-register-seed-test-2";
  process.env.ADMIN_JWT_SECRET = "risk-register-seed-admin";
  process.env.API_TOKEN_SALT = "risk-register-seed-api";
  process.env.TRANSFER_TOKEN_SALT = "risk-register-seed-transfer";
  process.env.ENCRYPTION_KEY = "risk-register-seed-encryption";
  process.env.JWT_SECRET = "risk-register-seed-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
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
  await withSeedEnvironment(enabled, () => seedAssessmentWorkflow(strapi as never));

  const bob = await singleBy("api::idambox-user.idambox-user", { email: { $eq: "bob.doe@idambox.com" } });
  const releasedRequest = await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").create({
    data: {
      requestNumber: "RAR-RELEASED-33SAEN",
      title: "Canonical released assessment request",
      requestStatus: "approved",
      submittedDate: "2026-08-30T00:00:00.000Z",
      requestor: bob.documentId,
    },
  });
  await strapi.documents("api::csrm-assessment.csrm-assessment").create({
    data: {
      assessmentNumber: "ASM-2026-33SAEN",
      assessmentStatus: "approved",
      summary: "Canonical released assessment",
      overallRating: "Moderate",
      generatedDate: "2026-08-30T00:00:00.000Z",
      assessmentDate: "2026-08-30T00:00:00.000Z",
      approvalDate: "2026-08-30T00:00:00.000Z",
      generatedBy: bob.documentId,
      reviewedBy: bob.documentId,
      approvedBy: bob.documentId,
      assessmentRequest: releasedRequest.documentId,
    },
  });
  controlsSnapshot = await snapshotControls();
  releasedSnapshot = await snapshotReleasedFixture();
});

after(async () => {
  if (strapi) await strapi.destroy();
  await rm(databaseFilename, { force: true });
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("Risk Register workflow seed requires the seed flag and every exact development identity gate", async () => {
  for (const values of [
    { nodeEnv: "production", environment: "development", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "production", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "false", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "true", seed: "false" },
  ]) await withSeedEnvironment(values, () => seedRiskRegisterWorkflow(strapi as never));

  assert.deepEqual(await findBy("api::csrm-assessment-request.csrm-assessment-request", { requestNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.requestNumber } }), []);
  assert.deepEqual(await findBy("api::csrm-assessment.csrm-assessment", { assessmentNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.assessmentNumber } }), []);
  assert.deepEqual(await findBy("api::csrm-risk.csrm-risk", { riskNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.riskNumber } }), []);
  assert.equal(await snapshotControls(), controlsSnapshot);
  assert.equal(await snapshotReleasedFixture(), releasedSnapshot);
});

test("Risk Register workflow seed creates one stable Bob-owned mutable aggregate and repeat is idempotent", async () => {
  await withSeedEnvironment(enabled, () => Promise.all([
    seedRiskRegisterWorkflow(strapi as never),
    seedRiskRegisterWorkflow(strapi as never),
  ]).then(() => undefined));

  const beforeCounts = await Promise.all([
    strapi.documents("api::csrm-assessment-request.csrm-assessment-request").count(),
    strapi.documents("api::csrm-assessment.csrm-assessment").count(),
    strapi.documents("api::csrm-risk.csrm-risk").count(),
    strapi.documents("api::csrm-control-implementation.csrm-control-implementation").count(),
  ]);
  await withSeedEnvironment(enabled, () => seedRiskRegisterWorkflow(strapi as never));
  const afterCounts = await Promise.all([
    strapi.documents("api::csrm-assessment-request.csrm-assessment-request").count(),
    strapi.documents("api::csrm-assessment.csrm-assessment").count(),
    strapi.documents("api::csrm-risk.csrm-risk").count(),
    strapi.documents("api::csrm-control-implementation.csrm-control-implementation").count(),
  ]);
  assert.deepEqual(afterCounts, beforeCounts);

  const request = await singleBy("api::csrm-assessment-request.csrm-assessment-request", { requestNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.requestNumber } }, { requestor: true });
  const assessment = await singleBy("api::csrm-assessment.csrm-assessment", { assessmentNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.assessmentNumber } }, { assessmentRequest: true });
  const risk = await singleBy("api::csrm-risk.csrm-risk", { riskNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.riskNumber } }, { assessment: true, riskOwner: true, treatmentOwner: true, riskType: true, controlImplementations: { populate: { control: true, controlOwner: true } } });
  assert.equal(request.requestStatus, "under-review");
  assert.equal((request.requestor as Document).email, "bob.doe@idambox.com");
  assert.equal(assessment.assessmentStatus, "in-review");
  assert.equal((assessment.assessmentRequest as Document).documentId, request.documentId);
  assert.equal((risk.assessment as Document).documentId, assessment.documentId);
  assert.equal((risk.riskOwner as Document).email, "bob.doe@idambox.com");
  assert.equal((risk.treatmentOwner as Document).email, "bob.doe@idambox.com");
  assert.equal((risk.riskType as Document).name, "Internet Exposure");
  assert.match(String(risk.riskStatement), /mutable/i);
  const implementations = risk.controlImplementations as Document[];
  assert.equal(implementations.length, 1);
  assert.equal((implementations[0].control as Document).controlNumber, RISK_REGISTER_FIXTURE_KEYS.controlNumber);
  assert.equal((implementations[0].controlOwner as Document).email, "bob.doe@idambox.com");
  const repository = createStrapiRiskRegisterRepository(strapi as never);
  const state = { csrmAuthorization: { riskRegisterCollectionScope: "all" } };
  const register = await listRiskRegister({
    repository,
    state,
    query: { q: "mutable", sort: "riskNumber:asc", page: "1", pageSize: "25" },
  });
  assert.equal(register.meta.pagination.total, 1);
  assert.equal(register.data[0]?.riskNumber, RISK_REGISTER_FIXTURE_KEYS.riskNumber);
  const detail = await getRiskRegisterDetail({ repository, state, riskDocumentId: risk.documentId });
  assert.equal(detail.riskNumber, RISK_REGISTER_FIXTURE_KEYS.riskNumber);
  assert.equal(detail.parentLock, "mutable");
  assert.equal((detail.controlImplementations as Document[]).length, 1);
  assert.equal(await snapshotControls(), controlsSnapshot);
  assert.equal(await snapshotReleasedFixture(), releasedSnapshot);
});

test("Risk Register reseed preserves analyst-owned Risk and mitigation relations", async () => {
  const request = await singleBy("api::csrm-assessment-request.csrm-assessment-request", { requestNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.requestNumber } });
  const assessment = await singleBy("api::csrm-assessment.csrm-assessment", { assessmentNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.assessmentNumber } });
  const risk = await singleBy("api::csrm-risk.csrm-risk", { riskNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.riskNumber } }, { controlImplementations: true });
  const [implementation] = risk.controlImplementations as Document[];
  assert.ok(implementation);

  await strapi.documents("api::csrm-assessment-request.csrm-assessment-request").update({
    documentId: request.documentId,
    data: { title: "Stale request title", requestStatus: "closed", submittedDate: "2026-09-01T00:00:00.000Z" },
  });
  await strapi.documents("api::csrm-assessment.csrm-assessment").update({
    documentId: assessment.documentId,
    data: { summary: "Stale assessment summary", assessmentStatus: "closed", assessmentDate: "2026-09-01T01:00:00.000Z" },
  });
  await strapi.documents("api::csrm-risk.csrm-risk").update({
    documentId: risk.documentId,
    data: { riskStatement: "Stale risk statement", riskType: null, riskOwner: null, treatmentOwner: null, treatmentStatus: "Complete", closureDate: "2026-09-01" },
  });
  await strapi.documents("api::csrm-control-implementation.csrm-control-implementation").update({
    documentId: implementation.documentId,
    data: { evidence: "Stale evidence", controlOwner: null, controlStatus: "Implemented", implementedDate: "2026-09-01" },
  });

  await withSeedEnvironment(enabled, () => seedRiskRegisterWorkflow(strapi as never));

  const repairedRequest = await singleBy("api::csrm-assessment-request.csrm-assessment-request", { requestNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.requestNumber } }, { requestor: true });
  const repairedAssessment = await singleBy("api::csrm-assessment.csrm-assessment", { assessmentNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.assessmentNumber } }, { assessmentRequest: true });
  const repairedRisk = await singleBy("api::csrm-risk.csrm-risk", { riskNumber: { $eq: RISK_REGISTER_FIXTURE_KEYS.riskNumber } }, { riskType: true, riskOwner: true, treatmentOwner: true, controlImplementations: { populate: { control: true, controlOwner: true } } });
  const [repairedImplementation] = repairedRisk.controlImplementations as Document[];

  assert.notEqual(repairedRequest.title, "Stale request title");
  assert.equal(repairedRequest.requestStatus, "closed");
  assert.equal(repairedRequest.submittedDate, "2026-09-01T00:00:00.000Z");
  assert.equal(repairedAssessment.summary, "Stale assessment summary");
  assert.equal(repairedAssessment.assessmentStatus, "closed");
  assert.equal(repairedAssessment.assessmentDate, "2026-09-01T01:00:00.000Z");
  assert.equal(repairedRisk.riskStatement, "Stale risk statement");
  assert.equal(repairedRisk.treatmentStatus, "Complete");
  assert.equal(repairedRisk.closureDate, "2026-09-01");
  assert.equal(repairedRisk.riskType, null);
  assert.equal(repairedRisk.riskOwner, null);
  assert.equal(repairedRisk.treatmentOwner, null);
  assert.equal(repairedImplementation.evidence, "Stale evidence");
  assert.equal(repairedImplementation.controlStatus, "Implemented");
  assert.equal(repairedImplementation.implementedDate, "2026-09-01");
  assert.equal((repairedImplementation.control as Document).controlNumber, RISK_REGISTER_FIXTURE_KEYS.controlNumber);
  assert.equal(repairedImplementation.controlOwner, null);
  assert.equal(await snapshotControls(), controlsSnapshot);
  assert.equal(await snapshotReleasedFixture(), releasedSnapshot);
});
