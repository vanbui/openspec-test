import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createWithAssessmentRequestNumber,
  generateAssessmentRequestNumber,
  REQUEST_NUMBER_CREATE_ATTEMPTS,
} from "../src/api/csrm-assessment-request/services/request-number";
import {
  createWithAssessmentNumber,
  generateAssessmentNumber,
} from "../src/api/csrm-assessment/services/assessment-number";
import {
  createWithRiskNumber,
  generateRiskNumber,
} from "../src/api/csrm-risk/services/risk-number";
import {
  AssessmentWorkflowError,
  type AssessmentMutationStrapi,
  assertMutableAssessment,
  isAssessmentRating,
  isReleased,
  parseWritableAssessmentFields,
  parseWritableControlImplementationFields,
  parseWritableRiskFields,
  projectReleaseReadiness,
  transitionForAcceptedEdit,
  validateReleaseReadiness,
  withMutableAssessmentMutation,
} from "../src/api/csrm-assessment/services/assessment-workflow";
import * as assessmentWorkflowModule from "../src/api/csrm-assessment/services/assessment-workflow";
import {
  parseAssessmentDraftProposal,
} from "../src/api/csrm-assessment/services/assessment-draft-provider";
import { buildAssessmentContext } from "../src/csrm/ai/assessment-context";
import { highestRating } from "../src/csrm/risk-scale";
import { uatALikeRecords } from "./fixtures/uat-a-like-context";
import { deterministicAssessmentDraftProvider } from "../src/api/csrm-assessment/services/deterministic-assessment-draft-provider";
import {
  ASSESSMENT_DRAFT_JOB_MAX_TERMINAL,
  ASSESSMENT_DRAFT_JOB_TERMINAL_TTL_MS,
  AssessmentDraftJobFailure,
  AssessmentDraftRegistryError,
  createAssessmentDraftRegistry,
  safeAssessmentDraftFailure,
} from "../src/api/csrm-assessment/services/assessment-draft-registry";
import { buildAssessmentCollectionQuery } from "../src/api/csrm-assessment/services/assessment-scope";

/*
 * The owner scope's released predicate, written out: 19-10 moved it into the one record-read check
 * (released-assessment-read.ts) with no change, so My risk assessments filters exactly as it did.
 */
const ownerReleasedFilters = (ownerDocumentId: string) => ({
  assessmentStatus: { $eq: "approved" },
  approvalDate: { $notNull: true },
  assessmentDate: { $notNull: true },
  approvedBy: { documentId: { $notNull: true } },
  assessmentRequest: { requestStatus: { $eq: "approved" }, requestor: { documentId: { $eq: ownerDocumentId } } },
});

const CROCKFORD_PATTERN = "[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}";

test("assessment collection queries compose scope before matching count and page data", () => {
  const analyst = { csrmAuthorization: { assessmentRequestActor: "analyst" as const } };
  const built = buildAssessmentCollectionQuery({ q: "vendor", status: "in-review", sort: "approvalDate:desc", page: 2, pageSize: 25 }, analyst, "analyst");
  assert.deepEqual(built.pagination, { page: 2, pageSize: 25 });
  assert.deepEqual(built.dataQuery.filters, built.countQuery.filters);
  assert.equal(built.dataQuery.start, 25);
  for (const invalid of [
    { status: "submitted" }, { q: "x".repeat(201) }, { sort: "summary:asc" },
    { page: 0 }, { pageSize: 101 }, { extra: "query" }, { sort: ["approvalDate:asc"] },
  ]) assert.throws(() => buildAssessmentCollectionQuery(invalid, analyst, "analyst"));

  // An empty search box is the absence of a search, not a malformed query: the
  // collection screens submit `q=` before the user has typed anything.
  for (const blank of [{ q: "" }, { q: "   " }]) {
    const unfiltered = buildAssessmentCollectionQuery(blank, analyst, "analyst");
    assert.doesNotMatch(JSON.stringify(unfiltered.countQuery.filters), /containsi/);
  }

  const owner = { csrmAuthorization: { assessmentRequestActor: "requestor" as const, assessmentOwnerCollectionScope: "own" as const, assessmentOwnerDocumentId: "owner-1" } };
  const owned = buildAssessmentCollectionQuery({}, owner, "owner");
  assert.match(JSON.stringify(owned.countQuery.filters), /owner-1/);
  assert.throws(() => buildAssessmentCollectionQuery({}, analyst, "owner"));
});

/*
 * GAP-1 (06.9-04): the assessment status filter accepts the complete datamodel
 * vocabulary. Every status, closed included, is inside the analyst assessment
 * scope. The owner collection keeps its released-owner predicate beside any
 * status, so a status can narrow that scope but never widen it.
 */
test("assessment collection status filters accept every assessment status without widening either scope", () => {
  const assessmentStatuses = (JSON.parse(readFileSync(
    path.resolve(__dirname, "..", "..", "..", "src", "api", "csrm-assessment", "content-types", "csrm-assessment", "schema.json"),
    "utf8",
  )) as { attributes: { assessmentStatus: { enum: string[] } } }).attributes.assessmentStatus.enum;
  assert.deepEqual(assessmentStatuses, ["draft", "in-review", "approved", "closed"], "ASSESSMENT_STATUS_VOCABULARY_CHANGED");

  const analyst = { csrmAuthorization: { assessmentRequestActor: "analyst" as const } };
  const owner = { csrmAuthorization: { assessmentRequestActor: "requestor" as const, assessmentOwnerCollectionScope: "own" as const, assessmentOwnerDocumentId: "owner-1" } };
  for (const status of assessmentStatuses) {
    const analystQuery = buildAssessmentCollectionQuery({ status }, analyst, "analyst");
    assert.deepEqual(analystQuery.countQuery.filters, status === "approved" ? {
      $and: [
        { assessmentStatus: { $eq: status } },
        { approvalDate: { $notNull: true }, approvedBy: { documentId: { $notNull: true } } },
      ],
    } : { assessmentStatus: { $eq: status } }, `ANALYST_STATUS_FILTER_${status}`);
    assert.deepEqual(analystQuery.dataQuery.filters, analystQuery.countQuery.filters, `ANALYST_STATUS_PAGE_FILTER_${status}`);

    const ownerQuery = buildAssessmentCollectionQuery({ status }, owner, "owner");
    assert.deepEqual(ownerQuery.countQuery.filters, {
      $and: [{ assessmentStatus: { $eq: status } }, ownerReleasedFilters("owner-1")],
    }, `OWNER_STATUS_FILTER_WIDENED_${status}`);
  }

  for (const status of ["Closed", "", "submitted", ["closed"], ["closed", "approved"], { $eq: "closed" }]) {
    assert.throws(() => buildAssessmentCollectionQuery({ status }, analyst, "analyst"), `MALFORMED_ASSESSMENT_STATUS_ACCEPTED_${JSON.stringify(status)}`);
  }
});

test("the analyst Released filter selects the complete release population while unfiltered review retains partial records", () => {
  const analyst = { csrmAuthorization: { assessmentRequestActor: "analyst" as const } };
  const released = buildAssessmentCollectionQuery({
    status: "approved", approvedFrom: "2026-09-01", approvedTo: "2026-09-30",
  }, analyst, "analyst");
  assert.deepEqual(released.countQuery.filters, {
    $and: [
      { assessmentStatus: { $eq: "approved" } },
      { approvalDate: { $gte: "2026-09-01T00:00:00.000Z" } },
      { approvalDate: { $lt: "2026-10-01T00:00:00.000Z" } },
      { approvalDate: { $notNull: true }, approvedBy: { documentId: { $notNull: true } } },
    ],
  });
  assert.deepEqual(released.dataQuery.filters, released.countQuery.filters);
  assert.deepEqual(buildAssessmentCollectionQuery({}, analyst, "analyst").countQuery.filters, { $and: [] });
});

const draftInput = () => {
  const records = uatALikeRecords();
  records.answers?.push({
    questionKey: "recovery-tested", sectionTitle: "Resilience", questionText: "Has recovery been tested?",
    helpText: "", answerType: "Single select", value: "no", answerLabel: "No",
  });
  return { records, context: buildAssessmentContext(records, { operation: "assessment-draft" }) };
};

test("deterministic draft uses selected systems and assets, repeated types, and an untyped risk", async () => {
  const input = draftInput();
  const first = await deterministicAssessmentDraftProvider.generate(input);
  const second = await deterministicAssessmentDraftProvider.generate(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.risks.map((risk) => risk.riskTypeName), [
    "Internet Exposure", "Personal Information Handling", "Personal Information Handling", "Third-Party Dependency", null,
  ]);
  assert.equal(first.risks[0].informationSystem, "system-hr");
  assert.equal(first.risks[1].informationAsset, "asset-pay");
  assert.equal(first.risks[1].dataClassification, "Restricted");
  assert.equal(first.risks[3].treatmentAction, "Accept");
  assert.deepEqual(first.risks[3].suggestedControls, []);
  assert.deepEqual(first.risks[4].sources.potentialImpact, []);
  assert.deepEqual(first.risks[4].uncitedClaims, ["Recovery time objectives for the service are not documented."]);
  assert.ok(first.risks.every((risk) => risk.suggestedControls.length <= 5
    && risk.suggestedControls.every((suggestion) => suggestion.controlNumber in input.context.allowed.controlCandidates)));
  assert.deepEqual(parseAssessmentDraftProposal(first, input.context.allowed), first);
});

/*
 * Verifier W-1 (success criterion 1, D-13): each deterministic Risk links the selected record it concerns, chosen from the
 * request's own selection in the context's order (by name), never in the order the records arrive. The service's system
 * is the internet-facing one, else the first selected; the third-party Risk links the first selected system a provider
 * runs (SaaS or Cloud); a personal-information Risk links the asset holding personal data, else the service's system.
 */
test("the deterministic draft links each risk to the selected system or asset it concerns", async () => {
  const linksOf = (proposal: Awaited<ReturnType<typeof deterministicAssessmentDraftProvider.generate>>) =>
    proposal.risks.map((risk) => [risk.riskTypeName ?? "(no type)", risk.riskSubCategory, risk.informationSystem, risk.informationAsset]);
  assert.deepEqual(linksOf(await deterministicAssessmentDraftProvider.generate(draftInput())), [
    ["Internet Exposure", "Internet exposure", "system-hr", null],
    ["Personal Information Handling", "Personal information handling", null, "asset-pay"],
    ["Personal Information Handling", "Regulatory compliance", null, "asset-pay"],
    ["Third-Party Dependency", "Supplier dependency", "system-hr", null],
    ["(no type)", "Recovery", "system-hr", null],
  ], "UAT_A_LIKE_RISK_LINKS");

  /* Nothing internet-facing, a provider runs the identity provider, no asset holds personal data, and the records reversed. */
  const records = draftInput().records;
  records.systems = [...records.systems].reverse().map((system) => ({ ...system, internetFacing: false, deploymentModel: system.documentId === "system-id" ? "SaaS" : "On-prem" }));
  records.assets = records.assets.map((asset) => ({ ...asset, containsPersonalData: false }));
  records.answers?.push({ questionKey: "handles-personal-data", sectionTitle: "Privacy", questionText: "Does the service handle personal information?", helpText: "", answerType: "Single select", value: "yes", answerLabel: "Yes" });
  const context = buildAssessmentContext(records, { operation: "assessment-draft" });
  assert.deepEqual(Object.values(context.allowed.systems), ["system-finance", "system-hr", "system-id"], "THE_CONTEXT_ORDERS_SYSTEMS_BY_NAME");
  assert.deepEqual(linksOf(await deterministicAssessmentDraftProvider.generate({ records, context })), [
    ["Personal Information Handling", "Personal information handling", "system-finance", null],
    ["Personal Information Handling", "Regulatory compliance", "system-finance", null],
    ["Third-Party Dependency", "Supplier dependency", "system-id", null],
    ["(no type)", "Recovery", "system-finance", null],
  ], "FALLBACK_RISK_LINKS");
});

/*
 * Walk D12: a Requestor reads the deterministic draft's statements once it is released (in development and in demos),
 * so they read as an assessment's own, with no back-end term.
 */
test("the deterministic draft's summary and statements read as an assessment's, with no back-end term", async () => {
  const input = draftInput();
  const proposal = await deterministicAssessmentDraftProvider.generate(input);
  assert.equal(proposal.summary, "This assessment identifies 5 risks from the request, its questionnaire answers and its selected systems and information assets.");
  for (const text of [proposal.summary, proposal.overallRiskRationale, proposal.recommendationsSummary]) assert.doesNotMatch(text, /deterministic|assistance|proposal|mapping/i, text);
  const none = { ...input.records, systems: [], assets: [], answers: [], request: { ...input.records.request, thirdPartyInvolvement: false, regulatoryRequirements: "" } };
  const empty = await deterministicAssessmentDraftProvider.generate({ records: none, context: buildAssessmentContext(none, { operation: "assessment-draft" }) });
  assert.equal(empty.risks.length, 0);
  assert.equal(empty.summary, "This assessment identifies no risks from the request, its questionnaire answers or its selected systems and information assets.");
  for (const text of [empty.summary, empty.overallRiskRationale, empty.recommendationsSummary]) assert.doesNotMatch(text, /deterministic|assistance|proposal|mapping/i, text);
});

test("closed parser refuses mismatched ratings, invalid relations and citations, and disallowed Accept", async () => {
  const input = draftInput();
  const proposal = await deterministicAssessmentDraftProvider.generate(input);
  const changed = (index: number, values: Record<string, unknown>) => ({
    ...proposal, risks: proposal.risks.map((risk, riskIndex) => riskIndex === index ? { ...risk, ...values } : risk),
  });
  assert.throws(() => parseAssessmentDraftProposal(changed(0, { inherentRating: "Low" }), input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal(changed(0, { informationSystem: "other-request-system" }), input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal(changed(0, { sources: { ...proposal.risks[0].sources, issueStatement: ["unknown"] } }), input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal(changed(0, { suggestedControls: [{ controlNumber: "unknown", control: "unknown", rationale: "Reason" }] }), input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal(changed(0, { treatmentAction: "Accept" }), input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal(changed(3, { suggestedControls: [proposal.risks[0].suggestedControls[0]] }), input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal({ ...proposal, risks: [...proposal.risks].reverse() }, input.context.allowed));
  assert.throws(() => parseAssessmentDraftProposal({ ...proposal, assessmentStatus: "released" }, input.context.allowed));
});
/*
 * WR-203 (D-11, 06.7 D-07): the closed parser is the unconditional gate for every provider, so it refuses an Accept on a
 * High or Critical residual rating by itself, on a risk with no suggested control, while the same risk as Treat parses.
 */
test("the closed parser refuses a High or Critical residual Accept on a risk with no suggestions", async () => {
  const input = draftInput();
  const proposal = await deterministicAssessmentDraftProvider.generate(input);
  const index = proposal.risks.findIndex((risk) => risk.treatmentAction === "Accept");
  assert.ok(index >= 0 && proposal.risks[index].suggestedControls.length === 0 && proposal.risks[index].residualRating === "Moderate", "the fixture's Accept is Moderate with no suggestion");
  const changed = (values: Record<string, unknown>) => {
    const risks = proposal.risks.map((risk, riskIndex) => riskIndex === index ? { ...risk, ...values } as typeof risk : risk);
    return { ...proposal, risks, overallRating: highestRating(risks.map((risk) => risk.residualRating)) ?? "Low" };
  };
  assert.deepEqual(parseAssessmentDraftProposal(changed({}), input.context.allowed).risks[index].treatmentAction, "Accept");
  for (const residual of [{ residualLikelihood: "Likely", highestResidualConsequence: "Major", residualRating: "High" }, { residualLikelihood: "Almost certain", highestResidualConsequence: "Severe", residualRating: "Critical" }]) {
    assert.throws(() => parseAssessmentDraftProposal(changed(residual), input.context.allowed), /invalid/, `ACCEPT_ON_${residual.residualRating.toUpperCase()}_PARSED`);
    assert.equal(parseAssessmentDraftProposal(changed({ ...residual, treatmentAction: "Treat" }), input.context.allowed).risks[index].residualRating, residual.residualRating);
  }
});

const analyst = { documentId: "analyst-1", canReadAllDraftJobs: false };
const otherAnalyst = { documentId: "analyst-2", canReadAllDraftJobs: false };
const scopedAnalyst = { documentId: "analyst-2", canReadAllDraftJobs: true };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("draft registry progresses queued to running to completed and is single-flight", async () => {
  let complete: ((value: { assessmentId: string }) => void) | undefined;
  let executions = 0;
  const registry = createAssessmentDraftRegistry({
    createJobId: () => "opaque-job-1",
    execute: async () => {
      executions += 1;
      return new Promise<{ assessmentId: string }>((resolve) => { complete = resolve; });
    },
  });
  const queued = registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" });
  assert.equal(queued.status, "queued");
  assert.equal(queued.attempt, 1);
  assert.deepEqual(registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" }), queued);
  const shared = registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: otherAnalyst.documentId, providerName: "provider", providerVersion: "1" });
  assert.equal(shared.jobId, queued.jobId);
  assert.equal(shared.initiatingAnalystDocumentId, analyst.documentId);
  await tick();
  assert.equal(registry.get("opaque-job-1", analyst).status, "running");
  assert.equal(executions, 1);
  complete?.({ assessmentId: "assessment-1" });
  await tick();
  const completed = registry.get("opaque-job-1", analyst);
  assert.equal(completed.status, "completed");
  assert.equal(completed.assessmentId, "assessment-1");
  assert.deepEqual(registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" }), completed);
  assert.equal(executions, 1);
});

test("draft registry exposes only safe actor-scoped records and retries failed jobs once per event", async () => {
  let executions = 0;
  const registry = createAssessmentDraftRegistry({
    createJobId: () => "opaque-job-2",
    execute: async ({ attempt }) => {
      executions += 1;
      if (attempt === 1) throw new AssessmentDraftJobFailure("PROVIDER_UNAVAILABLE", "Draft assistance is temporarily unavailable.");
      return { assessmentId: "assessment-2" };
    },
  });
  const queued = registry.enqueue({
    questionnaireId: "questionnaire-2",
    initiatingAnalystDocumentId: analyst.documentId,
    providerName: "provider",
    providerVersion: "1",
  });
  assert.equal("answers" in queued, false);
  await tick();
  const failed = registry.get("opaque-job-2", analyst);
  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.failure, { code: "PROVIDER_UNAVAILABLE", message: "Draft assistance is temporarily unavailable." });
  assert.equal(JSON.stringify(failed).includes("questionnaire answer"), false);
  assert.throws(() => registry.get("opaque-job-2", otherAnalyst), (error) => error instanceof AssessmentDraftRegistryError && error.status === 403);
  assert.equal(registry.get("opaque-job-2", scopedAnalyst).status, "failed");
  const retried = registry.retry("opaque-job-2", analyst);
  assert.equal(retried.status, "queued");
  assert.equal(retried.attempt, 2);
  assert.throws(() => registry.retry("opaque-job-2", analyst), /failed jobs/i);
  await tick();
  assert.equal(registry.get("opaque-job-2", analyst).status, "completed");
  assert.equal(executions, 2);
  assert.throws(() => registry.retry("opaque-job-2", analyst), /failed jobs/i);
});

/* D-18, G-3 (13-RESEARCH Pitfall 6): Bob starts a draft, it fails, the second analyst retries it, and the execution receives the second analyst. */
test("a retried assessment draft job is the retrying analyst's attempt", async () => {
  const executions: string[] = [];
  const registry = createAssessmentDraftRegistry({
    createJobId: () => "draft-retried",
    execute: async (job) => {
      executions.push(job.initiatingAnalystDocumentId);
      if (job.attempt === 1) throw new Error("provider failed");
      return { assessmentId: "assessment-retried" };
    },
  });
  registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: "bob", providerName: "provider", providerVersion: "1" });
  await tick();
  const second = { documentId: "second-analyst", canReadAllDraftJobs: true };
  assert.equal(registry.get("draft-retried", second).status, "failed", "BOB_DRAFT_JOB_DID_NOT_FAIL");
  const retried = registry.retry("draft-retried", second);
  assert.equal(retried.initiatingAnalystDocumentId, "second-analyst", "DRAFT_RETRY_NOT_CREDITED_TO_THE_RETRIER");
  await tick();
  assert.deepEqual(executions, ["bob", "second-analyst"], "DRAFT_RETRY_EXECUTED_AS_THE_ORIGINAL_INITIATOR");
});

test("draft registry masks unexpected failures and expires terminal jobs after one hour", async () => {
  let now = new Date("2026-08-30T00:00:00.000Z");
  const registry = createAssessmentDraftRegistry({
    now: () => now,
    createJobId: () => "opaque-job-3",
    execute: async () => { throw new Error("questionnaire secret and provider diagnostic"); },
  });
  registry.enqueue({ questionnaireId: "questionnaire-3", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" });
  await tick();
  const failed = registry.get("opaque-job-3", analyst);
  assert.deepEqual(failed.failure, { code: "DRAFT_GENERATION_FAILED", message: "Assessment draft generation failed safely." });
  assert.equal(JSON.stringify(failed).includes("secret"), false);
  now = new Date(now.getTime() + ASSESSMENT_DRAFT_JOB_TERMINAL_TTL_MS + 1);
  registry.cleanup();
  assert.throws(() => registry.get("opaque-job-3", analyst), /not found/i);
  assert.equal(ASSESSMENT_DRAFT_JOB_TERMINAL_TTL_MS, 60 * 60 * 1_000);
  assert.equal(ASSESSMENT_DRAFT_JOB_MAX_TERMINAL, 500);
});

/* IN-102: one mapping gives the job and its run the same safe code and message, and only what the run record accepts. */
test("a draft failure maps to one safe code and message for the job and its run", () => {
  assert.deepEqual(safeAssessmentDraftFailure(new AssessmentDraftJobFailure("PROVIDER_TIMEOUT", "Provider request timed out.")),
    { code: "PROVIDER_TIMEOUT", message: "Provider request timed out." });
  for (const error of [
    new Error("questionnaire secret and provider diagnostic"),
    new AssessmentDraftJobFailure("provider_timeout", "Provider request timed out."),
    new AssessmentDraftJobFailure("PROVIDER_TIMEOUT", "   "),
    new AssessmentDraftJobFailure("PROVIDER_TIMEOUT", "Provider request\ntimed out."),
    new AssessmentDraftJobFailure("PROVIDER_TIMEOUT", "Provider <b>timed out</b>."),
    new AssessmentDraftJobFailure("PROVIDER_TIMEOUT", "x".repeat(256)),
  ]) {
    assert.deepEqual(safeAssessmentDraftFailure(error), { code: "DRAFT_GENERATION_FAILED", message: "Assessment draft generation failed safely." }, error.message.slice(0, 40));
  }
});

test("draft registry evicts terminal jobs by LRU while retaining active jobs", async () => {
  let sequence = 0;
  let holdActive: ((value: { assessmentId: string }) => void) | undefined;
  const registry = createAssessmentDraftRegistry({
    maxTerminal: 2,
    createJobId: () => `opaque-job-${++sequence + 10}`,
    execute: async ({ questionnaireId }) => questionnaireId === "active"
      ? new Promise<{ assessmentId: string }>((resolve) => { holdActive = resolve; })
      : { assessmentId: `assessment-${questionnaireId}` },
  });
  const active = registry.enqueue({ questionnaireId: "active", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" });
  const first = registry.enqueue({ questionnaireId: "first", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" });
  const second = registry.enqueue({ questionnaireId: "second", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" });
  await tick();
  registry.get(first.jobId, analyst);
  const third = registry.enqueue({ questionnaireId: "third", initiatingAnalystDocumentId: analyst.documentId, providerName: "provider", providerVersion: "1" });
  await tick();
  registry.cleanup();
  assert.equal(registry.get(active.jobId, analyst).status, "running");
  assert.equal(registry.get(first.jobId, analyst).status, "completed");
  assert.throws(() => registry.get(second.jobId, analyst), /not found/i);
  assert.equal(registry.get(third.jobId, analyst).status, "completed");
  holdActive?.({ assessmentId: "assessment-active" });
  await tick();
});

test("domain numbers use the UTC year, fixed prefixes, and Crockford alphabet", () => {
  const now = new Date("2025-12-31T23:30:00-02:00");

  assert.match(generateAssessmentRequestNumber(now), new RegExp(`^RAR-2026-${CROCKFORD_PATTERN}$`));
  assert.match(generateAssessmentNumber(now), new RegExp(`^ASM-2026-${CROCKFORD_PATTERN}$`));
  assert.match(generateRiskNumber(now), new RegExp(`^RSK-2026-${CROCKFORD_PATTERN}$`));
});

test("domain number allocation retries recognized field-specific unique conflicts only", async () => {
  for (const [allocate, value, field] of [
    [createWithAssessmentRequestNumber, "RAR-2026-X7K4Q2", "requestNumber"],
    [createWithAssessmentNumber, "ASM-2026-X7K4Q2", "assessmentNumber"],
    [createWithRiskNumber, "RSK-2026-X7K4Q2", "riskNumber"],
  ] as const) {
    let attempts = 0;
    const result = await allocate(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error(`${field} unique constraint`), { code: "SQLITE_CONSTRAINT_UNIQUE" });
      }
      return value;
    }, () => value);

    assert.equal(result, value);
    assert.equal(attempts, 3);

    let wrongFieldAttempts = 0;
    await assert.rejects(allocate(async () => {
      wrongFieldAttempts += 1;
      throw Object.assign(new Error(`differentField unique constraint`), { code: "SQLITE_CONSTRAINT_UNIQUE" });
    }, () => value), /differentField/);
    assert.equal(wrongFieldAttempts, 1);

    let ordinaryAttempts = 0;
    await assert.rejects(allocate(async () => {
      ordinaryAttempts += 1;
      throw new Error("database unavailable");
    }, () => value), /database unavailable/);
    assert.equal(ordinaryAttempts, 1);
  }
});

test("domain number allocation stops after the shared five-attempt limit", async () => {
  for (const [allocate, value, field] of [
    [createWithAssessmentRequestNumber, "RAR-2026-X7K4Q2", "requestNumber"],
    [createWithAssessmentNumber, "ASM-2026-X7K4Q2", "assessmentNumber"],
    [createWithRiskNumber, "RSK-2026-X7K4Q2", "riskNumber"],
  ] as const) {
    let attempts = 0;
    await assert.rejects(allocate(async () => {
      attempts += 1;
      throw Object.assign(new Error(`${field} unique constraint`), { code: "SQLITE_CONSTRAINT_UNIQUE" });
    }, () => value));
    assert.equal(attempts, REQUEST_NUMBER_CREATE_ATTEMPTS);
  }
});

const releaseDate = "2026-08-30T00:00:00.000Z";

test("release requires the complete three-part fact and every partial combination fails closed", () => {
  for (let mask = 0; mask < 8; mask += 1) {
    const assessment = {
      assessmentStatus: mask & 1 ? "approved" : "in-review",
      approvedBy: mask & 2 ? { documentId: "analyst-1" } : null,
      approvalDate: mask & 4 ? releaseDate : null,
    };
    assert.equal(isReleased(assessment), mask === 7, `release mask ${mask}`);
    if (mask === 0) assert.doesNotThrow(() => assertMutableAssessment(assessment));
    else assert.throws(() => assertMutableAssessment(assessment), (error: unknown) =>
      error instanceof AssessmentWorkflowError && error.status === 409 && error.reason === "ASSESSMENT_NOT_MUTABLE", `release mask ${mask}`);
  }

  assert.doesNotThrow(() => assertMutableAssessment({ assessmentStatus: "draft", approvedBy: null, approvalDate: null }));
  assert.doesNotThrow(() => assertMutableAssessment({ assessmentStatus: "in-review", approvedBy: null, approvalDate: null }));
  assert.throws(() => assertMutableAssessment({ assessmentStatus: "closed", approvedBy: null, approvalDate: null }), /not mutable/i);
  assert.equal(isReleased({ assessmentStatus: "approved", approvedBy: "analyst-1", approvalDate: "not-a-date" }), false);
});

test("an accepted edit to a reviewed and release-ready assessment regresses it to draft while every other accepted edit keeps the first reviewer", () => {
  // Unchanged: the first accepted edit on a freshly drafted assessment opens the
  // review and stamps the acting analyst.
  assert.deepEqual(transitionForAcceptedEdit({
    assessmentStatus: "draft",
    requestStatus: "risk-assessment-drafted",
    reviewedBy: null,
    releaseReady: false,
  }, "analyst-1"), {
    assessmentStatus: "in-review",
    requestStatus: "under-review",
    reviewedBy: "analyst-1",
  });

  // Unchanged: a later edit to an assessment that is still incomplete stays in
  // review and keeps the original reviewer. The regression must not fire here.
  assert.deepEqual(transitionForAcceptedEdit({
    assessmentStatus: "in-review",
    requestStatus: "under-review",
    reviewedBy: { documentId: "analyst-1" },
    releaseReady: false,
  }, "analyst-2"), {
    assessmentStatus: "in-review",
    requestStatus: "under-review",
    reviewedBy: { documentId: "analyst-1" },
  });

  // New (D-13): the review was complete and the assessment was release-ready, so
  // the edit withdraws that review by storing draft. The reviewer of record
  // survives, which is the retained evidence of the superseded review.
  assert.deepEqual(transitionForAcceptedEdit({
    assessmentStatus: "in-review",
    requestStatus: "under-review",
    reviewedBy: { documentId: "analyst-1" },
    releaseReady: true,
  }, "analyst-2"), {
    assessmentStatus: "draft",
    requestStatus: "under-review",
    reviewedBy: { documentId: "analyst-1" },
  });

  // New: the fresh-review pass that recovers a regressed assessment, so nothing
  // can be stranded in draft. Release readiness is unreachable while the status
  // is draft, but the recovery holds either way.
  for (const releaseReady of [false, true]) {
    assert.deepEqual(transitionForAcceptedEdit({
      assessmentStatus: "draft",
      requestStatus: "under-review",
      reviewedBy: { documentId: "analyst-1" },
      releaseReady,
    }, "analyst-2"), {
      assessmentStatus: "in-review",
      requestStatus: "under-review",
      reviewedBy: { documentId: "analyst-1" },
    }, `recovery with releaseReady ${releaseReady}`);
  }

  // Unchanged refusals: the 409 vocabulary is identical for every other input.
  for (const state of [
    { assessmentStatus: "draft", requestStatus: "under-review", reviewedBy: null },
    { assessmentStatus: "in-review", requestStatus: "risk-assessment-drafted", reviewedBy: "analyst-1" },
    { assessmentStatus: "approved", requestStatus: "approved", reviewedBy: "analyst-1" },
  ]) {
    for (const releaseReady of [false, true]) {
      assert.throws(
        () => transitionForAcceptedEdit({ ...state, releaseReady }, "analyst-1"),
        /transition/i,
        `${state.assessmentStatus} on ${state.requestStatus} with releaseReady ${releaseReady}`,
      );
    }
  }
  assert.throws(() => transitionForAcceptedEdit({
    assessmentStatus: "in-review", requestStatus: "under-review", reviewedBy: "analyst-1", releaseReady: true,
  }, ""), /transition/i);
});

const readyRisk = {
  riskStatement: "A threat could compromise the service.",
  inherentLikelihood: "Likely",
  highestInherentConsequence: "Major",
  inherentRating: "High",
  residualLikelihood: "Possible",
  highestResidualConsequence: "Moderate",
  residualRating: "Moderate",
  riskOwner: "owner-1",
  treatmentAction: "Accept",
  targetDate: "2026-12-31",
  controlImplementations: [],
};

const readyAssessment = {
  assessmentStatus: "in-review",
  reviewedBy: "analyst-1",
  summary: "Reviewed assessment",
  overallRating: "High",
  overallRiskRationale: "Material exposure remains.",
  risks: [readyRisk],
};

test("a mutation selects its review transition from its result and pre-edit readiness", async () => {
  for (const startingStatus of ["draft", "in-review"] as const) {
    for (const choice of ["default", "none", "changed", "unchanged"] as const) {
      const assessment: Record<string, unknown> = {
        ...readyAssessment,
        assessmentStatus: startingStatus,
        reviewedBy: startingStatus === "draft" ? null : { documentId: "analyst-1" },
        assessmentRequest: {
          documentId: "request-1",
          requestStatus: startingStatus === "draft" ? "risk-assessment-drafted" : "under-review",
        },
      };
      const assessmentWrites: Record<string, unknown>[] = [];
      const requestWrites: Record<string, unknown>[] = [];
      const query = {
        select: () => query, where: () => query, forUpdate: () => query,
        transacting: () => query, execute: async () => [],
      };
      const strapi = {
        db: { queryBuilder: () => query, transaction: async (work: (input: { trx: unknown }) => Promise<unknown>) => work({ trx: {} }) },
        documents: (uid: string) => uid === "api::csrm-assessment.csrm-assessment"
          ? {
            findOne: async () => assessment,
            update: async ({ data }: { data: Record<string, unknown> }) => {
              assessmentWrites.push(data);
              Object.assign(assessment, data);
              return assessment;
            },
          }
          : {
            update: async ({ data }: { data: Record<string, unknown> }) => {
              requestWrites.push(data);
              Object.assign(assessment.assessmentRequest as Record<string, unknown>, data);
              return data;
            },
          },
      } as unknown as AssessmentMutationStrapi;
      const contentChanged = choice === "changed";
      const options = choice === "none" ? { transition: "none" as const }
        : choice === "default" ? {}
          : { transition: (result: { contentChanged: boolean }) => result.contentChanged ? "accepted-edit" as const : "none" as const };
      const result = await withMutableAssessmentMutation({
        strapi,
        assessmentDocumentId: "assessment-1",
        analystDocumentId: "analyst-2",
        ...options,
        mutate: async () => {
          assessment.summary = null;
          return { contentChanged };
        },
      });
      assert.deepEqual(result, { contentChanged });
      const shouldTransition = choice === "default" || choice === "changed";
      assert.equal(assessmentWrites.length, shouldTransition ? 1 : 0, `${startingStatus}/${choice} assessment writes`);
      assert.equal(requestWrites.length, shouldTransition && startingStatus === "draft" ? 1 : 0, `${startingStatus}/${choice} request writes`);
      assert.equal(assessment.assessmentStatus, shouldTransition
        ? startingStatus === "draft" ? "in-review" : "draft"
        : startingStatus, `${startingStatus}/${choice} status`);
      assert.deepEqual(assessment.reviewedBy, startingStatus === "draft" && shouldTransition
        ? "analyst-2" : startingStatus === "draft" ? null : shouldTransition ? "analyst-1" : { documentId: "analyst-1" });
      assert.equal((assessment.assessmentRequest as Record<string, unknown>).requestStatus,
        shouldTransition ? "under-review" : startingStatus === "draft" ? "risk-assessment-drafted" : "under-review");
    }
  }
});

/*
 * Phase 16 D-22: one exported guard decides whether an assessment can be changed by this actor now. It is read through
 * the module namespace so this file compiles before the guard exists (the RED step fails on assertions, #3770).
 */
type EditableGuardInput = { assessment: unknown; actor: { documentId: string } };
type EditableGuardModule = {
  assertAssessmentEditable?: (input: EditableGuardInput) => void;
  isAssessmentEditable?: (input: EditableGuardInput) => boolean;
};

function editableGuard(): Required<EditableGuardModule> {
  const module = assessmentWorkflowModule as unknown as EditableGuardModule;
  assert.equal(typeof module.assertAssessmentEditable, "function", "ASSERT_ASSESSMENT_EDITABLE_NOT_EXPORTED");
  assert.equal(typeof module.isAssessmentEditable, "function", "IS_ASSESSMENT_EDITABLE_NOT_EXPORTED");
  return module as Required<EditableGuardModule>;
}

test("the one editable guard refuses a released or release-stamped assessment with ASSESSMENT_NOT_MUTABLE and a blank actor with a 400 (D-22)", () => {
  const { assertAssessmentEditable, isAssessmentEditable } = editableGuard();
  const actor = { documentId: "analyst-1" };
  const notMutable = (error: unknown) => error instanceof AssessmentWorkflowError && error.status === 409 && error.reason === "ASSESSMENT_NOT_MUTABLE";
  const refused: Array<[string, Record<string, unknown>]> = [
    ["APPROVED", { assessmentStatus: "approved", approvedBy: { documentId: "analyst-1" }, approvalDate: releaseDate }],
    ["APPROVAL_DATE_ONLY", { assessmentStatus: "in-review", approvedBy: null, approvalDate: releaseDate }],
    ["DRAFT_WITH_APPROVAL_DATE", { assessmentStatus: "draft", approvedBy: null, approvalDate: releaseDate }],
  ];
  for (const [label, assessment] of refused) {
    assert.throws(() => assertAssessmentEditable({ assessment, actor }), notMutable, `GUARD_ADMITTED_${label}`);
    assert.equal(isAssessmentEditable({ assessment, actor }), false, `IS_EDITABLE_${label}`);
  }
  for (const status of ["draft", "in-review"]) {
    const assessment = { assessmentStatus: status, approvedBy: null, approvalDate: null };
    assert.doesNotThrow(() => assertAssessmentEditable({ assessment, actor }), `GUARD_REFUSED_${status}`);
    assert.equal(isAssessmentEditable({ assessment, actor }), true, `IS_EDITABLE_${status}`);
  }
  const draft = { assessmentStatus: "draft", approvedBy: null, approvalDate: null };
  const badRequest = (error: unknown) => error instanceof AssessmentWorkflowError && error.status === 400;
  for (const blank of [{ documentId: "" }, { documentId: "   " }, {} as { documentId: string }]) {
    assert.throws(() => assertAssessmentEditable({ assessment: draft, actor: blank }), badRequest, "GUARD_ADMITTED_A_BLANK_ACTOR");
    assert.throws(() => isAssessmentEditable({ assessment: draft, actor: blank }), badRequest, "IS_EDITABLE_HID_A_BLANK_ACTOR");
  }
});

test("a mutation that reports no change keeps a release-ready in-review assessment in review and writes no status (D-23)", async () => {
  for (const changed of [false, true]) {
    const assessment: Record<string, unknown> = {
      ...readyAssessment,
      reviewedBy: { documentId: "analyst-1" },
      assessmentRequest: { documentId: "request-1", requestStatus: "under-review" },
    };
    const writes: Record<string, unknown>[] = [];
    const query = { select: () => query, where: () => query, forUpdate: () => query, transacting: () => query, execute: async () => [] };
    const strapi = {
      db: { queryBuilder: () => query, transaction: async (work: (input: { trx: unknown }) => Promise<unknown>) => work({ trx: {} }) },
      documents: () => ({
        findOne: async () => assessment,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data);
          Object.assign(assessment, data);
          return assessment;
        },
      }),
    } as unknown as AssessmentMutationStrapi;
    await withMutableAssessmentMutation({
      strapi,
      assessmentDocumentId: "assessment-1",
      analystDocumentId: "analyst-2",
      transition: (result: { changed: boolean }) => result.changed ? "accepted-edit" : "none",
      mutate: async () => ({ changed }),
    });
    assert.equal(writes.length, changed ? 1 : 0, `STATUS_WRITES_WHEN_CHANGED_${changed}`);
    assert.equal(assessment.assessmentStatus, changed ? "draft" : "in-review", `STATUS_WHEN_CHANGED_${changed}`);
  }
});

test("release readiness reports every required assessment and Risk field", () => {
  assert.deepEqual(validateReleaseReadiness(readyAssessment), { ready: true, missing: [] });

  for (const field of ["assessmentStatus", "reviewedBy", "summary", "overallRating", "overallRiskRationale", "risks"]) {
    const candidate = { ...readyAssessment } as Record<string, unknown>;
    candidate[field] = field === "risks" ? [] : null;
    const result = validateReleaseReadiness(candidate);
    assert.equal(result.ready, false, field);
    assert.ok(result.missing.some((item) => item.includes(field)), `${field}: ${result.missing.join(", ")}`);
  }

  for (const field of [
    "riskStatement", "inherentLikelihood", "highestInherentConsequence", "inherentRating",
    "residualLikelihood", "highestResidualConsequence", "residualRating", "riskOwner",
    "treatmentAction", "targetDate",
  ]) {
    const candidateRisk = { ...readyRisk, [field]: null };
    const result = validateReleaseReadiness({ ...readyAssessment, risks: [candidateRisk] });
    assert.equal(result.ready, false, field);
    assert.ok(result.missing.includes(`risks[0].${field}`));
  }
});

test("release readiness projects the complete named set with stable Risk destinations", () => {
  const completeRisk = { ...readyRisk, documentId: "risk-document-2", riskNumber: "RSK-002" };
  const incompleteRisk = { ...readyRisk, documentId: "risk-document-1", riskNumber: "RSK-001", riskOwner: null };
  const readiness = projectReleaseReadiness({ ...readyAssessment, risks: [completeRisk, incompleteRisk] });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.requirements.length, 26);
  // The checklist follows the assessment's own Risk order so it reads in the
  // same order as the Identified Risks section, rather than being re-sorted by
  // number into an order the page never shows.
  assert.deepEqual(
    readiness.requirements.filter((requirement) => requirement.scope === "risk").map((requirement) => requirement.riskNumber),
    Array(10).fill("RSK-002").concat(Array(10).fill("RSK-001")),
  );
  assert.deepEqual(
    readiness.requirements.find((requirement) => requirement.key === "riskOwner" && requirement.riskNumber === "RSK-001"),
    {
      scope: "risk",
      key: "riskOwner",
      label: "Risk owner",
      state: "outstanding",
      riskNumber: "RSK-001",
      destination: "risk-risk-document-1",
    },
  );
  assert.ok(readiness.requirements.every((requirement) => requirement.state === "met" || requirement.state === "outstanding"));
});

test("release readiness rejects unpopulated Risk identity and keeps the no-Risk requirement", () => {
  assert.throws(
    () => projectReleaseReadiness({ ...readyAssessment, risks: [{ ...readyRisk, riskNumber: "RSK-001" }] }),
    /Risk identity is invalid/i,
  );
  const readiness = projectReleaseReadiness({ ...readyAssessment, risks: [] });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.requirements.at(-1), {
    scope: "assessment",
    key: "risks",
    label: "At least one Risk",
    state: "outstanding",
    destination: "identified-risks",
  });
});

/*
 * Phase 16 D-12, D-13 (16-RESEARCH Pitfall 2): both readiness functions count the active Risks only, from the same
 * list, so a `risks[index]` path names the same Risk in each. An incomplete withdrawn Risk never blocks release, and an
 * assessment whose Risks are all withdrawn has "At least one Risk" outstanding.
 */
test("release readiness counts only active Risks, with the same risks[index] paths in both functions (D-12, D-13)", () => {
  const withdrawnAt = "2026-10-01T00:00:00.000Z";
  const withdrawnIncomplete = { ...readyRisk, documentId: "risk-withdrawn", riskNumber: "RSK-001", riskOwner: null, residualRating: null, withdrawnAt };
  const active = { ...readyRisk, documentId: "risk-active", riskNumber: "RSK-002", withdrawnAt: null };
  const mixed = { ...readyAssessment, risks: [withdrawnIncomplete, active] };

  assert.deepEqual(validateReleaseReadiness(mixed), { ready: true, missing: [] });
  const projected = projectReleaseReadiness(mixed);
  assert.equal(projected.ready, true);
  const riskRows = projected.requirements.filter((requirement) => requirement.scope === "risk");
  assert.equal(riskRows.length, 10);
  assert.ok(riskRows.every((requirement) => requirement.riskNumber === "RSK-002" && requirement.destination === "risk-risk-active"), "A_WITHDRAWN_RISK_HAS_A_READINESS_ROW");

  // The active Risk is risks[0] in both functions: its own gap is reported at that path and projected onto it.
  const activeGap = { ...readyAssessment, risks: [withdrawnIncomplete, { ...active, riskOwner: null }] };
  assert.deepEqual(validateReleaseReadiness(activeGap), { ready: false, missing: ["risks[0].riskOwner"] });
  const gapRows = projectReleaseReadiness(activeGap).requirements.filter((requirement) => requirement.state === "outstanding");
  assert.deepEqual(gapRows.map(({ key, riskNumber }) => ({ key, riskNumber })), [{ key: "riskOwner", riskNumber: "RSK-002" }]);

  const onlyWithdrawn = { ...readyAssessment, risks: [{ ...active, withdrawnAt }, withdrawnIncomplete] };
  assert.deepEqual(validateReleaseReadiness(onlyWithdrawn), { ready: false, missing: ["risks"] });
  const empty = projectReleaseReadiness(onlyWithdrawn);
  assert.equal(empty.ready, false);
  assert.equal(empty.requirements.some((requirement) => requirement.scope === "risk"), false);
  assert.deepEqual(empty.requirements.at(-1), { scope: "assessment", key: "risks", label: "At least one Risk", state: "outstanding", destination: "identified-risks" });
});

test("Treat readiness adds plan, owner, resolve date, and reusable Control requirements", () => {
  const treated = {
    ...readyRisk,
    treatmentAction: "Treat",
    treatmentPlan: "Implement the selected control.",
    treatmentOwner: "owner-1",
    treatmentResolveDate: "2026-11-30",
    controlImplementations: [{ control: "control-1" }],
  };
  assert.equal(validateReleaseReadiness({ ...readyAssessment, risks: [treated] }).ready, true);

  for (const field of ["treatmentPlan", "treatmentOwner", "treatmentResolveDate", "controlImplementations"]) {
    const candidate = { ...treated } as Record<string, unknown>;
    candidate[field] = field === "controlImplementations" ? [] : null;
    const result = validateReleaseReadiness({ ...readyAssessment, risks: [candidate] });
    assert.equal(result.ready, false, field);
    assert.ok(result.missing.some((item) => item.includes(field)));
  }

  const missingReusableControl = { ...treated, controlImplementations: [{ control: null }] };
  assert.ok(validateReleaseReadiness({ ...readyAssessment, risks: [missingReusableControl] }).missing.includes("risks[0].controlImplementations.control"));
});

test("release readiness requires review of proposed fields at each record scope", () => {
  const fact = { state: "proposed" };
  const assessmentProvenance = { schemaVersion: 1, runId: "run-1", proposalKey: "proposal-1", fields: { summary: fact } };
  const riskProvenance = { schemaVersion: 1, runId: "run-1", proposalKey: "proposal-1", fields: { issueStatement: fact }, uncitedClaims: [], suggestions: [], adjustments: [] };
  const value = { ...readyAssessment, aiProvenance: assessmentProvenance, risks: [{ ...readyRisk, documentId: "risk-document-1", riskNumber: "RSK-001", aiProvenance: riskProvenance }] };
  assert.deepEqual(validateReleaseReadiness(value).missing, ["aiProposalsReviewed", "risks[0].aiProposalsReviewed"]);
  const projected = projectReleaseReadiness(value).requirements.filter((item) => item.key === "aiProposalsReviewed");
  assert.deepEqual(projected.map(({ label, scope, state, destination }) => ({ label, scope, state, destination })), [
    { label: "Review of AI proposals", scope: "assessment", state: "outstanding", destination: "assessment-details" },
    { label: "Review of AI proposals", scope: "risk", state: "outstanding", destination: "risk-risk-document-1" },
  ]);
  const legacy = { ...value, aiProvenance: null, risks: [{ ...value.risks[0], aiProvenance: null }] };
  assert.equal(validateReleaseReadiness(legacy).ready, true);
  assert.equal(projectReleaseReadiness(legacy).requirements.some((item) => item.key === "aiProposalsReviewed"), false);
});

/*
 * CR-01: null is a record that predates AI provenance and adds no requirement. Any other stored value that does not
 * parse stands for AI proposals whose review cannot be shown, so it fails closed: the review is outstanding at the
 * scope of the record that holds it, for the assessment and for each Risk.
 */
test("an AI review record that is present but unreadable keeps the review outstanding at its own scope", () => {
  const risk = { ...readyRisk, documentId: "risk-document-1", riskNumber: "RSK-001", aiProvenance: null };
  const legacy = { ...readyAssessment, aiProvenance: null, risks: [risk] };
  assert.deepEqual(validateReleaseReadiness(legacy), { ready: true, missing: [] });
  assert.equal(projectReleaseReadiness(legacy).ready, true);
  const aiReview = (candidate: unknown) => projectReleaseReadiness(candidate).requirements
    .filter((item) => item.key === "aiProposalsReviewed")
    .map(({ label, scope, state, destination }) => ({ label, scope, state, destination }));
  for (const malformed of [{ invalid: true }, { schemaVersion: 99 }, { schemaVersion: 1, runId: "run-1" }, [], "corrupted"]) {
    const name = JSON.stringify(malformed);
    const assessmentScope = { ...legacy, aiProvenance: malformed };
    assert.deepEqual(validateReleaseReadiness(assessmentScope), { ready: false, missing: ["aiProposalsReviewed"] }, `assessment ${name}`);
    assert.equal(projectReleaseReadiness(assessmentScope).ready, false, `assessment ${name}`);
    assert.deepEqual(aiReview(assessmentScope), [
      { label: "Review of AI proposals", scope: "assessment", state: "outstanding", destination: "assessment-details" },
    ], `assessment ${name}`);
    const riskScope = { ...legacy, risks: [{ ...risk, aiProvenance: malformed }] };
    assert.deepEqual(validateReleaseReadiness(riskScope), { ready: false, missing: ["risks[0].aiProposalsReviewed"] }, `risk ${name}`);
    assert.equal(projectReleaseReadiness(riskScope).ready, false, `risk ${name}`);
    assert.deepEqual(aiReview(riskScope), [
      { label: "Review of AI proposals", scope: "risk", state: "outstanding", destination: "risk-risk-document-1" },
    ], `risk ${name}`);
  }
});

/*
 * Walk D13(a): the release checklist is for an assessment that can still be released. A record that can no longer
 * change (released, closed, or carrying any release fact, as assertMutableAssessment reads it) presents no requirement,
 * met or outstanding, so "Assessment status" never reads outstanding on a released assessment. The shape stays the
 * contract's ReleaseReadiness: not ready (it can't be released again) and an empty list.
 */
test("an assessment that can no longer change presents no release requirements", () => {
  const value = { ...readyAssessment, risks: [{ ...readyRisk, documentId: "risk-document-1", riskNumber: "RSK-001" }] };
  assert.equal(projectReleaseReadiness(value).ready, true);
  assert.equal(projectReleaseReadiness(value).requirements.every((item) => item.state === "met"), true);
  const released = { assessmentStatus: "approved", approvedBy: "analyst-1", approvalDate: "2026-10-01T00:00:00.000Z" };
  for (const [name, facts] of [
    ["released", released],
    ["closed", { assessmentStatus: "closed" }],
    ["approved without its other facts", { assessmentStatus: "approved" }],
    ["in review with an approver", { approvedBy: "analyst-1" }],
    ["in review with an approval date", { approvalDate: "2026-10-01T00:00:00.000Z" }],
  ] as const) {
    assert.deepEqual(projectReleaseReadiness({ ...value, ...facts }), { ready: false, requirements: [] }, name);
  }
  const incomplete = { ...value, ...released, summary: null, aiProvenance: { invalid: true }, risks: [{ ...value.risks[0], riskOwner: null }] };
  assert.deepEqual(projectReleaseReadiness(incomplete), { ready: false, requirements: [] }, "released with gaps");
  const draft = projectReleaseReadiness({ ...value, assessmentStatus: "draft" });
  assert.equal(draft.ready, false);
  assert.ok(draft.requirements.some((item) => item.key === "assessmentStatus" && item.state === "outstanding"), "a draft keeps its checklist");
});

test("rating validation is closed to the four contract values", () => {
  for (const rating of ["Low", "Moderate", "High", "Critical"]) assert.equal(isAssessmentRating(rating), true);
  for (const rating of ["low", "Very High", "", null, 4]) assert.equal(isAssessmentRating(rating), false);
});

const writableRisk = {
  issueStatement: "Issue", riskStatement: "Risk", riskCategory: "Security", riskSubCategory: "Access",
  riskCause: "Cause", potentialImpact: "Impact", riskType: "risk-type-1", riskOwner: "owner-1",
  informationSystemImpacted: "system-1", informationAssetImpacted: "asset-1", dataClassification: "Restricted",
  inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "High", inherentRatingRationale: "Reason",
  residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate", residualRatingRationale: "Reason",
  controlEffectiveness: "Partially Effective", riskVelocity: "High", identifiedDate: "2026-08-30", targetDate: "2026-12-31",
  closureDate: null, isExempted: false, exemptionReviewDate: "2026-10-01T00:00:00.000Z", escalationDetails: "Details",
  comments: "Comment", riskCommunicationDate: "2026-09-01", treatmentAction: "Treat", treatmentPlan: "Plan",
  treatmentOwner: "owner-2", treatmentResolveDate: "2026-11-30", treatmentStatus: "In Progress",
};

test("Risk parser accepts every and only frozen writable field", () => {
  assert.deepEqual(parseWritableRiskFields(writableRisk), writableRisk);
  for (const [field, value] of Object.entries(writableRisk)) {
    assert.deepEqual(parseWritableRiskFields({ [field]: value }), { [field]: value }, field);
  }
  for (const field of [
    "documentId", "id", "riskNumber", "assessment", "controlImplementations", "assessmentStatus", "requestStatus",
    "generatedBy", "generatedDate", "reviewedBy", "approvedBy", "approvalDate", "assessmentDate", "createdAt", "updatedAt", "publishedAt",
  ]) assert.throws(() => parseWritableRiskFields({ [field]: field === "id" ? 1 : "hostile" }), /invalid/i, field);
});

test("Risk parser rejects whitespace-only statements and canonicalizes meaningful statements", () => {
  for (const riskStatement of ["   ", "\t", "\n\r"]) {
    assert.throws(() => parseWritableRiskFields({ riskStatement }), /invalid/i, JSON.stringify(riskStatement));
  }
  assert.deepEqual(
    parseWritableRiskFields({ riskStatement: "  Meaningful bounded risk statement  " }),
    { riskStatement: "Meaningful bounded risk statement" },
  );
});

test("Risk parser rejects invalid ratings, enums, dates, booleans, and references", () => {
  for (const input of [
    { inherentRating: "Very High" }, { residualRating: "low" }, { dataClassification: "Secret" },
    { controlEffectiveness: "Unknown" }, { riskVelocity: "Immediate" }, { treatmentAction: "Transfer" },
    { treatmentStatus: "Done" }, { targetDate: "2026-02-30" }, { exemptionReviewDate: "2026-02-30T00:00:00.000Z" },
    { isExempted: "yes" }, { riskType: { documentId: "risk-type-1" } }, { riskOwner: "" },
  ]) assert.throws(() => parseWritableRiskFields(input), /invalid/i, JSON.stringify(input));
});

const writableControlImplementation = {
  control: "control-1",
  controlOwner: "owner-1",
  controlStatus: "Implemented",
  effectivenessRating: "Effective",
  evidence: "Evidence",
  implementationDueDate: "2026-09-30",
  implementedDate: "2026-09-01",
  reviewDate: "2026-12-01",
};

test("ControlImplementation parser accepts every and only frozen writable field", () => {
  assert.deepEqual(parseWritableControlImplementationFields(writableControlImplementation), writableControlImplementation);
  for (const [field, value] of Object.entries(writableControlImplementation)) {
    assert.deepEqual(parseWritableControlImplementationFields({ [field]: value }), { [field]: value }, field);
  }
  for (const field of ["documentId", "id", "risk", "assessment", "riskNumber", "approvedBy", "createdAt", "updatedAt"]) {
    assert.throws(() => parseWritableControlImplementationFields({ [field]: field === "id" ? 1 : "hostile" }), /invalid/i, field);
  }
  for (const input of [
    { control: { documentId: "control-1" } }, { controlOwner: "" }, { controlStatus: "Active" },
    { effectivenessRating: "Unknown" }, { reviewDate: "2026-13-01" },
  ]) assert.throws(() => parseWritableControlImplementationFields(input), /invalid/i, JSON.stringify(input));
});

test("Assessment parser owns its exact metadata allowlist and validates ratings, enums, and dates", () => {
  const writable = {
    summary: "Summary",
    overallRating: "Critical",
    overallControlEffectiveness: "Not Assessed",
    recommendationsSummary: "Recommendations",
    overallRiskRationale: "Rationale",
    nextReviewDate: "2027-08-30",
  };
  assert.deepEqual(parseWritableAssessmentFields(writable), writable);
  for (const field of ["documentId", "id", "assessmentNumber", "assessmentStatus", "assessmentRequest", "risks", "generatedBy", "generatedDate", "reviewedBy", "approvedBy", "approvalDate", "assessmentDate", "createdAt", "updatedAt"]) {
    assert.throws(() => parseWritableAssessmentFields({ [field]: "hostile" }), /invalid/i, field);
  }
  for (const input of [
    { overallRating: "Very High" }, { overallControlEffectiveness: "Unknown" }, { nextReviewDate: "2026-02-30" }, { summary: null },
  ]) assert.throws(() => parseWritableAssessmentFields(input), /invalid/i, JSON.stringify(input));
});

test("all writable parsers reject workflow, release, parent, identity, and audit ownership", () => {
  const hostileFields = [
    "documentId", "id", "assessmentNumber", "riskNumber", "assessment", "assessmentRequest", "risk", "risks",
    "controlImplementations", "assessmentStatus", "requestStatus", "generatedBy", "generatedDate", "reviewedBy",
    "approvedBy", "approvalDate", "assessmentDate", "createdAt", "updatedAt", "publishedAt",
  ];
  for (const parse of [parseWritableAssessmentFields, parseWritableRiskFields, parseWritableControlImplementationFields]) {
    for (const field of hostileFields) {
      assert.throws(() => parse({ [field]: field === "id" ? 1 : "hostile" }), /invalid/i, field);
    }
  }
});
