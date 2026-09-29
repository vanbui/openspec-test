import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { seedCsrmData } from "../src/bootstrap/seed-csrm-data";
import { seedQuestionnaireWorkflow } from "../src/bootstrap/seed-questionnaire-workflow";

type Document = { documentId: string; [key: string]: unknown };
type DocumentService = {
  findMany: (input: Record<string, unknown>) => Promise<Document[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<Document>;
};
type RunningStrapi = {
  dirs: { app: { root: string } };
  documents: (uid: string) => DocumentService;
  destroy: () => Promise<void>;
};

const appDir = path.resolve(__dirname, "..", "..", "..");
const databaseDir = path.resolve(appDir, ".tmp", "questionnaire-seed-tests");
const databaseFilename = path.join(databaseDir, `questionnaire-seed-${process.pid}.sqlite`);
const originalEnvironment = new Map(
  ["NODE_ENV", "CSRM_ENVIRONMENT", "CSRM_DEV_IDENTITY", "IDAMBOX_SEED_CSRM", "IDAMBOX_SEED_CORE", "DATABASE_CLIENT", "DATABASE_FILENAME", "IDAMBOX_KEYCLOAK_PROVISIONING", "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION"]
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
  process.env.APP_KEYS = "questionnaire-seed-test-1,questionnaire-seed-test-2";
  process.env.ADMIN_JWT_SECRET = "questionnaire-seed-admin";
  process.env.API_TOKEN_SALT = "questionnaire-seed-api";
  process.env.TRANSFER_TOKEN_SALT = "questionnaire-seed-transfer";
  process.env.ENCRYPTION_KEY = "questionnaire-seed-encryption";
  process.env.JWT_SECRET = "questionnaire-seed-jwt";
  process.env.DATABASE_CLIENT = "sqlite";
  process.env.DATABASE_FILENAME = path.relative(appDir, databaseFilename);
  process.env.IDAMBOX_SEED_CSRM = "false";
  process.env.IDAMBOX_SEED_CORE = "false";
  process.env.STRAPI_DISABLE_UPDATE_NOTIFICATION = "true";
  // Tests never reach Keycloak, whatever the developer .env enables.
  process.env.IDAMBOX_KEYCLOAK_PROVISIONING = "false";
  process.env.IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION = "false";

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

test("questionnaire workflow seed is triple-gated and idempotent", async () => {
  for (const values of [
    { nodeEnv: "production", environment: "development", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "production", identity: "true", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "false", seed: "true" },
    { nodeEnv: "development", environment: "development", identity: "true", seed: "false" },
  ]) {
    await withSeedEnvironment(values, () => seedQuestionnaireWorkflow(strapi as never));
  }
  assert.deepEqual(await findBy("api::csrm-questionnaire.csrm-questionnaire", { questionnaireNumber: { $eq: "QUES-DEV-001" } }), []);

  const enabled = { nodeEnv: "development", environment: "development", identity: "true", seed: "true" };
  await withSeedEnvironment(enabled, () => seedQuestionnaireWorkflow(strapi as never));
  await withSeedEnvironment(enabled, () => seedQuestionnaireWorkflow(strapi as never));

  const requests = await findBy("api::csrm-assessment-request.csrm-assessment-request", { requestNumber: { $eq: "RAR-DEV-QUES-001" } }, { requestor: true, questionnaire: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.requestStatus, "questionnaire-in-progress");
  assert.equal((requests[0]?.requestor as Document | undefined)?.email, "jane.doe@idambox.com");

  const questionnaires = await findBy("api::csrm-questionnaire.csrm-questionnaire", { questionnaireNumber: { $eq: "QUES-DEV-001" } }, { assessmentRequest: true, questions: true });
  assert.equal(questionnaires.length, 1);
  assert.equal((questionnaires[0]?.assessmentRequest as Document | undefined)?.documentId, requests[0]?.documentId);
  const questions = (questionnaires[0]?.questions as Document[] | undefined) ?? [];
  assert.equal(questions.length, 8);
  const definitions = questions.map((question) => question.options as Record<string, unknown>);
  const questionKeys = definitions.map((definition) => definition.questionKey).sort();
  assert.deepEqual(questionKeys, ["go-live-date", "handles-personal-data", "hosting-model", "personal-data-types", "production-url", "service-description", "service-name", "third-party-providers"]);
  assert.equal(new Set(questionKeys).size, questionKeys.length);
  assert.deepEqual([...new Set(questions.map((question) => question.answerType))].sort(), ["Boolean", "Date", "Long text", "Multi select", "Single select", "Text"]);
  assert.equal(questions.some((question) => question.answerType === "File upload"), false);
  assert.equal(questions.every((question) => {
    const answer = question.answer as { schemaVersion?: unknown; state?: unknown; submittedAt?: unknown; value?: unknown } | null;
    return answer?.schemaVersion === 1
      && answer.state === "submitted"
      && typeof answer.submittedAt === "string"
      && Number.isFinite(Date.parse(answer.submittedAt))
      && answer.value !== undefined;
  }), true);
  assert.equal(definitions.every((definition) => definition.schemaVersion === 1), true);
  assert.deepEqual(
    [...new Set(definitions.map((definition) => (definition.section as { title: string }).title))],
    ["Service context", "Data and privacy", "Hosting and access", "Third parties"],
  );
  const dependent = definitions.find((definition) => definition.questionKey === "personal-data-types");
  assert.equal(dependent?.required, true);
  assert.deepEqual(dependent?.visibility, { questionKey: "handles-personal-data", operator: "equals", value: true });
});

test("questionnaire workflow seed restores managed fixture definitions on rerun", async () => {
  const [questionnaire] = await findBy("api::csrm-questionnaire.csrm-questionnaire", { questionnaireNumber: { $eq: "QUES-DEV-001" } }, { questions: true });
  assert.ok(questionnaire);
  const questions = (questionnaire.questions as Document[]).filter((question) => (question.options as { questionKey?: string }).questionKey === "service-name");
  assert.equal(questions.length, 1);
  await strapi.documents("api::csrm-question.csrm-question").update({ documentId: questions[0].documentId, data: { questionText: "Stale fixture text" } });

  await withSeedEnvironment(
    { nodeEnv: "development", environment: "development", identity: "true", seed: "true" },
    () => seedQuestionnaireWorkflow(strapi as never),
  );
  const [updatedQuestionnaire] = await findBy("api::csrm-questionnaire.csrm-questionnaire", { questionnaireNumber: { $eq: "QUES-DEV-001" } }, { questions: true });
  const updated = (updatedQuestionnaire.questions as Document[]).filter((question) => (question.options as { questionKey?: string }).questionKey === "service-name");
  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.questionText, "What is the name of the service being assessed?");
});

/*
 * The release gate reaches the development fixtures too. The two fixtures that
 * predate the gate carry release facts so the Requestor journeys written before
 * it still reach them, and a third fixture is deliberately left unreleased so
 * the Requestor denial can be exercised in the browser.
 */
test("questionnaire workflow seed releases the Requestor fixtures and keeps one deliberately unreleased", async () => {
  await withSeedEnvironment(
    { nodeEnv: "development", environment: "development", identity: "true", seed: "true" },
    () => seedQuestionnaireWorkflow(strapi as never),
  );

  const [analyst] = await findBy("api::idambox-user.idambox-user", { email: { $eq: "bob.doe@idambox.com" } });
  assert.ok(analyst, "MISSING_SEEDED_ANALYST");

  for (const questionnaireNumber of ["QUES-DEV-001", "QUES-DEV-DRAFT-001"]) {
    const [questionnaire] = await findBy(
      "api::csrm-questionnaire.csrm-questionnaire",
      { questionnaireNumber: { $eq: questionnaireNumber } },
      { releasedBy: true },
    );
    assert.ok(questionnaire, `MISSING_FIXTURE_${questionnaireNumber}`);
    assert.equal(typeof questionnaire.releasedAt, "string", `MISSING_RELEASE_FACT_${questionnaireNumber}`);
    assert.equal(
      (questionnaire.releasedBy as Document | undefined)?.documentId,
      analyst.documentId,
      `UNEXPECTED_RELEASE_ACTOR_${questionnaireNumber}`,
    );
    const events = questionnaire.governanceLog as Array<Record<string, unknown>> | undefined;
    assert.ok(Array.isArray(events) && events.length === 1, `UNEXPECTED_GOVERNANCE_LOG_${questionnaireNumber}`);
    assert.equal(events[0]?.kind, "released", `UNEXPECTED_GOVERNANCE_EVENT_KIND_${questionnaireNumber}`);
    assert.equal(events[0]?.schemaVersion, 1, `UNEXPECTED_GOVERNANCE_EVENT_VERSION_${questionnaireNumber}`);
    assert.equal(events[0]?.by, analyst.documentId, `UNEXPECTED_GOVERNANCE_EVENT_ACTOR_${questionnaireNumber}`);
    assert.equal(events[0]?.at, questionnaire.releasedAt, `GOVERNANCE_EVENT_DISAGREES_WITH_THE_FACT_${questionnaireNumber}`);
  }

  const [unreleased] = await findBy(
    "api::csrm-questionnaire.csrm-questionnaire",
    { questionnaireNumber: { $eq: "QUES-DEV-UNRELEASED-001" } },
    { assessmentRequest: { populate: { requestor: true } }, questions: true, releasedBy: true },
  );
  assert.ok(unreleased, "MISSING_UNRELEASED_FIXTURE");
  assert.equal(unreleased.releasedAt ?? null, null, "UNRELEASED_FIXTURE_CARRIES_A_RELEASE_FACT");
  assert.equal(unreleased.releasedBy ?? null, null, "UNRELEASED_FIXTURE_CARRIES_A_RELEASE_ACTOR");
  assert.equal(unreleased.governanceLog ?? null, null, "UNRELEASED_FIXTURE_CARRIES_A_GOVERNANCE_LOG");
  const unreleasedRequest = unreleased.assessmentRequest as Document | undefined;
  assert.equal(unreleasedRequest?.requestNumber, "RAR-DEV-QUES-UNRELEASED-001", "UNEXPECTED_UNRELEASED_FIXTURE_REQUEST");
  assert.equal(
    (unreleasedRequest?.requestor as Document | undefined)?.email,
    "jane.doe@idambox.com",
    "UNEXPECTED_UNRELEASED_FIXTURE_OWNER",
  );
  const unreleasedQuestions = (unreleased.questions as Document[] | undefined) ?? [];
  assert.equal(unreleasedQuestions.length, 8, "UNEXPECTED_UNRELEASED_FIXTURE_QUESTION_COUNT");
  assert.equal(unreleasedQuestions.every((question) => question.answer === null), true, "UNEXPECTED_UNRELEASED_FIXTURE_ANSWERS");

  // A reseed never resets governance state the running application owns: a
  // release performed in the app must survive a dev-server restart.
  await strapi.documents("api::csrm-questionnaire.csrm-questionnaire").update({
    documentId: unreleased.documentId,
    data: {
      releasedAt: "2026-09-10T00:00:00.000Z",
      releasedBy: analyst.documentId,
      governanceLog: [{ schemaVersion: 1, kind: "released", at: "2026-09-10T00:00:00.000Z", by: analyst.documentId }],
    },
  });
  await withSeedEnvironment(
    { nodeEnv: "development", environment: "development", identity: "true", seed: "true" },
    () => seedQuestionnaireWorkflow(strapi as never),
  );
  const [afterReseed] = await findBy(
    "api::csrm-questionnaire.csrm-questionnaire",
    { questionnaireNumber: { $eq: "QUES-DEV-UNRELEASED-001" } },
  );
  assert.equal(
    new Date(String(afterReseed?.releasedAt)).toISOString(),
    "2026-09-10T00:00:00.000Z",
    "RESEED_RESET_AN_APPLICATION_OWNED_RELEASE",
  );
});
