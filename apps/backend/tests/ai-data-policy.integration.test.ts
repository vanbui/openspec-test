import assert from "node:assert/strict";
import test, { after } from "node:test";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness({ aiDataClassificationCeiling: "Public" });
after(async () => (await harnessPromise).close());

async function body(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

test("mounted draft enqueue refuses Restricted data before a job or run exists", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeFixture();
  const beforeRequest = await harness.getRequest(fixture.requestId);
  const beforeQuestionnaire = await harness.getQuestionnaire(fixture.questionnaireId);
  const response = await harness.request({ path: `/api/v1/questionnaires/${fixture.questionnaireId}/generate_assessment`, identity: harness.identities.analyst, init: { method: "POST" } });
  assert.equal(response.status, 409);
  const error = (await body(response)).error;
  assert.deepEqual(error.details, { reason: "AI_CLASSIFICATION_ABOVE_CEILING" });
  assert.match(error.message, /Restricted.*Public/);
  assert.deepEqual(await harness.getRequest(fixture.requestId), beforeRequest);
  assert.deepEqual(await harness.getQuestionnaire(fixture.questionnaireId), beforeQuestionnaire);
  assert.deepEqual(await harness.listAiRunsForRequest(fixture.requestId), []);
  const jobs = await harness.request({ path: `/api/v1/assessment_requests/${fixture.requestId}/generation_jobs`, identity: harness.identities.analyst });
  const jobsData = (await body(jobs)).data;
  assert.equal(jobsData.assessmentDraft, null);
  // D-29: the hub reads the same refusal before anything is queued.
  assert.deepEqual(jobsData.aiPolicy, { status: "refused", reason: "AI_CLASSIFICATION_ABOVE_CEILING", requestClassification: "Restricted", classificationSource: "assets", ceiling: "Public" });
});

test("mounted questionnaire enqueue refuses Restricted and default Internal, and allows Public", async () => {
  const harness = await harnessPromise;
  const restricted = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: "Policy Restricted", dataClassification: "Restricted" });
  const publicAsset = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: "Policy Public", dataClassification: "Public" });
  const makeRequest = (suffix: string, assets: string[]) => harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: `POLICY-${suffix}`, title: `Policy ${suffix}`, requestStatus: "submitted", requestor: harness.users.owner, informationAssets: assets,
  });
  const restrictedId = await makeRequest("RESTRICTED", [restricted]);
  const defaultId = await makeRequest("DEFAULT", []);
  const publicId = await makeRequest("PUBLIC", [publicAsset]);
  const defaultContext = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: defaultId });
  assert.equal(defaultContext.policy.classificationSource, "default");
  assert.equal(defaultContext.policy.requestClassification, "Internal");
  for (const requestId of [restrictedId, defaultId]) {
    const before = await harness.getRequest(requestId);
    const response = await harness.request({ path: `/api/v1/assessment_requests/${requestId}/generate_questionnaire`, identity: harness.identities.analyst, init: { method: "POST" } });
    assert.equal(response.status, 409);
    assert.deepEqual((await body(response)).error.details, { reason: "AI_CLASSIFICATION_ABOVE_CEILING" });
    assert.deepEqual(await harness.getRequest(requestId), before);
    assert.deepEqual(await harness.listAiRunsForRequest(requestId), []);
  }
  const allowed = await harness.request({ path: `/api/v1/assessment_requests/${publicId}/generate_questionnaire`, identity: harness.identities.analyst, init: { method: "POST" } });
  assert.equal(allowed.status, 202);
  const queued = (await body(allowed)).data;
  let finalStatus: unknown;
  for (let attempt = 0; attempt < 100; attempt++) {
    const job = await harness.request({ path: `/api/v1/questionnaire_generation_jobs/${queued.jobId}`, identity: harness.identities.analyst });
    finalStatus = (await body(job)).data.status;
    if (finalStatus === "completed" || finalStatus === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(finalStatus, "completed");
});

test("execution checks refuse before creating a run or calling either provider", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeFixture();
  const restricted = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: "Execution Restricted", dataClassification: "Restricted" });
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "POLICY-EXECUTION", title: "Execution policy", requestStatus: "submitted", requestor: harness.users.owner, informationAssets: [restricted],
  });
  await harness.withProviderCallRecorder(async (counts) => {
    await assert.rejects(harness.runQuestionnaireGenerationJobFixture(requestId, harness.users.analyst), { code: "AI_CLASSIFICATION_ABOVE_CEILING" });
    await assert.rejects(harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst), { code: "AI_CLASSIFICATION_ABOVE_CEILING" });
    assert.equal(counts.questionnaire(), 0);
    assert.equal(counts.assessment(), 0);
  });
  assert.deepEqual(await harness.listAiRunsForRequest(requestId), []);
  assert.deepEqual(await harness.listAiRunsForRequest(fixture.requestId), []);
});

/*
 * IN-104, WR-308 (D-28): a retry is a new attempt, so the policy that refuses an enqueue refuses a retry the same
 * way, with the same 409 reason, before anything is queued: no new attempt, no job state change and no run. Here
 * the request's information became Restricted after the first attempt failed, above this harness's Public ceiling.
 */
async function terminalJob(harness: Awaited<typeof harnessPromise>, path: string): Promise<Record<string, any>> {
  let data: Record<string, any> = {};
  for (let attempt = 0; attempt < 200; attempt++) {
    data = (await body(await harness.request({ path, identity: harness.identities.analyst }))).data;
    if (data.status === "completed" || data.status === "failed") return data;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return data;
}

test("mounted retries are refused by the AI data policy before a job is queued or a run exists", async () => {
  const harness = await harnessPromise;
  const at = "2026-10-01T00:00:00.000Z";
  const publicAsset = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: "Retry Public", dataClassification: "Public" });
  const restrictedAsset = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: "Retry Restricted", dataClassification: "Restricted" });

  // Questionnaire generation: the first attempt fails at the provider, then the request gains a Restricted asset.
  const generationRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "POLICY-RETRY-QUESTIONNAIRE", title: "Retry policy questionnaire", requestStatus: "submitted", requestor: harness.users.owner, informationAssets: [publicAsset],
  });
  const generationJob = await harness.withQuestionnaireProviderFailureCode("PROVIDER_TIMEOUT", "The provider timed out.", async () => {
    const started = await harness.request({ path: `/api/v1/assessment_requests/${generationRequest}/generate_questionnaire`, identity: harness.identities.analyst, init: { method: "POST" } });
    assert.equal(started.status, 202);
    const { jobId } = (await body(started)).data;
    assert.equal((await terminalJob(harness, `/api/v1/questionnaire_generation_jobs/${jobId}`)).status, "failed");
    return String(jobId);
  });

  // Assessment draft: a submitted questionnaire whose first draft attempt fails at the provider.
  const draftRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "POLICY-RETRY-DRAFT", title: "Retry policy draft", requestStatus: "questionnaire-in-progress", requestor: harness.users.owner, informationAssets: [publicAsset],
  });
  const questionnaire = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-POLICY-RETRY-DRAFT", title: "Retry policy questionnaire", assessmentRequest: draftRequest,
    releasedAt: at, releasedBy: harness.users.analyst, governanceLog: [{ schemaVersion: 1, kind: "released", at, by: harness.users.analyst }],
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Is the service reachable from the internet?", answerType: "Boolean", questionnaire,
    options: { schemaVersion: 1, questionKey: "internet-facing", section: { key: "hosting", title: "Hosting", order: 1 }, order: 1, required: true },
    answer: { schemaVersion: 1, value: true, state: "submitted", updatedAt: at, submittedAt: at },
  });
  const draftJob = await harness.withProviderFailure(async () => {
    const started = await harness.request({ path: `/api/v1/questionnaires/${questionnaire}/generate_assessment`, identity: harness.identities.analyst, init: { method: "POST" } });
    assert.equal(started.status, 202, JSON.stringify(await body(started.clone())));
    const { jobId } = (await body(started)).data;
    assert.equal((await terminalJob(harness, `/api/v1/assessment_draft_jobs/${jobId}`)).status, "failed");
    return String(jobId);
  });

  for (const requestId of [generationRequest, draftRequest]) {
    await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, { informationAssets: [publicAsset, restrictedAsset] });
  }
  const outcomes = [];
  for (const { requestId, retry, read } of [
    { requestId: generationRequest, retry: `/api/v1/questionnaire_generation_jobs/${generationJob}/retry`, read: `/api/v1/questionnaire_generation_jobs/${generationJob}` },
    { requestId: draftRequest, retry: `/api/v1/assessment_draft_jobs/${draftJob}/retry`, read: `/api/v1/assessment_draft_jobs/${draftJob}` },
  ]) {
    const runsBefore = await harness.listAiRunsForRequest(requestId);
    assert.equal(runsBefore.length, 1, `${retry} first attempt has its run`);
    const jobBefore = (await body(await harness.request({ path: read, identity: harness.identities.analyst }))).data;
    const response = await harness.request({ path: retry, identity: harness.identities.analyst, init: { method: "POST" } });
    outcomes.push({ retry, status: response.status, payload: await body(response), jobBefore, runsBefore, requestId, read });
  }
  // Both retries are checked before any assertion, so a failure shows what each one did.
  assert.deepEqual(outcomes.map(({ retry, status }) => [retry, status]), outcomes.map(({ retry }) => [retry, 409]), JSON.stringify(outcomes.map(({ payload }) => payload)));
  for (const { retry, payload, jobBefore, runsBefore, requestId, read } of outcomes) {
    assert.deepEqual(payload.error.details, { reason: "AI_CLASSIFICATION_ABOVE_CEILING" }, retry);
    assert.match(payload.error.message, /Restricted.*Public/, retry);
    const jobAfter = (await body(await harness.request({ path: read, identity: harness.identities.analyst }))).data;
    assert.deepEqual(jobAfter, jobBefore, `${retry} changed the job`);
    assert.equal(jobAfter.status, "failed");
    assert.equal(jobAfter.attempt, 1);
    assert.deepEqual(await harness.listAiRunsForRequest(requestId), runsBefore, `${retry} created a run`);
  }
});

const NOT_CONFIGURED = "AI_POLICY_NOT_CONFIGURED";
const NOT_CONFIGURED_MESSAGE = "The AI provider has not been approved for any information classification.";
/* Each runtime that is not development: either variable production, or both. */
const PRODUCTION_RUNTIMES = [["production", "production"], ["production", "development"], ["development", "production"]] as const;

/* A UAT-A-like request with its answered questionnaire (the draft) and a submitted Restricted request (the questionnaire). */
async function productionPolicyTargets(harness: Awaited<typeof harnessPromise>, label: string) {
  const draft = await harness.seedUatALikeRequest(`POLICY-${label}`);
  const restricted = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: `Policy ${label} Restricted`, dataClassification: "Restricted" });
  const generationRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: `POLICY-${label}`, title: `Policy ${label}`, requestStatus: "submitted", requestor: harness.users.owner, informationAssets: [restricted],
  });
  return {
    draft, generationRequest,
    cases: [
      { name: "questionnaire generation", requestId: generationRequest, job: "questionnaireGeneration", start: `/api/v1/assessment_requests/${generationRequest}/generate_questionnaire`, read: (jobId: string) => `/api/v1/questionnaire_generation_jobs/${jobId}` },
      { name: "assessment draft", requestId: draft.requestId, job: "assessmentDraft", start: `/api/v1/questionnaires/${draft.questionnaireId}/generate_assessment`, read: (jobId: string) => `/api/v1/assessment_draft_jobs/${jobId}` },
    ],
  };
}

/*
 * WR-201 (D-26, D-27, D-29): outside the development runtime an empty ceiling approves no classification. Whichever of
 * NODE_ENV and CSRM_ENVIRONMENT is production, both generations are refused at enqueue with AI_POLICY_NOT_CONFIGURED
 * and its message: no job, no run, no provider call, the request and questionnaire deep-equal, and the hub's jobs read
 * serves the same refusal.
 */
test("production with no ceiling refuses both generations at enqueue with AI_POLICY_NOT_CONFIGURED", async () => {
  const harness = await harnessPromise;
  const { draft, generationRequest, cases } = await productionPolicyTargets(harness, "PRODUCTION-ENQUEUE");
  const persisted = () => harness.snapshot([() => harness.getRequest(generationRequest), () => harness.getRequest(draft.requestId), () => harness.getQuestionnaire(draft.questionnaireId)]);
  const before = await persisted();
  await harness.withAiDataClassificationCeiling("", () => harness.withProviderCallRecorder(async (counts) => {
    for (const [nodeEnv, csrmEnvironment] of PRODUCTION_RUNTIMES) {
      await harness.withDevelopmentEnvironment(nodeEnv, csrmEnvironment, "true", async () => {
        for (const item of cases) {
          const label = `${item.name} under NODE_ENV ${nodeEnv} and CSRM_ENVIRONMENT ${csrmEnvironment}`;
          const response = await harness.request({ path: item.start, identity: harness.identities.analyst, init: { method: "POST" } });
          const payload = await body(response);
          assert.equal(response.status, 409, `${label}: ${JSON.stringify(payload)}`);
          assert.deepEqual(payload.error.details, { reason: NOT_CONFIGURED }, label);
          assert.equal(payload.error.message, NOT_CONFIGURED_MESSAGE, label);
          const jobs = (await body(await harness.request({ path: `/api/v1/assessment_requests/${item.requestId}/generation_jobs`, identity: harness.identities.analyst }))).data;
          assert.deepEqual(jobs.aiPolicy, { status: "refused", reason: NOT_CONFIGURED, requestClassification: "Restricted", classificationSource: "assets", ceiling: null }, `${label}: GENERATION_JOBS_POLICY`);
          assert.equal(jobs[item.job], null, `${label}: a job was queued`);
        }
      });
    }
    assert.deepEqual([counts.questionnaire(), counts.assessment()], [0, 0], "a provider was called");
  }));
  assert.deepEqual(await persisted(), before, "a refused enqueue changed the request or the questionnaire");
  for (const item of cases) assert.deepEqual(await harness.listAiRunsForRequest(item.requestId), [], `${item.name}: a refusal created a run`);
});

/*
 * WR-201 and IN-208 (D-27, D-28): a job re-checks the policy when it runs, through the registry. Each job is queued in
 * development under an allowing ceiling (Restricted) and held before it builds its context; the runtime then turns
 * production with an empty ceiling, and the job is released. It ends failed with AI_POLICY_NOT_CONFIGURED and its
 * message, with no run and no provider call, and nothing is saved.
 */
test("a queued job that runs once production has no ceiling fails with AI_POLICY_NOT_CONFIGURED before a run or a provider call", async () => {
  const harness = await harnessPromise;
  const { draft, generationRequest, cases } = await productionPolicyTargets(harness, "PRODUCTION-EXECUTION");
  await harness.withProviderCallRecorder(async (counts) => {
    for (const item of cases) {
      const job = await harness.withAiDataClassificationCeiling("Restricted", () => harness.withHeldAiContext(async ({ reached, release }) => {
        const started = await harness.request({ path: item.start, identity: harness.identities.analyst, init: { method: "POST" } });
        assert.equal(started.status, 202, `${item.name} is queued under the allowing ceiling: ${await started.clone().text()}`);
        const { jobId } = (await body(started)).data;
        await reached;
        return harness.withAiDataClassificationCeiling("", () => harness.withDevelopmentEnvironment("production", "production", "true", async () => {
          release();
          return terminalJob(harness, item.read(String(jobId)));
        }));
      }));
      assert.equal(job.status, "failed", `${item.name}: ${JSON.stringify(job)}`);
      assert.equal(job.attempt, 1, item.name);
      assert.equal(job.failureCode, NOT_CONFIGURED, `${item.name}: JOB_FAILURE_CODE`);
      assert.equal(job.failureMessage, NOT_CONFIGURED_MESSAGE, item.name);
      assert.deepEqual(await harness.listAiRunsForRequest(item.requestId), [], `${item.name}: the refused job created a run`);
    }
    assert.deepEqual([counts.questionnaire(), counts.assessment()], [0, 0], "a provider was called");
  });
  const generation = await harness.getRequest(generationRequest);
  assert.deepEqual([generation?.requestStatus, generation?.questionnaire ?? null], ["submitted", null], "the refused generation saved a questionnaire");
  const drafted = await harness.getRequest(draft.requestId);
  assert.deepEqual([drafted?.requestStatus, drafted?.assessment ?? null], ["questionnaire-in-progress", null], "the refused draft saved an assessment");
});
