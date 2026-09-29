import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import {
  ANALYST_INSIGHTS_DAY_OFFSETS,
  ANALYST_INSIGHTS_FIXTURE,
  seedAnalystInsights,
} from "../src/bootstrap/seed-analyst-insights";
import { seedAssessmentNavigationLifecycle } from "../src/bootstrap/seed-assessment-navigation-lifecycle";
import { seedAssessmentWorkflow } from "../src/bootstrap/seed-assessment-workflow";
import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";
import { seedQuestionnaireWorkflow } from "../src/bootstrap/seed-questionnaire-workflow";
import { seedRiskRegisterWorkflow } from "../src/bootstrap/seed-risk-register-workflow";
import { createAlertRepository } from "../src/api/csrm-analyst-insight/services/alert-repository";
import {
  createStrapiRiskRegisterRepository,
  getRiskRegisterDetail,
} from "../src/api/csrm-risk/services/risk-register";
import { ALERT_KINDS, type AlertKind } from "../src/csrm/insights/alert-rules";
import { addUtcDays, daysBetween, utcToday } from "../src/csrm/insights/utc-date";

/*
 * D-23: the dedicated Phase 7 fixture. It is inert outside the development
 * gates, idempotent by stable key, re-anchored on the boot date every time it
 * runs, and raises every alert kind whatever the date. It is seeded before the
 * other development fixtures that Jane owns, so its rows never displace theirs
 * from her default list.
 */

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = {
  count: (input?: Record<string, unknown>) => Promise<number>;
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
};
type RunningStrapi = {
  documents: (uid: string) => DocumentService;
  destroy: () => Promise<void>;
};

const appDir = path.resolve(__dirname, "..", "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "analyst-insights-seed-tests");
const databaseFilename = path.join(databaseDir, `analyst-insights-seed-${process.pid}.sqlite`);
const enabled = { nodeEnv: "development", environment: "development", identity: "true", seed: "true" };
const originalEnvironment = new Map(
  ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "DATABASE_CLIENT", "DATABASE_FILENAME", "STRAPI_ADMIN_AUTO_OPEN", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION"]
    .map((name) => [name, process.env[name]] as const),
);

const UID = {
  request: "api::csrm-assessment-request.csrm-assessment-request",
  assessment: "api::csrm-assessment.csrm-assessment",
  risk: "api::csrm-risk.csrm-risk",
  implementation: "api::csrm-control-implementation.csrm-control-implementation",
  system: "api::csrm-information-system.csrm-information-system",
} as const;

const REQUEST_KEYS: readonly string[] = Object.values(ANALYST_INSIGHTS_FIXTURE.requests).map((request) => request.requestNumber);
const ASSESSMENT_KEYS: readonly string[] = Object.values(ANALYST_INSIGHTS_FIXTURE.assessments);
const RISK_KEYS: readonly string[] = Object.values(ANALYST_INSIGHTS_FIXTURE.risks);
const DAY_MS = 86_400_000;

let strapi: RunningStrapi;

async function withSeedEnvironment<T>(
  values: { nodeEnv?: string; environment?: string; identity?: string; seed?: string },
  action: () => Promise<T>,
): Promise<T> {
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
    return await action();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function seedAt(now: Date): Promise<void> {
  return withSeedEnvironment(enabled, () => seedAnalystInsights(strapi as never, { now: () => now }));
}

async function findBy(uid: string, filters: Record<string, unknown>, populate?: Record<string, unknown>): Promise<Document[]> {
  return strapi.documents(uid).findMany({ filters, ...(populate ? { populate } : {}), limit: 1_000 });
}

async function single(uid: string, filters: Record<string, unknown>, populate?: Record<string, unknown>): Promise<Document> {
  const rows = await findBy(uid, filters, populate);
  assert.equal(rows.length, 1, `EXPECTED_ONE_${uid}_${JSON.stringify(filters)}`);
  return rows[0];
}

const relation = (value: unknown): Document => {
  assert.ok(value && typeof value === "object", "RELATION_MISSING");
  return value as Document;
};

before(async () => {
  await mkdir(databaseDir, { recursive: true });
  await rm(databaseFilename, { force: true });
  process.env.APP_KEYS = "analyst-insights-seed-test-1,analyst-insights-seed-test-2";
  process.env.ADMIN_JWT_SECRET = "analyst-insights-seed-admin";
  process.env.API_TOKEN_SALT = "analyst-insights-seed-api";
  process.env.TRANSFER_TOKEN_SALT = "analyst-insights-seed-transfer";
  process.env.ENCRYPTION_KEY = "analyst-insights-seed-encryption";
  process.env.JWT_SECRET = "analyst-insights-seed-jwt";
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

test("the Phase 7 fixture requires the seed flag and every development identity gate", async () => {
  for (const values of [
    { nodeEnv: "production", environment: "development", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "production", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "false", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "true", seed: "false" },
    { nodeEnv: "development", environment: "development", identity: "true", seed: undefined },
  ]) {
    await withSeedEnvironment(values, () => seedAnalystInsights(strapi as never, { now: () => new Date() }));
  }

  assert.deepEqual(await findBy(UID.request, { requestNumber: { $in: REQUEST_KEYS } }), [], "GATED_SEED_CREATED_REQUESTS");
  assert.deepEqual(await findBy(UID.assessment, { assessmentNumber: { $in: ASSESSMENT_KEYS } }), [], "GATED_SEED_CREATED_ASSESSMENTS");
  assert.deepEqual(await findBy(UID.risk, { riskNumber: { $in: RISK_KEYS } }), [], "GATED_SEED_CREATED_RISKS");
  assert.deepEqual(
    await findBy(UID.system, { name: { $eq: ANALYST_INSIGHTS_FIXTURE.informationSystemName } }),
    [],
    "GATED_SEED_CREATED_SYSTEM",
  );
  assert.equal(await strapi.documents(UID.implementation).count(), 0, "GATED_SEED_CREATED_IMPLEMENTATIONS");
});

test("the Phase 7 fixture is one record per stable key, related as the plan fixes, however often it runs", async () => {
  const now = new Date();
  await withSeedEnvironment(enabled, () => Promise.all([
    seedAnalystInsights(strapi as never, { now: () => now }),
    seedAnalystInsights(strapi as never, { now: () => now }),
  ]).then(() => undefined));
  const counts = () => Promise.all([UID.request, UID.assessment, UID.risk, UID.implementation, UID.system]
    .map((uid) => strapi.documents(uid).count()));
  const afterFirst = await counts();
  await seedAt(now);
  assert.deepEqual(await counts(), afterFirst, "RESEED_CHANGED_RECORD_COUNTS");

  // The fixture adds exactly five Risks (the Risk Register journey reads page 1 at 25 rows).
  assert.equal((await findBy(UID.risk, { riskNumber: { $startsWith: "RSK-E2E-P7-" } })).length, 5, "FIXTURE_RISK_COUNT");
  assert.equal((await findBy(UID.request, { requestNumber: { $startsWith: "RAR-E2E-P7-" } })).length, 4, "FIXTURE_REQUEST_COUNT");
  assert.equal((await findBy(UID.assessment, { assessmentNumber: { $startsWith: "ASM-E2E-P7-" } })).length, 2, "FIXTURE_ASSESSMENT_COUNT");
  assert.equal(await strapi.documents(UID.implementation).count(), 2, "FIXTURE_IMPLEMENTATION_COUNT");

  const { requests, assessments, risks } = ANALYST_INSIGHTS_FIXTURE;
  for (const [key, expected] of Object.entries(requests)) {
    const request = await single(UID.request, { requestNumber: { $eq: expected.requestNumber } }, { requestor: true });
    assert.equal(request.title, expected.title, `REQUEST_TITLE_${key}`);
    assert.equal(request.requestStatus, expected.requestStatus, `REQUEST_STATUS_${key}`);
    assert.notEqual(request.requestStatus, "submitted", `REQUEST_COULD_START_GENERATION_${key}`);
    assert.equal(relation(request.requestor).email, "jane.doe@idambox.com", `REQUEST_OWNER_${key}`);
  }

  const mutable = await single(UID.assessment, { assessmentNumber: { $eq: assessments.mutable } }, {
    assessmentRequest: true, approvedBy: true, generatedBy: true,
  });
  assert.equal(mutable.assessmentStatus, "in-review", "MUTABLE_ASSESSMENT_STATUS");
  assert.equal(mutable.approvalDate, null, "MUTABLE_ASSESSMENT_APPROVAL_DATE");
  assert.equal(mutable.approvedBy, null, "MUTABLE_ASSESSMENT_APPROVER");
  assert.equal(relation(mutable.generatedBy).email, "bob.doe@idambox.com", "MUTABLE_ASSESSMENT_GENERATOR");
  assert.equal(relation(mutable.assessmentRequest).requestNumber, requests.mutable.requestNumber, "MUTABLE_ASSESSMENT_REQUEST");

  const released = await single(UID.assessment, { assessmentNumber: { $eq: assessments.released } }, {
    assessmentRequest: true, approvedBy: true, reviewedBy: true, generatedBy: true,
  });
  assert.equal(released.assessmentStatus, "approved", "RELEASED_ASSESSMENT_STATUS");
  assert.equal(typeof released.approvalDate, "string", "RELEASED_ASSESSMENT_APPROVAL_DATE");
  for (const actor of ["approvedBy", "reviewedBy", "generatedBy"] as const) {
    assert.equal(relation(released[actor]).email, "bob.doe@idambox.com", `RELEASED_ASSESSMENT_${actor}`);
  }
  assert.equal(relation(released.assessmentRequest).requestNumber, requests.released.requestNumber, "RELEASED_ASSESSMENT_REQUEST");

  const parentOf: Record<keyof typeof risks, string> = {
    overdue: assessments.mutable,
    dueSoon: assessments.mutable,
    critical: assessments.mutable,
    closed: assessments.mutable,
    released: assessments.released,
  };
  for (const [key, riskNumber] of Object.entries(risks) as Array<[keyof typeof risks, string]>) {
    const risk = await single(UID.risk, { riskNumber: { $eq: riskNumber } }, { assessment: true, informationSystemImpacted: true });
    assert.equal(relation(risk.assessment).assessmentNumber, parentOf[key], `RISK_PARENT_${key}`);
    const linked = key === "overdue" || key === "critical";
    assert.equal(
      (risk.informationSystemImpacted as Document | null)?.name ?? null,
      linked ? ANALYST_INSIGHTS_FIXTURE.informationSystemName : null,
      `RISK_SYSTEM_${key}`,
    );
  }
  assert.equal(
    (await findBy(UID.system, { name: { $eq: ANALYST_INSIGHTS_FIXTURE.informationSystemName } })).length,
    1,
    "FIXTURE_SYSTEM_COUNT",
  );

  const implementations = await findBy(UID.implementation, {}, { risk: true, control: true });
  const byRisk = new Map(implementations.map((implementation) => [relation(implementation.risk).riskNumber, implementation]));
  const planned = byRisk.get(risks.overdue);
  const ineffective = byRisk.get(risks.critical);
  assert.ok(planned && ineffective, "FIXTURE_IMPLEMENTATIONS_NOT_ON_THEIR_RISKS");
  assert.equal(relation(planned.control).controlNumber, ANALYST_INSIGHTS_FIXTURE.controlNumbers.planned, "PLANNED_CONTROL");
  assert.equal(planned.controlStatus, "Planned", "PLANNED_STATUS");
  assert.equal(relation(ineffective.control).controlNumber, ANALYST_INSIGHTS_FIXTURE.controlNumbers.ineffective, "INEFFECTIVE_CONTROL");
  assert.equal(ineffective.controlStatus, "Implemented", "INEFFECTIVE_STATUS");
  assert.equal(ineffective.effectivenessRating, "Ineffective", "INEFFECTIVE_RATING");
});

/** The fixture source that must raise each kind, found by its source identifier. */
const EXPECTED_SOURCES: Readonly<Record<AlertKind, { identifier: string; urgency: string }>> = {
  "risk-treatment-overdue": { identifier: ANALYST_INSIGHTS_FIXTURE.risks.overdue, urgency: "overdue" },
  "risk-treatment-due-soon": { identifier: ANALYST_INSIGHTS_FIXTURE.risks.dueSoon, urgency: "due-soon" },
  "request-overdue": { identifier: ANALYST_INSIGHTS_FIXTURE.requests.overdue.requestNumber, urgency: "overdue" },
  "request-due-soon": { identifier: ANALYST_INSIGHTS_FIXTURE.requests.dueSoon.requestNumber, urgency: "due-soon" },
  "control-implementation-overdue": { identifier: ANALYST_INSIGHTS_FIXTURE.risks.overdue, urgency: "overdue" },
  "assessment-review-due": { identifier: ANALYST_INSIGHTS_FIXTURE.assessments.released, urgency: "overdue" },
  "critical-residual-risk-untreated": { identifier: ANALYST_INSIGHTS_FIXTURE.risks.critical, urgency: "attention" },
  "ineffective-control": { identifier: ANALYST_INSIGHTS_FIXTURE.risks.critical, urgency: "attention" },
};

test("with the seed's today, and for three days after, every alert kind lists its fixture source", async () => {
  const now = new Date();
  await seedAt(now);
  const seedToday = utcToday(now);
  const repository = createAlertRepository(strapi);
  for (const offset of [0, 1, 2, 3]) {
    const today = addUtcDays(seedToday, offset);
    for (const kind of ALERT_KINDS) {
      const rows = await repository.listPage({ kinds: [kind], urgency: undefined, page: 1, pageSize: 50, today });
      const expected = EXPECTED_SOURCES[kind];
      const match = rows.find((row) => row.source_identifier === expected.identifier);
      assert.ok(match, `FIXTURE_SOURCE_MISSING_${kind}_DAY_${offset}`);
      assert.equal(match.urgency, expected.urgency, `FIXTURE_URGENCY_${kind}_DAY_${offset}`);
    }
    // The released Risk is overdue on released work and says so.
    const overdue = await repository.listPage({ kinds: ["risk-treatment-overdue"], urgency: undefined, page: 1, pageSize: 50, today });
    const releasedRisk = overdue.find((row) => row.source_identifier === ANALYST_INSIGHTS_FIXTURE.risks.released);
    assert.ok(releasedRisk, `RELEASED_RISK_NOT_OVERDUE_DAY_${offset}`);
    assert.equal(Number(releasedRisk.source_released), 1, `RELEASED_RISK_NOT_MARKED_RELEASED_DAY_${offset}`);
  }

  // The closed Risk and the two requests without due dates never alert.
  // A caller may leave the urgency out to read every urgency.
  const everything = await repository.listPage({ kinds: [...ALERT_KINDS], page: 1, pageSize: 50, today: seedToday });
  const identifiers = new Set(everything.map((row) => row.source_identifier));
  for (const silent of [
    ANALYST_INSIGHTS_FIXTURE.risks.closed,
    ANALYST_INSIGHTS_FIXTURE.requests.mutable.requestNumber,
    ANALYST_INSIGHTS_FIXTURE.requests.released.requestNumber,
    ANALYST_INSIGHTS_FIXTURE.assessments.mutable,
  ]) {
    assert.equal(identifiers.has(silent), false, `SILENT_FIXTURE_ALERTED_${silent}`);
  }
});

test("the Risk detail read resolves for the overdue and released Phase 7 Risks", async () => {
  await seedAt(new Date());
  const repository = createStrapiRiskRegisterRepository(strapi as never);
  const state = { csrmAuthorization: { riskRegisterCollectionScope: "all" } };
  for (const [riskNumber, parentLock, requestTitle] of [
    [ANALYST_INSIGHTS_FIXTURE.risks.overdue, "mutable", ANALYST_INSIGHTS_FIXTURE.requests.mutable.title],
    [ANALYST_INSIGHTS_FIXTURE.risks.released, "released", ANALYST_INSIGHTS_FIXTURE.requests.released.title],
  ] as const) {
    const risk = await single(UID.risk, { riskNumber: { $eq: riskNumber } });
    const detail = await getRiskRegisterDetail({ repository, state, riskDocumentId: risk.documentId });
    assert.equal(detail.riskNumber, riskNumber, `DETAIL_RISK_${riskNumber}`);
    assert.equal(detail.parentLock, parentLock, `DETAIL_PARENT_LOCK_${riskNumber}`);
    assert.equal((detail.assessment as Record<string, unknown>).title, requestTitle, `DETAIL_REQUEST_TITLE_${riskNumber}`);
  }
});

/** Every date the fixture writes, as a day count for dates and milliseconds for date-times. */
async function fixtureDates(): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  const record = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    assert.equal(typeof value, "string", `DATE_NOT_A_STRING_${key}`);
    dates.set(key, value as string);
  };
  for (const request of await findBy(UID.request, { requestNumber: { $in: REQUEST_KEYS } })) {
    for (const field of ["submittedDate", "dueDate"]) record(`${request.requestNumber}.${field}`, request[field]);
  }
  for (const assessment of await findBy(UID.assessment, { assessmentNumber: { $in: ASSESSMENT_KEYS } })) {
    for (const field of ["generatedDate", "assessmentDate", "approvalDate", "nextReviewDate"]) {
      record(`${assessment.assessmentNumber}.${field}`, assessment[field]);
    }
  }
  for (const risk of await findBy(UID.risk, { riskNumber: { $in: RISK_KEYS } })) {
    for (const field of ["identifiedDate", "targetDate", "closureDate"]) record(`${risk.riskNumber}.${field}`, risk[field]);
  }
  for (const implementation of await findBy(UID.implementation, {}, { risk: true })) {
    for (const field of ["implementationDueDate", "reviewDate"]) {
      record(`${relation(implementation.risk).riskNumber}.implementation.${field}`, implementation[field]);
    }
  }
  return dates;
}

test("every run re-anchors every fixture date on its own today", async () => {
  const start = new Date();
  const later = new Date(start.getTime() + 10 * DAY_MS);
  await seedAt(start);
  const before = await fixtureDates();
  await seedAt(later);
  const moved = await fixtureDates();

  assert.deepEqual([...moved.keys()].sort(), [...before.keys()].sort(), "RE_ANCHOR_CHANGED_THE_DATE_FIELDS");
  assert.ok(before.size >= 14, `TOO_FEW_FIXTURE_DATES_${before.size}`);
  for (const [key, value] of before) {
    const next = moved.get(key)!;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      assert.equal(daysBetween(value, next), 10, `DATE_NOT_MOVED_TEN_DAYS_${key}`);
    } else {
      assert.equal(Date.parse(next) - Date.parse(value), 10 * DAY_MS, `DATE_TIME_NOT_MOVED_TEN_DAYS_${key}`);
    }
  }

  // Each date is its declared whole-day offset from the run's own today.
  const today = utcToday(later);
  for (const [key, offset] of Object.entries(ANALYST_INSIGHTS_DAY_OFFSETS)) {
    const value = moved.get(key);
    assert.ok(value, `DECLARED_OFFSET_NOT_WRITTEN_${key}`);
    assert.equal(daysBetween(today, value.slice(0, 10)), offset, `DATE_OFFSET_${key}`);
  }
  assert.deepEqual([...moved.keys()].sort(), Object.keys(ANALYST_INSIGHTS_DAY_OFFSETS).sort(), "UNDECLARED_FIXTURE_DATE");

  await seedAt(new Date());
});

test("seeded before the other development fixtures, it never sorts ahead of them", async () => {
  // Bootstrap order: the Phase 7 fixture runs after the catalogue and before
  // every other development fixture Jane owns.
  const bootstrap = await readFile(path.join(appDir, "src", "index.ts"), "utf8");
  const calls = ["seedCsrmData(strapi)", "seedAnalystInsights(strapi)", "seedQuestionnaireWorkflow(strapi)",
    "seedAssessmentWorkflow(strapi)", "seedAssessmentNavigationLifecycle(strapi)", "seedRiskRegisterWorkflow(strapi)"];
  const positions = calls.map((call) => bootstrap.indexOf(`await ${call};`));
  assert.ok(positions.every((position) => position >= 0), `BOOTSTRAP_CALL_MISSING_${JSON.stringify(positions)}`);
  assert.deepEqual([...positions].sort((left, right) => left - right), positions, "BOOTSTRAP_SEED_ORDER");

  await withSeedEnvironment(enabled, async () => {
    await seedAnalystInsights(strapi as never, { now: () => new Date() });
    await seedQuestionnaireWorkflow(strapi as never);
    await seedAssessmentWorkflow(strapi as never);
    await seedAssessmentNavigationLifecycle(strapi as never);
    await seedRiskRegisterWorkflow(strapi as never);
  });

  const requests = await findBy(UID.request, {}, { requestor: true });
  const fixture = requests.filter((request) => REQUEST_KEYS.includes(String(request.requestNumber)));
  const others = requests.filter((request) => !REQUEST_KEYS.includes(String(request.requestNumber)));
  assert.equal(fixture.length, 4, "FIXTURE_REQUESTS_AFTER_OTHER_SEEDS");
  assert.ok(others.length >= 5, `OTHER_SEEDED_REQUESTS_${others.length}`);

  // Submitted later than every other seeded request (plan-check amendment).
  const latestOtherSubmission = Math.max(...others
    .map((request) => request.submittedDate)
    .filter((value): value is string => typeof value === "string")
    .map((value) => Date.parse(value)));
  for (const request of fixture) {
    assert.ok(
      Date.parse(String(request.submittedDate)) > latestOtherSubmission,
      `FIXTURE_SUBMITTED_BEFORE_ANOTHER_FIXTURE_${request.requestNumber}`,
    );
  }

  // Jane's default list sorts by updatedAt, newest first: every other seeded
  // request of hers comes before any Phase 7 request.
  const janes = (rows: Document[]) => rows.filter((request) => relation(request.requestor).email === "jane.doe@idambox.com");
  const newestFixtureUpdate = Math.max(...fixture.map((request) => Date.parse(String(request.updatedAt))));
  for (const request of janes(others)) {
    assert.ok(
      Date.parse(String(request.updatedAt)) >= newestFixtureUpdate,
      `FIXTURE_UPDATED_AFTER_JANES_${request.requestNumber}`,
    );
  }
  assert.ok(janes(others).length >= 5, "JANES_OTHER_SEEDED_REQUESTS");
});
