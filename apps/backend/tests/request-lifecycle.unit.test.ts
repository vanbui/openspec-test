import assert from "node:assert/strict";
import test from "node:test";

import { deriveRequestLifecycle, holderFor, projectRequestLifecycle, REQUEST_LIFECYCLE_STEPS, type LifecycleKey, type RequestLifecycleFacts } from "../src/api/csrm-assessment-request/services/request-lifecycle";

const statuses = ["draft", "submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed"] as const;

function expectedIndex(facts: RequestLifecycleFacts): number {
  if (facts.requestStatus === "closed" || facts.assessmentReleased) return 7;
  if (facts.assessmentReviewedAndReady) return 6;
  if (facts.assessmentExists) return 5;
  if (facts.questionnaireSubmitted) return 4;
  if (facts.questionnaireReleased) return 3;
  if (facts.questionnaireExists) return 2;
  return facts.requestStatus === "draft" ? 0 : 1;
}

test("every lifecycle fact combination derives exactly one highest matching step", () => {
  for (const requestStatus of statuses) for (let mask = 0; mask < 64; mask += 1) {
    const facts: RequestLifecycleFacts = {
      requestStatus,
      questionnaireExists: Boolean(mask & 1), questionnaireReleased: Boolean(mask & 2), questionnaireSubmitted: Boolean(mask & 4),
      assessmentExists: Boolean(mask & 8), assessmentReviewedAndReady: Boolean(mask & 16), assessmentReleased: Boolean(mask & 32),
    };
    const lifecycle = deriveRequestLifecycle(facts);
    if (requestStatus === "closed") {
      assert.equal(lifecycle.terminal, true, `CLOSED_TERMINAL_${mask}`);
      assert.ok(lifecycle.steps.every((step) => step.state === "completed"), `CLOSED_COMPLETE_${mask}`);
      continue;
    }
    const index = expectedIndex(facts);
    assert.equal(lifecycle.currentKey, REQUEST_LIFECYCLE_STEPS[index].key, `HIGHEST_MATCH_${requestStatus}_${mask}`);
    assert.equal(lifecycle.steps.filter((step) => step.state === "current").length, 1, `ONE_CURRENT_${requestStatus}_${mask}`);
    lifecycle.steps.forEach((step, stepIndex) => assert.equal(step.state, stepIndex < index ? "completed" : stepIndex === index ? "current" : "future", `PARTITION_${requestStatus}_${mask}_${stepIndex}`));
  }
});

test("named scenarios and backward movement do not latch forward", () => {
  const scenarios: Array<[string, RequestLifecycleFacts, string]> = [
    ["fresh draft", { requestStatus: "draft", questionnaireExists: false, questionnaireReleased: false, questionnaireSubmitted: false, assessmentExists: false, assessmentReviewedAndReady: false, assessmentReleased: false }, "draft"],
    ["submitted without questionnaire", { requestStatus: "submitted", questionnaireExists: false, questionnaireReleased: false, questionnaireSubmitted: false, assessmentExists: false, assessmentReviewedAndReady: false, assessmentReleased: false }, "submitted"],
    ["generated questionnaire", { requestStatus: "questionnaire-in-progress", questionnaireExists: true, questionnaireReleased: false, questionnaireSubmitted: false, assessmentExists: false, assessmentReviewedAndReady: false, assessmentReleased: false }, "questionnaire-generated"],
    ["released questionnaire", { requestStatus: "questionnaire-in-progress", questionnaireExists: true, questionnaireReleased: true, questionnaireSubmitted: false, assessmentExists: false, assessmentReviewedAndReady: false, assessmentReleased: false }, "questionnaire-released"],
    ["submitted questionnaire", { requestStatus: "questionnaire-in-progress", questionnaireExists: true, questionnaireReleased: true, questionnaireSubmitted: true, assessmentExists: false, assessmentReviewedAndReady: false, assessmentReleased: false }, "questionnaire-submitted"],
    ["draft assessment", { requestStatus: "risk-assessment-drafted", questionnaireExists: true, questionnaireReleased: true, questionnaireSubmitted: true, assessmentExists: true, assessmentReviewedAndReady: false, assessmentReleased: false }, "assessment-drafted"],
    ["reviewed assessment", { requestStatus: "under-review", questionnaireExists: true, questionnaireReleased: true, questionnaireSubmitted: true, assessmentExists: true, assessmentReviewedAndReady: true, assessmentReleased: false }, "assessment-reviewed"],
    ["released assessment", { requestStatus: "approved", questionnaireExists: true, questionnaireReleased: true, questionnaireSubmitted: true, assessmentExists: true, assessmentReviewedAndReady: true, assessmentReleased: true }, "assessment-released"],
  ];
  for (const [name, facts, key] of scenarios) assert.equal(deriveRequestLifecycle(facts).currentKey, key, name);
  const reverted = deriveRequestLifecycle({ ...scenarios[1][1], requestStatus: "draft" });
  assert.equal(reverted.currentKey, "draft"); assert.ok(reverted.steps.every((step) => step.state !== "completed"));
  assert.equal(deriveRequestLifecycle({ ...scenarios[3][1], questionnaireReleased: false }).currentKey, "questionnaire-generated");
  assert.equal(deriveRequestLifecycle({ ...scenarios[4][1], questionnaireReleased: false, questionnaireSubmitted: false }).currentKey, "questionnaire-generated");
  assert.equal(deriveRequestLifecycle({ ...scenarios[6][1], assessmentReviewedAndReady: false }).currentKey, "assessment-drafted");
});

test("projection supplies actor-specific actions and only authorised relation links", () => {
  const base = { documentId: "request-1", requestStatus: "questionnaire-in-progress", questionnaire: { documentId: "questionnaire-1", releasedAt: "2026-01-01T00:00:00.000Z", questions: [] } };
  const requestor = projectRequestLifecycle(base, { csrmAuthorization: { assessmentRequestActor: "requestor" } });
  const analyst = projectRequestLifecycle(base, { csrmAuthorization: { assessmentRequestActor: "analyst" } });
  assert.equal(requestor.currentKey, analyst.currentKey);
  assert.notEqual(requestor.nextAction?.summary, analyst.nextAction?.summary);
  assert.equal(requestor.nextAction?.href, "/app/questionnaires/questionnaire-1");
  assert.equal(analyst.nextAction?.href, undefined);
  const unreleased = projectRequestLifecycle({ ...base, questionnaire: { ...base.questionnaire, releasedAt: null } }, { csrmAuthorization: { assessmentRequestActor: "requestor" } });
  assert.equal(unreleased.nextAction?.href, undefined, "REQUESTOR_CANNOT_OPEN_UNRELEASED_QUESTIONNAIRE");
  const assessment = projectRequestLifecycle({ documentId: "request-1", requestStatus: "risk-assessment-drafted", assessment: { documentId: "assessment-1", assessmentStatus: "draft", risks: [] } }, { csrmAuthorization: { assessmentRequestActor: "requestor" } });
  assert.equal(assessment.nextAction?.href, undefined, "REQUESTOR_CANNOT_OPEN_UNRELEASED_ASSESSMENT");
});

/*
 * D-27, UI-SPEC §6.1: the next action names who holds the work. `actor` stays the viewer; `holder` is the
 * D-20 party whose turn it is, the same for both viewers. The holder's own sentence is verb-first and links
 * where the server can; the other party reads what the holder is doing, in words that name them, with no link.
 */
const at = "2026-01-01T00:00:00.000Z";
const submittedQuestion = {
  documentId: "question-a", questionText: "Question a", answerType: "Text",
  options: { schemaVersion: 1, questionKey: "a", section: { key: "context", title: "Context", order: 0 }, order: 0, required: true },
  answer: { schemaVersion: 1, value: "Yes", state: "submitted", updatedAt: at, submittedAt: at },
};
const generatedQuestionnaire = { documentId: "questionnaire-1", questionnaireNumber: "QUES-0001", releasedAt: null, questions: [] };
const releasedQuestionnaire = { ...generatedQuestionnaire, releasedAt: at };
const submittedQuestionnaire = { ...releasedQuestionnaire, questions: [submittedQuestion] };
const readyRisk = {
  riskStatement: "Customer data exposure", inherentLikelihood: "Likely", highestInherentConsequence: "Major",
  residualLikelihood: "Unlikely", highestResidualConsequence: "Minor", inherentRating: "High", residualRating: "Low",
  riskOwner: { documentId: "user-1" }, treatmentAction: "Accept", targetDate: "2026-12-31",
};
const draftAssessment = { documentId: "assessment-1", assessmentNumber: "ASM-0001", assessmentStatus: "draft", risks: [] };
const reviewedAssessment = {
  ...draftAssessment, assessmentStatus: "in-review", reviewedBy: { documentId: "analyst-1" },
  summary: "Summary", overallRating: "High", overallRiskRationale: "Rationale", risks: [readyRisk],
};
const releasedAssessment = { ...reviewedAssessment, assessmentStatus: "approved", approvedBy: { documentId: "analyst-1" }, approvalDate: at };

type HolderRow = {
  key: string; document: Record<string, unknown>; holder: "requestor" | "analyst" | "none";
  requestor: string; requestorHref?: string; analyst: string; analystHref?: string;
  /** 13-UI-SPEC §12.1: the Requestor's sentence when a Security Analyst holds the request; absent where no analyst holds the step. */
  requestorNamed?: string;
};
const request = (fields: Record<string, unknown>) => ({ documentId: "request-1", ...fields });
const holderTable: HolderRow[] = [
  { key: "draft", document: request({ requestStatus: "draft" }), holder: "requestor",
    requestor: "Complete and submit this request.", requestorHref: "/app/requests/request-1",
    analyst: "The Requestor hasn’t submitted this request yet." },
  { key: "submitted", document: request({ requestStatus: "submitted" }), holder: "analyst",
    requestor: "Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.",
    requestorNamed: "Bob Doe is reviewing your request and will send you a questionnaire to answer.",
    analyst: "Generate the questionnaire.", analystHref: "/app/review/requests/request-1" },
  { key: "questionnaire-generated", document: request({ requestStatus: "questionnaire-in-progress", questionnaire: generatedQuestionnaire }), holder: "analyst",
    requestor: "A Security Analyst is checking your questionnaire before sending it to you.",
    requestorNamed: "Bob Doe is checking your questionnaire before sending it to you.",
    analyst: "Review and release the questionnaire.", analystHref: "/app/review/questionnaires/questionnaire-1" },
  { key: "questionnaire-released", document: request({ requestStatus: "questionnaire-in-progress", questionnaire: releasedQuestionnaire }), holder: "requestor",
    requestor: "Answer and submit the questionnaire.", requestorHref: "/app/questionnaires/questionnaire-1",
    analyst: "The Requestor is answering the questionnaire." },
  { key: "questionnaire-submitted", document: request({ requestStatus: "questionnaire-in-progress", questionnaire: submittedQuestionnaire }), holder: "analyst",
    requestor: "A Security Analyst is reviewing your answers to assess the request’s risk.",
    requestorNamed: "Bob Doe is reviewing your answers to assess the request’s risk.",
    analyst: "Draft the assessment.", analystHref: "/app/review/questionnaires/questionnaire-1" },
  { key: "assessment-drafted", document: request({ requestStatus: "risk-assessment-drafted", questionnaire: submittedQuestionnaire, assessment: draftAssessment }), holder: "analyst",
    requestor: "A Security Analyst is preparing your risk assessment.",
    requestorNamed: "Bob Doe is preparing your risk assessment.",
    analyst: "Complete the assessment review.", analystHref: "/app/review/assessments/assessment-1" },
  { key: "assessment-reviewed", document: request({ requestStatus: "under-review", questionnaire: submittedQuestionnaire, assessment: reviewedAssessment }), holder: "analyst",
    requestor: "A Security Analyst is finalising your risk assessment before releasing it to you.",
    requestorNamed: "Bob Doe is finalising your risk assessment before releasing it to you.",
    analyst: "Release the assessment.", analystHref: "/app/review/assessments/assessment-1" },
  { key: "assessment-released", document: request({ requestStatus: "approved", questionnaire: submittedQuestionnaire, assessment: releasedAssessment }), holder: "none",
    requestor: "No action is required.", analyst: "No action is required." },
];
const viewer = (actor: "requestor" | "analyst") => ({ csrmAuthorization: { assessmentRequestActor: actor } });

test("holderFor gives the D-20 holder of every lifecycle step", () => {
  const expected: Record<string, string> = {
    draft: "requestor", submitted: "analyst", "questionnaire-generated": "analyst", "questionnaire-released": "requestor",
    "questionnaire-submitted": "analyst", "assessment-drafted": "analyst", "assessment-reviewed": "analyst", "assessment-released": "none",
  };
  assert.deepEqual(REQUEST_LIFECYCLE_STEPS.map(({ key }) => [key, holderFor(key)]), Object.entries(expected), "UNEXPECTED_HOLDER_MAP");
});

test("each step's next action names its holder in the UI-SPEC §6.1 sentence for both viewers, linking only the holder's own step", () => {
  assert.deepEqual(holderTable.map(({ key }) => key), REQUEST_LIFECYCLE_STEPS.map(({ key }) => key), "TABLE_COVERS_EVERY_STEP");
  for (const row of holderTable) {
    for (const actor of ["requestor", "analyst"] as const) {
      const lifecycle = projectRequestLifecycle(row.document, viewer(actor));
      assert.equal(lifecycle.currentKey, row.key, `FIXTURE_STEP_${row.key}_${actor}`);
      const expectedHref = actor === "requestor" ? row.requestorHref : row.analystHref;
      assert.deepEqual(lifecycle.nextAction, {
        actor, holder: row.holder, summary: row[actor], ...(expectedHref ? { href: expectedHref } : {}),
      }, `NEXT_ACTION_${row.key}_${actor}`);
      // T-11-06: the viewer who does not hold the step gets no link, and a Requestor's sentence names no record.
      if (row.holder !== actor) assert.equal(lifecycle.nextAction?.href, undefined, `NO_LINK_FOR_NON_HOLDER_${row.key}_${actor}`);
      if (actor === "requestor") assert.doesNotMatch(lifecycle.nextAction?.summary ?? "", /QUES-|ASM-|questionnaire-1|assessment-1/, `REQUESTOR_SENTENCE_NAMES_NO_RECORD_${row.key}`);
      assert.doesNotMatch(lifecycle.nextAction?.summary ?? "", /other party/, `RETIRED_SENTENCE_${row.key}_${actor}`);
    }
  }
});

/*
 * D-17, 13-UI-SPEC §12.1: the Requestor reads the assigned analyst's display name at every step an analyst holds, and
 * a plain "waiting" or "A Security Analyst" sentence when nobody holds the request. The analyst's own sentences, the
 * holder and the links never change with the assignee.
 */
test("the Requestor's sentences name the assigned Security Analyst, or say nobody has picked the request up (D-17)", () => {
  for (const row of holderTable) {
    for (const assigneeName of ["Bob Doe", null, undefined, "", "   "] as const) {
      const named = typeof assigneeName === "string" && assigneeName.trim().length > 0;
      const options = assigneeName === undefined ? undefined : { assigneeName };
      const requestor = projectRequestLifecycle(row.document, viewer("requestor"), options);
      const analyst = projectRequestLifecycle(row.document, viewer("analyst"), options);
      const label = `${row.key}_${String(assigneeName)}`;
      assert.deepEqual(requestor.nextAction, {
        actor: "requestor", holder: row.holder,
        summary: named && row.requestorNamed ? row.requestorNamed : row.requestor,
        ...(row.requestorHref ? { href: row.requestorHref } : {}),
      }, `REQUESTOR_NEXT_ACTION_${label}`);
      assert.deepEqual(analyst.nextAction, {
        actor: "analyst", holder: row.holder, summary: row.analyst, ...(row.analystHref ? { href: row.analystHref } : {}),
      }, `ANALYST_NEXT_ACTION_UNCHANGED_${label}`);
      assert.equal(requestor.nextAction?.holder, holderFor(row.key as LifecycleKey), `HOLDER_UNCHANGED_${label}`);
      assert.doesNotMatch(requestor.nextAction?.summary ?? "", /^The Security Analyst is/, `OLD_HOLDER_SENTENCE_${label}`);
    }
  }
  // The name is served as given: the display name, never more (D-04, D-17).
  assert.equal(
    projectRequestLifecycle(holderTable[1].document, viewer("requestor"), { assigneeName: "Dr Ana O’Neil-Smith" }).nextAction?.summary,
    "Dr Ana O’Neil-Smith is reviewing your request and will send you a questionnaire to answer.",
    "NAME_NOT_SERVED_AS_GIVEN",
  );
});

test("a closed request has no next action and no holder", () => {
  const closed = request({ requestStatus: "closed", questionnaire: submittedQuestionnaire, assessment: releasedAssessment });
  for (const actor of ["requestor", "analyst"] as const) {
    const lifecycle = projectRequestLifecycle(closed, viewer(actor));
    assert.equal(lifecycle.terminal, true, `CLOSED_TERMINAL_${actor}`);
    assert.equal(lifecycle.nextAction, null, `CLOSED_HAS_NO_NEXT_ACTION_${actor}`);
  }
});
