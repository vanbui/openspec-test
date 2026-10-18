import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

type Harness = Awaited<typeof harnessPromise>;
type Row = Record<string, unknown>;

/*
 * WR-210: every case decides on a draft of its own, generated for a fresh UAT-A-like request, so no case depends on
 * what another left behind, and each Risk is found by what it is, never by where a relation populate put it. The
 * deterministic draft of that request holds five Risks: Internet Exposure (Treat, on the internet-facing system, with
 * suggested controls), Personal Information Handling twice (the personal data on the Restricted asset, and the
 * Privacy Act obligation; both Treat, with suggested controls), Third-Party Dependency (an AI Accept, with none) and,
 * since WR-204, a Risk of no type for the untested pay-run fallback (Treat, citing that answer, with an uncited claim).
 */
type Draft = {
  harness: Harness;
  assessmentId: string;
  runId: string;
  path: string;
  risks: { internet: string; personal: string; regulatory: string; accept: string };
  /** Every Risk of the draft, in risk-number order (the analyst page's). */
  riskIds: string[];
  controlIds: string[];
};

async function draftOf(label: string): Promise<Draft> {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const { controlIds } = await harness.seedUatALikeFixture();
  const { questionnaireId } = await harness.seedUatALikeRequest(`DECISIONS-${label}`);
  const queued = await harness.request({ path: `/api/v1/questionnaires/${questionnaireId}/generate_assessment`,
    identity: harness.identities.analyst, init: { method: "POST" } });
  assert.equal(queued.status, 202, await queued.clone().text());
  const { data: job } = await queued.json() as { data: { jobId: string } };
  let assessmentId = "";
  for (let attempt = 0; attempt < 100 && !assessmentId; attempt += 1) {
    const response = await harness.request({ path: `/api/v1/assessment_draft_jobs/${job.jobId}`, identity: harness.identities.analyst });
    const { data } = await response.json() as { data: { status: string; assessmentId?: string } };
    if (data.status === "failed") assert.fail(`the ${label} draft failed`);
    if (data.status === "completed") assessmentId = String(data.assessmentId);
    else await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(assessmentId, `the ${label} draft completed`);
  const listed = await harness.listRisksForAssessment(assessmentId);
  assert.equal(listed.length, 5, `DRAFT_RISK_COUNT_${label}`);
  const typeOf = (risk: Row) => (risk.riskType as { name?: unknown } | null)?.name;
  const one = (name: string, predicate: (risk: Row) => boolean): string => {
    const found = listed.filter(predicate);
    assert.equal(found.length, 1, `DRAFT_RISK_${name}_${label}`);
    return String(found[0].documentId);
  };
  const runId = ((await harness.getAssessment(assessmentId))?.aiProvenance as { runId?: string } | null)?.runId;
  assert.ok(runId, `the ${label} draft names its run`);
  return {
    harness, assessmentId, runId, controlIds, path: `/api/v1/risk_assessments/${assessmentId}/ai_proposal_decisions`,
    risks: {
      internet: one("INTERNET_EXPOSURE", (risk) => typeOf(risk) === "Internet Exposure"),
      personal: one("PERSONAL_DATA", (risk) => typeOf(risk) === "Personal Information Handling" && risk.riskSubCategory === "Personal information handling"),
      regulatory: one("PRIVACY_OBLIGATION", (risk) => typeOf(risk) === "Personal Information Handling" && risk.riskSubCategory === "Regulatory compliance"),
      accept: one("AI_ACCEPT", (risk) => typeOf(risk) === "Third-Party Dependency" && risk.treatmentAction === "Accept"),
    },
    riskIds: listed.map((risk) => String(risk.documentId)),
  };
}

function body(decisions: unknown[]) {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisions }) };
}

function json(method: string, payload: unknown) {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}

type Suggestion = { key: string; control: string; controlNumber: string; rationale: string; state: string; by?: string; at?: string;
  implementation?: string; implementationSnapshot?: Record<string, unknown> };
type RiskEnvelope = { runId: string; fields: Record<string, { state: string }>; suggestions: Suggestion[] };

async function envelopeOf(harness: Harness, riskId: string): Promise<RiskEnvelope> {
  const risk = await harness.getRisk(riskId);
  assert.ok(risk?.aiProvenance, `RISK_HAS_NO_PROVENANCE_${riskId}`);
  return risk.aiProvenance as RiskEnvelope;
}

async function reasonOf(response: Response): Promise<string | undefined> {
  return (await response.json() as { error: { details?: { reason?: string } } }).error.details?.reason;
}

async function lastDecision(harness: Harness, runId: string): Promise<unknown> {
  return ((await harness.getAiRun(runId))?.decisions as unknown[]).at(-1);
}

/*
 * Brings a draft to release-ready: the details and each Risk's required fields are completed (every Risk is set to
 * Accept, which needs no mitigation control), every AI proposal still proposed is confirmed, and a draft the edits left
 * in draft is reviewed again. The Third-Party Dependency Risk keeps the AI's own Accept, which is confirmed.
 */
async function makeReleaseReady({ harness, assessmentId, riskIds, path }: Draft): Promise<void> {
  const assessmentPath = `/api/v1/risk_assessments/${assessmentId}`;
  const update = await harness.request({ path: assessmentPath, identity: harness.identities.analyst,
    init: json("PATCH", { summary: "Ready for review", overallRating: "High", overallRiskRationale: "Review is complete" }) });
  assert.equal(update.status, 200, await update.clone().text());
  for (const riskId of riskIds) {
    const risk = await harness.getRisk(riskId);
    const response = await harness.request({ path: `/api/v1/risks/${riskId}`, identity: harness.identities.analyst, init: json("PATCH", {
      riskStatement: risk?.riskStatement, inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "High",
      residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate",
      riskOwner: harness.users.owner, treatmentAction: "Accept", targetDate: "2027-08-30",
    }) });
    assert.equal(response.status, 200, await response.clone().text());
  }
  const proposedOf = (record: Row | null) => Object.entries((record?.aiProvenance as { fields?: Record<string, { state: string }> } | undefined)?.fields ?? {})
    .filter(([, fact]) => fact.state === "proposed").map(([field]) => field);
  const reviewDecisions: Array<{ target: { kind: "assessment" } | { kind: "risk"; riskId: string }; action: "accept"; fields: string[] }> = [];
  const assessmentFields = proposedOf(await harness.getAssessment(assessmentId));
  if (assessmentFields.length) reviewDecisions.push({ target: { kind: "assessment" }, action: "accept", fields: assessmentFields });
  for (const riskId of riskIds) {
    const fields = proposedOf(await harness.getRisk(riskId));
    if (fields.length) reviewDecisions.push({ target: { kind: "risk", riskId }, action: "accept", fields });
  }
  if (reviewDecisions.length) {
    const reviewed = await harness.request({ path, identity: harness.identities.analyst, init: body(reviewDecisions) });
    assert.equal(reviewed.status, 200, await reviewed.clone().text());
  }
  if ((await harness.getAssessment(assessmentId))?.assessmentStatus === "draft") {
    const review = await harness.request({ path: assessmentPath, identity: harness.identities.analyst,
      init: json("PATCH", { recommendationsSummary: "Reviewed again" }) });
    assert.equal(review.status, 200, await review.clone().text());
  }
  const detail = await harness.request({ path: assessmentPath, identity: harness.identities.analyst });
  assert.equal(detail.status, 200);
  assert.equal(((await detail.json() as { data: { releaseReadiness: { ready: boolean } } }).data.releaseReadiness).ready, true, "THE_DRAFT_IS_NOT_RELEASE_READY");
}

test("mounted proposal decisions confirm a field, preserve provenance, and repeat without writes", async () => {
  const { harness, assessmentId, risks, path } = await draftOf("CONFIRM");
  const riskId = risks.internet;
  const decision = { target: { kind: "risk", riskId }, action: "accept", fields: ["riskStatement"] };
  const first = await harness.request({ path, identity: harness.identities.analyst, init: body([decision]) });
  assert.equal(first.status, 200, await first.clone().text());
  assert.deepEqual((await first.json() as { data: unknown }).data, { applied: 1, unchanged: 0 });
  const risk = await harness.getRisk(riskId);
  assert.ok(risk);
  const fact = (risk.aiProvenance as { fields: Record<string, { state: string; by: string; at: string }> }).fields.riskStatement;
  assert.equal(fact.state, "accepted");
  assert.equal(fact.by, harness.users.analyst);
  assert.ok(Date.parse(fact.at));
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "in-review");
  const runId = (risk.aiProvenance as { runId: string }).runId;
  const run = await harness.getAiRun(runId);
  assert.ok(run);
  assert.deepEqual((run.decisions as Array<{ kind: string; target: string; fields: string[] }>).at(-1),
    { schemaVersion: 1, kind: "accepted", at: fact.at, by: harness.users.analyst, target: riskId, fields: ["riskStatement"] });
  const before = await harness.snapshot([() => harness.getRisk(riskId), () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]);
  const repeated = await harness.request({ path, identity: harness.identities.analyst, init: body([decision]) });
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json() as { data: unknown }).data, { applied: 0, unchanged: 1 });
  assert.deepEqual(await harness.snapshot([() => harness.getRisk(riskId), () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]), before);
});

test("mounted proposal decisions refuse other actors without writes", async () => {
  const { harness, assessmentId, risks, runId, path } = await draftOf("ACTORS");
  const riskId = risks.personal;
  const snapshot = () => harness.snapshot([() => harness.getRisk(riskId), () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]);
  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.serviceAnalystAgent]) {
    const before = await snapshot();
    const response = await harness.request({ path, identity, init: body([{ target: { kind: "risk", riskId }, action: "accept", fields: ["riskStatement"] }]) });
    assert.equal(response.status, 403);
    assert.deepEqual(await snapshot(), before);
  }
});

test("proposal batch bounds, conflicts and planned-control refusal are atomic", async () => {
  const { harness, assessmentId, risks, runId, controlIds, path } = await draftOf("BOUNDS");
  const [controlId] = controlIds;
  const riskId = risks.accept;
  const snapshot = () => harness.snapshot([() => harness.getRisk(riskId), () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]);
  const proposed = { target: { kind: "risk", riskId }, action: "accept", fields: ["treatmentAction"] };
  for (const decisions of [[], Array.from({ length: 201 }, () => proposed), [{ ...proposed, suggestion: "unknown" }],
    /* WR-106: an action or a target kind that only coerces to one of its closed strings is refused, never read as another. */
    [{ ...proposed, action: ["accept"] }], [{ ...proposed, action: {} }], [{ ...proposed, action: 1 }],
    [{ ...proposed, target: { kind: ["risk"], riskId } }]]) {
    const before = await snapshot();
    const response = await harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
    assert.equal(response.status, 400, `${JSON.stringify(decisions).slice(0, 120)}: ${await response.clone().text()}`);
    assert.deepEqual(await snapshot(), before);
  }
  const created = await harness.request({ path: `/api/v1/risks/${riskId}/control_implementations`, identity: harness.identities.analyst,
    init: json("POST", { control: controlId, controlStatus: "Planned" }) });
  assert.equal(created.status, 201, await created.clone().text());
  const implementationId = String((await created.json() as { data: { documentId: string } }).data.documentId);
  for (const decisions of [[proposed], [{ target: { kind: "risk", riskId }, action: "accept" }]]) {
    const before = await snapshot();
    const response = await harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
    assert.equal(response.status, 409, await response.clone().text());
    assert.equal(((await response.json() as { error: { details: { reason: string } } }).error.details).reason, "AI_ACCEPT_WITH_PLANNED_CONTROL");
    assert.deepEqual(await snapshot(), before);
  }
  const other = await harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action: "accept", fields: ["riskStatement"] }]) });
  assert.equal(other.status, 200, await other.clone().text());
  const removed = await harness.request({ path: `/api/v1/control_implementations/${implementationId}`, identity: harness.identities.analyst, init: { method: "DELETE" } });
  assert.equal(removed.status, 204, await removed.clone().text());
  const confirmed = await harness.request({ path, identity: harness.identities.analyst, init: body([proposed]) });
  assert.equal(confirmed.status, 200, await confirmed.clone().text());
  const restored = await harness.request({ path, identity: harness.identities.analyst,
    init: body([{ ...proposed, action: "restore" }]) });
  assert.equal(restored.status, 200, await restored.clone().text());
  assert.equal(((await harness.getRisk(riskId))?.aiProvenance as { fields: Record<string, { state: string }> }).fields.treatmentAction.state, "proposed");
  const beforeConflict = await snapshot();
  const conflict = await harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action: "accept", fields: ["riskCategory"] },
      { target: { kind: "risk", riskId }, action: "accept", fields: ["unknownField"] }]) });
  assert.equal(conflict.status, 400);
  assert.deepEqual(await snapshot(), beforeConflict);
  /* A Risk of another assessment is refused in its own case below, with AI facts only the parent check can refuse. */
  for (const decisions of [
    [{ target: { kind: "risk", riskId: "unknown-risk" }, action: "accept", fields: ["riskStatement"] }],
    [{ target: { kind: "risk", riskId }, action: "accept", fields: ["comments"] }],
  ]) {
    const before = await snapshot();
    const response = await harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
    assert.equal(response.status, 400);
    assert.deepEqual(await snapshot(), before);
  }
  const implemented = await harness.request({ path: `/api/v1/risks/${riskId}/control_implementations`, identity: harness.identities.analyst,
    init: json("POST", { control: controlId, controlStatus: "Implemented" }) });
  assert.equal(implemented.status, 201, await implemented.clone().text());
  assert.equal((await harness.request({ path, identity: harness.identities.analyst, init: body([proposed]) })).status, 200);
  const treatRiskId = risks.personal;
  assert.equal((await harness.request({ path: `/api/v1/risks/${treatRiskId}/control_implementations`, identity: harness.identities.analyst,
    init: json("POST", { control: controlId, controlStatus: "Planned" }) })).status, 201);
  assert.equal((await harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId: treatRiskId }, action: "accept", fields: ["treatmentAction"] }]) })).status, 200);
});

/* IN-206 (D-24): the batch bound accepts its edge: 200 decisions, one that applies and 199 exact repeats of it. */
test("a batch of exactly 200 decisions is accepted: one applies and 199 repeat it", async () => {
  const { harness, risks, path } = await draftOf("BATCH-EDGE");
  const decision = { target: { kind: "risk", riskId: risks.internet }, action: "accept", fields: ["riskStatement"] };
  const response = await harness.request({ path, identity: harness.identities.analyst, init: body(Array.from({ length: 200 }, () => decision)) });
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual((await response.json() as { data: unknown }).data, { applied: 1, unchanged: 199 }, "THE_BATCH_AT_ITS_BOUND_WAS_NOT_ACCEPTED");
  assert.equal((await envelopeOf(harness, risks.internet)).fields.riskStatement.state, "accepted");
});

/*
 * CR-202: a decision reaches only the Risks of the assessment in its path. Each foreign Risk here carries AI facts the
 * decision would otherwise take (a proposed risk statement and a proposed suggestion, over a run that records events),
 * so only the parent check can refuse it: a Risk of another draft, and the seeded released assessment's Risk, given a
 * readable record for this case. Nothing changes on either assessment, and no control is added to the foreign Risk.
 */
test("a decision can't reach a Risk of another assessment, even one whose AI facts it could take", async () => {
  const draft = await draftOf("PARENT");
  const other = await draftOf("PARENT-OTHER");
  const { harness, assessmentId, runId, controlIds, path } = draft;
  const seeded = await harness.seedAssessmentWorkflowFixtures();
  const releasedRiskId = seeded.aggregate.risk;
  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", releasedRiskId, { aiProvenance: {
    schemaVersion: 1, runId: other.runId, proposalKey: "risk-1", uncitedClaims: [], adjustments: [],
    fields: { riskStatement: { state: "proposed", sources: [] } },
    suggestions: [{ key: "released-suggestion", control: controlIds[1], controlNumber: "UATA-002", rationale: "Seeded so the released Risk has an AI suggestion.", state: "proposed" }],
  } });
  try {
    for (const [name, foreignRiskId, foreignAssessmentId] of [
      ["ANOTHER_DRAFT", other.risks.internet, other.assessmentId],
      ["A_RELEASED_ASSESSMENT", releasedRiskId, seeded.aggregate.assessment],
    ] as const) {
      const foreign = await envelopeOf(harness, foreignRiskId);
      const suggestion = foreign.suggestions.find((item) => item.state === "proposed");
      assert.equal(foreign.fields.riskStatement?.state, "proposed", `CR202_${name}_HAS_NO_PROPOSED_FIELD`);
      assert.ok(suggestion, `CR202_${name}_HAS_NO_PROPOSED_SUGGESTION`);
      const snapshot = async () => [await harness.snapshot([() => harness.getRisk(foreignRiskId), () => harness.getAssessment(foreignAssessmentId),
        () => harness.getAiRun(foreign.runId), () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]),
      await harness.countControlImplementationsForRisk(foreignRiskId)];
      for (const [kind, decision] of [
        ["FIELD", { target: { kind: "risk", riskId: foreignRiskId }, action: "accept", fields: ["riskStatement"] }],
        ["SUGGESTION", { target: { kind: "risk", riskId: foreignRiskId }, action: "accept", suggestion: suggestion.key }],
      ] as const) {
        const before = await snapshot();
        const response = await harness.request({ path, identity: harness.identities.analyst, init: body([decision]) });
        assert.equal(response.status, 400, `CR202_${name}_${kind}: ${await response.clone().text()}`);
        assert.deepEqual(await snapshot(), before, `CR202_${name}_${kind}_CHANGED_PERSISTENCE`);
      }
    }
  } finally {
    await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", releasedRiskId, { aiProvenance: null });
  }
});

test("an edited field conflicts atomically and a released assessment is immutable", async () => {
  const { harness, assessmentId, risks, path } = await draftOf("EDITED");
  const releasedAssessmentId = (await harness.seedAssessmentWorkflowFixtures()).releaseFacts.complete;
  const editedRiskId = risks.personal;
  const otherRiskId = risks.regulatory;
  const edit = await harness.request({ path: `/api/v1/risks/${editedRiskId}`, identity: harness.identities.analyst,
    init: json("PATCH", { riskStatement: "Analyst revised statement" }) });
  assert.equal(edit.status, 200, await edit.clone().text());
  const snapshot = () => harness.snapshot([() => harness.getRisk(editedRiskId), () => harness.getRisk(otherRiskId),
    () => harness.getAssessment(assessmentId)]);
  for (const action of ["accept", "restore"]) {
    const before = await snapshot();
    const response = await harness.request({ path, identity: harness.identities.analyst, init: body([
      { target: { kind: "risk", riskId: otherRiskId }, action: "accept", fields: ["riskStatement"] },
      { target: { kind: "risk", riskId: editedRiskId }, action, fields: ["riskStatement"] },
    ]) });
    assert.equal(response.status, 409);
    assert.equal((await response.json() as { error: { details: { reason: string } } }).error.details.reason, "AI_PROPOSAL_ALREADY_DECIDED");
    assert.deepEqual(await snapshot(), before);
  }
  const releasedSnapshot = () => harness.snapshot([() => harness.getAssessment(releasedAssessmentId)]);
  const before = await releasedSnapshot();
  const released = await harness.request({ path: `/api/v1/risk_assessments/${releasedAssessmentId}/ai_proposal_decisions`, identity: harness.identities.analyst,
    init: body([{ target: { kind: "assessment" }, action: "accept", fields: ["summary"] }]) });
  assert.equal(released.status, 409);
  assert.equal((await released.json() as { error: { details: { reason: string } } }).error.details.reason, "ASSESSMENT_NOT_MUTABLE");
  assert.deepEqual(await releasedSnapshot(), before);
});

test("assessment details and all remaining risk fields can be confirmed together", async () => {
  const { harness, assessmentId, risks, path } = await draftOf("TOGETHER");
  const riskId = risks.regulatory;
  const response = await harness.request({ path, identity: harness.identities.analyst, init: body([
    { target: { kind: "assessment" }, action: "accept", fields: ["overallRating"] },
    { target: { kind: "risk", riskId }, action: "accept" },
  ]) });
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual((await response.json() as { data: unknown }).data, { applied: 2, unchanged: 0 });
  const assessment = await harness.getAssessment(assessmentId);
  const risk = await harness.getRisk(riskId);
  assert.ok(assessment && risk);
  assert.equal((assessment.aiProvenance as { fields: Record<string, { state: string }> }).fields.overallRating.state, "accepted");
  assert.equal(Object.values((risk.aiProvenance as { fields: Record<string, { state: string }> }).fields).some((field) => field.state === "proposed"), false);
  const repeated = await harness.request({ path, identity: harness.identities.analyst, init: body([
    { target: { kind: "assessment" }, action: "accept", fields: ["overallRating"] },
  ]) });
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json() as { data: unknown }).data, { applied: 0, unchanged: 1 });
});

/*
 * WR-102 (D-24: an exact repeat is a no-op). "Confirm remaining" is an accept without fields: it confirms the fields
 * still proposed. Sent again (a lost response, a double submit), it confirms nothing and changes nothing, and a batch
 * holding it still applies its other decisions. A field restore names the fields it restores: without them it read the
 * proposed fields, which a restore never changes, so it could never restore one.
 */
test("Confirm remaining sent again changes nothing, and a field restore names its fields", async () => {
  const { harness, assessmentId, risks, runId, path } = await draftOf("CONFIRM-REMAINING");
  const send = (decisions: unknown[]) => harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
  const snapshot = () => harness.snapshot([() => harness.getRisk(risks.regulatory), () => harness.getRisk(risks.internet),
    () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]);
  const proposedOf = async (riskId: string) => Object.entries((await envelopeOf(harness, riskId)).fields)
    .filter(([, fact]) => fact.state === "proposed").map(([name]) => name);

  for (const target of [{ kind: "risk", riskId: risks.regulatory }, { kind: "assessment" }]) {
    const first = await send([{ target, action: "accept" }]);
    assert.equal(first.status, 200, await first.clone().text());
    assert.deepEqual((await first.json() as { data: unknown }).data, { applied: 1, unchanged: 0 });
    const before = await snapshot();
    const repeated = await send([{ target, action: "accept" }]);
    assert.equal(repeated.status, 200, `WR102_REPEAT_${target.kind}: ${await repeated.clone().text()}`);
    assert.deepEqual((await repeated.json() as { data: unknown }).data, { applied: 0, unchanged: 1 });
    assert.deepEqual(await snapshot(), before, `WR102_REPEAT_${target.kind}_CHANGED_PERSISTENCE`);
  }
  assert.deepEqual(await proposedOf(risks.regulatory), []);

  const mixed = await send([{ target: { kind: "risk", riskId: risks.regulatory }, action: "accept" },
    { target: { kind: "risk", riskId: risks.internet }, action: "accept", fields: ["riskStatement"] }]);
  assert.equal(mixed.status, 200, `WR102_REPEAT_IN_A_BATCH: ${await mixed.clone().text()}`);
  assert.deepEqual((await mixed.json() as { data: unknown }).data, { applied: 1, unchanged: 1 });
  assert.equal((await envelopeOf(harness, risks.internet)).fields.riskStatement.state, "accepted");

  /* The Internet Exposure Risk still holds proposed fields, which a restore without fields read and never restored. */
  const unnamedBefore = await snapshot();
  for (const target of [{ kind: "risk", riskId: risks.internet }, { kind: "assessment" }]) {
    const unnamed = await send([{ target, action: "restore" }]);
    assert.equal(unnamed.status, 400, `WR102_UNNAMED_RESTORE_${target.kind}: ${await unnamed.clone().text()}`);
    assert.deepEqual(await snapshot(), unnamedBefore, `WR102_UNNAMED_RESTORE_${target.kind}_CHANGED_PERSISTENCE`);
  }
  const named = await send([{ target: { kind: "risk", riskId: risks.regulatory }, action: "restore", fields: ["riskStatement"] }]);
  assert.equal(named.status, 200, await named.clone().text());
  assert.deepEqual((await named.json() as { data: unknown }).data, { applied: 1, unchanged: 0 });
  assert.deepEqual(await proposedOf(risks.regulatory), ["riskStatement"]);
});

test("a suggested control is added as Planned in one decision, and Undo removes it only while nobody changed it", async () => {
  const { harness, assessmentId, risks, path } = await draftOf("SUGGESTION");
  const riskId = risks.internet;
  const start = await envelopeOf(harness, riskId);
  const suggestion = start.suggestions.find((item) => item.state === "proposed");
  assert.ok(suggestion, "the Treat risk carries a proposed suggestion");
  const decide = (action: string, key = suggestion.key) => harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action, suggestion: key }]) });
  const countBefore = await harness.countControlImplementationsForRisk(riskId);

  const manual = await harness.request({ path: `/api/v1/risks/${riskId}/control_implementations`, identity: harness.identities.analyst,
    init: json("POST", { controlStatus: "Planned" }) });
  assert.equal(manual.status, 400, "the manual add path still validates its body");

  const added = await decide("accept");
  assert.equal(added.status, 200, await added.clone().text());
  assert.deepEqual((await added.json() as { data: unknown }).data, { applied: 1, unchanged: 0 });
  const afterAdd = await envelopeOf(harness, riskId);
  const item = afterAdd.suggestions.find((entry) => entry.key === suggestion.key);
  assert.ok(item?.implementation);
  assert.equal(item.state, "added");
  assert.equal(item.by, harness.users.analyst);
  const implementation = await harness.getControlImplementation(item.implementation);
  assert.equal(implementation?.controlStatus, "Planned");
  assert.equal((implementation?.control as { documentId: string }).documentId, suggestion.control);
  assert.equal(item.implementationSnapshot?.control, suggestion.control);
  assert.equal(item.implementationSnapshot?.controlStatus, "Planned");
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countBefore + 1);
  assert.deepEqual(await lastDecision(harness, afterAdd.runId), { schemaVersion: 1, kind: "accepted", at: item.at, by: harness.users.analyst,
    target: riskId, item: suggestion.key, implementation: item.implementation });
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "in-review");

  /* WR-106: `["accept"]` once passed the closed parse as "accept" and was carried out as a restore, removing this control. */
  const addedId = item.implementation;
  const addedSnapshot = () => harness.snapshot([() => harness.getRisk(riskId), () => harness.getControlImplementation(addedId),
    () => harness.getAiRun(afterAdd.runId), () => harness.getAssessment(assessmentId)]);
  const beforeCoerced = await addedSnapshot();
  for (const action of [["accept"], {}, 1]) {
    const response = await harness.request({ path, identity: harness.identities.analyst,
      init: body([{ target: { kind: "risk", riskId }, action, suggestion: suggestion.key }]) });
    assert.equal(response.status, 400, `WR106_SUGGESTION_ACTION_${JSON.stringify(action)}: ${await response.clone().text()}`);
    assert.deepEqual(await addedSnapshot(), beforeCoerced, `WR106_SUGGESTION_ACTION_${JSON.stringify(action)}_CHANGED_PERSISTENCE`);
  }
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countBefore + 1);

  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", riskId, { aiProvenance: { ...afterAdd, suggestions: [...afterAdd.suggestions,
    { key: "seeded-present", control: suggestion.control, controlNumber: suggestion.controlNumber, rationale: "Seeded for the present case.", state: "proposed" }] } });
  const present = await decide("accept", "seeded-present");
  assert.equal(present.status, 200, await present.clone().text());
  assert.deepEqual((await present.json() as { data: unknown }).data, { applied: 0, unchanged: 1 });
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countBefore + 1);
  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", riskId, { aiProvenance: afterAdd });

  const undone = await decide("restore");
  assert.equal(undone.status, 200, await undone.clone().text());
  const afterUndo = (await envelopeOf(harness, riskId)).suggestions.find((entry) => entry.key === suggestion.key);
  assert.equal(afterUndo?.state, "proposed");
  assert.equal(afterUndo?.implementation, undefined);
  assert.equal(await harness.getControlImplementation(item.implementation), null);
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countBefore);
  assert.deepEqual(await lastDecision(harness, afterAdd.runId), { schemaVersion: 1, kind: "restored", at: afterUndo?.at, by: harness.users.analyst,
    target: riskId, item: suggestion.key, implementation: item.implementation });

  assert.equal((await decide("accept")).status, 200);
  const readded = (await envelopeOf(harness, riskId)).suggestions.find((entry) => entry.key === suggestion.key)?.implementation;
  assert.ok(readded);
  const edited = await harness.request({ path: `/api/v1/control_implementations/${readded}`, identity: harness.identities.analyst,
    init: json("PATCH", { evidence: "Analyst evidence" }) });
  assert.equal(edited.status, 200, await edited.clone().text());
  const snapshot = () => harness.snapshot([() => harness.getRisk(riskId), () => harness.getControlImplementation(readded),
    () => harness.getAiRun(afterAdd.runId), () => harness.getAssessment(assessmentId)]);
  const beforeRefusal = await snapshot();
  const refused = await decide("restore");
  assert.equal(refused.status, 409);
  assert.equal(await reasonOf(refused), "AI_SUGGESTION_CONTROL_CHANGED");
  assert.deepEqual(await snapshot(), beforeRefusal);

  const removed = await harness.request({ path: `/api/v1/control_implementations/${readded}`, identity: harness.identities.analyst, init: { method: "DELETE" } });
  assert.equal(removed.status, 204, await removed.clone().text());
  const restoredAfterRemoval = await decide("restore");
  assert.equal(restoredAfterRemoval.status, 200, await restoredAfterRemoval.clone().text());
  assert.equal((await envelopeOf(harness, riskId)).suggestions.find((entry) => entry.key === suggestion.key)?.state, "proposed");
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countBefore);
});

/*
 * CR-02 (D-12, UI-D12). A suggestion is `added` while the planned control it created exists. When an analyst removes
 * that control through the ordinary route, the suggestion goes back to proposed in the same change, as its Undo leaves
 * it, and the run's history records the `restored` event, so the page offers Add again and the review record never says
 * a removed control is added. A history that can't take the event refuses the removal, and nothing changes. A record
 * kept `added` after its control was removed before this rule reads as proposed, and adding it again works.
 */
test("removing a planned control an AI suggestion added proposes the suggestion again, and it can be added again", async () => {
  const { harness, assessmentId, risks, runId, path } = await draftOf("REMOVED-CONTROL");
  const accept = (riskId: string, key: string) => harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action: "accept", suggestion: key }]) });
  const remove = (implementationId: string) => harness.request({ path: `/api/v1/control_implementations/${implementationId}`,
    identity: harness.identities.analyst, init: { method: "DELETE" } });
  const suggestionOf = async (riskId: string, key: string) => (await envelopeOf(harness, riskId)).suggestions.find((item) => item.key === key);
  type PageSuggestion = { key: string; state: string; implementation: string | null; by: unknown; at: string | null };
  const pageSuggestion = async (riskId: string, key: string): Promise<PageSuggestion | undefined> => {
    const detail = await harness.request({ path: `/api/v1/risk_assessments/${assessmentId}`, identity: harness.identities.analyst });
    assert.equal(detail.status, 200, await detail.clone().text());
    const { data } = await detail.json() as { data: { risks: Array<{ documentId: string; aiProvenance: { suggestions: PageSuggestion[] } | null }> } };
    return data.risks.find((risk) => risk.documentId === riskId)?.aiProvenance?.suggestions.find((item) => item.key === key);
  };

  const riskId = risks.internet;
  const suggestion = (await envelopeOf(harness, riskId)).suggestions.find((item) => item.state === "proposed");
  assert.ok(suggestion, "the Treat risk carries a proposed suggestion");
  const added = await accept(riskId, suggestion.key);
  assert.equal(added.status, 200, await added.clone().text());
  const implementationId = (await suggestionOf(riskId, suggestion.key))?.implementation;
  assert.ok(implementationId, "the suggestion added a planned control");
  const countAfterAdd = await harness.countControlImplementationsForRisk(riskId);

  const removed = await remove(implementationId);
  assert.equal(removed.status, 204, await removed.clone().text());
  assert.equal(await harness.getControlImplementation(implementationId), null);
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countAfterAdd - 1);
  const restored = await suggestionOf(riskId, suggestion.key);
  assert.equal(restored?.state, "proposed", "CR02_REMOVED_CONTROL_LEFT_THE_SUGGESTION_ADDED");
  assert.equal(restored?.implementation, undefined);
  assert.equal(restored?.implementationSnapshot, undefined);
  assert.equal(restored?.by, harness.users.analyst);
  assert.deepEqual(await lastDecision(harness, runId), { schemaVersion: 1, kind: "restored", at: restored?.at, by: harness.users.analyst,
    target: riskId, item: suggestion.key, implementation: implementationId });
  const offered = await pageSuggestion(riskId, suggestion.key);
  assert.deepEqual({ state: offered?.state, implementation: offered?.implementation }, { state: "proposed", implementation: null }, "CR02_PAGE_DOES_NOT_OFFER_ADD");

  const readded = await accept(riskId, suggestion.key);
  assert.equal(readded.status, 200, await readded.clone().text());
  assert.deepEqual((await readded.json() as { data: unknown }).data, { applied: 1, unchanged: 0 });
  const again = await suggestionOf(riskId, suggestion.key);
  assert.equal(again?.state, "added");
  assert.ok(again?.implementation && again.implementation !== implementationId, "a new planned control");
  assert.equal((await harness.getControlImplementation(again.implementation))?.controlStatus, "Planned");
  assert.equal(await harness.countControlImplementationsForRisk(riskId), countAfterAdd);

  /* A history that can't take the `restored` event refuses the removal, and nothing changes (WR-103). */
  const refusedRiskId = risks.personal;
  const refusedSuggestion = (await envelopeOf(harness, refusedRiskId)).suggestions.find((item) => item.state === "proposed");
  assert.ok(refusedSuggestion);
  assert.equal((await accept(refusedRiskId, refusedSuggestion.key)).status, 200);
  const refusedImplementationId = (await suggestionOf(refusedRiskId, refusedSuggestion.key))?.implementation;
  assert.ok(refusedImplementationId);
  const history = (await harness.getAiRun(runId))?.decisions;
  await harness.updateAiRunFixture(runId, { decisions: [{ schemaVersion: 99 }] });
  const refusedSnapshot = async () => [await harness.snapshot([() => harness.getRisk(refusedRiskId), () => harness.getControlImplementation(refusedImplementationId),
    () => harness.getAssessment(assessmentId), () => harness.getAiRun(runId)]), await harness.countControlImplementationsForRisk(refusedRiskId)];
  const beforeRefusal = await refusedSnapshot();
  const refused = await remove(refusedImplementationId);
  assert.equal(refused.status, 409, `CR02_UNRECORDABLE_REMOVAL: ${await refused.clone().text()}`);
  assert.equal(await reasonOf(refused), "AI_RUN_RECORD_UNAVAILABLE");
  assert.deepEqual(await refusedSnapshot(), beforeRefusal, "CR02_UNRECORDABLE_REMOVAL_CHANGED_PERSISTENCE");
  await harness.updateAiRunFixture(runId, { decisions: history });

  /* A record kept `added` after its control was removed, before this rule: the page reads it as proposed, and Add works. */
  const legacyRiskId = risks.regulatory;
  const legacy = await envelopeOf(harness, legacyRiskId);
  const legacySuggestion = legacy.suggestions.find((item) => item.state === "proposed");
  assert.ok(legacySuggestion);
  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", legacyRiskId, { aiProvenance: { ...legacy, suggestions: legacy.suggestions.map((item) => item.key === legacySuggestion.key
    ? { ...item, state: "added", by: harness.users.analyst, at: "2026-10-01T00:00:00.000Z", implementation: "removed-before-cr02", implementationSnapshot: { control: item.control, controlStatus: "Planned" } }
    : item) } });
  const legacyOffered = await pageSuggestion(legacyRiskId, legacySuggestion.key);
  assert.deepEqual({ state: legacyOffered?.state, implementation: legacyOffered?.implementation, by: legacyOffered?.by, at: legacyOffered?.at },
    { state: "proposed", implementation: null, by: null, at: null }, "CR02_STALE_RECORD_NOT_RECONCILED");
  const legacyCount = await harness.countControlImplementationsForRisk(legacyRiskId);
  const legacyAdded = await accept(legacyRiskId, legacySuggestion.key);
  assert.equal(legacyAdded.status, 200, await legacyAdded.clone().text());
  assert.deepEqual((await legacyAdded.json() as { data: unknown }).data, { applied: 1, unchanged: 0 }, "CR02_STALE_RECORD_NOT_ACTIONABLE");
  const legacyAgain = await suggestionOf(legacyRiskId, legacySuggestion.key);
  assert.equal(legacyAgain?.state, "added");
  assert.ok(legacyAgain?.implementation && legacyAgain.implementation !== "removed-before-cr02");
  assert.equal(await harness.countControlImplementationsForRisk(legacyRiskId), legacyCount + 1);
});

test("restoring a confirmed field withdraws a release-ready review", async () => {
  const draft = await draftOf("WITHDRAW");
  const { harness, assessmentId, risks, path } = draft;
  await makeReleaseReady(draft);
  const riskId = risks.accept;
  assert.equal(((await harness.getRisk(riskId))?.aiProvenance as { fields: Record<string, { state: string }> }).fields.treatmentAction.state, "accepted");
  const restored = await harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action: "restore", fields: ["treatmentAction"] }]) });
  assert.equal(restored.status, 200, await restored.clone().text());
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "draft");
});

test("dismissing a suggestion and restoring the dismissal never record or withdraw a review", async () => {
  const draft = await draftOf("DISMISS");
  const { harness, assessmentId, risks, path } = draft;
  const riskId = risks.regulatory;
  const suggestion = (await envelopeOf(harness, riskId)).suggestions.find((item) => item.state === "proposed");
  assert.ok(suggestion);
  const decide = (action: string) => harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action, suggestion: suggestion.key }]) });
  const reviewState = async () => {
    const assessment = await harness.getAssessment(assessmentId);
    return { status: assessment?.assessmentStatus, reviewedBy: assessment?.reviewedBy ?? null };
  };
  const runId = (await envelopeOf(harness, riskId)).runId;
  const confirmAccept = body([{ target: { kind: "risk", riskId: risks.accept }, action: "accept", fields: ["treatmentAction"] }]);

  /* A reviewed assessment that a restored confirmation sent back to draft, where a wrongly applied review would record one. */
  await makeReleaseReady(draft);
  const withdrawn = await harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId: risks.accept }, action: "restore", fields: ["treatmentAction"] }]) });
  assert.equal(withdrawn.status, 200, await withdrawn.clone().text());
  const draftState = await reviewState();
  assert.equal(draftState.status, "draft", "the withdrawn review left the assessment in draft");
  for (const [action, state, kind] of [["dismiss", "dismissed", "dismissed"], ["restore", "proposed", "restored"]] as const) {
    const response = await decide(action);
    assert.equal(response.status, 200, await response.clone().text());
    assert.deepEqual((await response.json() as { data: unknown }).data, { applied: 1, unchanged: 0 });
    assert.equal((await envelopeOf(harness, riskId)).suggestions.find((item) => item.key === suggestion.key)?.state, state);
    assert.deepEqual(await reviewState(), draftState);
    assert.equal((await lastDecision(harness, runId) as { kind: string; item: string }).kind, kind);
  }

  const reconfirmed = await harness.request({ path, identity: harness.identities.analyst, init: confirmAccept });
  assert.equal(reconfirmed.status, 200, await reconfirmed.clone().text());
  const detail = await harness.request({ path: `/api/v1/risk_assessments/${assessmentId}`, identity: harness.identities.analyst });
  assert.equal(((await detail.json() as { data: { releaseReadiness: { ready: boolean } } }).data.releaseReadiness).ready, true);
  const inReview = await reviewState();
  assert.equal(inReview.status, "in-review");
  for (const action of ["dismiss", "restore"]) {
    assert.equal((await decide(action)).status, 200);
    assert.deepEqual(await reviewState(), inReview, `${action.toUpperCase()}_CHANGED_A_RELEASE_READY_REVIEW`);
  }
});

test("conflicting suggestion decisions are refused and a refused batch adds no control", async () => {
  const { harness, assessmentId, risks, runId, path } = await draftOf("CONFLICTS");
  const riskId = risks.regulatory;
  const firstRiskId = risks.internet;
  const suggestion = (await envelopeOf(harness, riskId)).suggestions.find((item) => item.state === "proposed");
  const firstSuggestion = (await envelopeOf(harness, firstRiskId)).suggestions.find((item) => item.state === "proposed");
  assert.ok(suggestion && firstSuggestion);
  const decision = (action: string, key = suggestion.key, target = riskId) => ({ target: { kind: "risk", riskId: target }, action, suggestion: key });
  const send = (...decisions: unknown[]) => harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
  const snapshot = async () => [await harness.snapshot([() => harness.getRisk(riskId), () => harness.getRisk(firstRiskId),
    () => harness.getAiRun(runId), () => harness.getAssessment(assessmentId)]),
  await harness.countControlImplementationsForRisk(riskId), await harness.countControlImplementationsForRisk(firstRiskId)];

  assert.equal((await send(decision("accept"))).status, 200);
  let before = await snapshot();
  let refused = await send(decision("dismiss"));
  assert.equal(refused.status, 409);
  assert.equal(await reasonOf(refused), "AI_PROPOSAL_ALREADY_DECIDED");
  assert.deepEqual(await snapshot(), before);

  assert.equal((await send(decision("restore"))).status, 200);
  assert.equal((await send(decision("dismiss"))).status, 200);
  before = await snapshot();
  refused = await send(decision("accept", firstSuggestion.key, firstRiskId), decision("accept"));
  assert.equal(refused.status, 409);
  assert.equal(await reasonOf(refused), "AI_PROPOSAL_ALREADY_DECIDED");
  assert.deepEqual(await snapshot(), before, "THE_REFUSED_BATCH_ADDED_A_CONTROL");

  const unknown = await send(decision("accept", "no-such-suggestion"));
  assert.equal(unknown.status, 400);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await send(decision("restore"))).status, 200);
});

test("a suggested control and an AI Accept on the same risk can't be confirmed together, in either order", async () => {
  const { harness, assessmentId, risks, controlIds, path } = await draftOf("ACCEPT-WITH-SUGGESTION");
  const riskId = risks.accept;
  const firstRiskId = risks.internet;
  const target = { kind: "risk", riskId };
  const send = (...decisions: unknown[]) => harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
  const envelope = await envelopeOf(harness, riskId);
  assert.equal(envelope.fields.treatmentAction.state, "proposed");
  assert.equal((await harness.getRisk(riskId))?.treatmentAction, "Accept");
  /* The deterministic draft never pairs an AI Accept with a suggestion (12-06); this models a later run's suggestion. */
  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", riskId, { aiProvenance: { ...envelope, suggestions: [...envelope.suggestions,
    { key: "seeded-suggestion", control: controlIds[6], controlNumber: "UATA-007", rationale: "Seeded to model a later run’s suggestion.", state: "proposed" }] } });
  const addSuggestion = { target, action: "accept", suggestion: "seeded-suggestion" };
  const confirmAccept = { target, action: "accept", fields: ["treatmentAction"] };
  const snapshot = async () => [await harness.snapshot([() => harness.getRisk(riskId), () => harness.getAiRun(envelope.runId),
    () => harness.getAssessment(assessmentId)]), await harness.countControlImplementationsForRisk(riskId)];
  for (const batch of [[addSuggestion, confirmAccept], [confirmAccept, addSuggestion]]) {
    const before = await snapshot();
    const response = await send(...batch);
    assert.equal(response.status, 409, await response.clone().text());
    assert.deepEqual((await response.json() as { error: { details: unknown } }).error.details, { reason: "AI_ACCEPT_WITH_PLANNED_CONTROL" });
    assert.deepEqual(await snapshot(), before);
  }

  const firstSuggestion = (await envelopeOf(harness, firstRiskId)).suggestions.find((item) => item.state === "proposed");
  assert.ok(firstSuggestion);
  const otherRisk = await send({ target: { kind: "risk", riskId: firstRiskId }, action: "accept", suggestion: firstSuggestion.key }, confirmAccept);
  assert.equal(otherRisk.status, 200, await otherRisk.clone().text());
  assert.equal((await envelopeOf(harness, riskId)).fields.treatmentAction.state, "accepted");

  const alone = await send(addSuggestion);
  assert.equal(alone.status, 200, await alone.clone().text());
  assert.equal((await envelopeOf(harness, riskId)).suggestions.find((item) => item.key === "seeded-suggestion")?.state, "added");
});

/*
 * WR-103: a decision, and an edit of a proposed or confirmed AI field, append to the run's decision history in the
 * same transaction. When that history can't take the record (an administrator deleted the run or corrupted its
 * history in the Content Manager, or it is full), the change is refused with its own closed reason, never a 500,
 * and nothing persists: no decision and no AI field edit is ever applied without its audit record. A draft of its
 * own, so the broken run touches no other case.
 */
test("a decision or AI field edit whose run history can't be written is refused with its reason and changes nothing", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  /* A submitted questionnaire whose one answer makes the deterministic draft propose an Internet Exposure Risk. */
  const at = "2026-10-01T00:00:00.000Z";
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "WR103-RUN-HISTORY", title: "Run history refusal", requestStatus: "questionnaire-in-progress", requestor: harness.users.owner,
  });
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-WR103-RUN-HISTORY", title: "Run history refusal questionnaire", assessmentRequest: requestId,
    releasedAt: at, releasedBy: harness.users.analyst, governanceLog: [{ schemaVersion: 1, kind: "released", at, by: harness.users.analyst }],
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Is the service reachable from the internet?", answerType: "Boolean", questionnaire: questionnaireId,
    options: { schemaVersion: 1, questionKey: "internet-facing", section: { key: "hosting", title: "Hosting", order: 1 }, order: 1, required: true },
    answer: { schemaVersion: 1, value: true, state: "submitted", updatedAt: at, submittedAt: at },
  });
  const queued = await harness.request({ path: `/api/v1/questionnaires/${questionnaireId}/generate_assessment`,
    identity: harness.identities.analyst, init: { method: "POST" } });
  assert.equal(queued.status, 202, await queued.clone().text());
  const { data: job } = await queued.json() as { data: { jobId: string } };
  let assessmentId = "";
  for (let attempt = 0; attempt < 100 && !assessmentId; attempt += 1) {
    const response = await harness.request({ path: `/api/v1/assessment_draft_jobs/${job.jobId}`, identity: harness.identities.analyst });
    const { data } = await response.json() as { data: { status: string; assessmentId?: string } };
    if (data.status === "failed") assert.fail("draft generation failed");
    if (data.status === "completed") assessmentId = String(data.assessmentId);
    else await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(assessmentId, "the draft completed");
  const drafted = await harness.getAssessment(assessmentId);
  const listed = await harness.listRisksForAssessment(assessmentId);
  assert.equal(listed.length, 1, "the one answer drafts one Risk");
  const riskId = String(listed[0].documentId);
  const runId = (drafted?.aiProvenance as { runId: string }).runId;
  assert.equal((await envelopeOf(harness, riskId)).fields.riskStatement.state, "proposed");
  const snapshot = () => harness.snapshot([() => harness.getAssessment(assessmentId), () => harness.getRisk(riskId), () => harness.getAiRun(runId)]);
  const attempts = [
    { name: "risk edit", path: `/api/v1/risks/${riskId}`, init: json("PATCH", { riskStatement: "Analyst rewrote the AI statement" }) },
    { name: "decision", path: `/api/v1/risk_assessments/${assessmentId}/ai_proposal_decisions`,
      init: body([{ target: { kind: "risk", riskId }, action: "accept", fields: ["riskStatement"] }]) },
    { name: "assessment edit", path: `/api/v1/risk_assessments/${assessmentId}`, init: json("PATCH", { summary: "Analyst rewrote the AI summary" }) },
  ];
  const refusedWithoutWrites = async (state: string) => {
    for (const attempt of attempts) {
      const before = await snapshot();
      const response = await harness.request({ path: attempt.path, identity: harness.identities.analyst, init: attempt.init });
      const text = await response.clone().text();
      assert.equal(response.status, 409, `${state} ${attempt.name}: ${text}`);
      assert.equal(await reasonOf(response), "AI_RUN_RECORD_UNAVAILABLE", `${state} ${attempt.name}`);
      assert.doesNotMatch(text, /AI_RUN_RECORD_INVALID|stack|database|SQL/i, `${state} ${attempt.name}`);
      assert.deepEqual(await snapshot(), before, `${state} ${attempt.name} changed persistence`);
    }
  };

  await harness.updateAiRunFixture(runId, { decisions: [{ schemaVersion: 99 }] });
  await refusedWithoutWrites("corrupt history");
  await harness.deleteAiRunFixture(runId);
  assert.equal(await harness.getAiRun(runId), null);
  await refusedWithoutWrites("deleted run");

  /* Only a change that needs the audit record is refused: an edit of a field the AI never proposed still saves. */
  const comment = await harness.request({ path: `/api/v1/risks/${riskId}`, identity: harness.identities.analyst, init: json("PATCH", { comments: "Not an AI field" }) });
  assert.equal(comment.status, 200, await comment.clone().text());
  assert.equal((await harness.getRisk(riskId))?.comments, "Not an AI field");
  assert.equal((await envelopeOf(harness, riskId)).fields.riskStatement.state, "proposed");
});

/*
 * Verifier W-3 (D-21, G-1; AI output is reviewable assistance). The analyst service agent, an automation identity, keeps
 * the assessment and Risk edit grants D-33 left it for Phase 22's role review, but only a human Security Analyst's edit or
 * decision moves an AI field out of `proposed`. The agent's edit of an AI field saves its value, leaves the field
 * `proposed` (or returns it there from `accepted` or `edited`) by the agent, keeps the review of AI proposals outstanding
 * for release, and records an `edited` event by the agent in the run. A human analyst's same edit still marks it `edited`.
 * Each record keeps one AI field proposed after a human confirms the rest, so only that field's review state decides
 * whether its review of AI proposals is met.
 */
test("an automation identity's edit keeps an AI field proposed, and only a human analyst's edit reviews it", async () => {
  const { harness, assessmentId, risks, runId, path } = await draftOf("AGENT-EDIT");
  const agentId = harness.users.serviceAnalystAgent;
  const riskId = risks.internet;
  type Target = string;
  const edit = (identity: string, target: Target, payload: Record<string, unknown>) => harness.request({
    path: target === "assessment" ? `/api/v1/risk_assessments/${assessmentId}` : `/api/v1/risks/${target}`, identity, init: json("PATCH", payload) });
  const storedOf = async (target: Target) => (target === "assessment" ? await harness.getAssessment(assessmentId) : await harness.getRisk(target)) as Row;
  const factOf = async (target: Target, field: string) =>
    ((await storedOf(target)).aiProvenance as { fields: Record<string, { state: string; by?: string; at?: string }> }).fields[field];
  const aiReview = async (target: Target) => {
    const detail = await harness.request({ path: `/api/v1/risk_assessments/${assessmentId}`, identity: harness.identities.analyst });
    assert.equal(detail.status, 200, await detail.clone().text());
    const { data } = await detail.json() as { data: { releaseReadiness: { requirements: Array<{ scope: string; key: string; state: string; destination?: string }> } } };
    return data.releaseReadiness.requirements.find((item) => item.key === "aiProposalsReviewed"
      && (target === "assessment" ? item.scope === "assessment" : item.destination === `risk-${target}`))?.state;
  };
  const expectEdit = async (identity: string, by: string, target: Target, field: string, value: string, state: "proposed" | "edited", name: string) => {
    const response = await edit(identity, target, { [field]: value });
    assert.equal(response.status, 200, `${name}: ${await response.clone().text()}`);
    assert.equal((await storedOf(target))[field], value, `${name}_VALUE_NOT_SAVED`);
    const fact = await factOf(target, field);
    assert.equal(fact.state, state, `${name}_FIELD_STATE`);
    assert.equal(fact.by, by, `${name}_FIELD_ACTOR`);
    assert.deepEqual(await lastDecision(harness, runId), { schemaVersion: 1, kind: "edited", at: fact.at, by, target, fields: [field] }, `${name}_RUN_EVENT`);
  };

  /* A human analyst confirms every AI field but one, on the Risk and in the assessment details. */
  const riskFields = Object.entries((await envelopeOf(harness, riskId)).fields).filter(([name, fact]) => fact.state === "proposed" && name !== "riskStatement").map(([name]) => name);
  const confirmed = await harness.request({ path, identity: harness.identities.analyst, init: body([
    { target: { kind: "risk", riskId }, action: "accept", fields: riskFields },
    { target: { kind: "assessment" }, action: "accept", fields: ["overallRating", "overallRiskRationale", "recommendationsSummary"] },
  ]) });
  assert.equal(confirmed.status, 200, await confirmed.clone().text());
  for (const target of [riskId, "assessment"]) assert.equal(await aiReview(target), "outstanding", `W3_${target === "assessment" ? "ASSESSMENT" : "RISK"}_REVIEW_MET_BEFORE_ANY_EDIT`);

  /* The agent rewrites the one field still proposed: it stays proposed, and the review of AI proposals stays outstanding. */
  for (const [target, field, value, name] of [
    [riskId, "riskStatement", "The service agent rewrote the risk statement.", "W3_AGENT_RISK_EDIT"],
    ["assessment", "summary", "The service agent rewrote the summary.", "W3_AGENT_ASSESSMENT_EDIT"],
  ] as const) {
    await expectEdit(harness.identities.serviceAnalystAgent, agentId, target, field, value, "proposed", name);
    assert.equal(await aiReview(target), "outstanding", `${name}_MET_THE_REVIEW_OF_AI_PROPOSALS`);
  }

  /* The agent changes a field the analyst confirmed: it returns to proposed, for a human to review again. */
  for (const [target, field, value, name] of [
    [riskId, "riskCategory", "Agent category", "W3_AGENT_EDIT_OF_A_CONFIRMED_RISK_FIELD"],
    ["assessment", "overallRiskRationale", "The service agent rewrote the overall rationale.", "W3_AGENT_EDIT_OF_A_CONFIRMED_ASSESSMENT_FIELD"],
  ] as const) {
    assert.equal((await factOf(target, field)).state, "accepted", `${name}_WAS_NOT_CONFIRMED`);
    await expectEdit(harness.identities.serviceAnalystAgent, agentId, target, field, value, "proposed", name);
  }

  /* A human analyst's same edit still reviews the field: it is edited, by that analyst. */
  for (const [target, field, value, name] of [
    [riskId, "riskStatement", "The analyst rewrote the risk statement.", "W3_HUMAN_RISK_EDIT"],
    ["assessment", "summary", "The analyst rewrote the summary.", "W3_HUMAN_ASSESSMENT_EDIT"],
  ] as const) {
    await expectEdit(harness.identities.analyst, harness.users.analyst, target, field, value, "edited", name);
  }

  /* And the agent's later change of a field a human edited returns it to proposed. */
  await expectEdit(harness.identities.serviceAnalystAgent, agentId, riskId, "riskStatement", "The service agent changed the analyst's statement.", "proposed", "W3_AGENT_EDIT_OF_A_HUMAN_EDIT");
  assert.equal(await aiReview(riskId), "outstanding", "W3_AGENT_EDIT_OF_A_HUMAN_EDIT_MET_THE_REVIEW_OF_AI_PROPOSALS");
});

/*
 * Phase 16 16-04 (D-19, D-20): a suggested control added as planned is a change to the Risk, recorded as
 * control-implementation-added from the AI run that suggested it; confirming a field or dismissing a suggestion
 * changes no value and records nothing (UI-D23).
 */
type HistoryRow = { kind?: unknown; sourceKind?: unknown; actor?: unknown; aiRun?: unknown; proposalItem?: unknown; changes?: unknown };

function proposedFieldOf(envelope: RiskEnvelope): string {
  const field = Object.entries(envelope.fields).find(([, fact]) => fact.state === "proposed")?.[0];
  assert.ok(field, "THE_RISK_HAS_NO_PROPOSED_FIELD");
  return field;
}

test("adding a suggested control records one control-implementation-added row from the AI run; confirming a field or dismissing records none (D-19)", async () => {
  const { harness, risks, path } = await draftOf("HISTORY");
  const riskId = risks.internet;
  const envelope = await envelopeOf(harness, riskId);
  const [first, second] = envelope.suggestions.filter((item) => item.state === "proposed");
  assert.ok(first && second, "THE_TREAT_RISK_CARRIES_TWO_PROPOSED_SUGGESTIONS");
  const rows = () => harness.riskHistoryRowsFixture(riskId) as Promise<HistoryRow[]>;
  const start = await rows();
  assert.deepEqual(start.map((row) => [row.kind, row.sourceKind, row.aiRun]), [["created", "ai-run", envelope.runId]], "DRAFTED_RISK_HISTORY");

  const decide = (decision: Record<string, unknown>) => harness.request({ path, identity: harness.identities.analyst, init: body([{ target: { kind: "risk", riskId }, ...decision }]) });
  const confirmed = await decide({ action: "accept", fields: [proposedFieldOf(envelope)] });
  assert.equal(confirmed.status, 200, await confirmed.clone().text());
  const dismissed = await decide({ action: "dismiss", suggestion: second.key });
  assert.equal(dismissed.status, 200, await dismissed.clone().text());
  assert.equal((await rows()).length, start.length, "A_CONFIRMATION_OR_DISMISSAL_RECORDED_HISTORY");

  const added = await decide({ action: "accept", suggestion: first.key });
  assert.equal(added.status, 200, await added.clone().text());
  const after = await rows();
  assert.equal(after.length, start.length + 1, "THE_ADDED_SUGGESTION_RECORDED_NO_ROW");
  const row = after.at(-1)!;
  assert.equal(row.kind, "control-implementation-added");
  assert.equal(row.sourceKind, "ai-run");
  assert.equal(row.aiRun, envelope.runId);
  assert.equal(row.actor, harness.users.analyst);
  assert.equal(row.proposalItem, first.key);
  const changes = row.changes as { control: { documentId: string; controlNumber: string }; fields: Array<{ field: string; to: unknown }> };
  assert.equal(changes.control.documentId, first.control);
  assert.equal(changes.control.controlNumber, first.controlNumber);
  assert.deepEqual(changes.fields.map((change) => [change.field, change.field === "control" ? (change.to as { documentId: string }).documentId : change.to]),
    [["control", first.control], ["controlStatus", "Planned"]]);
});

test("a decision batch naming a withdrawn Risk's field or suggestion is refused 409 RISK_WITHDRAWN and changes nothing (D-07)", async () => {
  const { harness, assessmentId, risks, path, runId } = await draftOf("WITHDRAWN");
  const riskId = risks.internet;
  const envelope = await envelopeOf(harness, riskId);
  const suggestion = envelope.suggestions.find((item) => item.state === "proposed");
  assert.ok(suggestion, "THE_TREAT_RISK_CARRIES_A_PROPOSED_SUGGESTION");
  const field = proposedFieldOf(envelope);
  const activeField = proposedFieldOf(await envelopeOf(harness, risks.personal));
  await harness.setRiskWithdrawalFactsFixture(riskId, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: "Duplicate of another risk." });
  const snapshot = () => harness.snapshot([
    () => harness.getRisk(riskId), () => harness.getRisk(risks.personal), () => harness.getAiRun(runId), () => harness.getAssessment(assessmentId),
    () => harness.riskHistoryRowsFixture(riskId), () => harness.riskHistoryRowsFixture(risks.personal), () => harness.countControlImplementationsForRisk(riskId),
  ]);
  const before = await snapshot();
  const batches: Array<[string, unknown[]]> = [
    ["FIELD", [{ target: { kind: "risk", riskId }, action: "accept", fields: [field] }]],
    ["SUGGESTION", [{ target: { kind: "risk", riskId }, action: "accept", suggestion: suggestion.key }]],
    ["DISMISSAL", [{ target: { kind: "risk", riskId }, action: "dismiss", suggestion: suggestion.key }]],
    ["AFTER_AN_ACTIVE_RISK", [
      { target: { kind: "risk", riskId: risks.personal }, action: "accept", fields: [activeField] },
      { target: { kind: "risk", riskId }, action: "accept", suggestion: suggestion.key },
    ]],
  ];
  for (const [label, decisions] of batches) {
    const response = await harness.request({ path, identity: harness.identities.analyst, init: body(decisions) });
    assert.equal(response.status, 409, `${label}_STATUS: ${await response.clone().text()}`);
    assert.equal(await reasonOf(response), "RISK_WITHDRAWN", `${label}_REASON`);
  }
  assert.deepEqual(await snapshot(), before, "A_REFUSED_DECISION_CHANGED_PERSISTENCE");
});

/*
 * Phase 16 D-23 (16-RESEARCH Pitfall 4): only a change to the assessment's content, or to a field's review state,
 * withdraws a review. Closing a proposal (dismissing a suggested control, restoring the dismissal) and an edit that
 * changes nothing leave a release-ready in-review assessment in review; adding the suggested control regresses it.
 */
test("dismissing and restoring a suggested control leave a release-ready assessment in-review, and adding one regresses it to draft (D-23)", async () => {
  const draft = await draftOf("DISMISS-IN-REVIEW");
  const { harness, assessmentId, risks, path } = draft;
  const riskId = risks.internet;
  const [toAdd, toDismiss] = (await envelopeOf(harness, riskId)).suggestions.filter((item) => item.state === "proposed");
  assert.ok(toAdd && toDismiss, "THE_TREAT_RISK_CARRIES_TWO_PROPOSED_SUGGESTIONS");
  await makeReleaseReady(draft);
  const status = async () => (await harness.getAssessment(assessmentId))?.assessmentStatus;
  assert.equal(await status(), "in-review");
  const decide = (action: string, key: string) => harness.request({ path, identity: harness.identities.analyst,
    init: body([{ target: { kind: "risk", riskId }, action, suggestion: key }]) });
  for (const action of ["dismiss", "restore"]) {
    const response = await decide(action, toDismiss.key);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(await status(), "in-review", `${action.toUpperCase()}_WITHDREW_THE_REVIEW`);
  }
  const added = await decide("accept", toAdd.key);
  assert.equal(added.status, 200, await added.clone().text());
  assert.equal(await status(), "draft", "ADDING_A_SUGGESTED_CONTROL_KEPT_THE_REVIEW");
});

test("a Risk PATCH or a control edit that changes nothing leaves a release-ready assessment in-review (D-23)", async () => {
  const draft = await draftOf("NO-OP-IN-REVIEW");
  const { harness, assessmentId, risks, controlIds } = draft;
  const riskId = risks.accept;
  const implementationId = await harness.createRiskRegisterMitigationFixture(riskId, controlIds[0], "Existing", { evidence: "Recorded evidence" });
  await makeReleaseReady(draft);
  const persisted = () => harness.snapshot([() => harness.getAssessment(assessmentId), () => harness.getRisk(riskId),
    () => harness.getControlImplementation(implementationId), () => harness.riskHistoryRowsFixture(riskId)]);
  const before = await persisted();
  assert.equal((before[0] as Row | null)?.assessmentStatus, "in-review");
  const risk = before[1] as Row;
  const unchanged = await harness.request({ path: `/api/v1/risks/${riskId}`, identity: harness.identities.analyst,
    init: json("PATCH", { riskStatement: risk.riskStatement, treatmentAction: risk.treatmentAction, targetDate: risk.targetDate }) });
  assert.equal(unchanged.status, 200, await unchanged.clone().text());
  const control = await harness.request({ path: `/api/v1/control_implementations/${implementationId}`, identity: harness.identities.analyst,
    init: json("PATCH", { evidence: "Recorded evidence", controlStatus: "Existing" }) });
  assert.equal(control.status, 200, await control.clone().text());
  assert.deepEqual(await persisted(), before, "A_NO_OP_EDIT_WITHDREW_THE_REVIEW_OR_WROTE");
});

/*
 * Phase 16 D-39: Phase 12's entries stay closed to the run-scoped verbs. `reject` and a reason are refused on a field
 * or suggested-control target, and a field target never takes a proposal's run or item, so a batch carrying any of
 * them is a 400 that writes nothing; the same entries without them apply as before.
 */
test("Phase 12's field and suggestion targets refuse reject, a reason and a proposal's keys with 400 and change nothing (D-39)", async () => {
  const { harness, assessmentId, risks, path, runId } = await draftOf("CLOSED-VERBS");
  const riskId = risks.internet;
  const suggestion = (await envelopeOf(harness, riskId)).suggestions.find((item) => item.state === "proposed");
  assert.ok(suggestion, "THE_TREAT_RISK_CARRIES_A_PROPOSED_SUGGESTION");
  const snapshot = () => harness.snapshot([() => harness.getRisk(riskId), () => harness.getAiRun(runId), () => harness.getAssessment(assessmentId)]);
  const before = await snapshot();
  for (const decision of [
    { target: { kind: "risk", riskId }, action: "reject", fields: ["riskStatement"] },
    { target: { kind: "risk", riskId }, action: "reject", suggestion: suggestion.key },
    { target: { kind: "risk", riskId }, action: "accept", fields: ["riskStatement"], reason: "Confirmed." },
    { target: { kind: "risk", riskId }, action: "dismiss", suggestion: suggestion.key, reason: "Not needed." },
    { target: { kind: "assessment" }, action: "reject", fields: ["summary"] },
    { target: { kind: "risk", riskId, runId, item: "s-1" }, action: "accept", fields: ["riskStatement"] },
  ]) {
    const response = await harness.request({ path, identity: harness.identities.analyst, init: body([decision]) });
    assert.equal(response.status, 400, `NOT_REFUSED_${JSON.stringify(decision)}`);
  }
  assert.deepEqual(await snapshot(), before, "A_REFUSED_PHASE_12_ENTRY_WROTE");
  const applied = await harness.request({ path, identity: harness.identities.analyst, init: body([{ target: { kind: "risk", riskId }, action: "accept", fields: ["riskStatement"] }]) });
  assert.equal(applied.status, 200, await applied.clone().text());
});
