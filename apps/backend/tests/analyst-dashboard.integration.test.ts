import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import dashboardController from "../src/api/csrm-analyst-insight/controllers/dashboard";
import { addUtcDays, utcToday } from "../src/csrm/insights/utc-date";

/*
 * DASH-01, D-02, D-03, D-05, D-09, D-14, D-18, D-21, D-24, D-34, D-36: the
 * analyst dashboard summary, computed on read over controlled fixtures whose
 * dates are offsets from the test's own UTC today. Every figure is asserted
 * literally and equal to the total of the list it opens.
 *
 * The mounted harness seeds the catalogue, users and the control library only,
 * plus two draft requests that no analyst figure counts, so the fixtures below
 * are the only dashboard sources in this file's database. The recent activity
 * test adds its own requests, questionnaires and assessments after every figure
 * test has run. The High and Critical truncation test adds four more Risks,
 * which changes the Risk figures, so it runs last.
 *
 * D-40 to D-42: Risk exposure counts released open Risks, the accepted ones
 * among them and the open Risks under assessment apart, each with the Risk
 * Register's own named branch, so every rating count equals the register list
 * filtered by that rating, state=open and its stage.
 *
 * Every served level is pinned literally and against its published closed
 * component, and the whole body is walked against DashboardSummaryResponse.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const today = utcToday(new Date());
const D = (days: number): string => addUtcDays(today, days);
/** The ISO instant at UTC midnight of `date`. Every Task 1 fixture timestamp is one of these, before today. */
const at = (date: string): string => `${date}T00:00:00.000Z`;

const SUMMARY_PATH = "/api/v1/dashboard/summary";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend,
// two more resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");

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
  anyOf?: SpecSchema[];
};
const specification = JSON.parse(
  readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8"),
) as { components?: { schemas?: Record<string, SpecSchema> } };

function specComponent(componentName: string): SpecSchema {
  const component = specification.components?.schemas?.[componentName];
  assert.ok(component, `DASHBOARD_SPEC_COMPONENT_MISSING_${componentName}`);
  return component;
}

/** The published property names of a closed spec component, sorted: exactly what the server may serve. */
function specKeys(componentName: string): string[] {
  const component = specComponent(componentName);
  assert.equal(component.additionalProperties, false, `DASHBOARD_SPEC_COMPONENT_OPEN_${componentName}`);
  return Object.keys(component.properties ?? {}).sort();
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Walks a served value against its published schema: every object's keys
 * equal its closed component's properties, and every leaf has its published
 * type, enumeration, format and bounds. A closed web parser that would refuse
 * what Strapi serves fails here first.
 */
function assertMatchesSpec(value: unknown, reference: SpecSchema, label: string): void {
  const name = reference.$ref?.replace("#/components/schemas/", "") ?? null;
  const schema = name === null ? reference : specComponent(name);
  const at = name === null ? label : `${label}<${name}>`;
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
    if (schema.format === "date-time") assert.match(value as string, ISO_INSTANT, `${at}_NOT_A_DATE_TIME`);
    return;
  }
  if (types.includes("boolean")) {
    assert.equal(typeof value, "boolean", `${at}_NOT_A_BOOLEAN`);
    return;
  }
  if (types.includes("integer")) assert.ok(Number.isSafeInteger(value), `${at}_NOT_AN_INTEGER`);
  else assert.fail(`${at}_UNPUBLISHED_TYPE`);
  if (typeof schema.minimum === "number") assert.ok((value as number) >= schema.minimum, `${at}_BELOW_MINIMUM`);
}

// The served key sets, restated literally at every level.
const ENVELOPE_KEYS = ["data"];
const SUMMARY_KEYS = ["dueSoonWindowDays", "highCriticalRisks", "recentActivity", "reviewQueue", "riskExposure", "today", "treatmentsDue"];
const REVIEW_QUEUE_KEYS = [
  "assessmentsDraft",
  "assessmentsInReview",
  "awaitingRequestor",
  "generationInProgress",
  "mine",
  "questionnairesReadyForReview",
  "requiresAttention",
  "unassigned",
];
// Phase 13 (D-15): the viewer's own queue counts. No `open` count is served, because no surface shows it.
const REVIEW_QUEUE_MINE_KEYS = ["awaitingRequestor", "generationInProgress", "requiresAttention", "withUnreadNotes"];
const RISK_EXPOSURE_KEYS = ["released", "releasedAccepted", "underAssessment"];
const RATING_COUNT_KEYS = ["Critical", "High", "Low", "Moderate", "notRated", "total"];
const HIGH_CRITICAL_KEYS = ["rows", "total", "truncated"];
const RISK_ROW_KEYS = ["documentId", "residualRating", "riskNumber", "riskStatement", "targetDate", "treatmentDueState"];
const TREATMENTS_DUE_KEYS = ["dueSoon", "overdue", "total"];
const RECENT_ACTIVITY_KEYS = ["rows", "truncated"];
const ACTIVITY_ITEM_KEYS = ["actorDisplayName", "documentId", "identifier", "kind", "occurredAt", "recordType", "title"];

type QuestionnaireState = "draft" | "submitted";
type RequestFixture = {
  requestStatus: string;
  submittedDays: number;
  questionnaire: QuestionnaireState | null;
  assessment: { assessmentStatus: string; generatedDays: number } | null;
};

/*
 * Five owner requests, one per queue position, carry every queue,
 * questionnaire and assessment figure. Each questionnaire hangs off its
 * request and is released by the analyst; each assessment sits on its request.
 */
const REQUESTS = {
  // Requires attention: submitted, nothing generated yet.
  Q1: { requestStatus: "submitted", submittedDays: -20, questionnaire: null, assessment: null },
  // Awaiting the Requestor: released, the Requestor is still drafting answers, no assessment.
  Q2: { requestStatus: "questionnaire-in-progress", submittedDays: -19, questionnaire: "draft", assessment: null },
  // Requires attention: the Requestor submitted, and the analyst has a draft assessment.
  Q3: { requestStatus: "risk-assessment-drafted", submittedDays: -18, questionnaire: "submitted", assessment: { assessmentStatus: "draft", generatedDays: -12 } },
  // Requires attention: in review. Its assessment (AX) parents every exposure Risk, so they are mutable and in scope.
  Q4: { requestStatus: "under-review", submittedDays: -17, questionnaire: "submitted", assessment: { assessmentStatus: "in-review", generatedDays: -11 } },
  // Requires attention: in review.
  Q5: { requestStatus: "under-review", submittedDays: -16, questionnaire: "submitted", assessment: { assessmentStatus: "in-review", generatedDays: -10 } },
} as const satisfies Record<string, RequestFixture>;
type RequestName = keyof typeof REQUESTS;

/*
 * Each Risk's parent: AX, the in-review assessment of Q4; AD, the draft assessment of Q3; AR, the
 * released assessment of RR (approved, with an approval date and an approver).
 */
type RiskParent = "AX" | "AD" | "AR";
type RiskFixture = {
  parent: RiskParent;
  residualRating: string | null;
  targetDate: string | null;
  closureDate?: string;
  treatmentAction?: "Accept" | "Treat";
};
/**
 * Every exposure Risk is In Progress. Under assessment (AX and AD): C1, H1, H2, M1, MA, N1 and DL1;
 * MA's Accept is a draft's, so it never counts as accepted (D-41). Released (AR): RC1, RH1, RM1 (the
 * one accepted), RL1 and RO1, whose rating is off the ladder, so it is not rated. X1 and RX1 are
 * closed, so they never count.
 */
const RISKS = {
  C1: { parent: "AX", residualRating: "Critical", targetDate: D(5) },
  H1: { parent: "AX", residualRating: "High", targetDate: D(-3) },
  H2: { parent: "AX", residualRating: "High", targetDate: null },
  M1: { parent: "AX", residualRating: "Moderate", targetDate: D(30) },
  MA: { parent: "AX", residualRating: "Moderate", targetDate: null, treatmentAction: "Accept" },
  N1: { parent: "AX", residualRating: null, targetDate: null },
  X1: { parent: "AX", residualRating: "Critical", targetDate: D(-10), closureDate: D(-1) },
  DL1: { parent: "AD", residualRating: "Low", targetDate: null },
  RC1: { parent: "AR", residualRating: "Critical", targetDate: D(-4) },
  RH1: { parent: "AR", residualRating: "High", targetDate: D(10) },
  RM1: { parent: "AR", residualRating: "Moderate", targetDate: D(60), treatmentAction: "Accept" },
  RL1: { parent: "AR", residualRating: "Low", targetDate: null, treatmentAction: "Treat" },
  RO1: { parent: "AR", residualRating: "Severe", targetDate: null },
  RX1: { parent: "AR", residualRating: "Moderate", targetDate: D(-20), closureDate: D(-2), treatmentAction: "Accept" },
} as const satisfies Record<string, RiskFixture>;
type RiskName = keyof typeof RISKS;

const riskNumber = (name: string): string => `P7D-RSK-${name}`;
const riskStatement = (name: string): string => `P7D dashboard Risk ${name}`;

type Fixtures = {
  requests: Record<RequestName, string>;
  /** AX, the in-review parent of the Risks under assessment. */
  ax: string;
  /** AR, the released parent of the released Risks. */
  ar: string;
  risks: Record<RiskName | "P1", string>;
};

let fixtures: Promise<Fixtures> | null = null;

function seedDashboardFixtures(): Promise<Fixtures> {
  fixtures ??= (async () => {
    const harness = await harnessPromise;
    const owner = harness.users.owner;
    const analyst = harness.users.analyst;
    const requests = {} as Record<RequestName, string>;
    const assessments = {} as Partial<Record<RequestName, string>>;
    for (const [name, fixture] of Object.entries(REQUESTS) as Array<[RequestName, RequestFixture]>) {
      requests[name] = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `P7D-RAR-${name}`,
        title: `P7D dashboard request ${name}`,
        requestStatus: fixture.requestStatus,
        requestor: owner,
        submittedDate: at(D(fixture.submittedDays)),
      });
      if (fixture.questionnaire !== null) {
        await harness.createQuestionnaireLifecycleFixture({
          requestDocumentId: requests[name],
          released: true,
          answerState: fixture.questionnaire,
        });
      }
      if (fixture.assessment !== null) {
        assessments[name] = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
          assessmentNumber: `P7D-ASM-${name}`,
          assessmentStatus: fixture.assessment.assessmentStatus,
          summary: `P7D dashboard assessment ${name}`,
          assessmentRequest: requests[name],
          generatedDate: at(D(fixture.assessment.generatedDays)),
          generatedBy: analyst,
        });
      }
    }
    const ax = assessments.Q4;
    assert.ok(ax, "DASHBOARD_FIXTURE_AX_MISSING");
    const ad = assessments.Q3;
    assert.ok(ad, "DASHBOARD_FIXTURE_AD_MISSING");

    /*
     * AR: a released assessment, with the complete release facts (approved, an approval date and an
     * approver). Its request is approved, so it is in no action queue, and the assessment is in
     * neither the draft nor the in-review list. Its release, at a UTC midnight before today, is older
     * than every controlled activity event.
     */
    const releasedRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: "P7D-RAR-RR",
      title: "P7D dashboard request RR",
      requestStatus: "approved",
      requestor: owner,
      submittedDate: at(D(-45)),
    });
    const ar = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: "P7D-ASM-RR",
      assessmentStatus: "approved",
      summary: "P7D released assessment",
      assessmentRequest: releasedRequest,
      approvalDate: at(D(-25)),
      assessmentDate: at(D(-25)),
      approvedBy: analyst,
      reviewedBy: analyst,
    });

    const parents: Record<RiskParent, string> = { AX: ax, AD: ad, AR: ar };
    const risks = {} as Record<RiskName | "P1", string>;
    for (const [name, fixture] of Object.entries(RISKS) as Array<[RiskName, RiskFixture]>) {
      risks[name] = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
        riskNumber: riskNumber(name),
        riskStatement: riskStatement(name),
        assessment: parents[fixture.parent],
        treatmentStatus: "In Progress",
        ...(fixture.residualRating === null ? {} : { residualRating: fixture.residualRating }),
        ...(fixture.targetDate === null ? {} : { targetDate: fixture.targetDate }),
        ...(fixture.closureDate === undefined ? {} : { closureDate: fixture.closureDate }),
        ...(fixture.treatmentAction === undefined ? {} : { treatmentAction: fixture.treatmentAction }),
      });
    }

    /*
     * Out of scope: an open, overdue Critical Risk whose parent is only
     * partially released (approved with an approval date but no approver), so
     * the Risk Register never discloses it. Its request is approved, so it is in
     * no action queue, and its assessment is in neither the draft nor the
     * in-review list.
     */
    const partialRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
      requestNumber: "P7D-RAR-P",
      title: "P7D dashboard request P",
      requestStatus: "approved",
      requestor: owner,
      submittedDate: at(D(-40)),
    });
    const partialAssessment = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: "P7D-ASM-P",
      assessmentStatus: "approved",
      summary: "P7D partially released assessment",
      assessmentRequest: partialRequest,
      approvalDate: at(D(-30)),
      assessmentDate: at(D(-30)),
    });
    risks.P1 = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
      riskNumber: riskNumber("P1"),
      riskStatement: riskStatement("P1"),
      assessment: partialAssessment,
      residualRating: "Critical",
      treatmentStatus: "In Progress",
      targetDate: D(-6),
      treatmentAction: "Accept",
    });
    return { requests, ax, ar, risks };
  })();
  return fixtures;
}

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

type ActivityRow = {
  kind: string;
  recordType: string;
  documentId: string;
  identifier: string | null;
  title: string | null;
  actorDisplayName: string | null;
  occurredAt: string;
};

type Summary = {
  today: string;
  dueSoonWindowDays: number;
  reviewQueue: Record<string, number> & { mine: Record<string, number> };
  riskExposure: { released: Record<string, number>; releasedAccepted: Record<string, number>; underAssessment: Record<string, number> };
  highCriticalRisks: { rows: Array<Record<string, unknown>>; total: number; truncated: boolean };
  treatmentsDue: Record<string, number>;
  recentActivity: { rows: ActivityRow[]; truncated: boolean };
};

/**
 * The summary read by the human analyst. The whole body is walked against the
 * published DashboardSummaryResponse, and every served level (the envelope, the
 * summary, each section, each High and Critical row and each activity item) is
 * pinned literally and against its closed component.
 */
async function readSummary(identity?: string): Promise<Summary> {
  const { status, body, text } = await readJson(SUMMARY_PATH, identity);
  assert.equal(status, 200, `DASHBOARD_SUMMARY_READ_FAILED: ${text}`);
  assertMatchesSpec(body, { $ref: "#/components/schemas/DashboardSummaryResponse" }, "DASHBOARD");
  const envelope = assertKeys(body, ENVELOPE_KEYS, "DASHBOARD_ENVELOPE", "DashboardSummaryResponse");
  const data = assertKeys(envelope.data, SUMMARY_KEYS, "DASHBOARD_SUMMARY", "DashboardSummary");
  const queue = assertKeys(data.reviewQueue, REVIEW_QUEUE_KEYS, "DASHBOARD_REVIEW_QUEUE", "DashboardReviewQueue");
  assertKeys(queue.mine, REVIEW_QUEUE_MINE_KEYS, "DASHBOARD_REVIEW_QUEUE_MINE", "DashboardReviewQueueMine");
  const exposure = assertKeys(data.riskExposure, RISK_EXPOSURE_KEYS, "DASHBOARD_RISK_EXPOSURE", "DashboardRiskExposure");
  for (const part of RISK_EXPOSURE_KEYS) {
    assertKeys(exposure[part], RATING_COUNT_KEYS, `DASHBOARD_RISK_EXPOSURE_${part}`, "RatingCounts");
  }
  const highCritical = assertKeys(data.highCriticalRisks, HIGH_CRITICAL_KEYS, "DASHBOARD_HIGH_CRITICAL", "DashboardHighCriticalRisks");
  assert.ok(Array.isArray(highCritical.rows), "DASHBOARD_HIGH_CRITICAL_ROWS_NOT_A_LIST");
  for (const [index, row] of (highCritical.rows as unknown[]).entries()) {
    assertKeys(row, RISK_ROW_KEYS, `DASHBOARD_HIGH_CRITICAL_ROW_${index}`, "DashboardRiskRow");
  }
  assertKeys(data.treatmentsDue, TREATMENTS_DUE_KEYS, "DASHBOARD_TREATMENTS_DUE", "DashboardTreatmentsDue");
  const activity = assertKeys(data.recentActivity, RECENT_ACTIVITY_KEYS, "DASHBOARD_RECENT_ACTIVITY", "DashboardRecentActivity");
  assert.ok(Array.isArray(activity.rows), "DASHBOARD_RECENT_ACTIVITY_ROWS_NOT_A_LIST");
  for (const [index, row] of (activity.rows as unknown[]).entries()) {
    assertKeys(row, ACTIVITY_ITEM_KEYS, `DASHBOARD_ACTIVITY_ROW_${index}`, "ActivityItem");
  }
  return data as unknown as Summary;
}

/** The total of a list the analyst can open, from its own pagination. */
async function listTotal(pathName: string, identity?: string): Promise<number> {
  const { status, body, text } = await readJson(pathName, identity);
  assert.equal(status, 200, `LIST_READ_FAILED_${pathName}: ${text}`);
  const total = (body as { meta?: { pagination?: { total?: unknown } } } | null)?.meta?.pagination?.total;
  assert.ok(typeof total === "number" && Number.isSafeInteger(total), `LIST_TOTAL_MISSING_${pathName}`);
  return total;
}

/** The alert summary's count for one kind, read by the human analyst. */
async function alertCount(kind: string): Promise<number> {
  const { status, body, text } = await readJson("/api/v1/alerts/summary");
  assert.equal(status, 200, `ALERT_SUMMARY_READ_FAILED: ${text}`);
  const count = (body as { data?: { byKind?: Record<string, unknown> } } | null)?.data?.byKind?.[kind];
  assert.ok(typeof count === "number", `ALERT_SUMMARY_COUNT_MISSING_${kind}`);
  return count;
}

const riskRow = (created: Fixtures, name: string, residualRating: string, targetDate: string | null, treatmentDueState: string) => ({
  documentId: created.risks[name as RiskName],
  riskNumber: riskNumber(name),
  riskStatement: riskStatement(name),
  residualRating,
  targetDate,
  treatmentDueState,
});

/*
 * D-15 (Phase 13): each of the viewer's own counts, and the team's pick-up pool, equals the total of the queue read the
 * Home opens for it, read by the same viewer: Assigned to me (`filters[assignee]=me`) by queue, its new notes over the
 * open queue, and Requests' requires-attention queue with nobody holding the request.
 */
const VIEWER_COUNT_LISTS = [
  ["requiresAttention", "/api/v1/assessment_requests?filters[queue]=requires-attention&filters[assignee]=me"],
  ["awaitingRequestor", "/api/v1/assessment_requests?filters[queue]=awaiting-requestor&filters[assignee]=me"],
  ["generationInProgress", "/api/v1/assessment_requests?filters[queue]=generation-in-progress&filters[assignee]=me"],
  ["withUnreadNotes", "/api/v1/assessment_requests?filters[queue]=open&filters[assignee]=me&filters[notes]=unread"],
] as const;
const UNASSIGNED_LIST = "/api/v1/assessment_requests?filters[queue]=requires-attention&filters[assignee]=unassigned";

async function assertViewerCountsEqualTheirLists(reviewQueue: Summary["reviewQueue"], label: string, identity?: string): Promise<void> {
  for (const [key, pathName] of VIEWER_COUNT_LISTS) {
    assert.equal(await listTotal(pathName, identity), reviewQueue.mine[key], `MINE_${key}_DIFFERS_FROM_ITS_LIST_${label}`);
  }
  assert.equal(await listTotal(UNASSIGNED_LIST, identity), reviewQueue.unassigned, `UNASSIGNED_DIFFERS_FROM_ITS_LIST_${label}`);
}

test("the review queue counts equal the totals of the review lists they open", async () => {
  assertSameUtcDay();
  await seedDashboardFixtures();
  const { reviewQueue } = await readSummary();

  // Q1, Q3, Q4 and Q5 require attention; Q2 waits on the Requestor. The boot drafts count nowhere.
  // Nobody holds any of them yet, so the analyst's own counts are zero and all four wait for pick-up (D-15).
  assert.deepEqual(reviewQueue, {
    requiresAttention: 4,
    awaitingRequestor: 1,
    generationInProgress: 0,
    questionnairesReadyForReview: 3,
    assessmentsDraft: 1,
    assessmentsInReview: 2,
    mine: { requiresAttention: 0, awaitingRequestor: 0, generationInProgress: 0, withUnreadNotes: 0 },
    unassigned: 4,
  }, "DASHBOARD_REVIEW_QUEUE");
  await assertViewerCountsEqualTheirLists(reviewQueue, "BOB_BEFORE_PICK_UP");

  // D-21: each queue figure is the queue page's own total.
  assert.equal(await listTotal("/api/v1/assessment_requests"), reviewQueue.requiresAttention, "REQUIRES_ATTENTION_DIFFERS_FROM_THE_QUEUE");
  assert.equal(
    await listTotal("/api/v1/assessment_requests?filters[queue]=awaiting-requestor"),
    reviewQueue.awaitingRequestor,
    "AWAITING_REQUESTOR_DIFFERS_FROM_THE_QUEUE",
  );
  assert.equal(
    await listTotal("/api/v1/assessment_requests?filters[queue]=generation-in-progress"),
    reviewQueue.generationInProgress,
    "GENERATION_IN_PROGRESS_DIFFERS_FROM_THE_QUEUE",
  );
  // The questionnaires of Q3, Q4 and Q5 hold submitted answers; Q2's answer is a draft.
  assert.equal(
    await listTotal("/api/v1/questionnaires?status=submitted"),
    reviewQueue.questionnairesReadyForReview,
    "READY_FOR_REVIEW_DIFFERS_FROM_THE_QUESTIONNAIRE_LIST",
  );
  assert.equal(await listTotal("/api/v1/risk_assessments?status=draft"), reviewQueue.assessmentsDraft, "DRAFT_DIFFERS_FROM_THE_ASSESSMENT_LIST");
  assert.equal(
    await listTotal("/api/v1/risk_assessments?status=in-review"),
    reviewQueue.assessmentsInReview,
    "IN_REVIEW_DIFFERS_FROM_THE_ASSESSMENT_LIST",
  );
  assertSameUtcDay();
});

/** Each count of a RatingCounts with the register's own residualRating value: `none` for not rated (D-35). */
const EXPOSURE_RATING_FILTERS = [
  ["Critical", "Critical"],
  ["High", "High"],
  ["Moderate", "Moderate"],
  ["Low", "Low"],
  ["notRated", "none"],
] as const;

test("Risk exposure counts released open Risks apart from those under assessment, with the accepted released Risks, each equal to its Risk Register list (D-40, D-41, D-42)", async () => {
  assertSameUtcDay();
  await seedDashboardFixtures();
  const { riskExposure } = await readSummary();

  // RX1 is closed, RO1's rating is off the ladder, and P1's parent is only partially released.
  assert.deepEqual(riskExposure.released, { Critical: 1, High: 1, Moderate: 1, Low: 1, notRated: 1, total: 5 }, "DASHBOARD_RELEASED_EXPOSURE");
  // RM1 alone: RX1 is closed, MA's Accept is a draft's and P1 is in neither stage.
  assert.deepEqual(riskExposure.releasedAccepted, { Critical: 0, High: 0, Moderate: 1, Low: 0, notRated: 0, total: 1 }, "DASHBOARD_ACCEPTED_EXPOSURE");
  // The in-review AX and the draft AD; X1 is closed.
  assert.deepEqual(riskExposure.underAssessment, { Critical: 1, High: 2, Moderate: 2, Low: 1, notRated: 1, total: 7 }, "DASHBOARD_UNDER_ASSESSMENT_EXPOSURE");

  // D-40: each figure is the total of the register list it opens, filtered by its own stage.
  const lists = [
    ["released", riskExposure.released, "&stage=released"],
    ["releasedAccepted", riskExposure.releasedAccepted, "&stage=released&treatmentAction=Accept"],
    ["underAssessment", riskExposure.underAssessment, "&stage=under-assessment"],
  ] as const;
  for (const [label, counts, filters] of lists) {
    for (const [key, value] of EXPOSURE_RATING_FILTERS) {
      assert.equal(
        await listTotal(`/api/v1/risks?residualRating=${value}&state=open${filters}`),
        counts[key],
        `EXPOSURE_DIFFERS_FROM_THE_REGISTER_${label}_${key}`,
      );
    }
    assert.equal(await listTotal(`/api/v1/risks?state=open${filters}`), counts.total, `EXPOSURE_TOTAL_DIFFERS_FROM_THE_REGISTER_${label}`);
  }
  // The two stages partition the open register, so the two figures are never one total read twice.
  assert.equal(
    await listTotal("/api/v1/risks?state=open"),
    riskExposure.released.total + riskExposure.underAssessment.total,
    "EXPOSURE_STAGES_DO_NOT_PARTITION_THE_OPEN_REGISTER",
  );
  assertSameUtcDay();
});

test("the High and Critical residual Risks list released open Risks only, Critical first, then the earliest target date, each with its treatment due state (D-42)", async () => {
  assertSameUtcDay();
  const created = await seedDashboardFixtures();
  const { highCriticalRisks } = await readSummary();

  // C1, H1 and H2 are under assessment, X1 is closed and P1's parent is only partially released.
  assert.deepEqual(highCriticalRisks, {
    rows: [
      riskRow(created, "RC1", "Critical", D(-4), "overdue"),
      riskRow(created, "RH1", "High", D(10), "due-soon"),
    ],
    total: 2,
    truncated: false,
  }, "DASHBOARD_HIGH_CRITICAL_RISKS");
  assert.equal(
    highCriticalRisks.rows.some((row) => row.documentId === created.risks.C1),
    false,
    "DASHBOARD_HIGH_CRITICAL_LISTS_A_CRITICAL_RISK_UNDER_ASSESSMENT",
  );
  // D-37: the total is the sum of the two released lists the footer opens.
  assert.equal(
    (await listTotal("/api/v1/risks?residualRating=Critical&state=open&stage=released"))
      + (await listTotal("/api/v1/risks?residualRating=High&state=open&stage=released")),
    highCriticalRisks.total,
    "HIGH_CRITICAL_TOTAL_DIFFERS_FROM_THE_RELEASED_LISTS",
  );
  assertSameUtcDay();
});

test("treatments due count the two treatment alert kinds over the alert list's own predicate", async () => {
  assertSameUtcDay();
  await seedDashboardFixtures();
  const { treatmentsDue } = await readSummary();

  /*
   * D-43: both stages count. H1 (under assessment) and RC1 (released) are overdue; C1 (under
   * assessment) and RH1 (released) are due soon. M1 and RM1 are later, the others have no target date,
   * and X1, RX1 and P1 are out of scope.
   */
  assert.deepEqual(treatmentsDue, { overdue: 2, dueSoon: 2, total: 4 }, "DASHBOARD_TREATMENTS_DUE");
  assert.equal(treatmentsDue.overdue, await alertCount("risk-treatment-overdue"), "OVERDUE_DIFFERS_FROM_THE_ALERT_SUMMARY");
  assert.equal(treatmentsDue.dueSoon, await alertCount("risk-treatment-due-soon"), "DUE_SOON_DIFFERS_FROM_THE_ALERT_SUMMARY");
  assert.equal(
    await listTotal("/api/v1/alerts?kind=risk-treatment-overdue&kind=risk-treatment-due-soon"),
    treatmentsDue.total,
    "TREATMENTS_DUE_TOTAL_DIFFERS_FROM_THE_ALERT_LIST",
  );
  assertSameUtcDay();
});

test("the summary is stamped with the server's UTC today and the due-soon window", async () => {
  assertSameUtcDay();
  await seedDashboardFixtures();
  const summary = await readSummary();
  assert.equal(summary.today, today, "DASHBOARD_TODAY");
  assert.equal(summary.dueSoonWindowDays, 14, "DASHBOARD_DUE_SOON_WINDOW");
  assertSameUtcDay();
});

test("the summary refuses every identity other than the human analyst, and any query, without leaking a figure", async () => {
  const harness = await harnessPromise;
  await seedDashboardFixtures();
  const identities = [
    ["owner", harness.identities.owner],
    ["otherRequestor", harness.identities.otherRequestor],
    ["serviceAnalystAgent", harness.identities.serviceAnalystAgent],
    ["analystAgent", harness.identities.analystAgent],
    ["inactiveAnalyst", harness.identities.inactiveAnalyst],
    ["no identity", undefined],
  ] as const;
  const leaks = /P7D-|reviewQueue|riskExposure|highCriticalRisks|treatmentsDue|recentActivity|Jane Doe|Bob Doe/;
  for (const pathName of [SUMMARY_PATH, `${SUMMARY_PATH}?x=1`]) {
    for (const [label, identity] of identities) {
      const response = await harness.request({ path: pathName, identity });
      assert.equal(response.status, 403, `DASHBOARD_DENIAL_FAILED_${label}_${pathName}`);
      const text = await response.text();
      assert.doesNotMatch(text, /SQL|stack|database/i, `DASHBOARD_DENIAL_LEAKED_INTERNALS_${label}_${pathName}`);
      assert.doesNotMatch(text, leaks, `DASHBOARD_DENIAL_LEAKED_DATA_${label}_${pathName}`);
    }
    const missingToken = await harness.request({ path: pathName, identity: harness.identities.analyst, omitApiToken: true });
    assert.equal(missingToken.status, 401, `DASHBOARD_TOKEN_GATE_MISSING_${pathName}`);
  }

  // The analyst's summary takes no query at all: one safe 400, before any read.
  for (const query of ["?x=1", `?today=${D(-1)}`, "?populate=*", "?filters[requestStatus]=draft", "?pageSize=5"]) {
    const { status, body, text } = await readJson(`${SUMMARY_PATH}${query}`);
    assert.equal(status, 400, `DASHBOARD_QUERY_NOT_REFUSED_${query}: ${text}`);
    assert.doesNotMatch(text, /SQL|stack|database/i, `DASHBOARD_QUERY_LEAKED_INTERNALS_${query}`);
    assert.doesNotMatch(text, leaks, `DASHBOARD_QUERY_LEAKED_DATA_${query}`);
    const error = (body as { error?: { status?: number; message?: string } } | null)?.error;
    assert.equal(error?.status, 400, `DASHBOARD_QUERY_ERROR_STATUS_${query}`);
    assert.equal(error?.message, "CSRM dashboard query is invalid.", `DASHBOARD_QUERY_ERROR_MESSAGE_${query}`);
  }
});

/*
 * Recent activity. NINE controlled in-scope events, T1 < T2 < ... < T9, cover
 * all seven kinds. Each is later than every other timestamp any fixture in
 * this file writes: those are UTC midnights before today, or the harness's
 * fixed 2026-08-15 questionnaire release. The feed shows eight, so it is
 * exactly T9 down to T2, and T1, the ninth, makes it truncated.
 *
 * Two excluded facts carry later instants, so a leak of either would top the
 * feed: T10 is the partially released assessment's approvalDate (it has no
 * generatedDate, which would be an in-scope "draft generated" event), and T11
 * is the still-draft request's revertedAt.
 */
const CONTROLLED_ACTIVITY_EVENTS = 9;
const activityStart = Date.now();
const T = (step: number): string => new Date(activityStart + step * 60_000).toISOString();

type ActivityFixtures = {
  resubmitted: string;
  generatedQuestionnaire: string;
  returnedQuestionnaire: string;
  releasedAssessment: string;
};

let activityFixtures: Promise<ActivityFixtures> | null = null;

function seedActivityFixtures(): Promise<ActivityFixtures> {
  activityFixtures ??= (async () => {
    const harness = await harnessPromise;
    await seedDashboardFixtures();
    const owner = harness.users.owner;
    const analyst = harness.users.analyst;
    const request = (name: string, data: Record<string, unknown>) =>
      harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
        requestNumber: `P7D-ACT-${name}`,
        title: `P7D activity request ${name}`,
        requestor: owner,
        ...data,
      });

    // T1: submitted by the owner. It is the ninth event, so the feed does not show it.
    await request("R1", { requestStatus: "submitted", submittedDate: T(1) });
    // T3: returned to draft by the analyst; T6: resubmitted by the owner. Both are in scope.
    const resubmitted = await request("R2", {
      requestStatus: "submitted",
      revertReason: "Describe the data flows.",
      revertedAt: T(3),
      revertedBy: analyst,
      submittedDate: T(6),
    });
    // T11: returned to draft and still a draft, so outside the analyst scope (D-14).
    await request("R3", { requestStatus: "draft", revertReason: "Not ready yet.", revertedAt: T(11), revertedBy: analyst });

    // The questionnaire and assessment events hang off their own requests, submitted before T1.
    const generatedHost = await request("RQ1", { requestStatus: "questionnaire-in-progress", submittedDate: at(D(-2)) });
    const returnedHost = await request("RQ2", { requestStatus: "questionnaire-in-progress", submittedDate: at(D(-3)) });
    const releasedHost = await request("RA1", { requestStatus: "approved", submittedDate: at(D(-4)) });
    const partialHost = await request("RA2", { requestStatus: "under-review", submittedDate: at(D(-5)) });

    // T2: a draft generated for review; T5: released to the Requestor by the analyst.
    const generatedQuestionnaire = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
      questionnaireNumber: "P7D-ACT-QUES-1",
      title: "P7D activity questionnaire generated and released",
      assessmentRequest: generatedHost,
      generatedDate: T(2),
      generatedBy: analyst,
      releasedAt: T(5),
      releasedBy: analyst,
    });
    // No questionnaire number (the attribute is optional). Generated before T1; T4: released by
    // the analyst; T8: returned to draft by the owner. Its events carry a null identifier.
    const returnedQuestionnaire = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
      title: "P7D activity questionnaire returned to draft",
      assessmentRequest: returnedHost,
      generatedDate: at(D(-1)),
      generatedBy: analyst,
      releasedAt: T(4),
      releasedBy: analyst,
      revertReason: "One answer needs correcting.",
      revertedAt: T(8),
      revertedBy: owner,
    });
    // T7: a draft generated for review; T9: released with the complete triple by the analyst.
    const releasedAssessment = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: "P7D-ACT-ASM-1",
      assessmentStatus: "approved",
      summary: "P7D activity assessment released",
      assessmentRequest: releasedHost,
      generatedDate: T(7),
      generatedBy: analyst,
      approvalDate: T(9),
      assessmentDate: T(9),
      approvedBy: analyst,
      reviewedBy: analyst,
    });
    // T10: approved with an approval date but no approver, so it is not released; never generated.
    await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: "P7D-ACT-ASM-2",
      assessmentStatus: "approved",
      summary: "P7D activity assessment partially released",
      assessmentRequest: partialHost,
      approvalDate: T(10),
      assessmentDate: T(10),
    });
    return { resubmitted, generatedQuestionnaire, returnedQuestionnaire, releasedAssessment };
  })();
  return activityFixtures;
}

test("recent activity lists the eight newest workflow events in the review scope, each with its named actor", async () => {
  const created = await seedActivityFixtures();
  const { recentActivity } = await readSummary();

  const generatedTitle = "P7D activity questionnaire generated and released";
  const returnedTitle = "P7D activity questionnaire returned to draft";
  const expected: ActivityRow[] = [
    {
      kind: "assessment-released",
      recordType: "assessment",
      documentId: created.releasedAssessment,
      identifier: "P7D-ACT-ASM-1",
      title: "P7D activity request RA1",
      actorDisplayName: "Bob Doe",
      occurredAt: T(9),
    },
    {
      kind: "questionnaire-returned-to-draft",
      recordType: "questionnaire",
      documentId: created.returnedQuestionnaire,
      identifier: null,
      title: returnedTitle,
      actorDisplayName: "Jane Doe",
      occurredAt: T(8),
    },
    {
      kind: "assessment-draft-generated",
      recordType: "assessment",
      documentId: created.releasedAssessment,
      identifier: "P7D-ACT-ASM-1",
      title: "P7D activity request RA1",
      actorDisplayName: null,
      occurredAt: T(7),
    },
    {
      kind: "request-submitted",
      recordType: "assessment-request",
      documentId: created.resubmitted,
      identifier: "P7D-ACT-R2",
      title: "P7D activity request R2",
      actorDisplayName: "Jane Doe",
      occurredAt: T(6),
    },
    {
      kind: "questionnaire-released",
      recordType: "questionnaire",
      documentId: created.generatedQuestionnaire,
      identifier: "P7D-ACT-QUES-1",
      title: generatedTitle,
      actorDisplayName: "Bob Doe",
      occurredAt: T(5),
    },
    {
      kind: "questionnaire-released",
      recordType: "questionnaire",
      documentId: created.returnedQuestionnaire,
      identifier: null,
      title: returnedTitle,
      actorDisplayName: "Bob Doe",
      occurredAt: T(4),
    },
    {
      kind: "request-returned-to-draft",
      recordType: "assessment-request",
      documentId: created.resubmitted,
      identifier: "P7D-ACT-R2",
      title: "P7D activity request R2",
      actorDisplayName: "Bob Doe",
      occurredAt: T(3),
    },
    {
      kind: "questionnaire-generated",
      recordType: "questionnaire",
      documentId: created.generatedQuestionnaire,
      identifier: "P7D-ACT-QUES-1",
      title: generatedTitle,
      actorDisplayName: null,
      occurredAt: T(2),
    },
  ];
  // The feed shows eight of the nine controlled events: T9 down to T2.
  assert.equal(expected.length, CONTROLLED_ACTIVITY_EVENTS - 1, "ACTIVITY_FIXTURE_ARITHMETIC");
  assert.deepEqual(recentActivity, { rows: expected, truncated: true }, "DASHBOARD_RECENT_ACTIVITY");

  // All seven kinds appear, and a generated draft is never attributed to anyone.
  assert.deepEqual(
    [...new Set(recentActivity.rows.map(({ kind }) => kind))].sort(),
    [
      "assessment-draft-generated",
      "assessment-released",
      "questionnaire-generated",
      "questionnaire-released",
      "questionnaire-returned-to-draft",
      "request-returned-to-draft",
      "request-submitted",
    ],
    "ACTIVITY_KINDS_NOT_ALL_SHOWN",
  );
  // Neither excluded fact leaks: the still-draft revert (T11) and the partial release (T10).
  assert.equal(recentActivity.rows.some(({ occurredAt }) => occurredAt === T(10) || occurredAt === T(11)), false, "ACTIVITY_EXCLUDED_FACT_LEAKED");
});

test("the High and Critical residual Risks are capped at five, flagged as truncated, and totalled in full", async () => {
  // This test adds four more released, open High Risks, which changes the Risk figures, so it runs last.
  assertSameUtcDay();
  const harness = await harnessPromise;
  const created = await seedDashboardFixtures();
  const extra = {
    E1: { targetDate: D(-7) },
    E2: { targetDate: D(20) },
    E3: { targetDate: null },
    E4: { targetDate: null },
  } as const;
  const risks = { ...created.risks } as Record<string, string>;
  for (const [name, fixture] of Object.entries(extra) as Array<[string, { targetDate: string | null }]>) {
    risks[name] = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
      riskNumber: riskNumber(name),
      riskStatement: riskStatement(name),
      assessment: created.ar,
      residualRating: "High",
      treatmentStatus: "In Progress",
      ...(fixture.targetDate === null ? {} : { targetDate: fixture.targetDate }),
    });
  }
  const withExtra: Fixtures = { ...created, risks: risks as Fixtures["risks"] };

  const { highCriticalRisks, riskExposure } = await readSummary();
  // Released only. Critical first; then the High Risks by target date, undated last; undated ties by Risk number (E3 before E4).
  assert.deepEqual(highCriticalRisks, {
    rows: [
      riskRow(withExtra, "RC1", "Critical", D(-4), "overdue"),
      riskRow(withExtra, "E1", "High", D(-7), "overdue"),
      riskRow(withExtra, "RH1", "High", D(10), "due-soon"),
      riskRow(withExtra, "E2", "High", D(20), "later"),
      riskRow(withExtra, "E3", "High", null, "no-target-date"),
    ],
    total: 6,
    truncated: true,
  }, "DASHBOARD_HIGH_CRITICAL_RISKS_TRUNCATED");
  assert.equal(riskExposure.released.High, 5, "DASHBOARD_RELEASED_HIGH_AFTER_EXTRA_RISKS");
  assert.equal(
    await listTotal("/api/v1/risks?residualRating=High&state=open&stage=released"),
    riskExposure.released.High,
    "EXPOSURE_DIFFERS_FROM_THE_REGISTER_AFTER_EXTRA_RISKS",
  );
  assertSameUtcDay();
});

/*
 * D-15 (Phase 13; T-13-46): the summary's own counts belong to the viewer the policy resolved. Bob holds two requests
 * that need him (one with a note from Jane he has not read), one with the Requestor (Jane's note read) and one
 * released (an unread note, outside the open queue); the second analyst holds one that needs them, with Jane's note;
 * one more waits for pick-up. Each analyst's figures are literal and equal to the lists they open, read as that
 * analyst. Assignment and notes write no dashboard-counted Risk or activity fact, but the requests are new, so this
 * test runs after every literal figure test.
 */
const jsonBody = (body: unknown, method = "POST"): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const notesPath = (requestId: string, suffix = "") => `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes${suffix}`;

async function addNote(requestId: string, identity: string, body: string): Promise<string> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: notesPath(requestId), identity, init: jsonBody({ data: { body } }) });
  assert.equal(response.status, 200, `NOTE_NOT_ADDED_${identity}: ${await response.clone().text()}`);
  return String(((await response.json()) as { data: { documentId: string } }).data.documentId);
}

async function markRead(requestId: string, identity: string, throughNoteId: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: notesPath(requestId, "/read"), identity, init: jsonBody({ data: { throughNoteId } }) });
  assert.equal(response.status, 200, `NOTES_NOT_MARKED_READ_${identity}`);
}

async function pickUp(requestId: string, identity: string, analyst: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/assignee`,
    identity,
    init: jsonBody({ data: { analyst, expectedAnalyst: null } }, "PUT"),
  });
  assert.equal(response.status, 200, `PICK_UP_FAILED_${identity}: ${await response.clone().text()}`);
}

test("each analyst's summary counts the requests that analyst holds, and the team's pick-up pool, each equal to its list (D-15)", async () => {
  assertSameUtcDay();
  const harness = await harnessPromise;
  await seedDashboardFixtures();
  const ids = harness.identities;
  const { analyst: bob, secondAnalyst } = harness.users;
  const before = (await readSummary()).reviewQueue;
  const request = (name: string, requestStatus: string) => harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: `P13D-RAR-${name}`,
    title: `P13 dashboard request ${name}`,
    requestStatus,
    requestor: harness.users.owner,
    submittedDate: at(D(-9)),
  });

  // B1: Bob holds it; Jane's note is new to him.
  const b1 = await request("B1", "submitted");
  await pickUp(b1, ids.analyst, bob);
  const b1Note = await addNote(b1, ids.owner, "The supplier hosts the data in Sydney.");
  // B2: Bob holds it; no notes.
  const b2 = await request("B2", "submitted");
  await pickUp(b2, ids.analyst, bob);
  // B3: with the Requestor; Bob holds it and has read Jane's note.
  const b3 = await request("B3", "questionnaire-in-progress");
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: b3, released: true, answerState: "draft" });
  await pickUp(b3, ids.analyst, bob);
  await markRead(b3, ids.analyst, await addNote(b3, ids.owner, "I will finish the answers on Friday."));
  // B4: released and held by Bob, with a note nobody has read: outside the open queue, so never new work.
  const b4 = await request("B4", "approved");
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: b4, released: true, answerState: "submitted" });
  await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "P13D-ASM-B4",
    assessmentStatus: "approved",
    summary: "P13 dashboard released assessment B4",
    assessmentRequest: b4,
    approvalDate: at(D(-3)),
    assessmentDate: at(D(-3)),
    approvedBy: bob,
    reviewedBy: bob,
  });
  await pickUp(b4, ids.analyst, bob);
  await harness.createRequestNoteFixtures(b4, 1);
  // S1: the second analyst holds it; Jane's note is new to both analysts, but it is not Bob's.
  const s1 = await request("S1", "submitted");
  await pickUp(s1, ids.secondAnalyst, secondAnalyst);
  await addNote(s1, ids.owner, "Please call me about the contract.");
  // U1: nobody holds it.
  await request("U1", "submitted");

  const bobs = (await readSummary()).reviewQueue;
  assert.deepEqual(bobs.mine, { requiresAttention: 2, awaitingRequestor: 1, generationInProgress: 0, withUnreadNotes: 1 }, "BOB_MINE");
  // The five Q fixtures and the activity test's requests are unchanged; U1 joins the pool.
  assert.equal(bobs.unassigned, before.unassigned + 1, "BOB_UNASSIGNED");
  assert.equal(bobs.requiresAttention, before.requiresAttention + 4, "TEAM_REQUIRES_ATTENTION");
  await assertViewerCountsEqualTheirLists(bobs, "BOB");

  const theirs = (await readSummary(ids.secondAnalyst)).reviewQueue;
  assert.deepEqual(theirs.mine, { requiresAttention: 1, awaitingRequestor: 0, generationInProgress: 0, withUnreadNotes: 1 }, "SECOND_ANALYST_MINE");
  // The team's figures are the same for every analyst; only `mine` is personal.
  const { mine: _bobsOwn, ...bobsTeam } = bobs;
  const { mine: _theirOwn, ...theirTeam } = theirs;
  assert.deepEqual(theirTeam, bobsTeam, "TEAM_FIGURES_DIFFER_BY_VIEWER");
  await assertViewerCountsEqualTheirLists(theirs, "SECOND_ANALYST", ids.secondAnalyst);

  // Reading is personal: once Bob reads Jane's note on B1, his new-notes count drops and the second analyst's stays.
  await markRead(b1, ids.analyst, b1Note);
  assert.equal((await readSummary()).reviewQueue.mine.withUnreadNotes, 0, "BOB_READ_NOT_COUNTED");
  assert.equal((await readSummary(ids.secondAnalyst)).reviewQueue.mine.withUnreadNotes, 1, "BOBS_READ_CHANGED_ANOTHER_ANALYST");
  assertSameUtcDay();
});

test("the summary controller refuses a caller the policy resolved no viewer for, before any read (T-13-46)", async () => {
  await harnessPromise;
  let status: number | undefined;
  let message: string | undefined;
  const ctx: Record<string, unknown> = {
    state: { csrmAuthorization: { analystInsightScope: "all", humanAnalyst: true } },
    query: {},
    forbidden(text: string) {
      status = 403;
      message = text;
      return { data: null, error: { status: 403, message: text } };
    },
  };
  const response = await dashboardController.summary(ctx) as { data?: unknown };
  assert.equal(status, 403, "SUMMARY_WITHOUT_VIEWER_NOT_REFUSED");
  assert.equal(message, "CSRM analyst insight access is denied.", "SUMMARY_WITHOUT_VIEWER_MESSAGE");
  assert.equal(response.data, null, "SUMMARY_WITHOUT_VIEWER_LEAKED_DATA");
});

/*
 * Phase 16 D-13, D-14, decision 11: a withdrawn Risk counts in no figure. WU, a Critical Risk with an overdue treatment
 * on an in-review assessment of its own (which a withdrawal, an accepted edit, keeps in review: D-23), is withdrawn and reinstated through the 16-05 operations; WR, a Critical, accepted
 * Risk with an overdue treatment on the released AR, carries the withdrawal facts through the fixture, as a Risk withdrawn
 * before its assessment was released does (an API withdrawal is refused on a released assessment). Withdrawn, the two
 * change no Risk figure; reinstated, each figure is back. The review queue and recent activity are request and
 * assessment figures, compared too, apart from the activity rows the curation itself writes. This test adds Risks, so
 * it runs last, and it leaves them withdrawn.
 */
type CurationOperation = "risk_withdrawals" | "risk_reinstatements";

async function curateRisks(operation: CurationOperation, assessmentId: string, riskIds: readonly string[], reason: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/${operation}`,
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskIds, reason }) },
  });
  assert.equal(response.status, 200, `DASHBOARD_${operation}_FAILED: ${await response.clone().text()}`);
}

/** Every Risk figure of the summary, the parts a Risk can move; the review queue is kept to prove nothing else moved. */
function riskFigures(summary: Summary): Record<string, unknown> {
  return {
    reviewQueue: summary.reviewQueue,
    riskExposure: summary.riskExposure,
    highCriticalRisks: summary.highCriticalRisks,
    treatmentsDue: summary.treatmentsDue,
  };
}

async function assertExposureEqualsTheRegister(label: string): Promise<void> {
  const { riskExposure } = await readSummary();
  const lists = [
    ["released", riskExposure.released, "&stage=released"],
    ["releasedAccepted", riskExposure.releasedAccepted, "&stage=released&treatmentAction=Accept"],
    ["underAssessment", riskExposure.underAssessment, "&stage=under-assessment"],
  ] as const;
  for (const [part, counts, filters] of lists) {
    for (const [key, value] of EXPOSURE_RATING_FILTERS) {
      assert.equal(await listTotal(`/api/v1/risks?residualRating=${value}&state=open${filters}`), counts[key], `${label}_EXPOSURE_DIFFERS_FROM_THE_REGISTER_${part}_${key}`);
    }
    assert.equal(await listTotal(`/api/v1/risks?state=open${filters}`), counts.total, `${label}_EXPOSURE_TOTAL_DIFFERS_FROM_THE_REGISTER_${part}`);
  }
  const { treatmentsDue } = await readSummary();
  assert.equal(treatmentsDue.overdue, await alertCount("risk-treatment-overdue"), `${label}_OVERDUE_DIFFERS_FROM_THE_ALERTS`);
  assert.equal(treatmentsDue.dueSoon, await alertCount("risk-treatment-due-soon"), `${label}_DUE_SOON_DIFFERS_FROM_THE_ALERTS`);
}

test("a withdrawn Critical Risk with an overdue treatment changes no dashboard figure, and reinstating it restores each (Phase 16 D-13, D-14)", async () => {
  assertSameUtcDay();
  const harness = await harnessPromise;
  const created = await seedDashboardFixtures();
  const request = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "P7D-RAR-WD",
    title: "P7D dashboard request WD",
    requestStatus: "under-review",
    requestor: harness.users.owner,
    submittedDate: at(D(-9)),
  });
  const draft = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "P7D-ASM-WD",
    assessmentStatus: "in-review",
    summary: "P7D dashboard withdrawal assessment",
    assessmentRequest: request,
    reviewedBy: harness.users.analyst,
  });
  const without = riskFigures(await readSummary());

  const underAssessment = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: riskNumber("WU"), riskStatement: riskStatement("WU"), assessment: draft,
    residualRating: "Critical", treatmentStatus: "In Progress", targetDate: D(-7), treatmentAction: "Treat",
  });
  const released = await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: riskNumber("WR"), riskStatement: riskStatement("WR"), assessment: created.ar,
    residualRating: "Critical", treatmentStatus: "In Progress", targetDate: D(-8), treatmentAction: "Accept",
  });
  const withRisks = riskFigures(await readSummary());
  const exposure = (figures: Record<string, unknown>) => figures.riskExposure as Summary["riskExposure"];
  assert.equal(exposure(withRisks).underAssessment.Critical, exposure(without).underAssessment.Critical + 1, "WU_NOT_IN_UNDER_ASSESSMENT");
  assert.equal(exposure(withRisks).released.Critical, exposure(without).released.Critical + 1, "WR_NOT_IN_RELEASED");
  assert.equal(exposure(withRisks).releasedAccepted.Critical, exposure(without).releasedAccepted.Critical + 1, "WR_NOT_ACCEPTED");
  assert.notDeepEqual(withRisks.highCriticalRisks, without.highCriticalRisks, "WR_NOT_IN_HIGH_CRITICAL");
  assert.notDeepEqual(withRisks.treatmentsDue, without.treatmentsDue, "WITHDRAWAL_FIXTURES_NOT_DUE");

  const reason = "Proposed under the wrong Risk Type";
  const withdraw = async () => {
    await curateRisks("risk_withdrawals", draft, [underAssessment], reason);
    await harness.setRiskWithdrawalFactsFixture(released, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: reason });
  };
  await withdraw();
  assert.deepEqual(riskFigures(await readSummary()), without, "A_WITHDRAWN_RISK_CHANGED_A_DASHBOARD_FIGURE");
  await assertExposureEqualsTheRegister("WITHDRAWN");

  await curateRisks("risk_reinstatements", draft, [underAssessment], "Withdrawn by mistake");
  await harness.setRiskWithdrawalFactsFixture(released, { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null });
  assert.deepEqual(riskFigures(await readSummary()), withRisks, "REINSTATING_DID_NOT_RESTORE_THE_DASHBOARD_FIGURES");
  await assertExposureEqualsTheRegister("REINSTATED");

  await withdraw();
  assert.deepEqual(riskFigures(await readSummary()), without, "WITHDRAWN_AGAIN_CHANGED_A_DASHBOARD_FIGURE");
  assertSameUtcDay();
});
