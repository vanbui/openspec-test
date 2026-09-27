import assert from "node:assert/strict";
import test from "node:test";

import csrmAuthorization from "../src/policies/csrm-authorization";
import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../src/api/csrm-analyst-insight/operations";
import { AnalystInsightError, assertAnalystInsightScope } from "../src/api/csrm-analyst-insight/services/insight-scope";

/*
 * The policy is exercised directly with a fake Strapi. Shapes follow
 * tests/fixtures/authorization.ts; every identity below exists only here.
 */

const insightOperations = [
  "GET:/api/v1/dashboard/summary",
  "GET:/api/v1/alerts",
  "GET:/api/v1/alerts/summary",
  "GET:/api/v1/reports",
  "GET:/api/v1/reports/{reportKey}",
] as const;

/* D-14 and the plan-check amendment: an insight discloses these four reads, so it requires all of them. */
const RISK_REGISTER_READ = "GET:/api/v1/risks";
const REVIEW_QUEUE_READ = "GET:/api/v1/assessment_requests";
const QUESTIONNAIRE_REVIEW_READ = "GET:/api/v1/questionnaires";
const ASSESSMENT_REVIEW_READ = "GET:/api/v1/risk_assessments";
const underlyingReads = [RISK_REGISTER_READ, REVIEW_QUEUE_READ, QUESTIONNAIRE_REVIEW_READ, ASSESSMENT_REVIEW_READ];

type Role = { name: string; functions: ReadonlyArray<{ functionApis: ReadonlyArray<{ url: string }> }> };
type Identity = { id: number; documentId: string; accountStatus: "active" | "inactive"; roles: readonly Role[] };

function role(name: string, urls: readonly string[]): Role {
  return { name, functions: [{ functionApis: urls.map((url) => ({ url })) }] };
}

const everyAnalystGrant = [...insightOperations, ...underlyingReads];
const without = (url: string) => everyAnalystGrant.filter((entry) => entry !== url);

const requestorBirthright = role("Requestor", [
  "GET:/api/csrm-assessment-requests",
  "GET:/api/v1/my_requests/status_summary",
  "GET:/api/v1/my_questionnaires",
]);

const identities = {
  humanAnalyst: { id: 701, documentId: "insight-human-analyst", accountStatus: "active", roles: [role("Security Analyst", everyAnalystGrant)] },
  // Deliberately mis-granted: an automation identity holding every insight grant.
  analystAgent: { id: 702, documentId: "insight-analyst-agent", accountStatus: "active", roles: [role("Security Analyst Agent", everyAnalystGrant)] },
  analystWithoutRiskRegister: { id: 703, documentId: "insight-analyst-no-risks", accountStatus: "active", roles: [role("Security Analyst", without(RISK_REGISTER_READ))] },
  analystWithoutReviewQueue: { id: 704, documentId: "insight-analyst-no-requests", accountStatus: "active", roles: [role("Security Analyst", without(REVIEW_QUEUE_READ))] },
  analystWithoutQuestionnaires: { id: 705, documentId: "insight-analyst-no-questionnaires", accountStatus: "active", roles: [role("Security Analyst", without(QUESTIONNAIRE_REVIEW_READ))] },
  analystWithoutAssessments: { id: 706, documentId: "insight-analyst-no-assessments", accountStatus: "active", roles: [role("Security Analyst", without(ASSESSMENT_REVIEW_READ))] },
  analystWithoutInsightGrant: { id: 707, documentId: "insight-analyst-no-insight", accountStatus: "active", roles: [role("Security Analyst", underlyingReads)] },
  // The underlying reads come from an automation role the same identity also holds, not the human role.
  analystReadsOnlyThroughAgent: {
    id: 708,
    documentId: "insight-analyst-reads-through-agent",
    accountStatus: "active",
    roles: [role("Security Analyst", insightOperations), role("Security Analyst Agent", underlyingReads)],
  },
  requestor: { id: 709, documentId: "insight-requestor", accountStatus: "active", roles: [] },
  inactiveAnalyst: { id: 710, documentId: "insight-inactive-analyst", accountStatus: "inactive", roles: [role("Security Analyst", everyAnalystGrant)] },
  // Holds only the release and governance grants, to prove the older human-only messages are unchanged.
  releasingAgent: {
    id: 711,
    documentId: "insight-releasing-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", [
      "POST:/api/v1/risk_assessments/{assessmentId}/release",
      "POST:/api/v1/questionnaires/{questionnaireId}/release",
    ])],
  },
} as const satisfies Record<string, Identity>;

const fakeStrapi = {
  documents(uid: string) {
    if (uid === "api::idambox-user.idambox-user") {
      return {
        findOne: async ({ documentId }: { documentId: string }) =>
          Object.values(identities).find((identity) => identity.documentId === documentId) ?? null,
      };
    }
    if (uid === "api::role.role") {
      return { findMany: async () => [requestorBirthright] };
    }
    throw new Error(`Unexpected Strapi document service: ${uid}`);
  },
};

type PolicyStrapi = Parameters<typeof csrmAuthorization>[2]["strapi"];

async function authorize(identity: Identity | null, config: Parameters<typeof csrmAuthorization>[1]) {
  const messages: string[] = [];
  const context = {
    params: {},
    state: identity ? { idamboxUser: { documentId: identity.documentId } } : {},
    forbidden(message: string) {
      messages.push(message);
      return undefined;
    },
  } as Parameters<typeof csrmAuthorization>[0];
  const allowed = await csrmAuthorization(context, config, { strapi: fakeStrapi as unknown as PolicyStrapi });
  return { allowed, messages, decision: context.state.csrmAuthorization };
}

const FUNCTION_API_DENIED = "CSRM FunctionAPI access is denied.";
const HUMAN_ANALYST_REQUIRED = "CSRM analyst insights require a human Security Analyst.";
const INSIGHT_DENIED = "CSRM analyst insight access is denied.";

test("the five served analyst insight operations are named once", () => {
  assert.deepEqual(CSRM_ANALYST_INSIGHT_OPERATIONS, {
    dashboardSummary: "GET:/api/v1/dashboard/summary",
    listAlerts: "GET:/api/v1/alerts",
    alertSummary: "GET:/api/v1/alerts/summary",
    listReports: "GET:/api/v1/reports",
    getReport: "GET:/api/v1/reports/{reportKey}",
  });
  assert.ok(Object.isFrozen(CSRM_ANALYST_INSIGHT_OPERATIONS));
});

for (const operation of insightOperations) {
  const config = { operation, requireAnalystInsightScope: true };

  test(`a human Security Analyst holding every underlying read gets the insight scope for ${operation}`, async () => {
    const result = await authorize(identities.humanAnalyst, config);
    assert.equal(result.allowed, true);
    assert.deepEqual(result.messages, []);
    // Only the insight scope is granted: no Risk Register, review or administration scope widens with it.
    assert.deepEqual(result.decision, { assessmentRequestActor: "analyst", analystInsightScope: "all" });
  });

  test(`an automation identity is refused ${operation} by the guard even when mis-granted`, async () => {
    const result = await authorize(identities.analystAgent, config);
    assert.equal(result.allowed, false);
    assert.deepEqual(result.messages, [HUMAN_ANALYST_REQUIRED]);
  });

  test(`a human analyst missing any underlying read is refused ${operation}`, async () => {
    for (const identity of [
      identities.analystWithoutRiskRegister,
      identities.analystWithoutReviewQueue,
      identities.analystWithoutQuestionnaires,
      identities.analystWithoutAssessments,
      identities.analystReadsOnlyThroughAgent,
    ]) {
      const result = await authorize(identity, config);
      assert.equal(result.allowed, false, identity.documentId);
      assert.deepEqual(result.messages, [INSIGHT_DENIED], identity.documentId);
      assert.equal(result.decision?.analystInsightScope, undefined, identity.documentId);
    }
  });

  test(`a Requestor, an analyst without the grant, an inactive analyst and no identity are refused ${operation}`, async () => {
    for (const identity of [identities.requestor, identities.analystWithoutInsightGrant, identities.inactiveAnalyst, null]) {
      const result = await authorize(identity, config);
      assert.equal(result.allowed, false, identity?.documentId ?? "no identity");
      assert.deepEqual(result.messages, [FUNCTION_API_DENIED], identity?.documentId ?? "no identity");
    }
  });
}

test("the release and questionnaire governance refusals keep their own messages", async () => {
  const release = await authorize(identities.releasingAgent, { operation: "POST:/api/v1/risk_assessments/{assessmentId}/release" });
  assert.equal(release.allowed, false);
  assert.deepEqual(release.messages, ["CSRM assessment release requires a human Security Analyst."]);

  const governance = await authorize(identities.releasingAgent, { operation: "POST:/api/v1/questionnaires/{questionnaireId}/release" });
  assert.equal(governance.allowed, false);
  assert.deepEqual(governance.messages, ["CSRM questionnaire governance requires a human Security Analyst."]);
});

test("the insight scope assertion accepts only the policy's all-scope decision", () => {
  for (const state of [undefined, {}, { csrmAuthorization: {} }, { csrmAuthorization: { analystInsightScope: "own" } }]) {
    assert.throws(
      () => assertAnalystInsightScope(state),
      (error: unknown) => error instanceof AnalystInsightError
        && error.status === 403
        && error.message === INSIGHT_DENIED,
      JSON.stringify(state),
    );
  }
  assert.doesNotThrow(() => assertAnalystInsightScope({ csrmAuthorization: { analystInsightScope: "all" } }));
  assert.equal(new AnalystInsightError(404, "CSRM analyst report was not found.").status, 404);
});
