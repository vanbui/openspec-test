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

/*
 * An earlier seed stored the catalogue entry it read in sourceData beside the description it derived from
 * it, so a value the seed wrote is recognisable: the stored description is the one the stored sourceData
 * gives. These fixtures store both halves of what that earlier seed wrote.
 */
async function storeEarlierSeed(control: Document, entry: Record<string, unknown>, description: string): Promise<void> {
  const sourceData = control.sourceData as { control: Record<string, unknown> } & Record<string, unknown>;
  assert.ok(sourceData?.control, `${String(control.controlNumber)} stores its catalogue entry`);
  await strapi.documents("api::csrm-control.csrm-control").update({
    documentId: control.documentId,
    data: { description, sourceData: { ...sourceData, control: { ...sourceData.control, ...entry } } },
  });
}

test("ADMIN-05 a seeded start corrects a Privacy Principle an earlier seed stored truncated", async () => {
  const app11 = await seededControl("APP-11");
  const truncated = "information 11.1 If an APP entity holds personal information";
  await storeEarlierSeed(app11, { title: "security of personal", legalText: truncated }, truncated);
  await strapi.documents("api::csrm-control.csrm-control").update({
    documentId: app11.documentId,
    data: { name: "APP-11 — security of personal" },
  });
  await seedCsrmData(strapi as never);
  const corrected = await seededControl("APP-11");
  assert.equal(corrected.documentId, app11.documentId);
  assert.equal(corrected.name, "APP-11 — Security of personal information");
  assert.ok(String(corrected.description).startsWith("11.1 If an APP entity holds"));
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

/*
 * The Controls contract bounds a control description at 10,000 characters. An earlier seed stored APP-13's
 * catalogue text with Schedule 2 and the compilation's endnotes appended (100,973 characters), and every
 * list or picker page holding APP-13 failed the web's closed parser. The seed wrote that value, so the next
 * seeded start replaces it with APP 13's own paragraphs. An operator's own description of a seeded control
 * is never overwritten, unless it is beyond the bound, which no valid write can store.
 */
const APP_13_END = "for associating the statement with the personal information (as the case may be).";

function assertCuratedApp13(description: unknown): void {
  const text = String(description);
  assert.ok(text.length <= 10_000, `APP-13 is within the 10,000-character bound: ${text.length}`);
  assert.ok(text.startsWith("Correction 13.1 If:"), text.slice(0, 60));
  assert.ok(text.endsWith(APP_13_END), text.slice(-90));
}

test("ADMIN-05 a seeded start replaces the over-long APP-13 text an earlier seed stored", async () => {
  const app13 = await seededControl("APP-13");
  assertCuratedApp13(app13.description);
  const overLong = `${String(app13.description)} Statutory Tort for Serious Invasions of Privacy Schedule 2 ${"Endnotes Endnote 4—Amendment history ".repeat(2_700)}`.trim();
  assert.ok(overLong.length > 100_000);
  await storeEarlierSeed(app13, { legalText: overLong }, overLong);
  assert.equal(String((await seededControl("APP-13")).description).length, overLong.length);

  await seedCsrmData(strapi as never);
  const corrected = await seededControl("APP-13");
  assert.equal(corrected.documentId, app13.documentId);
  assertCuratedApp13(corrected.description);
  assert.equal(corrected.description, app13.description);
  assert.equal((corrected.sourceData as { control: { legalText: string } }).control.legalText, app13.description);
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

test("ADMIN-05 a seeded start keeps an operator's own description of a seeded control, then changes nothing", async () => {
  const app13 = await seededControl("APP-13");
  const operatorDescription = "Our reading of APP 13: correct personal information on request, within 30 days for an agency.";
  await strapi.documents("api::csrm-control.csrm-control").update({ documentId: app13.documentId, data: { description: operatorDescription } });

  await seedCsrmData(strapi as never);
  const kept = await seededControl("APP-13");
  assert.equal(kept.description, operatorDescription, "the seed never overwrites an operator's description");
  await seedCsrmData(strapi as never);
  const unchanged = await seededControl("APP-13");
  assert.equal(unchanged.description, operatorDescription);
  assert.equal(String(unchanged.updatedAt), String(kept.updatedAt), "a further seeded start leaves APP-13 untouched");
});

test("ADMIN-05 a seeded start replaces a stored description beyond the bound, whoever stored it", async () => {
  const app13 = await seededControl("APP-13");
  const beyondBound = "word ".repeat(2_001).trim();
  assert.ok(beyondBound.length > 10_000);
  await strapi.documents("api::csrm-control.csrm-control").update({ documentId: app13.documentId, data: { description: beyondBound } });

  await seedCsrmData(strapi as never);
  const replaced = await seededControl("APP-13");
  assertCuratedApp13(replaced.description);
  assert.equal(replaced.description, (replaced.sourceData as { control: { legalText: string } }).control.legalText);
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

/*
 * D-46 (operator decision 15): an Annex A control carries the standard's control name from the CSRM
 * title file, and no ISO control text. A database seeded before the titles existed stores the bare
 * number; the next seeded start renames it, and a further seeded start changes nothing (D-36).
 */
test("ADMIN-05 D-46 a seeded start names an Annex A control and loads no ISO text", async () => {
  const control = await seededControl("5.1");
  assert.equal(control.name, "5.1 — Policies for information security");
  assert.ok(control.description === null || control.description === undefined, `5.1 has no description: ${String(control.description)}`);
});

test("ADMIN-05 D-46 a seeded start titles a control an earlier seed stored by its number, then changes nothing", async () => {
  const control = await seededControl("5.1");
  await strapi.documents("api::csrm-control.csrm-control").update({ documentId: control.documentId, data: { name: "5.1" } });
  assert.equal((await seededControl("5.1")).name, "5.1");
  await seedCsrmData(strapi as never);
  const restored = await seededControl("5.1");
  assert.equal(restored.documentId, control.documentId);
  assert.equal(restored.name, "5.1 — Policies for information security");
  await seedCsrmData(strapi as never);
  const unchanged = await seededControl("5.1");
  assert.equal(unchanged.name, restored.name);
  assert.equal(String(unchanged.updatedAt), String(restored.updatedAt), "a further seeded start leaves 5.1 untouched");
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

/*
 * D-46: after a seeded start no stored control is named by its number alone, and an APRA or PSPF
 * requirement keeps its clause or section as its reference and its paragraph as its description.
 */
test("ADMIN-05 D-46 a seeded start leaves no control named by its number alone", async () => {
  const untitled: string[] = [];
  let total = 0;
  for (let start = 0; ; start += 1_000) {
    const page = await strapi.documents("api::csrm-control.csrm-control").findMany({
      fields: ["controlNumber", "name"], sort: ["controlNumber:asc"], limit: 1_000, start,
    });
    total += page.length;
    untitled.push(...page.filter((control) => !control.name || control.name === control.controlNumber).map((control) => String(control.controlNumber)));
    if (page.length < 1_000) break;
  }
  assert.equal(total, 2_646);
  assert.deepEqual(untitled, []);
});

test("ADMIN-05 D-46 a titled APRA or PSPF requirement keeps its reference and its paragraph", async () => {
  for (const [controlNumber, reference, paragraphStart] of [
    ["CPS-234-15", "Clause 15", "An APRA -regulated entity must maintain an information security capability"],
    ["PSPF-001", "Section 01", "The Department of State supports portfolio entities"],
  ] as const) {
    const control = await seededControl(controlNumber);
    assert.match(String(control.name), new RegExp(`^${controlNumber} — \\S.{2,}`), `${controlNumber} carries a title`);
    assert.equal(control.controlReference, reference, `${controlNumber} keeps its source reference`);
    assert.ok(String(control.description).startsWith(paragraphStart), `${controlNumber} keeps its paragraph: ${String(control.description).slice(0, 80)}`);
  }
});

/*
 * 10-23 walkthrough fix 3: the development database already holds 10-22's titles, some of which narrowed
 * their paragraph. A seeded start replaces a name the seed wrote (an earlier seeded title, or the bare number)
 * with the corrected title, and never an operator's own name for a seeded control.
 */
const CPS_230_34_EARLIER = "CPS-230-34 — Critical operations defined by adverse customer impact";
const CPS_230_34_CORRECTED = "CPS-230-34 — Critical operations defined by material harm to customers or the financial system";

test("ADMIN-05 D-46 fix 3: a seeded start renames a control stored under its earlier seeded title, then changes nothing", async () => {
  const control = await seededControl("CPS-230-34");
  await strapi.documents("api::csrm-control.csrm-control").update({ documentId: control.documentId, data: { name: CPS_230_34_EARLIER } });
  assert.equal((await seededControl("CPS-230-34")).name, CPS_230_34_EARLIER);

  await seedCsrmData(strapi as never);
  const renamed = await seededControl("CPS-230-34");
  assert.equal(renamed.documentId, control.documentId);
  assert.equal(renamed.name, CPS_230_34_CORRECTED, "the seed replaces the title it wrote earlier");
  assert.equal(renamed.description, control.description, "the paragraph stays the description");
  await seedCsrmData(strapi as never);
  const unchanged = await seededControl("CPS-230-34");
  assert.equal(unchanged.name, CPS_230_34_CORRECTED);
  assert.equal(String(unchanged.updatedAt), String(renamed.updatedAt), "a further seeded start leaves CPS-230-34 untouched");
  assert.equal(await strapi.documents("api::csrm-control.csrm-control").count(), 2_646);
});

test("ADMIN-05 D-46 fix 3: a seeded start keeps an operator's own name for a seeded control, then changes nothing", async () => {
  const control = await seededControl("CPS-230-57");
  const operatorName = "CPS-230-57 — Our reading: relief for exchanges and clearing houses";
  await strapi.documents("api::csrm-control.csrm-control").update({ documentId: control.documentId, data: { name: operatorName } });

  await seedCsrmData(strapi as never);
  const kept = await seededControl("CPS-230-57");
  assert.equal(kept.name, operatorName, "the seed never overwrites an operator's name");
  await seedCsrmData(strapi as never);
  const unchanged = await seededControl("CPS-230-57");
  assert.equal(unchanged.name, operatorName);
  assert.equal(String(unchanged.updatedAt), String(kept.updatedAt), "a further seeded start leaves CPS-230-57 untouched");

  await strapi.documents("api::csrm-control.csrm-control").update({ documentId: control.documentId, data: { name: control.name } });
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
