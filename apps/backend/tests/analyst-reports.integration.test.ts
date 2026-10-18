import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import { deriveTreatmentDueState } from "../src/csrm/insights/treatment-due-state";
import { addUtcDays, addUtcMonths, startOfUtcMonth, utcToday } from "../src/csrm/insights/utc-date";

/*
 * D-01, D-03, D-13, D-14, D-24, D-36, D-40 to D-43: the analyst reports, computed on read over
 * controlled fixtures whose dates are offsets from the test's own UTC today.
 * The mounted harness seeds the catalogue, users and the control library only,
 * plus two draft requests, so the fixtures below are the only report sources in
 * this file's database. The exposed-systems truncation test adds eleven more
 * Risks, which changes every other figure, so it runs last.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const DAY_MS = 86_400_000;
const today = utcToday(new Date());
const D = (days: number): string => addUtcDays(today, days);
const currentMonthStart = startOfUtcMonth(today);
/** The ISO instant `hours` after UTC midnight of `date`. */
const at = (date: string, hours = 0): string => new Date(Date.parse(`${date}T00:00:00.000Z`) + hours * 3_600_000).toISOString();
const daysBefore = (instant: string, days: number): string => new Date(Date.parse(instant) - days * DAY_MS).toISOString();

const INDEX_PATH = "/api/v1/reports";
const reportPath = (key: string): string => `${INDEX_PATH}/${key}`;

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend,
// two more resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
/** UI-D19: the web's canonical key-to-copy map, which the served definitions must equal. */
const REPORT_COPY = JSON.parse(
  readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "features", "reports", "report-copy.json"), "utf8"),
) as Array<{ key: string; title: string; description: string; metadataTitle: string }>;

type SpecSchema = {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, SpecSchema>;
  additionalProperties?: unknown;
  items?: SpecSchema;
  maxItems?: number;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  minLength?: number;
  maxLength?: number;
  oneOf?: SpecSchema[];
  anyOf?: SpecSchema[];
  discriminator?: { propertyName: string; mapping: Record<string, string> };
};
const specification = JSON.parse(
  readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8"),
) as { components?: { schemas?: Record<string, SpecSchema> } };

function specComponent(componentName: string): SpecSchema {
  const component = specification.components?.schemas?.[componentName];
  assert.ok(component, `REPORT_SPEC_COMPONENT_MISSING_${componentName}`);
  return component;
}

/** The published property names of a closed spec component, sorted: exactly what the server may serve. */
function specKeys(componentName: string): string[] {
  const component = specComponent(componentName);
  assert.equal(component.additionalProperties, false, `REPORT_SPEC_COMPONENT_OPEN_${componentName}`);
  return Object.keys(component.properties ?? {}).sort();
}

/**
 * Walks a served value against its published schema. Every object's keys equal
 * its closed component's properties, a union is resolved to the branch its
 * discriminator names (which must be one of the union's branches), and every
 * leaf has its published type, enumeration, format and bounds. A closed web
 * parser that would refuse what Strapi serves fails here first.
 */
function assertMatchesSpec(value: unknown, reference: SpecSchema, label: string): void {
  const name = reference.$ref?.replace("#/components/schemas/", "") ?? null;
  const schema = name === null ? reference : specComponent(name);
  const at = name === null ? label : `${label}<${name}>`;
  if (schema.oneOf) {
    const discriminator = schema.discriminator;
    assert.ok(discriminator, `${at}_UNION_WITHOUT_DISCRIMINATOR`);
    assert.ok(isRecord(value), `${at}_UNION_VALUE_NOT_AN_OBJECT`);
    const branch = discriminator.mapping[String(value[discriminator.propertyName])];
    assert.ok(branch, `${at}_UNMAPPED_BRANCH_${String(value[discriminator.propertyName])}`);
    assert.ok(schema.oneOf.some((option) => option.$ref === branch), `${at}_BRANCH_OUTSIDE_THE_UNION_${branch}`);
    assertMatchesSpec(value, { $ref: branch }, at);
    return;
  }
  if (schema.anyOf) {
    if (value === null) {
      assert.ok(schema.anyOf.some((option) => option.type === "null"), `${at}_NULL_NOT_PUBLISHED`);
      return;
    }
    const options = schema.anyOf.filter((option) => option.type !== "null");
    assert.equal(options.length, 1, `${at}_AMBIGUOUS_ANY_OF`);
    assertMatchesSpec(value, options[0], at);
    return;
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (value === null) {
    assert.ok(types.includes("null"), `${at}_NULL_NOT_PUBLISHED`);
    return;
  }
  if (schema.enum) assert.ok(schema.enum.includes(value), `${at}_NOT_IN_THE_PUBLISHED_ENUM_${String(value)}`);
  if (types.includes("object")) {
    assert.ok(isRecord(value), `${at}_NOT_AN_OBJECT`);
    assert.equal(schema.additionalProperties, false, `${at}_OPEN_COMPONENT`);
    assert.deepEqual(Object.keys(value).sort(), Object.keys(schema.properties ?? {}).sort(), `${at}_KEYS`);
    for (const [property, propertySchema] of Object.entries(schema.properties ?? {})) {
      assertMatchesSpec(value[property], propertySchema, `${at}.${property}`);
    }
    return;
  }
  if (types.includes("array")) {
    assert.ok(Array.isArray(value), `${at}_NOT_A_LIST`);
    if (typeof schema.maxItems === "number") assert.ok(value.length <= schema.maxItems, `${at}_ABOVE_MAX_ITEMS`);
    assert.ok(schema.items, `${at}_ITEMS_UNPUBLISHED`);
    for (const [index, item] of value.entries()) assertMatchesSpec(item, schema.items, `${at}[${index}]`);
    return;
  }
  if (types.includes("string")) {
    assert.equal(typeof value, "string", `${at}_NOT_A_STRING`);
    if (schema.format === "date") assert.match(value as string, /^\d{4}-\d{2}-\d{2}$/, `${at}_NOT_A_DATE`);
    if (typeof schema.minLength === "number") assert.ok((value as string).length >= schema.minLength, `${at}_BELOW_MIN_LENGTH`);
    if (typeof schema.maxLength === "number") assert.ok((value as string).length <= schema.maxLength, `${at}_ABOVE_MAX_LENGTH`);
    return;
  }
  if (types.includes("boolean")) {
    assert.equal(typeof value, "boolean", `${at}_NOT_A_BOOLEAN`);
    return;
  }
  if (types.includes("integer")) assert.ok(Number.isSafeInteger(value), `${at}_NOT_AN_INTEGER`);
  else if (types.includes("number")) assert.ok(typeof value === "number" && Number.isFinite(value), `${at}_NOT_A_NUMBER`);
  else assert.fail(`${at}_UNPUBLISHED_TYPE`);
  if (typeof schema.minimum === "number") assert.ok((value as number) >= schema.minimum, `${at}_BELOW_MINIMUM`);
}

// The served key sets, restated literally at every level.
const ENVELOPE_KEYS = ["data"];
const DEFINITION_KEYS = ["description", "key", "title"];
const RISK_EXPOSURE_KEYS = ["acceptedByResidualRating", "byInherentRating", "byResidualRating", "exposedSystems", "key", "residualByTreatmentStatus", "today", "underAssessment"];
const UNDER_ASSESSMENT_KEYS = ["byResidualRating"];
const RATING_COUNT_KEYS = ["Critical", "High", "Low", "Moderate", "notRated", "total"];
const RESIDUAL_BY_STATUS_KEYS = ["Critical", "High", "Low", "Moderate", "notRated"];
const TREATMENT_STATUS_COUNT_KEYS = ["complete", "inProgress", "notProvided", "notStarted", "overdue", "total"];
const EXPOSED_SYSTEMS_KEYS = ["risksWithoutSystem", "rows", "total", "truncated"];
const EXPOSED_SYSTEM_KEYS = ["critical", "documentId", "high", "name", "total"];
const CONTROL_EFFECTIVENESS_KEYS = ["effectivenessRating", "implementationStatus", "key", "today"];
const CONTROL_STATUS_COUNT_KEYS = ["existing", "implemented", "notProvided", "planned", "retired", "total"];
const EFFECTIVENESS_COUNT_KEYS = ["effective", "ineffective", "notAssessed", "notProvided", "partiallyEffective", "total"];
const TREATMENT_PERFORMANCE_KEYS = ["dueState", "dueWindowDays", "key", "mostOverdue", "today", "treatmentStatus"];
const DUE_STATE_COUNT_KEYS = ["dueWithinWindow", "later", "noTargetDate", "overdue", "total"];
const MOST_OVERDUE_KEYS = ["rows", "total", "truncated"];
const ALERT_ITEM_KEYS = ["dayOffset", "governingDate", "id", "kind", "link", "residualRating", "source", "urgency"];
const ALERT_SOURCE_KEYS = ["documentId", "identifier", "released", "title", "type"];
const ALERT_LINK_KEYS = ["documentId", "type"];
const THROUGHPUT_KEYS = ["key", "medianDaysToRelease", "period", "periodStart", "released", "requestsByStatus", "today"];
const RELEASED_KEYS = ["months", "total"];
const THROUGHPUT_MONTH_KEYS = ["count", "monthStart", "partial"];
const MEDIAN_KEYS = ["sampleSize", "truncated", "value"];
const REQUEST_STATUS_COUNT_KEYS = ["approved", "closed", "questionnaireInProgress", "riskAssessmentDrafted", "submitted", "total", "underReview"];

const SYSTEMS = { S1: "Alpha system", S2: "Beta system" } as const;
type SystemName = keyof typeof SYSTEMS;

type AssessmentFixture = {
  assessmentStatus: string;
  approvalDate: string | null;
  approvedBy: boolean;
  /** The status of the assessment's own request. */
  requestStatus: string;
  requestSubmittedDate: string | null;
};
const releasedLongAgo = at(addUtcMonths(currentMonthStart, -20));
/** Parent assessments, each on its own request. */
const ASSESSMENTS = {
  AM: { assessmentStatus: "in-review", approvalDate: null, approvedBy: false, requestStatus: "under-review", requestSubmittedDate: null },
  // Released 20 months before this month began: outside every throughput period.
  AR: { assessmentStatus: "approved", approvalDate: releasedLongAgo, approvedBy: true, requestStatus: "approved", requestSubmittedDate: daysBefore(releasedLongAgo, 15) },
  // Partially released: approved with an approval date but no approver, so its Risks are out of scope.
  AP: { assessmentStatus: "approved", approvalDate: at(D(-30)), approvedBy: false, requestStatus: "approved", requestSubmittedDate: at(D(-40)) },
} as const satisfies Record<string, AssessmentFixture>;
type AssessmentName = keyof typeof ASSESSMENTS;

type RiskFixture = {
  parent: AssessmentName;
  residualRating: string | null;
  inherentRating: string | null;
  treatmentStatus: string | null;
  targetDate: string | null;
  closureDate?: string;
  system: SystemName | null;
  treatmentAction?: "Accept" | "Treat";
};
/*
 * D-40 to D-43: AR's Risks are released and AM's are under assessment. The exposure sections count
 * released open Risks only, and the under-assessment figure counts AM's open Risks apart; the
 * treatment and control figures keep both stages.
 */
const RISKS = {
  // Under assessment, and accepted on a draft: never counted as accepted (D-41), nor in S1's exposure.
  A: { parent: "AM", residualRating: "Critical", inherentRating: "High", treatmentStatus: "Not Started", targetDate: D(-2), system: "S1", treatmentAction: "Accept" },
  B: { parent: "AR", residualRating: "High", inherentRating: "Critical", treatmentStatus: "In Progress", targetDate: D(10), system: "S1", treatmentAction: "Treat" },
  // D-38: C is due the day after the 14-day window ends, so it is due later.
  C: { parent: "AR", residualRating: "High", inherentRating: "High", treatmentStatus: null, targetDate: D(15), system: "S2", treatmentAction: "Accept" },
  D: { parent: "AR", residualRating: "Moderate", inherentRating: "Low", treatmentStatus: "Complete", targetDate: D(-5), system: null, treatmentAction: "Accept" },
  E: { parent: "AR", residualRating: "Low", inherentRating: "Extreme", treatmentStatus: "Overdue", targetDate: null, system: null },
  // D-38: F is due on the last day of the 14-day window, which is inclusive.
  F: { parent: "AM", residualRating: null, inherentRating: null, treatmentStatus: "Not Started", targetDate: D(14), system: null },
  I: { parent: "AR", residualRating: "High", inherentRating: "Moderate", treatmentStatus: "Not Started", targetDate: null, system: null },
  // Closed: its ratings, status, past target date and system never count.
  G: { parent: "AM", residualRating: "Critical", inherentRating: "Critical", treatmentStatus: "In Progress", targetDate: D(-4), closureDate: D(-1), system: "S1" },
  // Its parent is only partially released, so it is outside the Risk Register scope.
  H: { parent: "AP", residualRating: "Critical", inherentRating: "Critical", treatmentStatus: "Not Started", targetDate: D(-6), system: "S2" },
  RR: { parent: "AR", residualRating: "Critical", inherentRating: "High", treatmentStatus: "In Progress", targetDate: D(-12), system: "S2" },
} as const satisfies Record<string, RiskFixture>;
type RiskName = keyof typeof RISKS;

type ControlImplementationFixture = { risk: RiskName; controlStatus: string | null; effectivenessRating: string | null };
const CONTROL_IMPLEMENTATIONS = {
  CA: { risk: "A", controlStatus: "Planned", effectivenessRating: "Not Assessed" },
  CB: { risk: "B", controlStatus: "Implemented", effectivenessRating: "Effective" },
  CC: { risk: "C", controlStatus: "Implemented", effectivenessRating: "Ineffective" },
  CRR: { risk: "RR", controlStatus: "Existing", effectivenessRating: "Partially Effective" },
  CI: { risk: "I", controlStatus: null, effectivenessRating: null },
  // On a closed Risk and on an out-of-scope Risk: never counted.
  CG: { risk: "G", controlStatus: "Implemented", effectivenessRating: "Ineffective" },
  CH: { risk: "H", controlStatus: "Planned", effectivenessRating: "Ineffective" },
} as const satisfies Record<string, ControlImplementationFixture>;

const riskNumber = (name: string) => `P7R-RSK-${name}`;

type Fixtures = {
  systems: Record<SystemName, string>;
  requests: Record<AssessmentName, string>;
  assessments: Record<AssessmentName, string>;
  risks: Record<RiskName, string>;
  control: string;
};

let fixtures: Promise<Fixtures> | null = null;

function seedReportFixtures(): Promise<Fixtures> {
  fixtures ??= (async () => {
    const harness = await harnessPromise;
    const owner = harness.users.owner;
    const analyst = harness.users.analyst;
    const systems = {} as Record<SystemName, string>;
    for (const [name, systemName] of Object.entries(SYSTEMS) as Array<[SystemName, string]>) {
      systems[name] = await harness.createFixtureDocument("api::csrm-information-system.csrm-information-system", { name: systemName });
    }
    const requests = {} as Record<AssessmentName, string>;
    const assessments = {} as Record<AssessmentName, string>;
    for (const [name, fixture] of Object.entries(ASSESSMENTS) as Array<[AssessmentName, AssessmentFixture]>) {
      requests[name] = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `P7R-RAR-${name}`,
        title: `P7R report request ${name}`,
        requestStatus: fixture.requestStatus,
        requestor: owner,
        ...(fixture.requestSubmittedDate === null ? {} : { submittedDate: fixture.requestSubmittedDate }),
      });
      assessments[name] = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
        assessmentNumber: `P7R-ASM-${name}`,
        assessmentStatus: fixture.assessmentStatus,
        summary: `P7R report parent assessment ${name}`,
        assessmentRequest: requests[name],
        ...(fixture.approvalDate === null ? {} : { approvalDate: fixture.approvalDate }),
        ...(fixture.approvedBy ? { approvedBy: analyst, reviewedBy: analyst } : {}),
      });
    }
    const risks = {} as Record<RiskName, string>;
    for (const [name, fixture] of Object.entries(RISKS) as Array<[RiskName, RiskFixture]>) {
      risks[name] = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
        riskNumber: riskNumber(name),
        riskStatement: `P7R report Risk ${name}`,
        assessment: assessments[fixture.parent],
        ...(fixture.residualRating === null ? {} : { residualRating: fixture.residualRating }),
        ...(fixture.inherentRating === null ? {} : { inherentRating: fixture.inherentRating }),
        ...(fixture.treatmentStatus === null ? {} : { treatmentStatus: fixture.treatmentStatus }),
        ...(fixture.targetDate === null ? {} : { targetDate: fixture.targetDate }),
        ...(fixture.closureDate === undefined ? {} : { closureDate: fixture.closureDate }),
        ...(fixture.system === null ? {} : { informationSystemImpacted: systems[fixture.system] }),
        ...(fixture.treatmentAction === undefined ? {} : { treatmentAction: fixture.treatmentAction }),
      });
    }
    const control = await harness.createFixtureDocument("api::csrm-control.csrm-control", {
      controlNumber: "P7R-CTL-001",
      name: "Phase 7 report fixture control",
      framework: "P7R report fixtures",
    });
    for (const fixture of Object.values(CONTROL_IMPLEMENTATIONS) as ControlImplementationFixture[]) {
      await harness.createFixtureDocument("api::csrm-control-implementation.csrm-control-implementation", {
        risk: risks[fixture.risk],
        control,
        ...(fixture.controlStatus === null ? {} : { controlStatus: fixture.controlStatus }),
        ...(fixture.effectivenessRating === null ? {} : { effectivenessRating: fixture.effectivenessRating }),
      });
    }
    return { systems, requests, assessments, risks, control };
  })();
  return fixtures;
}

/** An approval instant `days` and `hours` into the UTC month `monthOffset` months from this one. */
const approvalAt = (monthOffset: number, days: number, hours: number): string =>
  at(addUtcDays(addUtcMonths(currentMonthStart, monthOffset), days), hours);

type ReleaseFixture = {
  assessmentStatus: string;
  approvalDate: string;
  approvedBy: boolean;
  requestStatus: string;
  /** Whole days from submission to approval, or null for a request with no submission date. */
  submittedDaysBefore: number | null;
};
/*
 * The throughput fixtures, each on its own request. AR from the first fixture
 * set was released twenty months ago and AP is only partially released, so
 * neither ever counts.
 */
const RELEASES = {
  // This month, submitted ten days before release.
  AR1: { assessmentStatus: "approved", approvalDate: approvalAt(0, 0, 1), approvedBy: true, requestStatus: "approved", submittedDaysBefore: 10 },
  // This month, with no submission date: released, but never in the median sample.
  AR4: { assessmentStatus: "approved", approvalDate: approvalAt(0, 0, 2), approvedBy: true, requestStatus: "approved", submittedDaysBefore: null },
  // Two months back, submitted thirty days before release.
  AR2: { assessmentStatus: "approved", approvalDate: approvalAt(-2, 5, 0), approvedBy: true, requestStatus: "approved", submittedDaysBefore: 30 },
  // Eight months back: inside the twelve-month period only.
  AR3: { assessmentStatus: "approved", approvalDate: approvalAt(-8, 5, 0), approvedBy: true, requestStatus: "closed", submittedDaysBefore: 5 },
  // Partially released this month: approved with an approval date but no approver.
  APX: { assessmentStatus: "approved", approvalDate: approvalAt(0, 0, 3), approvedBy: false, requestStatus: "under-review", submittedDaysBefore: 7 },
  // Still in review, although it carries release facts this month: only the approved status releases.
  AIR: { assessmentStatus: "in-review", approvalDate: approvalAt(0, 0, 4), approvedBy: true, requestStatus: "under-review", submittedDaysBefore: 6 },
} as const satisfies Record<string, ReleaseFixture>;

/** Requests with no assessment, so every review-scope status has a count, and one draft that never counts. */
const STATUS_REQUESTS = {
  QS: "submitted",
  QQ1: "questionnaire-in-progress",
  QQ2: "questionnaire-in-progress",
  QD: "risk-assessment-drafted",
  QDRAFT: "draft",
} as const;

let throughputFixtures: Promise<void> | null = null;

function seedThroughputFixtures(): Promise<void> {
  throughputFixtures ??= (async () => {
    const harness = await harnessPromise;
    await seedReportFixtures();
    const owner = harness.users.owner;
    const analyst = harness.users.analyst;
    for (const [name, fixture] of Object.entries(RELEASES) as Array<[string, ReleaseFixture]>) {
      const request = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `P7R-RAR-${name}`,
        title: `P7R throughput request ${name}`,
        requestStatus: fixture.requestStatus,
        requestor: owner,
        ...(fixture.submittedDaysBefore === null ? {} : { submittedDate: daysBefore(fixture.approvalDate, fixture.submittedDaysBefore) }),
      });
      await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
        assessmentNumber: `P7R-ASM-${name}`,
        assessmentStatus: fixture.assessmentStatus,
        summary: `P7R throughput assessment ${name}`,
        assessmentRequest: request,
        approvalDate: fixture.approvalDate,
        ...(fixture.approvedBy ? { approvedBy: analyst, reviewedBy: analyst } : {}),
      });
    }
    for (const [name, requestStatus] of Object.entries(STATUS_REQUESTS)) {
      await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `P7R-RAR-${name}`,
        title: `P7R status request ${name}`,
        requestStatus,
        requestor: owner,
        submittedDate: at(D(-3)),
      });
    }
  })();
  return throughputFixtures;
}

/*
 * The review-scope request counts once both fixture sets exist: AM, APX and AIR
 * are under review; AR, AP, AR1, AR4 and AR2 are approved; AR3 is closed. The
 * harness's two draft requests and QDRAFT are outside the analyst's scope.
 */
const EXPECTED_REQUESTS_BY_STATUS = {
  submitted: 1,
  questionnaireInProgress: 2,
  riskAssessmentDrafted: 1,
  underReview: 3,
  approved: 5,
  closed: 1,
  total: 13,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertSameUtcDay(): void {
  assert.equal(utcToday(new Date()), today, "UTC_DAY_ROLLED_OVER_DURING_TEST");
}

function sortedKeys(value: unknown, label: string): string[] {
  assert.ok(isRecord(value), `${label}_NOT_AN_OBJECT`);
  return Object.keys(value).sort();
}

/** Pins one served level: its keys literally, and against the closed component the contract publishes for it. */
function assertKeys(value: unknown, expected: readonly string[], label: string, component: string): Record<string, unknown> {
  assert.deepEqual(sortedKeys(value, label), expected, `${label}_KEYS`);
  assert.deepEqual(sortedKeys(value, label), specKeys(component), `${label}_SPEC_KEYS_${component}`);
  return value as Record<string, unknown>;
}

async function readJson(pathName: string, identity?: string): Promise<{ status: number; body: unknown; text: string }> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: pathName, identity: identity ?? harness.identities.analyst });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

/** The union branch the contract publishes for each report key. */
const REPORT_COMPONENTS: Readonly<Record<string, string>> = {
  "risk-exposure": "RiskExposureReport",
  "treatment-performance": "TreatmentPerformanceReport",
  "assessment-throughput": "AssessmentThroughputReport",
  "control-effectiveness": "ControlEffectivenessReport",
};

/**
 * One report read by the human analyst. The envelope and the report are pinned
 * against their components, and the whole body is walked against the published
 * union, so the served branch is the one the discriminator maps its key to.
 */
async function readReport(key: string, query = ""): Promise<Record<string, unknown>> {
  const { status, body, text } = await readJson(`${reportPath(key)}${query}`);
  assert.equal(status, 200, `REPORT_READ_FAILED_${key}${query}: ${text}`);
  assertMatchesSpec(body, { $ref: "#/components/schemas/ReportResponse" }, `REPORT_${key}${query}`);
  const envelope = assertKeys(body, ENVELOPE_KEYS, `REPORT_ENVELOPE_${key}`, "ReportResponse");
  assert.ok(isRecord(envelope.data), `REPORT_DATA_NOT_AN_OBJECT_${key}`);
  const data = envelope.data;
  assert.equal(data.key, key, `REPORT_KEY_${key}`);
  assert.equal(data.today, today, `REPORT_TODAY_${key}`);
  const union = specComponent("ReportResponse").properties?.data;
  assert.equal(union?.discriminator?.mapping[key], `#/components/schemas/${REPORT_COMPONENTS[key]}`, `REPORT_BRANCH_MAPPING_${key}`);
  assert.deepEqual(sortedKeys(data, `REPORT_BRANCH_${key}`), specKeys(REPORT_COMPONENTS[key]), `REPORT_BRANCH_SPEC_KEYS_${key}`);
  return data;
}

function assertRiskExposureShape(data: Record<string, unknown>, label: string): void {
  assertKeys(data, RISK_EXPOSURE_KEYS, `${label}_REPORT`, "RiskExposureReport");
  assertKeys(data.byResidualRating, RATING_COUNT_KEYS, `${label}_BY_RESIDUAL_RATING`, "RatingCounts");
  assertKeys(data.byInherentRating, RATING_COUNT_KEYS, `${label}_BY_INHERENT_RATING`, "RatingCounts");
  assertKeys(data.acceptedByResidualRating, RATING_COUNT_KEYS, `${label}_ACCEPTED_BY_RESIDUAL_RATING`, "RatingCounts");
  const underAssessment = assertKeys(data.underAssessment, UNDER_ASSESSMENT_KEYS, `${label}_UNDER_ASSESSMENT`, "RiskExposureUnderAssessment");
  assertKeys(underAssessment.byResidualRating, RATING_COUNT_KEYS, `${label}_UNDER_ASSESSMENT_BY_RESIDUAL_RATING`, "RatingCounts");
  const matrix = assertKeys(data.residualByTreatmentStatus, RESIDUAL_BY_STATUS_KEYS, `${label}_RESIDUAL_BY_STATUS`, "ResidualByTreatmentStatus");
  for (const rating of RESIDUAL_BY_STATUS_KEYS) {
    assertKeys(matrix[rating], TREATMENT_STATUS_COUNT_KEYS, `${label}_RESIDUAL_BY_STATUS_${rating}`, "TreatmentStatusCounts");
  }
  const systems = assertKeys(data.exposedSystems, EXPOSED_SYSTEMS_KEYS, `${label}_EXPOSED_SYSTEMS`, "ExposedSystems");
  assert.ok(Array.isArray(systems.rows), `${label}_EXPOSED_SYSTEM_ROWS_NOT_A_LIST`);
  for (const [index, row] of (systems.rows as unknown[]).entries()) {
    assertKeys(row, EXPOSED_SYSTEM_KEYS, `${label}_EXPOSED_SYSTEM_${index}`, "ExposedSystem");
  }
}

function assertControlEffectivenessShape(data: Record<string, unknown>, label: string): void {
  assertKeys(data, CONTROL_EFFECTIVENESS_KEYS, `${label}_REPORT`, "ControlEffectivenessReport");
  assertKeys(data.implementationStatus, CONTROL_STATUS_COUNT_KEYS, `${label}_IMPLEMENTATION_STATUS`, "ControlStatusCounts");
  assertKeys(data.effectivenessRating, EFFECTIVENESS_COUNT_KEYS, `${label}_EFFECTIVENESS_RATING`, "EffectivenessCounts");
}

function assertTreatmentPerformanceShape(data: Record<string, unknown>, label: string): void {
  assertKeys(data, TREATMENT_PERFORMANCE_KEYS, `${label}_REPORT`, "TreatmentPerformanceReport");
  assertKeys(data.dueState, DUE_STATE_COUNT_KEYS, `${label}_DUE_STATE`, "TreatmentDueStateCounts");
  assertKeys(data.treatmentStatus, TREATMENT_STATUS_COUNT_KEYS, `${label}_TREATMENT_STATUS`, "TreatmentStatusCounts");
  const mostOverdue = assertKeys(data.mostOverdue, MOST_OVERDUE_KEYS, `${label}_MOST_OVERDUE`, "MostOverdueTreatments");
  assert.ok(Array.isArray(mostOverdue.rows), `${label}_MOST_OVERDUE_ROWS_NOT_A_LIST`);
  for (const [index, row] of (mostOverdue.rows as unknown[]).entries()) {
    const item = assertKeys(row, ALERT_ITEM_KEYS, `${label}_MOST_OVERDUE_ROW_${index}`, "AlertItem");
    assertKeys(item.source, ALERT_SOURCE_KEYS, `${label}_MOST_OVERDUE_SOURCE_${index}`, "AlertSource");
    assertKeys(item.link, ALERT_LINK_KEYS, `${label}_MOST_OVERDUE_LINK_${index}`, "AlertLink");
  }
}

function assertThroughputShape(data: Record<string, unknown>, label: string): void {
  assertKeys(data, THROUGHPUT_KEYS, `${label}_REPORT`, "AssessmentThroughputReport");
  const released = assertKeys(data.released, RELEASED_KEYS, `${label}_RELEASED`, "ThroughputReleased");
  assert.ok(Array.isArray(released.months), `${label}_MONTHS_NOT_A_LIST`);
  for (const [index, month] of (released.months as unknown[]).entries()) {
    assertKeys(month, THROUGHPUT_MONTH_KEYS, `${label}_MONTH_${index}`, "ThroughputMonth");
  }
  assertKeys(data.medianDaysToRelease, MEDIAN_KEYS, `${label}_MEDIAN`, "MedianDaysToRelease");
  assertKeys(data.requestsByStatus, REQUEST_STATUS_COUNT_KEYS, `${label}_REQUESTS_BY_STATUS`, "RequestStatusCounts");
}

/** The Risk Register total for one query, read by the human analyst. */
async function registerTotal(query: string): Promise<number> {
  const { status, body, text } = await readJson(`/api/v1/risks?${query}`);
  assert.equal(status, 200, `REGISTER_READ_FAILED_${query}: ${text}`);
  const total = (body as { meta?: { pagination?: { total?: unknown } } }).meta?.pagination?.total;
  assert.ok(typeof total === "number", `REGISTER_TOTAL_MISSING_${query}`);
  return total;
}

/** The alert summary's count for one kind, read by the human analyst. */
async function alertCount(kind: string): Promise<number> {
  const { status, body, text } = await readJson("/api/v1/alerts/summary");
  assert.equal(status, 200, `ALERT_SUMMARY_READ_FAILED: ${text}`);
  const count = (body as { data?: { byKind?: Record<string, unknown> } }).data?.byKind?.[kind];
  assert.ok(typeof count === "number", `ALERT_SUMMARY_COUNT_MISSING_${kind}`);
  return count;
}

/*
 * Released open Risks: B, C, D, E, I and RR. A and F are under assessment, G is closed and H's parent is
 * only partly released. Without the released branch, A would lift Critical to 2 and F would add a Not rated.
 */
const EXPECTED_BY_RESIDUAL_RATING = { Critical: 1, High: 3, Moderate: 1, Low: 1, notRated: 0, total: 6 };
const EXPECTED_BY_INHERENT_RATING = { Critical: 1, High: 2, Moderate: 1, Low: 1, notRated: 1, total: 6 };
/* C and D are released and accepted; A's Accept is on a draft, so it never counts (D-41). */
const EXPECTED_ACCEPTED_BY_RESIDUAL_RATING = { Critical: 0, High: 1, Moderate: 1, Low: 0, notRated: 0, total: 2 };
/* A and F: the open Risks under assessment (D-42). */
const EXPECTED_UNDER_ASSESSMENT_BY_RESIDUAL_RATING = { Critical: 1, High: 0, Moderate: 0, Low: 0, notRated: 1, total: 2 };
const EXPECTED_RESIDUAL_BY_TREATMENT_STATUS = {
  Critical: { notStarted: 0, inProgress: 1, overdue: 0, complete: 0, notProvided: 0, total: 1 },
  High: { notStarted: 1, inProgress: 1, overdue: 0, complete: 0, notProvided: 1, total: 3 },
  Moderate: { notStarted: 0, inProgress: 0, overdue: 0, complete: 1, notProvided: 0, total: 1 },
  Low: { notStarted: 0, inProgress: 0, overdue: 1, complete: 0, notProvided: 0, total: 1 },
  notRated: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
};
/** The register's value for each rating key: notRated is the `none` value (D-35). */
const REGISTER_RATING_VALUES = { Critical: "Critical", High: "High", Moderate: "Moderate", Low: "Low", notRated: "none" } as const;

test("the report index lists exactly the four reports with the web's canonical copy", async () => {
  const { status, body, text } = await readJson(INDEX_PATH);
  assert.equal(status, 200, `REPORT_INDEX_READ_FAILED: ${text}`);
  assertMatchesSpec(body, { $ref: "#/components/schemas/ReportDefinitionListResponse" }, "REPORT_INDEX");
  const envelope = assertKeys(body, ENVELOPE_KEYS, "REPORT_INDEX_ENVELOPE", "ReportDefinitionListResponse");
  assert.ok(Array.isArray(envelope.data), "REPORT_INDEX_DATA_NOT_A_LIST");
  for (const [index, definition] of (envelope.data as unknown[]).entries()) {
    assertKeys(definition, DEFINITION_KEYS, `REPORT_DEFINITION_${index}`, "ReportDefinition");
  }

  assert.equal(REPORT_COPY.length, 4, "REPORT_COPY_MAP_NOT_FOUR_ENTRIES");
  assert.deepEqual(
    envelope.data,
    REPORT_COPY.map(({ key, title, description }) => ({ key, title, description })),
    "REPORT_DEFINITIONS_DIFFER_FROM_THE_WEB_COPY_MAP",
  );
  assert.deepEqual(
    (envelope.data as Array<{ key: string }>).map(({ key }) => key),
    ["risk-exposure", "treatment-performance", "assessment-throughput", "control-effectiveness"],
    "REPORT_INDEX_ORDER",
  );
});

test("risk exposure counts released open Risks by rating, treatment status and Information System, with accepted Risks and Risks under assessment apart (D-40 to D-42)", async () => {
  assertSameUtcDay();
  const created = await seedReportFixtures();
  const data = await readReport("risk-exposure");
  assertRiskExposureShape(data, "RISK_EXPOSURE");

  // A closed Risk (G), a Risk on a partly released parent (H) or one under assessment (A, F) never counts here.
  assert.deepEqual(data.byResidualRating, EXPECTED_BY_RESIDUAL_RATING, "RISK_EXPOSURE_BY_RESIDUAL_RATING");
  assert.deepEqual(data.byInherentRating, EXPECTED_BY_INHERENT_RATING, "RISK_EXPOSURE_BY_INHERENT_RATING");
  assert.deepEqual(data.acceptedByResidualRating, EXPECTED_ACCEPTED_BY_RESIDUAL_RATING, "RISK_EXPOSURE_ACCEPTED_BY_RESIDUAL_RATING");
  assert.deepEqual(data.underAssessment, { byResidualRating: EXPECTED_UNDER_ASSESSMENT_BY_RESIDUAL_RATING }, "RISK_EXPOSURE_UNDER_ASSESSMENT");
  assert.deepEqual(data.residualByTreatmentStatus, EXPECTED_RESIDUAL_BY_TREATMENT_STATUS, "RISK_EXPOSURE_RESIDUAL_BY_TREATMENT_STATUS");
  // S2 carries the released Critical RR and the High C; S1 only the High B, because A, its
  // Critical Risk, is under assessment. I is the one released High or Critical Risk with no
  // Information System; D and E are not High or Critical.
  assert.deepEqual(data.exposedSystems, {
    rows: [
      { documentId: created.systems.S2, name: SYSTEMS.S2, critical: 1, high: 1, total: 2 },
      { documentId: created.systems.S1, name: SYSTEMS.S1, critical: 0, high: 1, total: 1 },
    ],
    total: 2,
    truncated: false,
    risksWithoutSystem: 1,
  }, "RISK_EXPOSURE_EXPOSED_SYSTEMS");
  assertSameUtcDay();
});

test("every exposure figure equals the Risk Register total of the stage-filtered list it links to (D-40 to D-42)", async () => {
  await seedReportFixtures();
  const data = await readReport("risk-exposure");
  const byResidualRating = data.byResidualRating as Record<string, number>;
  const byInherentRating = data.byInherentRating as Record<string, number>;
  const accepted = data.acceptedByResidualRating as Record<string, number>;
  const underAssessment = (data.underAssessment as { byResidualRating: Record<string, number> }).byResidualRating;
  for (const [key, value] of Object.entries(REGISTER_RATING_VALUES)) {
    assert.equal(await registerTotal(`residualRating=${value}&state=open&stage=released`), byResidualRating[key], `REGISTER_RELEASED_RESIDUAL_DIFFERS_${key}`);
    assert.equal(await registerTotal(`inherentRating=${value}&state=open&stage=released`), byInherentRating[key], `REGISTER_RELEASED_INHERENT_DIFFERS_${key}`);
    assert.equal(
      await registerTotal(`residualRating=${value}&state=open&stage=released&treatmentAction=Accept`),
      accepted[key],
      `REGISTER_ACCEPTED_DIFFERS_${key}`,
    );
    assert.equal(
      await registerTotal(`residualRating=${value}&state=open&stage=under-assessment`),
      underAssessment[key],
      `REGISTER_UNDER_ASSESSMENT_DIFFERS_${key}`,
    );
  }
  assert.equal(await registerTotal("state=open&stage=released"), byResidualRating.total, "REGISTER_RELEASED_TOTAL_DIFFERS");
  assert.equal(await registerTotal("state=open&stage=released&treatmentAction=Accept"), accepted.total, "REGISTER_ACCEPTED_TOTAL_DIFFERS");
  assert.equal(await registerTotal("state=open&stage=under-assessment"), underAssessment.total, "REGISTER_UNDER_ASSESSMENT_TOTAL_DIFFERS");
  // The two stages partition the open register, so neither figure ever holds the other's Risks.
  assert.equal(await registerTotal("state=open"), byResidualRating.total + underAssessment.total, "REGISTER_OPEN_TOTAL_NOT_THE_TWO_STAGES");
  assert.equal(await registerTotal("state=open"), 8, "REGISTER_OPEN_TOTAL");
});

test("control effectiveness counts Control Implementations on open contextual Risks only", async () => {
  await seedReportFixtures();
  const data = await readReport("control-effectiveness");
  assertControlEffectivenessShape(data, "CONTROL_EFFECTIVENESS");

  assert.deepEqual(data.implementationStatus, {
    existing: 1,
    planned: 1,
    implemented: 2,
    retired: 0,
    notProvided: 1,
    total: 5,
  }, "CONTROL_EFFECTIVENESS_IMPLEMENTATION_STATUS");
  assert.deepEqual(data.effectivenessRating, {
    effective: 1,
    partiallyEffective: 1,
    ineffective: 1,
    notAssessed: 1,
    notProvided: 1,
    total: 5,
  }, "CONTROL_EFFECTIVENESS_RATING");
  // The Rated Ineffective tile links to the ineffective-control alerts, over the same scope.
  assert.equal(
    (data.effectivenessRating as Record<string, number>).ineffective,
    await alertCount("ineffective-control"),
    "RATED_INEFFECTIVE_DIFFERS_FROM_THE_ALERT_TOTAL",
  );
});

test("both report operations refuse every identity other than the human analyst, before any key or query is read", async () => {
  const harness = await harnessPromise;
  await seedReportFixtures();
  const identities = [
    ["owner", harness.identities.owner],
    ["otherRequestor", harness.identities.otherRequestor],
    ["serviceAnalystAgent", harness.identities.serviceAnalystAgent],
    ["analystAgent", harness.identities.analystAgent],
    ["inactiveAnalyst", harness.identities.inactiveAnalyst],
    ["no identity", undefined],
  ] as const;
  const paths = [
    INDEX_PATH,
    `${INDEX_PATH}?x=1`,
    reportPath("risk-exposure"),
    reportPath("treatment-performance"),
    reportPath("assessment-throughput"),
    `${reportPath("assessment-throughput")}?period=3`,
    reportPath("control-effectiveness"),
    reportPath("unknown"),
  ];
  for (const pathName of paths) {
    for (const [label, identity] of identities) {
      const response = await harness.request({ path: pathName, identity });
      assert.equal(response.status, 403, `REPORT_DENIAL_FAILED_${label}_${pathName}`);
      const text = await response.text();
      assert.doesNotMatch(text, /SQL|stack|database/i, `REPORT_DENIAL_LEAKED_INTERNALS_${label}_${pathName}`);
      assert.doesNotMatch(text, /P7R-|byResidualRating|exposedSystems|Alpha system/, `REPORT_DENIAL_LEAKED_DATA_${label}_${pathName}`);
    }
    const missingToken = await harness.request({ path: pathName, identity: harness.identities.analyst, omitApiToken: true });
    assert.equal(missingToken.status, 401, `REPORT_TOKEN_GATE_MISSING_${pathName}`);
  }
});

test("an unknown report key is a 404 to the analyst, and any other query is one safe 400", async () => {
  await seedReportFixtures();
  const refusals: ReadonlyArray<readonly [string, number, string]> = [
    [reportPath("unknown"), 404, "CSRM report was not found."],
    [reportPath("Risk-Exposure"), 404, "CSRM report was not found."],
    [reportPath("risk-exposure-report"), 404, "CSRM report was not found."],
    [`${INDEX_PATH}?x=1`, 400, "CSRM report query is invalid."],
    [`${INDEX_PATH}?period=6`, 400, "CSRM report query is invalid."],
    [`${reportPath("risk-exposure")}?period=6`, 400, "CSRM report query is invalid."],
    [`${reportPath("risk-exposure")}?x=1`, 400, "CSRM report query is invalid."],
    [`${reportPath("control-effectiveness")}?period=12`, 400, "CSRM report query is invalid."],
    [`${reportPath("treatment-performance")}?period=6`, 400, "CSRM report query is invalid."],
    [`${reportPath("treatment-performance")}?window=30`, 400, "CSRM report query is invalid."],
  ];
  for (const [pathName, status, message] of refusals) {
    const { status: served, body, text } = await readJson(pathName);
    assert.equal(served, status, `REPORT_REFUSAL_STATUS_${pathName}: ${text}`);
    assert.doesNotMatch(text, /SQL|stack|database/i, `REPORT_REFUSAL_LEAKED_INTERNALS_${pathName}`);
    assert.doesNotMatch(text, /P7R-|byResidualRating|exposedSystems|Alpha system/, `REPORT_REFUSAL_LEAKED_DATA_${pathName}`);
    const error = (body as { error?: { status?: number; message?: string } } | null)?.error;
    assert.equal(error?.status, status, `REPORT_REFUSAL_ERROR_STATUS_${pathName}`);
    assert.equal(error?.message, message, `REPORT_REFUSAL_ERROR_MESSAGE_${pathName}`);
  }
});

test("treatment performance partitions open treatments by due state over the 14-day due-soon window and lists the most overdue first (D-38)", async () => {
  assertSameUtcDay();
  const created = await seedReportFixtures();
  const data = await readReport("treatment-performance");
  assertTreatmentPerformanceShape(data, "TREATMENT_PERFORMANCE");

  // D-38: the product's one due-soon window, reversing Phase 7 D-13's thirty days.
  assert.equal(data.dueWindowDays, 14, "TREATMENT_PERFORMANCE_WINDOW");
  // Open, not-Complete treatments in both stages: A, B, C, E, F, I and RR. F's target is exactly
  // today plus fourteen days, so the window is inclusive at its end; C's, one day later, is later.
  assert.deepEqual(data.dueState, { overdue: 2, dueWithinWindow: 2, later: 1, noTargetDate: 2, total: 7 }, "TREATMENT_DUE_STATE");
  // Every open contextual Risk by its recorded status; C records none.
  assert.deepEqual(data.treatmentStatus, {
    notStarted: 3,
    inProgress: 2,
    overdue: 1,
    complete: 1,
    notProvided: 1,
    total: 8,
  }, "TREATMENT_STATUS");

  // The due state agrees with the single D-04 rule on every in-scope fixture.
  const oracle = { overdue: 0, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 };
  const oracleKey = { overdue: "overdue", "due-soon": "dueWithinWindow", later: "later", "no-target-date": "noTargetDate" } as const;
  for (const fixture of Object.values(RISKS) as RiskFixture[]) {
    if (fixture.parent === "AP") continue;
    const state = deriveTreatmentDueState({
      targetDate: fixture.targetDate,
      treatmentStatus: fixture.treatmentStatus,
      closureDate: fixture.closureDate ?? null,
    }, today, 14);
    if (state === "complete-or-closed") continue;
    oracle[oracleKey[state]] += 1;
    oracle.total += 1;
  }
  assert.deepEqual(data.dueState, oracle, "TREATMENT_DUE_STATE_DISAGREES_WITH_THE_SHARED_RULE");

  // The most overdue are the risk-treatment-overdue alerts, oldest target date first.
  const risk = (name: RiskName, targetDays: number, released: boolean) => ({
    id: `risk-treatment-overdue:${created.risks[name]}`,
    kind: "risk-treatment-overdue",
    urgency: "overdue",
    governingDate: D(targetDays),
    dayOffset: targetDays,
    source: { type: "risk", documentId: created.risks[name], identifier: riskNumber(name), title: `P7R report Risk ${name}`, released },
    link: { type: "risk", documentId: created.risks[name] },
    residualRating: "Critical",
  });
  assert.deepEqual(data.mostOverdue, {
    rows: [risk("RR", -12, true), risk("A", -2, false)],
    total: 2,
    truncated: false,
  }, "MOST_OVERDUE_TREATMENTS");

  // The Overdue tile links to the risk-treatment-overdue alerts, over the same predicate.
  const dueState = data.dueState as Record<string, number>;
  assert.equal(dueState.overdue, await alertCount("risk-treatment-overdue"), "OVERDUE_DIFFERS_FROM_THE_ALERT_TOTAL");
  assert.equal((data.mostOverdue as { total: number }).total, dueState.overdue, "MOST_OVERDUE_TOTAL_DIFFERS_FROM_THE_DUE_STATE");
  assertSameUtcDay();
});

/*
 * D-38, G-16 seam: the report's four due-state figures read the shared due-state rule with the alerts' window, so
 * each equals the list it opens: the due-soon and overdue alert lists, and the Risk register's dueState lists.
 */
test("every treatment due-state figure equals its alert list or its Risk register dueState list (D-38, G-16)", async () => {
  assertSameUtcDay();
  await seedReportFixtures();
  const data = await readReport("treatment-performance");
  const dueState = data.dueState as Record<string, number>;
  assert.equal(dueState.dueWithinWindow, await alertCount("risk-treatment-due-soon"), "DUE_WITHIN_WINDOW_DIFFERS_FROM_THE_DUE_SOON_ALERTS");
  assert.equal(dueState.overdue, await alertCount("risk-treatment-overdue"), "OVERDUE_DIFFERS_FROM_THE_OVERDUE_ALERTS");
  assert.equal(dueState.dueWithinWindow, await registerTotal("dueState=due-soon"), "DUE_WITHIN_WINDOW_DIFFERS_FROM_THE_REGISTER");
  assert.equal(dueState.overdue, await registerTotal("dueState=overdue"), "OVERDUE_DIFFERS_FROM_THE_REGISTER");
  assert.equal(dueState.later, await registerTotal("dueState=later"), "LATER_DIFFERS_FROM_THE_REGISTER");
  assert.equal(dueState.noTargetDate, await registerTotal("dueState=no-target-date"), "NO_TARGET_DATE_DIFFERS_FROM_THE_REGISTER");
  // The figures were not vacuous: each list holds at least one fixture Risk.
  for (const [key, value] of Object.entries(dueState)) assert.ok(value > 0, `DUE_STATE_FIGURE_EMPTY_${key}`);
  assertSameUtcDay();
});

test("assessment throughput counts releases per UTC month over six months, with a partial current month and the median", async () => {
  assertSameUtcDay();
  await seedThroughputFixtures();
  for (const query of ["", "?period=6"]) {
    const data = await readReport("assessment-throughput", query);
    assertThroughputShape(data, `THROUGHPUT_SIX${query}`);
    assert.equal(data.period, 6, `THROUGHPUT_PERIOD${query}`);
    assert.equal(data.periodStart, addUtcMonths(currentMonthStart, -5), `THROUGHPUT_PERIOD_START${query}`);
    const released = data.released as { months: Array<{ monthStart: string; count: number; partial: boolean }>; total: number };
    assert.deepEqual(
      released.months.map(({ monthStart }) => monthStart),
      [-5, -4, -3, -2, -1, 0].map((offset) => addUtcMonths(currentMonthStart, offset)),
      `THROUGHPUT_MONTHS${query}`,
    );
    // AR2 two months back; AR1 and AR4 this month. APX, AIR, AP and AR never count.
    assert.deepEqual(released.months.map(({ count }) => count), [0, 0, 0, 1, 0, 2], `THROUGHPUT_MONTH_COUNTS${query}`);
    assert.deepEqual(released.months.map(({ partial }) => partial), [false, false, false, false, false, true], `THROUGHPUT_PARTIAL_MONTH${query}`);
    assert.equal(released.total, 3, `THROUGHPUT_RELEASED_TOTAL${query}`);
    // AR1 took ten days and AR2 thirty; AR4 has no submission date.
    assert.deepEqual(data.medianDaysToRelease, { value: 20, sampleSize: 2, truncated: false }, `THROUGHPUT_MEDIAN${query}`);
    assert.deepEqual(data.requestsByStatus, EXPECTED_REQUESTS_BY_STATUS, `THROUGHPUT_REQUESTS_BY_STATUS${query}`);
  }
  assertSameUtcDay();
});

test("assessment throughput over twelve months reaches the release eight months back", async () => {
  assertSameUtcDay();
  await seedThroughputFixtures();
  const data = await readReport("assessment-throughput", "?period=12");
  assertThroughputShape(data, "THROUGHPUT_TWELVE");
  assert.equal(data.period, 12, "THROUGHPUT_TWELVE_PERIOD");
  assert.equal(data.periodStart, addUtcMonths(currentMonthStart, -11), "THROUGHPUT_TWELVE_PERIOD_START");
  const released = data.released as { months: Array<{ monthStart: string; count: number; partial: boolean }>; total: number };
  assert.equal(released.months.length, 12, "THROUGHPUT_TWELVE_MONTH_COUNT");
  assert.equal(released.months[3]?.monthStart, addUtcMonths(currentMonthStart, -8), "THROUGHPUT_TWELVE_AR3_MONTH");
  assert.equal(released.months[3]?.count, 1, "THROUGHPUT_TWELVE_AR3_COUNT");
  assert.deepEqual(released.months.map(({ count }) => count), [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 2], "THROUGHPUT_TWELVE_MONTH_COUNTS");
  assert.deepEqual(released.months.filter(({ partial }) => partial).map(({ monthStart }) => monthStart), [currentMonthStart], "THROUGHPUT_TWELVE_PARTIAL");
  assert.equal(released.total, 4, "THROUGHPUT_TWELVE_TOTAL");
  // Five, ten and thirty days: the median is ten.
  assert.deepEqual(data.medianDaysToRelease, { value: 10, sampleSize: 3, truncated: false }, "THROUGHPUT_TWELVE_MEDIAN");
  // Requests by lifecycle state are a current snapshot, whatever the period.
  assert.deepEqual(data.requestsByStatus, EXPECTED_REQUESTS_BY_STATUS, "THROUGHPUT_TWELVE_REQUESTS_BY_STATUS");
  assertSameUtcDay();
});

test("throughput figure drill-downs equal the Released assessment population and partial approvals remain reviewable", async () => {
  assertSameUtcDay();
  await seedThroughputFixtures();
  const list = async (query: string): Promise<{ numbers: string[]; total: number }> => {
    const { status, body, text } = await readJson(`/api/v1/risk_assessments?${query}&pageSize=100`);
    assert.equal(status, 200, `THROUGHPUT_DRILLDOWN_REFUSED_${text}`);
    assert.ok(isRecord(body) && Array.isArray(body.data) && isRecord(body.meta));
    assert.ok(isRecord(body.meta.pagination));
    return {
      numbers: (body.data as Array<{ assessmentNumber: string }>).map((row) => row.assessmentNumber).sort(),
      total: body.meta.pagination.total as number,
    };
  };
  for (const period of [6, 12]) {
    const data = await readReport("assessment-throughput", `?period=${period}`);
    const released = data.released as { months: Array<{ monthStart: string; count: number }>; total: number };
    const periodList = await list(`status=approved&approvedFrom=${data.periodStart}&approvedTo=${today}`);
    assert.equal(periodList.total, released.total, `THROUGHPUT_PERIOD_LIST_DIFFERS_${period}`);
    assert.deepEqual(periodList.numbers, (period === 6
      ? ["P7R-ASM-AR1", "P7R-ASM-AR2", "P7R-ASM-AR4"]
      : ["P7R-ASM-AR1", "P7R-ASM-AR2", "P7R-ASM-AR3", "P7R-ASM-AR4"]));
    for (const month of released.months) {
      const nextMonth = addUtcMonths(month.monthStart, 1);
      const monthEnd = nextMonth > today ? today : addUtcDays(nextMonth, -1);
      const monthList = await list(`status=approved&approvedFrom=${month.monthStart}&approvedTo=${monthEnd}`);
      assert.equal(monthList.total, month.count, `THROUGHPUT_MONTH_LIST_DIFFERS_${month.monthStart}`);
      assert.equal(monthList.numbers.includes("P7R-ASM-APX"), false, "PARTIAL_APPROVAL_PRESENTED_AS_RELEASED");
    }
  }
  assert.ok((await list("q=P7R-ASM-APX")).numbers.includes("P7R-ASM-APX"), "PARTIAL_APPROVAL_UNAVAILABLE_FOR_REVIEW");
  assertSameUtcDay();
});

test("the throughput period is closed to six or twelve months, and no other query is taken", async () => {
  await seedThroughputFixtures();
  const refused = [
    "?period=3",
    "?period=6&x=1",
    "?period=",
    "?period=06",
    "?period=6.0",
    "?period=6&period=12",
    "?period[$eq]=6",
    "?months=6",
  ];
  for (const query of refused) {
    const { status, body, text } = await readJson(`${reportPath("assessment-throughput")}${query}`);
    assert.equal(status, 400, `THROUGHPUT_QUERY_NOT_REFUSED_${query}: ${text}`);
    assert.doesNotMatch(text, /SQL|stack|database/i, `THROUGHPUT_QUERY_LEAKED_INTERNALS_${query}`);
    assert.doesNotMatch(text, /P7R-|released|requestsByStatus/, `THROUGHPUT_QUERY_LEAKED_DATA_${query}`);
    assert.equal((body as { error?: { message?: string } } | null)?.error?.message, "CSRM report query is invalid.", `THROUGHPUT_QUERY_MESSAGE_${query}`);
  }
});

/*
 * Phase 16 D-13, D-14, decision 11: a withdrawn Risk counts in no report. WU, a Critical Risk with an overdue treatment
 * and an ineffective control, impacting S1, sits on an in-review assessment of its own (which a withdrawal, an accepted
 * edit, keeps in review: D-23, so the throughput's request counts hold) and is withdrawn and reinstated through
 * the 16-05 operations; WR, a Critical, accepted Risk with an overdue treatment and an ineffective control, impacting S2,
 * on the released AR carries the withdrawal facts through the fixture, as a Risk withdrawn before its assessment was
 * released does. Withdrawn, every report equals the reports without them and each exposure and due-state figure still
 * equals its register list; reinstated, each figure is back. The two are left withdrawn, so the last test's figures hold.
 */
type CurationOperation = "risk_withdrawals" | "risk_reinstatements";
const WITHDRAWAL_REPORT_KEYS = ["risk-exposure", "control-effectiveness", "treatment-performance", "assessment-throughput"] as const;

async function curateRisks(operation: CurationOperation, assessmentId: string, riskIds: readonly string[], reason: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/${operation}`,
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskIds, reason }) },
  });
  assert.equal(response.status, 200, `REPORTS_${operation}_FAILED: ${await response.clone().text()}`);
}

async function everyReport(): Promise<Record<string, Record<string, unknown>>> {
  const reports: Record<string, Record<string, unknown>> = {};
  for (const key of WITHDRAWAL_REPORT_KEYS) reports[key] = await readReport(key);
  return reports;
}

/** The Phase 11 equality: each exposure and due-state figure is the total of the register list it links to. */
async function assertFiguresEqualTheRegister(label: string): Promise<void> {
  const exposure = await readReport("risk-exposure");
  const byResidualRating = exposure.byResidualRating as Record<string, number>;
  const accepted = exposure.acceptedByResidualRating as Record<string, number>;
  const underAssessment = (exposure.underAssessment as { byResidualRating: Record<string, number> }).byResidualRating;
  for (const [key, value] of Object.entries(REGISTER_RATING_VALUES)) {
    assert.equal(await registerTotal(`residualRating=${value}&state=open&stage=released`), byResidualRating[key], `${label}_RELEASED_${key}`);
    assert.equal(await registerTotal(`residualRating=${value}&state=open&stage=released&treatmentAction=Accept`), accepted[key], `${label}_ACCEPTED_${key}`);
    assert.equal(await registerTotal(`residualRating=${value}&state=open&stage=under-assessment`), underAssessment[key], `${label}_UNDER_ASSESSMENT_${key}`);
  }
  const dueState = (await readReport("treatment-performance")).dueState as Record<string, number>;
  assert.equal(dueState.overdue, await registerTotal("dueState=overdue"), `${label}_OVERDUE_DIFFERS_FROM_THE_REGISTER`);
  assert.equal(dueState.overdue, await alertCount("risk-treatment-overdue"), `${label}_OVERDUE_DIFFERS_FROM_THE_ALERTS`);
  assert.equal(dueState.dueWithinWindow, await registerTotal("dueState=due-soon"), `${label}_DUE_SOON_DIFFERS_FROM_THE_REGISTER`);
}

test("a withdrawn Critical Risk with an overdue treatment changes no report figure, and reinstating it restores each (Phase 16 D-13, D-14)", async () => {
  assertSameUtcDay();
  const harness = await harnessPromise;
  const created = await seedReportFixtures();
  const request = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "P7R-RAR-AW",
    title: "P7R report request AW",
    requestStatus: "under-review",
    requestor: harness.users.owner,
  });
  const draft = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "P7R-ASM-AW",
    assessmentStatus: "in-review",
    summary: "P7R report withdrawal assessment AW",
    assessmentRequest: request,
    reviewedBy: harness.users.analyst,
  });
  const without = await everyReport();

  const underAssessment = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: riskNumber("WU"), riskStatement: "P7R report Risk WU", assessment: draft,
    residualRating: "Critical", inherentRating: "Critical", treatmentStatus: "Not Started", targetDate: D(-7),
    informationSystemImpacted: created.systems.S1, treatmentAction: "Treat",
  });
  const released = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: riskNumber("WR"), riskStatement: "P7R report Risk WR", assessment: created.assessments.AR,
    residualRating: "Critical", inherentRating: "Critical", treatmentStatus: "In Progress", targetDate: D(-9),
    informationSystemImpacted: created.systems.S2, treatmentAction: "Accept",
  });
  for (const risk of [underAssessment, released]) {
    await harness.createFixtureDocument("api::csrm-control-implementation.csrm-control-implementation", {
      risk, control: created.control, controlStatus: "Implemented", effectivenessRating: "Ineffective",
    });
  }
  const withRisks = await everyReport();
  for (const key of ["risk-exposure", "control-effectiveness", "treatment-performance"] as const) {
    assert.notDeepEqual(withRisks[key], without[key], `WITHDRAWAL_FIXTURES_NOT_IN_${key}`);
  }

  const reason = "Proposed under the wrong Risk Type";
  const withdraw = async () => {
    await curateRisks("risk_withdrawals", draft, [underAssessment], reason);
    await harness.setRiskWithdrawalFactsFixture(released, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: reason });
  };
  await withdraw();
  assert.deepEqual(await everyReport(), without, "A_WITHDRAWN_RISK_CHANGED_A_REPORT_FIGURE");
  await assertFiguresEqualTheRegister("WITHDRAWN");

  await curateRisks("risk_reinstatements", draft, [underAssessment], "Withdrawn by mistake");
  await harness.setRiskWithdrawalFactsFixture(released, { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null });
  assert.deepEqual(await everyReport(), withRisks, "REINSTATING_DID_NOT_RESTORE_THE_REPORT_FIGURES");
  await assertFiguresEqualTheRegister("REINSTATED");

  await withdraw();
  assert.deepEqual(await everyReport(), without, "WITHDRAWN_AGAIN_CHANGED_A_REPORT_FIGURE");
  assertSameUtcDay();
});

test("the exposed Information Systems are capped at ten, flagged as truncated, and totalled in full", async () => {
  // This test adds eleven released open High Risks, which changes every other figure, so it runs last.
  assertSameUtcDay();
  const harness = await harnessPromise;
  const created = await seedReportFixtures();
  const extraNames = Array.from({ length: 11 }, (_, index) => `P7R extra system ${String(index + 1).padStart(2, "0")}`);
  const extraSystems: string[] = [];
  for (const [index, name] of extraNames.entries()) {
    const system = await harness.createFixtureDocument("api::csrm-information-system.csrm-information-system", { name });
    extraSystems.push(system);
    await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
      riskNumber: riskNumber(`X${String(index + 1).padStart(2, "0")}`),
      riskStatement: `P7R extra exposed Risk ${index + 1}`,
      assessment: created.assessments.AR,
      residualRating: "High",
      inherentRating: "High",
      treatmentStatus: "Not Started",
      informationSystemImpacted: system,
    });
  }

  const data = await readReport("risk-exposure");
  assertRiskExposureShape(data, "RISK_EXPOSURE_TRUNCATED");
  const exposedSystems = data.exposedSystems as { rows: Array<{ documentId: string }>; total: number; truncated: boolean; risksWithoutSystem: number };
  assert.equal(exposedSystems.rows.length, 10, "EXPOSED_SYSTEMS_NOT_CAPPED_AT_TEN");
  assert.equal(exposedSystems.truncated, true, "EXPOSED_SYSTEMS_NOT_FLAGGED_AS_TRUNCATED");
  assert.equal(exposedSystems.total, 13, "EXPOSED_SYSTEMS_TOTAL_NOT_IN_FULL");
  assert.equal(exposedSystems.risksWithoutSystem, 1, "RISKS_WITHOUT_SYSTEM_CHANGED");
  // The system carrying a released Critical Risk leads, then the rest by name.
  assert.deepEqual(
    exposedSystems.rows,
    [
      { documentId: created.systems.S2, name: SYSTEMS.S2, critical: 1, high: 1, total: 2 },
      { documentId: created.systems.S1, name: SYSTEMS.S1, critical: 0, high: 1, total: 1 },
      ...extraSystems.slice(0, 8).map((documentId, index) => ({ documentId, name: extraNames[index], critical: 0, high: 1, total: 1 })),
    ],
    "EXPOSED_SYSTEMS_ORDER",
  );
  assert.deepEqual(data.byResidualRating, { ...EXPECTED_BY_RESIDUAL_RATING, High: 14, total: 17 }, "RISK_EXPOSURE_AFTER_EXTRA_RISKS");
  assert.deepEqual(data.underAssessment, { byResidualRating: EXPECTED_UNDER_ASSESSMENT_BY_RESIDUAL_RATING }, "UNDER_ASSESSMENT_AFTER_EXTRA_RISKS");
  assertSameUtcDay();
});
