import assert from "node:assert/strict";
import test from "node:test";

import { deriveRequestLifecycle, projectRequestLifecycle, REQUEST_LIFECYCLE_STEPS, type RequestLifecycleFacts } from "../src/api/csrm-assessment-request/services/request-lifecycle";

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
