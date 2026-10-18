import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import {
  ALERT_KINDS,
  ALERT_URGENCIES,
  classifyAssessmentAlerts,
  classifyControlImplementationAlerts,
  classifyRequestAlerts,
  classifyRiskAlerts,
  compareAlerts,
  type AlertKind,
  type AlertUrgency,
} from "../src/csrm/insights/alert-rules";
import { addUtcDays, utcToday } from "../src/csrm/insights/utc-date";

/*
 * D-10, D-11, D-12, D-14, D-24, D-27, D-29, D-31: the analyst alerts derived on
 * read, over controlled fixtures whose dates are offsets from the test's own
 * UTC today. The mounted harness seeds the catalogue, users and the control
 * library only, plus two draft requests without due dates, so the fixtures
 * below are the only alert sources in this file's database.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const today = utcToday(new Date());
const D = (days: number): string => addUtcDays(today, days);

const LIST_PATH = "/api/v1/alerts";
const SUMMARY_PATH = "/api/v1/alerts/summary";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend,
// two more resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(
  readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8"),
) as { components?: { schemas?: Record<string, { additionalProperties?: unknown; properties?: Record<string, unknown>; enum?: unknown[] }> } };

/** The published property names of a closed spec component, sorted: exactly what the server may serve. */
function specKeys(componentName: string): string[] {
  const component = specification.components?.schemas?.[componentName];
  assert.ok(component, `ALERT_SPEC_COMPONENT_MISSING_${componentName}`);
  assert.equal(component.additionalProperties, false, `ALERT_SPEC_COMPONENT_OPEN_${componentName}`);
  return Object.keys(component.properties ?? {}).sort();
}

/** The published values of a closed spec enumeration. */
function specEnum(componentName: string): unknown[] {
  const values = specification.components?.schemas?.[componentName]?.enum;
  assert.ok(Array.isArray(values), `ALERT_SPEC_ENUM_MISSING_${componentName}`);
  return values;
}

// The served key sets, restated literally at every level.
const LIST_KEYS = ["data", "meta"];
const META_KEYS = ["dueSoonWindowDays", "pagination", "today"];
const PAGINATION_KEYS = ["page", "pageCount", "pageSize", "total"];
const ITEM_KEYS = ["dayOffset", "governingDate", "id", "kind", "link", "residualRating", "source", "urgency"];
const SOURCE_KEYS = ["documentId", "identifier", "released", "title", "type"];
const LINK_KEYS = ["documentId", "type"];
const SUMMARY_ENVELOPE_KEYS = ["data"];
const SUMMARY_KEYS = ["byKind", "byUrgency", "dueSoonWindowDays", "today", "total"];
const BY_KIND_KEYS = [...ALERT_KINDS].sort();
const BY_URGENCY_KEYS = [...ALERT_URGENCIES].sort();

const CONTROLS = {
  one: { controlNumber: "P7A-CTL-001", name: "Phase 7 alert fixture control one" },
  two: { controlNumber: "P7A-CTL-002", name: "Phase 7 alert fixture control two" },
} as const;
type ControlName = keyof typeof CONTROLS;

type RequestFixture = { requestStatus: string; dueDate: string | null };
/** Requests that can alert by themselves. */
const REQUESTS: Readonly<Record<string, RequestFixture>> = {
  Q1: { requestStatus: "under-review", dueDate: D(-1) },
  Q2: { requestStatus: "submitted", dueDate: today },
  Q3: { requestStatus: "questionnaire-in-progress", dueDate: D(14) },
  Q4: { requestStatus: "risk-assessment-drafted", dueDate: D(15) },
  Q5: { requestStatus: "approved", dueDate: D(-1) },
  Q6: { requestStatus: "draft", dueDate: D(-1) },
  Q7: { requestStatus: "closed", dueDate: D(-1) },
  Q8: { requestStatus: "under-review", dueDate: null },
};

type AssessmentFixture = {
  assessmentStatus: string;
  approvalDate: boolean;
  approvedBy: boolean;
  nextReviewDate: string | null;
  /** The status of the assessment's own request, which has no due date and so never alerts. */
  requestStatus: string;
};
/** Parent assessments, each on its own request. */
const ASSESSMENTS: Readonly<Record<string, AssessmentFixture>> = {
  AM: { assessmentStatus: "in-review", approvalDate: false, approvedBy: false, nextReviewDate: null, requestStatus: "under-review" },
  AR: { assessmentStatus: "approved", approvalDate: true, approvedBy: true, nextReviewDate: D(-1), requestStatus: "approved" },
  AR2: { assessmentStatus: "approved", approvalDate: true, approvedBy: true, nextReviewDate: D(14), requestStatus: "approved" },
  AR3: { assessmentStatus: "approved", approvalDate: true, approvedBy: true, nextReviewDate: D(15), requestStatus: "approved" },
  // Partially released: approved with an approval date but no approver. Its
  // overdue review date proves the release triple, not the status, decides.
  AP: { assessmentStatus: "approved", approvalDate: true, approvedBy: false, nextReviewDate: D(-1), requestStatus: "approved" },
};

type RiskFixture = {
  parent: keyof typeof ASSESSMENTS;
  targetDate?: string;
  treatmentStatus?: string | null;
  residualRating?: string;
  closureDate?: string;
  identifiedDate?: string;
};
const RISKS: Readonly<Record<string, RiskFixture>> = {
  R1: { parent: "AM", targetDate: D(-1), treatmentStatus: "In Progress", residualRating: "High" },
  R2: { parent: "AM", targetDate: today, treatmentStatus: "Not Started", residualRating: "Moderate" },
  R3: { parent: "AM", targetDate: D(14), residualRating: "Low" },
  R4: { parent: "AM", targetDate: D(15) },
  R5: { parent: "AM", targetDate: D(-3), treatmentStatus: null, residualRating: "Critical" },
  R6: { parent: "AM", targetDate: D(-5), treatmentStatus: "Complete" },
  R7: { parent: "AM", targetDate: D(-5), treatmentStatus: "In Progress", closureDate: D(-1) },
  R8: { parent: "AM", residualRating: "Critical", treatmentStatus: "Not Started", identifiedDate: D(-20) },
  R9: { parent: "AM", residualRating: "Critical", treatmentStatus: "In Progress" },
  R10: { parent: "AM", residualRating: "Critical", treatmentStatus: "Not Started", closureDate: D(-2) },
  RP: { parent: "AP", targetDate: D(-2), treatmentStatus: "In Progress" },
  RR1: { parent: "AR", targetDate: D(-12), treatmentStatus: "In Progress", residualRating: "Critical" },
};

type ControlImplementationFixture = {
  risk: keyof typeof RISKS;
  control: ControlName;
  controlStatus: string;
  effectivenessRating?: string;
  implementationDueDate?: string;
  reviewDate?: string;
};
const CONTROL_IMPLEMENTATIONS: Readonly<Record<string, ControlImplementationFixture>> = {
  CI1: { risk: "R1", control: "one", controlStatus: "Planned", implementationDueDate: D(-1) },
  CI2: { risk: "R10", control: "one", controlStatus: "Planned", implementationDueDate: D(-1) },
  CI3: { risk: "R2", control: "two", controlStatus: "Implemented", implementationDueDate: D(-1) },
  CI4: { risk: "R8", control: "two", controlStatus: "Implemented", effectivenessRating: "Ineffective", reviewDate: D(-7) },
  CI5: { risk: "R10", control: "two", controlStatus: "Implemented", effectivenessRating: "Ineffective" },
};

const requestNumber = (name: string) => `P7A-RAR-${name}`;
const requestTitle = (name: string) => `P7A alert request ${name}`;
const parentRequestTitle = (name: string) => `P7A parent request ${name}`;
const assessmentNumber = (name: string) => `P7A-ASM-${name}`;
const riskNumber = (name: string) => `P7A-RSK-${name}`;
const riskStatement = (name: string) => `P7A alert Risk ${name}`;
const controlTitle = (control: ControlName) => `${CONTROLS[control].controlNumber} ${CONTROLS[control].name}`;

function released(fixture: AssessmentFixture): boolean {
  return fixture.assessmentStatus === "approved" && fixture.approvalDate && fixture.approvedBy;
}

/** D-14: the Risk Register admits a mutable parent or a completely released one. */
function disclosable(fixture: AssessmentFixture): boolean {
  const mutable = (fixture.assessmentStatus === "draft" || fixture.assessmentStatus === "in-review")
    && !fixture.approvalDate && !fixture.approvedBy;
  return mutable || released(fixture);
}

type Fixtures = {
  requests: Record<string, string>;
  parentRequests: Record<string, string>;
  assessments: Record<string, string>;
  risks: Record<string, string>;
  controlImplementations: Record<string, string>;
  controls: Record<ControlName, string>;
};

let fixtures: Promise<Fixtures> | null = null;

function seedAlertFixtures(): Promise<Fixtures> {
  fixtures ??= (async () => {
    const harness = await harnessPromise;
    const owner = harness.users.owner;
    const analyst = harness.users.analyst;
    const created: Fixtures = { requests: {}, parentRequests: {}, assessments: {}, risks: {}, controlImplementations: {}, controls: { one: "", two: "" } };

    for (const [name, fixture] of Object.entries(REQUESTS)) {
      created.requests[name] = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: requestNumber(name),
        title: requestTitle(name),
        requestStatus: fixture.requestStatus,
        requestor: owner,
        ...(fixture.dueDate === null ? {} : { dueDate: fixture.dueDate }),
      });
    }
    for (const [name, fixture] of Object.entries(ASSESSMENTS)) {
      created.parentRequests[name] = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: requestNumber(`PARENT-${name}`),
        title: parentRequestTitle(name),
        requestStatus: fixture.requestStatus,
        requestor: owner,
      });
      created.assessments[name] = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
        assessmentNumber: assessmentNumber(name),
        assessmentStatus: fixture.assessmentStatus,
        summary: `P7A alert parent assessment ${name}`,
        assessmentRequest: created.parentRequests[name],
        ...(fixture.approvalDate ? { approvalDate: `${D(-30)}T00:00:00.000Z` } : {}),
        ...(fixture.approvedBy ? { approvedBy: analyst, reviewedBy: analyst } : {}),
        ...(fixture.nextReviewDate === null ? {} : { nextReviewDate: fixture.nextReviewDate }),
      });
    }
    for (const [name, fixture] of Object.entries(RISKS)) {
      created.risks[name] = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
        riskNumber: riskNumber(name),
        riskStatement: riskStatement(name),
        assessment: created.assessments[fixture.parent],
        ...(fixture.targetDate === undefined ? {} : { targetDate: fixture.targetDate }),
        ...(fixture.treatmentStatus === undefined || fixture.treatmentStatus === null ? {} : { treatmentStatus: fixture.treatmentStatus }),
        ...(fixture.residualRating === undefined ? {} : { residualRating: fixture.residualRating }),
        ...(fixture.closureDate === undefined ? {} : { closureDate: fixture.closureDate }),
        ...(fixture.identifiedDate === undefined ? {} : { identifiedDate: fixture.identifiedDate }),
      });
    }
    for (const [name, control] of Object.entries(CONTROLS) as Array<[ControlName, typeof CONTROLS[ControlName]]>) {
      created.controls[name] = await harness.createFixtureDocument("api::csrm-control.csrm-control", {
        ...control,
        framework: "P7A alert fixtures",
      });
    }
    for (const [name, fixture] of Object.entries(CONTROL_IMPLEMENTATIONS)) {
      created.controlImplementations[name] = await harness.createFixtureDocument(
        "api::csrm-control-implementation.csrm-control-implementation",
        {
          risk: created.risks[fixture.risk],
          control: created.controls[fixture.control],
          controlStatus: fixture.controlStatus,
          ...(fixture.effectivenessRating === undefined ? {} : { effectivenessRating: fixture.effectivenessRating }),
          ...(fixture.implementationDueDate === undefined ? {} : { implementationDueDate: fixture.implementationDueDate }),
          ...(fixture.reviewDate === undefined ? {} : { reviewDate: fixture.reviewDate }),
        },
      );
    }
    return created;
  })();
  return fixtures;
}

type ExpectedAlert = {
  kind: AlertKind;
  source: string;
  urgency: AlertUrgency;
  governingDate: string | null;
  dayOffset: number | null;
  residualRating: string | null;
  released: boolean;
};

/**
 * The unfiltered list, in the literal D-12 order: urgency, undated last, date,
 * source identifier, kind, source documentId. R1 and CI1 share R1's Risk
 * number, so the kind decides between them.
 */
const EXPECTED_ALERTS: readonly ExpectedAlert[] = [
  { kind: "risk-treatment-overdue", source: "RR1", urgency: "overdue", governingDate: D(-12), dayOffset: -12, residualRating: "Critical", released: true },
  { kind: "risk-treatment-overdue", source: "R5", urgency: "overdue", governingDate: D(-3), dayOffset: -3, residualRating: "Critical", released: false },
  { kind: "assessment-review-due", source: "AR", urgency: "overdue", governingDate: D(-1), dayOffset: -1, residualRating: null, released: true },
  { kind: "request-overdue", source: "Q1", urgency: "overdue", governingDate: D(-1), dayOffset: -1, residualRating: null, released: false },
  { kind: "control-implementation-overdue", source: "CI1", urgency: "overdue", governingDate: D(-1), dayOffset: -1, residualRating: "High", released: false },
  { kind: "risk-treatment-overdue", source: "R1", urgency: "overdue", governingDate: D(-1), dayOffset: -1, residualRating: "High", released: false },
  { kind: "request-due-soon", source: "Q2", urgency: "due-soon", governingDate: today, dayOffset: 0, residualRating: null, released: false },
  { kind: "risk-treatment-due-soon", source: "R2", urgency: "due-soon", governingDate: today, dayOffset: 0, residualRating: "Moderate", released: false },
  { kind: "assessment-review-due", source: "AR2", urgency: "due-soon", governingDate: D(14), dayOffset: 14, residualRating: null, released: true },
  { kind: "request-due-soon", source: "Q3", urgency: "due-soon", governingDate: D(14), dayOffset: 14, residualRating: null, released: false },
  { kind: "risk-treatment-due-soon", source: "R3", urgency: "due-soon", governingDate: D(14), dayOffset: 14, residualRating: "Low", released: false },
  { kind: "critical-residual-risk-untreated", source: "R8", urgency: "attention", governingDate: D(-20), dayOffset: -20, residualRating: "Critical", released: false },
  { kind: "ineffective-control", source: "CI4", urgency: "attention", governingDate: D(-7), dayOffset: -7, residualRating: "Critical", released: false },
  { kind: "critical-residual-risk-untreated", source: "R5", urgency: "attention", governingDate: null, dayOffset: null, residualRating: "Critical", released: false },
];

const EXPECTED_SUMMARY = {
  byKind: {
    "risk-treatment-overdue": 3,
    "risk-treatment-due-soon": 2,
    "request-overdue": 1,
    "request-due-soon": 2,
    "control-implementation-overdue": 1,
    "assessment-review-due": 2,
    "critical-residual-risk-untreated": 2,
    "ineffective-control": 1,
  },
  byUrgency: { overdue: 6, "due-soon": 5, attention: 3 },
  total: 14,
};

type AlertItem = {
  id: string;
  kind: AlertKind;
  urgency: AlertUrgency;
  governingDate: string | null;
  dayOffset: number | null;
  source: { type: string; documentId: string; identifier: string; title: string | null; released: boolean };
  link: { type: string; documentId: string };
  residualRating: string | null;
};
type Pagination = { page: number; pageSize: number; pageCount: number; total: number };
type AlertPage = { items: AlertItem[]; pagination: Pagination; meta: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertSameUtcDay(): void {
  assert.equal(utcToday(new Date()), today, "UTC_DAY_ROLLED_OVER_DURING_TEST");
}

function sortedKeys(value: unknown, label: string): string[] {
  assert.ok(isRecord(value), `${label}_NOT_AN_OBJECT`);
  return Object.keys(value).sort();
}

/**
 * Pins every served level of one alert page, literally and against the
 * published component, and every served enumerated value against its
 * published enumeration. A closed web parser that would refuse what Strapi
 * serves fails here first.
 */
function assertServedListShape(body: unknown, label: string): void {
  assert.deepEqual(sortedKeys(body, `${label}_ENVELOPE`), LIST_KEYS, `${label}_ENVELOPE_KEYS`);
  assert.deepEqual(sortedKeys(body, `${label}_ENVELOPE`), specKeys("AlertListResponse"), `${label}_ENVELOPE_SPEC_KEYS`);
  const envelope = body as Record<string, unknown>;
  assert.deepEqual(sortedKeys(envelope.meta, `${label}_META`), META_KEYS, `${label}_META_KEYS`);
  assert.deepEqual(sortedKeys(envelope.meta, `${label}_META`), specKeys("AlertListMeta"), `${label}_META_SPEC_KEYS`);
  const meta = envelope.meta as Record<string, unknown>;
  assert.deepEqual(sortedKeys(meta.pagination, `${label}_PAGINATION`), PAGINATION_KEYS, `${label}_PAGINATION_KEYS`);
  assert.deepEqual(sortedKeys(meta.pagination, `${label}_PAGINATION`), specKeys("AlertPagination"), `${label}_PAGINATION_SPEC_KEYS`);
  assert.ok(Array.isArray(envelope.data), `${label}_DATA_NOT_A_LIST`);
  for (const [index, item] of (envelope.data as unknown[]).entries()) {
    assert.deepEqual(sortedKeys(item, `${label}_ITEM_${index}`), ITEM_KEYS, `${label}_ITEM_KEYS_${index}`);
    assert.deepEqual(sortedKeys(item, `${label}_ITEM_${index}`), specKeys("AlertItem"), `${label}_ITEM_SPEC_KEYS_${index}`);
    const record = item as Record<string, unknown>;
    assert.deepEqual(sortedKeys(record.source, `${label}_SOURCE_${index}`), SOURCE_KEYS, `${label}_SOURCE_KEYS_${index}`);
    assert.deepEqual(sortedKeys(record.source, `${label}_SOURCE_${index}`), specKeys("AlertSource"), `${label}_SOURCE_SPEC_KEYS_${index}`);
    assert.deepEqual(sortedKeys(record.link, `${label}_LINK_${index}`), LINK_KEYS, `${label}_LINK_KEYS_${index}`);
    assert.deepEqual(sortedKeys(record.link, `${label}_LINK_${index}`), specKeys("AlertLink"), `${label}_LINK_SPEC_KEYS_${index}`);
    const source = record.source as Record<string, unknown>;
    const link = record.link as Record<string, unknown>;
    assert.ok(specEnum("AlertKind").includes(record.kind), `${label}_ITEM_KIND_UNPUBLISHED_${index}`);
    assert.ok(specEnum("AlertUrgency").includes(record.urgency), `${label}_ITEM_URGENCY_UNPUBLISHED_${index}`);
    assert.ok(specEnum("AlertSourceType").includes(source.type), `${label}_SOURCE_TYPE_UNPUBLISHED_${index}`);
    assert.ok(specEnum("AlertLinkType").includes(link.type), `${label}_LINK_TYPE_UNPUBLISHED_${index}`);
    assert.ok(record.residualRating === null || specEnum("AssessmentRating").includes(record.residualRating), `${label}_RATING_UNPUBLISHED_${index}`);
  }
  const pageSize = specification.components?.schemas?.AlertPagination?.properties?.pageSize as { enum?: unknown[] } | undefined;
  assert.ok(pageSize?.enum?.includes((meta.pagination as Record<string, unknown>).pageSize), `${label}_PAGE_SIZE_UNPUBLISHED`);
}

async function readAlerts(query = ""): Promise<AlertPage> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: `${LIST_PATH}${query}`, identity: harness.identities.analyst });
  assert.equal(response.status, 200, `ALERT_LIST_READ_FAILED_${query}: ${await response.clone().text()}`);
  const body = await response.json() as Record<string, unknown>;
  assertServedListShape(body, `ALERT_LIST_${query}`);
  const meta = body.meta as Record<string, unknown>;
  return { items: body.data as AlertItem[], pagination: meta.pagination as Pagination, meta };
}

async function readSummary(): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: SUMMARY_PATH, identity: harness.identities.analyst });
  assert.equal(response.status, 200, `ALERT_SUMMARY_READ_FAILED: ${await response.clone().text()}`);
  const body = await response.json() as Record<string, unknown>;
  assert.deepEqual(sortedKeys(body, "ALERT_SUMMARY_ENVELOPE"), SUMMARY_ENVELOPE_KEYS, "ALERT_SUMMARY_ENVELOPE_KEYS");
  assert.deepEqual(sortedKeys(body, "ALERT_SUMMARY_ENVELOPE"), specKeys("AlertSummaryResponse"), "ALERT_SUMMARY_ENVELOPE_SPEC_KEYS");
  const data = body.data as Record<string, unknown>;
  assert.deepEqual(sortedKeys(data, "ALERT_SUMMARY_DATA"), SUMMARY_KEYS, "ALERT_SUMMARY_DATA_KEYS");
  assert.deepEqual(sortedKeys(data, "ALERT_SUMMARY_DATA"), specKeys("AlertSummary"), "ALERT_SUMMARY_DATA_SPEC_KEYS");
  assert.deepEqual(sortedKeys(data.byKind, "ALERT_SUMMARY_BY_KIND"), BY_KIND_KEYS, "ALERT_SUMMARY_BY_KIND_KEYS");
  assert.deepEqual(sortedKeys(data.byKind, "ALERT_SUMMARY_BY_KIND"), specKeys("AlertCountsByKind"), "ALERT_SUMMARY_BY_KIND_SPEC_KEYS");
  assert.deepEqual(sortedKeys(data.byUrgency, "ALERT_SUMMARY_BY_URGENCY"), BY_URGENCY_KEYS, "ALERT_SUMMARY_BY_URGENCY_KEYS");
  assert.deepEqual(sortedKeys(data.byUrgency, "ALERT_SUMMARY_BY_URGENCY"), specKeys("AlertCountsByUrgency"), "ALERT_SUMMARY_BY_URGENCY_SPEC_KEYS");
  return data;
}

function documentIdOf(created: Fixtures, name: string): string {
  const documentId = created.requests[name] ?? created.assessments[name] ?? created.risks[name] ?? created.controlImplementations[name];
  assert.ok(documentId, `UNKNOWN_FIXTURE_${name}`);
  return documentId;
}

function expectedId(created: Fixtures, alert: Pick<ExpectedAlert, "kind" | "source">): string {
  return `${alert.kind}:${documentIdOf(created, alert.source)}`;
}

/** The whole served item each expected alert must be, built from the fixture's literal facts. */
function expectedItem(created: Fixtures, alert: ExpectedAlert): AlertItem {
  const documentId = documentIdOf(created, alert.source);
  const common = {
    id: `${alert.kind}:${documentId}`,
    kind: alert.kind,
    urgency: alert.urgency,
    governingDate: alert.governingDate,
    dayOffset: alert.dayOffset,
    residualRating: alert.residualRating,
  };
  if (alert.source in RISKS) {
    return {
      ...common,
      source: { type: "risk", documentId, identifier: riskNumber(alert.source), title: riskStatement(alert.source), released: alert.released },
      link: { type: "risk", documentId },
    };
  }
  if (alert.source in CONTROL_IMPLEMENTATIONS) {
    const implementation = CONTROL_IMPLEMENTATIONS[alert.source];
    return {
      ...common,
      source: {
        type: "control-implementation",
        documentId,
        identifier: riskNumber(implementation.risk),
        title: controlTitle(implementation.control),
        released: alert.released,
      },
      link: { type: "risk", documentId: created.risks[implementation.risk] },
    };
  }
  if (alert.source in REQUESTS) {
    return {
      ...common,
      source: { type: "assessment-request", documentId, identifier: requestNumber(alert.source), title: requestTitle(alert.source), released: alert.released },
      link: { type: "assessment-request", documentId },
    };
  }
  return {
    ...common,
    source: { type: "assessment", documentId, identifier: assessmentNumber(alert.source), title: parentRequestTitle(alert.source), released: alert.released },
    link: { type: "assessment", documentId },
  };
}

const idsOf = (items: readonly AlertItem[]) => items.map((item) => item.id);

test("the analyst reads every derived alert exactly, in the literal D-12 order", async () => {
  assertSameUtcDay();
  const created = await seedAlertFixtures();
  const page = await readAlerts("?pageSize=50");

  assert.deepEqual(page.pagination, { page: 1, pageSize: 50, pageCount: 1, total: 14 }, "ALERT_LIST_PAGINATION");
  assert.deepEqual(idsOf(page.items), EXPECTED_ALERTS.map((alert) => expectedId(created, alert)), "ALERT_LIST_ORDER");
  for (const [index, alert] of EXPECTED_ALERTS.entries()) {
    assert.deepEqual(page.items[index], expectedItem(created, alert), `ALERT_ITEM_${index + 1}_${alert.kind}_${alert.source}`);
  }
  assert.equal(page.meta.today, today, "ALERT_LIST_TODAY");
  assert.equal(page.meta.dueSoonWindowDays, 14, "ALERT_LIST_WINDOW");

  // The served order is the oracle order.
  assert.deepEqual(idsOf([...page.items].sort(compareAlerts)), idsOf(page.items), "ALERT_ORDER_DISAGREES_WITH_ORACLE");
  assertSameUtcDay();
});

test("each source raises exactly the kinds its own facts give under the rule oracles", async () => {
  assertSameUtcDay();
  const created = await seedAlertFixtures();
  const page = await readAlerts("?pageSize=50");
  const servedKinds = new Map<string, AlertKind[]>();
  for (const item of page.items) servedKinds.set(item.source.documentId, [...(servedKinds.get(item.source.documentId) ?? []), item.kind]);
  const inKindOrder = (kinds: readonly AlertKind[]) => ALERT_KINDS.filter((kind) => kinds.includes(kind));
  const expectKinds = (label: string, documentId: string, expected: AlertKind[]) => {
    assert.deepEqual(inKindOrder(servedKinds.get(documentId) ?? []), expected, `ORACLE_DISAGREES_${label}`);
    servedKinds.delete(documentId);
  };

  for (const [name, fixture] of Object.entries(REQUESTS)) {
    expectKinds(name, created.requests[name], classifyRequestAlerts({ requestStatus: fixture.requestStatus, dueDate: fixture.dueDate }, today));
  }
  for (const [name, fixture] of Object.entries(ASSESSMENTS)) {
    expectKinds(`PARENT-${name}`, created.parentRequests[name], classifyRequestAlerts({ requestStatus: fixture.requestStatus, dueDate: null }, today));
    expectKinds(name, created.assessments[name], classifyAssessmentAlerts({ released: released(fixture), nextReviewDate: fixture.nextReviewDate }, today));
  }
  for (const [name, fixture] of Object.entries(RISKS)) {
    expectKinds(name, created.risks[name], classifyRiskAlerts({
      targetDate: fixture.targetDate ?? null,
      treatmentStatus: fixture.treatmentStatus ?? null,
      closureDate: fixture.closureDate ?? null,
      residualRating: fixture.residualRating ?? null,
      parentDisclosable: disclosable(ASSESSMENTS[fixture.parent]),
    }, today));
  }
  for (const [name, fixture] of Object.entries(CONTROL_IMPLEMENTATIONS)) {
    const risk = RISKS[fixture.risk];
    expectKinds(name, created.controlImplementations[name], classifyControlImplementationAlerts({
      controlStatus: fixture.controlStatus,
      effectivenessRating: fixture.effectivenessRating ?? null,
      implementationDueDate: fixture.implementationDueDate ?? null,
      parentRiskOpen: risk.closureDate === undefined,
      parentDisclosable: disclosable(ASSESSMENTS[risk.parent]),
    }, today));
  }
  assert.deepEqual([...servedKinds.keys()], [], "ALERT_FROM_AN_UNKNOWN_SOURCE");
  assertSameUtcDay();
});

test("the summary counts the same predicate, so every filtered list total equals its count", async () => {
  assertSameUtcDay();
  const created = await seedAlertFixtures();
  const summary = await readSummary();
  assert.deepEqual(summary, { ...EXPECTED_SUMMARY, today, dueSoonWindowDays: 14 }, "ALERT_SUMMARY");

  const full = await readAlerts("?pageSize=50");
  const byKind = summary.byKind as Record<AlertKind, number>;
  const byUrgency = summary.byUrgency as Record<AlertUrgency, number>;
  for (const kind of ALERT_KINDS) {
    const filtered = await readAlerts(`?kind=${kind}&pageSize=50`);
    assert.equal(filtered.pagination.total, byKind[kind], `KIND_TOTAL_DISAGREES_WITH_SUMMARY_${kind}`);
    assert.deepEqual(idsOf(filtered.items), idsOf(full.items.filter((item) => item.kind === kind)), `KIND_FILTER_${kind}`);
  }
  for (const urgency of ALERT_URGENCIES) {
    const filtered = await readAlerts(`?urgency=${urgency}&pageSize=50`);
    assert.equal(filtered.pagination.total, byUrgency[urgency], `URGENCY_TOTAL_DISAGREES_WITH_SUMMARY_${urgency}`);
    assert.deepEqual(idsOf(filtered.items), idsOf(full.items.filter((item) => item.urgency === urgency)), `URGENCY_FILTER_${urgency}`);
  }

  const treatments = await readAlerts("?kind=risk-treatment-overdue&kind=risk-treatment-due-soon&pageSize=50");
  assert.equal(treatments.pagination.total, 5, "TWO_KIND_TOTAL");
  assert.deepEqual(
    idsOf(treatments.items),
    EXPECTED_ALERTS.filter((alert) => alert.kind === "risk-treatment-overdue" || alert.kind === "risk-treatment-due-soon")
      .map((alert) => expectedId(created, alert)),
    "TWO_KIND_ORDER",
  );

  const overdueReview = await readAlerts("?kind=assessment-review-due&urgency=overdue");
  assert.deepEqual(idsOf(overdueReview.items), [expectedId(created, { kind: "assessment-review-due", source: "AR" })], "REVIEW_OVERDUE");
  const dueSoonReview = await readAlerts("?kind=assessment-review-due&urgency=due-soon");
  assert.deepEqual(idsOf(dueSoonReview.items), [expectedId(created, { kind: "assessment-review-due", source: "AR2" })], "REVIEW_DUE_SOON");
  assert.equal((await readAlerts("?kind=request-overdue&urgency=attention")).pagination.total, 0, "IMPOSSIBLE_PAIR_NOT_EMPTY");
  assertSameUtcDay();
});

test("pages are literal slices of the one order, and a page past the end is empty", async () => {
  assertSameUtcDay();
  const created = await seedAlertFixtures();
  const expectedIds = EXPECTED_ALERTS.map((alert) => expectedId(created, alert));

  const second = await readAlerts("?pageSize=5&page=2");
  assert.deepEqual(second.pagination, { page: 2, pageSize: 5, pageCount: 3, total: 14 }, "SECOND_PAGE_PAGINATION");
  assert.deepEqual(idsOf(second.items), expectedIds.slice(5, 10), "SECOND_PAGE_IDS");

  const pages = [];
  for (const page of [1, 2, 3]) pages.push(...(await readAlerts(`?pageSize=5&page=${page}`)).items);
  assert.deepEqual(idsOf(pages), expectedIds, "PAGES_DO_NOT_TILE_THE_LIST");

  const beyond = await readAlerts("?pageSize=5&page=4");
  assert.deepEqual(beyond.items, [], "PAGE_PAST_THE_END_NOT_EMPTY");
  assert.deepEqual(beyond.pagination, { page: 4, pageSize: 5, pageCount: 3, total: 14 }, "PAGE_PAST_THE_END_PAGINATION");

  const defaults = await readAlerts();
  assert.deepEqual(defaults.pagination, { page: 1, pageSize: 25, pageCount: 1, total: 14 }, "DEFAULT_PAGINATION");
  assert.deepEqual(idsOf(defaults.items), expectedIds, "DEFAULT_PAGE_IDS");
  assertSameUtcDay();
});

test("both alert operations refuse every identity other than the human analyst", async () => {
  const harness = await harnessPromise;
  await seedAlertFixtures();
  const identities = [
    ["owner", harness.identities.owner],
    ["otherRequestor", harness.identities.otherRequestor],
    ["serviceAnalystAgent", harness.identities.serviceAnalystAgent],
    ["analystAgent", harness.identities.analystAgent],
    ["inactiveAnalyst", harness.identities.inactiveAnalyst],
    ["no identity", undefined],
  ] as const;
  for (const path of [LIST_PATH, `${LIST_PATH}?kind=request-overdue`, SUMMARY_PATH]) {
    for (const [label, identity] of identities) {
      const response = await harness.request({ path, identity });
      assert.equal(response.status, 403, `ALERT_DENIAL_FAILED_${label}_${path}`);
      const text = await response.text();
      assert.doesNotMatch(text, /SQL|stack|database/i, `ALERT_DENIAL_LEAKED_INTERNALS_${label}_${path}`);
      assert.doesNotMatch(text, /P7A-|byKind|pagination/, `ALERT_DENIAL_LEAKED_DATA_${label}_${path}`);
    }
    const missingToken = await harness.request({ path, identity: harness.identities.analyst, omitApiToken: true });
    assert.equal(missingToken.status, 401, `ALERT_TOKEN_GATE_MISSING_${path}`);
  }
  // The policy refuses before the query is read, so a malformed query is still a denial.
  const deniedBadQuery = await harness.request({ path: `${LIST_PATH}?kind=x`, identity: harness.identities.owner });
  assert.equal(deniedBadQuery.status, 403, "ALERT_QUERY_READ_BEFORE_AUTHORIZATION");
});

test("a malformed alert query is one safe 400, and the summary takes no query", async () => {
  const harness = await harnessPromise;
  await seedAlertFixtures();
  const refused = [
    `${LIST_PATH}?unknown=1`,
    `${LIST_PATH}?kind=not-a-kind`,
    `${LIST_PATH}?kind=request-overdue&kind=request-overdue`,
    `${LIST_PATH}?kind[$eq]=request-overdue`,
    `${LIST_PATH}?urgency=Overdue`,
    `${LIST_PATH}?urgency=overdue&urgency=attention`,
    `${LIST_PATH}?page=0`,
    `${LIST_PATH}?page=1.5`,
    `${LIST_PATH}?page=1000001`,
    `${LIST_PATH}?pageSize=20`,
    `${LIST_PATH}?sort=kind:asc`,
    `${SUMMARY_PATH}?x=1`,
    `${SUMMARY_PATH}?kind=request-overdue`,
    `${SUMMARY_PATH}?page=1`,
  ];
  for (const path of refused) {
    const response = await harness.request({ path, identity: harness.identities.analyst });
    assert.equal(response.status, 400, `ALERT_QUERY_NOT_REFUSED_${path}`);
    const text = await response.text();
    assert.doesNotMatch(text, /SQL|stack|database/i, `ALERT_QUERY_ERROR_LEAKED_INTERNALS_${path}`);
    assert.doesNotMatch(text, /P7A-|byKind|pagination/, `ALERT_QUERY_ERROR_LEAKED_DATA_${path}`);
    const body = JSON.parse(text) as { error?: { status?: number; message?: string } };
    assert.equal(body.error?.status, 400, `ALERT_QUERY_ERROR_STATUS_${path}`);
    assert.equal(body.error?.message, "CSRM alert query is invalid.", `ALERT_QUERY_ERROR_MESSAGE_${path}`);
  }
});

test("ties on urgency, date, identifier and kind fall back to the source documentId", async () => {
  // This test adds tied fixtures, so it runs last.
  assertSameUtcDay();
  const harness = await harnessPromise;
  const created = await seedAlertFixtures();
  /*
   * Planned implementations on R1, all due D(-1), tie with CI1 on every rule
   * but the last. They are created until their creation order differs from
   * their documentId order, so an order that fell back to insertion order
   * would be caught.
   */
  const tied = [created.controlImplementations.CI1];
  const sortedByDocumentId = (ids: readonly string[]) => [...ids].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  while (tied.length < 9 && JSON.stringify(sortedByDocumentId(tied)) === JSON.stringify(tied)) {
    tied.push(await harness.createFixtureDocument("api::csrm-control-implementation.csrm-control-implementation", {
      risk: created.risks.R1,
      control: created.controls.one,
      controlStatus: "Planned",
      implementationDueDate: D(-1),
    }));
  }
  assert.notDeepEqual(sortedByDocumentId(tied), tied, "TIE_FIXTURES_NEVER_LEFT_DOCUMENT_ID_ORDER");

  const page = await readAlerts("?kind=control-implementation-overdue&pageSize=50");
  assert.deepEqual(
    page.items.map((item) => item.source.documentId),
    sortedByDocumentId(tied),
    "TIED_ALERTS_NOT_ORDERED_BY_DOCUMENT_ID",
  );
  const full = await readAlerts("?pageSize=50");
  assert.deepEqual(idsOf([...full.items].sort(compareAlerts)), idsOf(full.items), "ALERT_ORDER_DISAGREES_WITH_ORACLE_AFTER_TIES");
  const summary = await readSummary();
  assert.equal((summary.byKind as Record<AlertKind, number>)["control-implementation-overdue"], tied.length, "TIED_SUMMARY_COUNT");
  assert.equal(summary.total, full.pagination.total, "TIED_SUMMARY_TOTAL");
  assertSameUtcDay();
});

/*
 * Phase 16 D-13, D-14: a withdrawn Risk raises no alert, nor does any Control Implementation on it. WU, a Critical Risk
 * with an overdue treatment, an overdue planned control and an ineffective control past its review, sits on a draft
 * assessment of its own and is withdrawn and reinstated through the 16-05 operations; WR, a Critical Risk with an
 * overdue treatment and an overdue control on the released AR, carries the withdrawal facts through the fixture, as a
 * Risk withdrawn before its assessment was released does. Withdrawn, the summary and every list page equal the alerts
 * without them; reinstated, they are back. This test adds Risks, so it runs last, and it leaves them withdrawn.
 */
type CurationOperation = "risk_withdrawals" | "risk_reinstatements";

async function curateRisks(operation: CurationOperation, assessmentId: string, riskIds: readonly string[], reason: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/${operation}`,
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskIds, reason }) },
  });
  assert.equal(response.status, 200, `ALERTS_${operation}_FAILED: ${await response.clone().text()}`);
}

/** The summary and every alert, page by page, each total equal to its summary count. */
async function everyAlert(label: string): Promise<{ summary: Record<string, unknown>; items: AlertItem[] }> {
  const summary = await readSummary();
  const items: AlertItem[] = [];
  for (let page = 1; ; page += 1) {
    const read = await readAlerts(`?pageSize=50&page=${page}`);
    items.push(...read.items);
    assert.equal(read.pagination.total, summary.total, `${label}_LIST_TOTAL_DISAGREES_WITH_SUMMARY`);
    if (page >= read.pagination.pageCount) break;
  }
  assert.equal(items.length, summary.total, `${label}_ITEMS_DISAGREE_WITH_SUMMARY`);
  return { summary, items };
}

test("a withdrawn Critical Risk with an overdue treatment and controls raises no alert, and reinstating it restores each (Phase 16 D-13, D-14)", async () => {
  assertSameUtcDay();
  const harness = await harnessPromise;
  const created = await seedAlertFixtures();
  const request = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: requestNumber("PARENT-AW"),
    title: parentRequestTitle("AW"),
    requestStatus: "risk-assessment-drafted",
    requestor: harness.users.owner,
  });
  const draft = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: assessmentNumber("AW"),
    assessmentStatus: "draft",
    summary: "P7A alert withdrawal assessment AW",
    assessmentRequest: request,
  });
  const without = await everyAlert("WITHOUT");

  const underAssessment = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: riskNumber("WU"), riskStatement: riskStatement("WU"), assessment: draft,
    residualRating: "Critical", treatmentStatus: "Not Started", targetDate: D(-7), identifiedDate: D(-20),
  });
  const released = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: riskNumber("WR"), riskStatement: riskStatement("WR"), assessment: created.assessments.AR,
    residualRating: "Critical", treatmentStatus: "In Progress", targetDate: D(-9),
  });
  for (const [risk, fixture] of [
    [underAssessment, { control: created.controls.one, controlStatus: "Planned", implementationDueDate: D(-1) }],
    [underAssessment, { control: created.controls.two, controlStatus: "Implemented", effectivenessRating: "Ineffective", reviewDate: D(-7) }],
    [released, { control: created.controls.one, controlStatus: "Planned", implementationDueDate: D(-2) }],
  ] as const) {
    await harness.createFixtureDocument("api::csrm-control-implementation.csrm-control-implementation", { risk, ...fixture });
  }
  const withRisks = await everyAlert("WITH");
  const kindsOf = (alerts: { items: AlertItem[] }, riskId: string) => alerts.items
    .filter((item) => item.source.documentId === riskId || item.link.documentId === riskId).map((item) => item.kind).sort();
  assert.deepEqual(kindsOf(without, underAssessment), [], "WU_ALERTED_BEFORE_IT_EXISTED");
  assert.ok(kindsOf(withRisks, underAssessment).includes("risk-treatment-overdue"), `WU_RAISES_NO_TREATMENT_ALERT_${kindsOf(withRisks, underAssessment).join(",")}`);
  assert.ok(kindsOf(withRisks, released).includes("risk-treatment-overdue"), "WR_RAISES_NO_TREATMENT_ALERT");
  assert.ok(withRisks.items.length >= without.items.length + 4, "WITHDRAWAL_FIXTURES_RAISE_TOO_FEW_ALERTS");

  const reason = "Proposed under the wrong Risk Type";
  const withdraw = async () => {
    await curateRisks("risk_withdrawals", draft, [underAssessment], reason);
    await harness.setRiskWithdrawalFactsFixture(released, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: reason });
  };
  await withdraw();
  assert.deepEqual(await everyAlert("WITHDRAWN"), without, "A_WITHDRAWN_RISK_RAISED_AN_ALERT");

  await curateRisks("risk_reinstatements", draft, [underAssessment], "Withdrawn by mistake");
  await harness.setRiskWithdrawalFactsFixture(released, { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null });
  assert.deepEqual(await everyAlert("REINSTATED"), withRisks, "REINSTATING_DID_NOT_RESTORE_THE_ALERTS");

  await withdraw();
  assert.deepEqual(await everyAlert("WITHDRAWN_AGAIN"), without, "WITHDRAWN_AGAIN_RAISED_AN_ALERT");
  assertSameUtcDay();
});
