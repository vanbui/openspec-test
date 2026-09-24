import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => {
  await (await harnessPromise).close();
});

async function request(path: string, identity?: string, init: RequestInit = {}) {
  return (await harnessPromise).request({ path, identity, init });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

async function completedJob(jobId: string, identity: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(jobId)}`, identity);
    assert.equal(response.status, 200, "QUESTIONNAIRE_GENERATION_STATUS_ROUTE_MISSING");
    const data = (await body(response)).data as Record<string, unknown>;
    if (data.status === "completed") return data;
    if (data.status === "failed") assert.fail(`QUESTIONNAIRE_GENERATION_UNEXPECTED_FAILURE:${data.failureCode ?? "unknown"}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("QUESTIONNAIRE_GENERATION_DID_NOT_REACH_TERMINAL_STATE");
}

test("mounted questionnaire generation keeps completed relations populated and job reads actor-scoped", async () => {
  const harness = await harnessPromise;
  assert.equal(process.env.CSRM_AI_PROVIDER, "deterministic");
  const fixtures = await harness.seedRequestWorkflowFixtures();
  const generatePath = `/api/v1/assessment_requests/${encodeURIComponent(fixtures.requests.submitted)}/generate_questionnaire`;

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    const denied = await request(generatePath, identity, { method: "POST" });
    assert.equal(denied.status, 403, `QUESTIONNAIRE_GENERATION_UNGRANTED_ACTOR_${identity}`);
  }

  const queuedResponse = await request(generatePath, harness.identities.analyst, { method: "POST" });
  assert.equal(queuedResponse.status, 202, "QUESTIONNAIRE_GENERATION_QUEUE_ROUTE_MISSING");
  const queued = (await body(queuedResponse)).data as Record<string, unknown>;
  assert.equal(queued.status, "queued");
  assert.equal(typeof queued.jobId, "string");

  const job = await completedJob(String(queued.jobId), harness.identities.analyst);
  assert.equal(job.status, "completed");
  assert.equal(typeof job.providerName, "string");
  assert.equal(typeof job.providerVersion, "string");
  assert.ok(job.questionnaire && typeof job.questionnaire === "object", "QUESTIONNAIRE_GENERATION_COMPLETION_RELATION_MISSING");
  const questionnaire = job.questionnaire as Record<string, unknown>;
  assert.equal(typeof questionnaire.documentId, "string");
  // Domain numbers use the Crockford base32 alphabet, matching RAR and ASM.
  assert.match(String(questionnaire.questionnaireNumber), /^QNR-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  /*
   * The job payload is a bounded summary and deliberately carries no question
   * rows: parsing the whole record with a closed client schema made every new
   * questionnaire attribute a breaking change for this route. Prove the
   * generation really produced questions from the persisted record instead.
   */
  assert.equal(Object.keys(questionnaire).sort().join(","), "documentId,generatedBy,generatedDate,questionnaireNumber,title", "QUESTIONNAIRE_GENERATION_SUMMARY_NOT_BOUNDED");
  const persisted = await harness.getQuestionnaire(String(questionnaire.documentId));
  assert.ok(Array.isArray(persisted?.questions) && persisted.questions.length > 0, "QUESTIONNAIRE_GENERATION_QUESTIONS_MISSING");
  assert.equal(persisted?.providerName, "deterministic-questionnaire-generation");
  assert.equal(persisted?.providerVersion, "1");
  assert.equal(typeof persisted?.generatedDate, "string", "QUESTIONNAIRE_PERSISTED_PROVENANCE_DATE_MISSING");
  assert.ok(persisted?.generatedBy && typeof persisted.generatedBy === "object", "QUESTIONNAIRE_PERSISTED_PROVENANCE_ACTOR_MISSING");
  assert.equal(typeof questionnaire.generatedDate, "string", "QUESTIONNAIRE_GENERATION_PROVENANCE_DATE_MISSING");
  assert.ok(questionnaire.generatedBy && typeof questionnaire.generatedBy === "object", "QUESTIONNAIRE_GENERATION_PROVENANCE_ACTOR_MISSING");

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    const denied = await request(`/api/v1/questionnaire_generation_jobs/${encodeURIComponent(String(queued.jobId))}`, identity);
    assert.equal(denied.status, 403, `QUESTIONNAIRE_GENERATION_JOB_READ_DENIED_${identity}`);
  }
});

test("mounted questionnaire generation refuses non-submitted requests", async () => {
  const harness = await harnessPromise;
  const requestFixtures = await harness.seedRequestWorkflowFixtures();

  const nonSubmitted = await request(
    `/api/v1/assessment_requests/${encodeURIComponent(requestFixtures.requests.editable)}/generate_questionnaire`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(nonSubmitted.status, 409, "QUESTIONNAIRE_GENERATION_NON_SUBMITTED_REQUEST_NOT_REFUSED");
});
