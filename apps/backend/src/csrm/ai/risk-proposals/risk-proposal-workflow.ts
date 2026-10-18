import type { Core } from "@strapi/strapi";
import { createProposalJobRegistry, ProposalJobFailure, ProposalJobRegistryError, type AssessmentProposalJobTarget, type ProposalJob, type ProposalJobReport } from "../proposal-job-registry";
import { InstructionShapeError, parseAnalystInstruction, repeatsRequestorText, type SlotInstruction } from "../analyst-instruction";
import { AssessmentContextTooLargeError } from "../assessment-context";
import { buildAssessmentContextFor, failureAttachmentIds, loadRiskProposalClassifications, failureAttachmentsEntry, resolveContextAttachments, type AssessmentContextStrapi, type ContextAttachmentReader, type ResolvedContextAttachment } from "../assessment-context-loader";
import { aiPolicyRefusalMessage, evaluateAiDataPolicy, readAiDataPolicyConfiguration } from "../data-policy";
import { foldItemStates } from "../proposal-items";
import { isActiveRisk } from "../../active-risk";
import type { ConflictReason } from "../../conflict-reasons";
import { generationJobViewerFacts, resolveGenerationJobInitiators, type GenerationJobViewerFacts } from "../../generation-job-viewer";
import { appendAiRunDecisions, completeAiRun, createRunningAiRun, failAiRun, parseRunDecisionsFor, parseRunProposalFor } from "../../../api/csrm-ai-run/services/ai-run-record";
import {
  assertAssessmentEditable,
  AssessmentWorkflowError,
  assessmentReleasePopulate,
  isAssessmentEditable,
  withAssessmentLock,
  type AssessmentMutationStrapi,
} from "../../../api/csrm-assessment/services/assessment-workflow";
import { loadRequestorTextCorpus, type ProposalWorkflowStrapi } from "../../../api/csrm-questionnaire/services/questionnaire-proposals-workflow";
import type { FocusPart } from "./field-units";
import type { RiskDecisionEvent, RiskProposalOperation, RiskProposalV1 } from "./risk-proposal-envelope";
import { toRiskRewriteProposal, toRiskSuggestionsProposal } from "./risk-proposal-adapter";
import { parseRewriteFocus } from "./risk-proposal-context";
import { selectRiskProposalProvider } from "./risk-proposal-provider";

/*
 * Phase 16 targeted AI re-runs as jobs (D-22, D-24 to D-27, D-29, D-40, D-43; 16-RESEARCH "The proposal jobs (D-26)").
 *
 * A human Security Analyst who did not raise the request starts "Suggest more risks" for an editable assessment
 * (`suggestions:{assessmentId}`) or "Rewrite this risk" for one of its active Risks (`rewrite:{riskId}`), optionally with
 * an instruction (and a rewrite's focus), and gets a job from Phase 15's generic registry, instantiated here once per
 * Strapi with the assessment target. The job:
 *  1. re-checks the editable guard (D-22) and a rewrite's Risk (D-29) and fails, with no run, when either refuses;
 *  2. re-checks the run cap and the AI data policy and fails, with nothing sent and no run, when either refuses (D-25);
 *  3. builds the context (over its bounds: CONTEXT_TOO_LARGE, no run, 06.7 D-10);
 *  4. creates the run just before the one provider call, which runs outside any lock (Phase 12 D-19, D-20);
 *  5. passes the provider's wire output through the one adapter (16-08);
 *  6. completes the run with the proposal inside the assessment's lock, without the guard or the edit transition: the
 *     run writes only itself, so no risk and no assessment field changes until an analyst confirms an item (D-24).
 *     There it records every item lapsed when the assessment stopped being editable, a rewrite's units superseded when
 *     its Risk was withdrawn, and a newer rewrite's supersession of the older open units of the same Risk (D-40).
 * Any failure after the run exists closes it as failed with a safe code. A retry is the retrying analyst's new run.
 */

type Row = Record<string, unknown>;
type Documents = {
  findOne: (query: Row) => Promise<Row | null>;
  findMany: (query: Row) => Promise<Row[]>;
  update: (query: { documentId: string; data: Row }) => Promise<Row>;
};
export type RiskProposalStrapi = {
  documents: (uid: string) => Documents;
  config: { get: (key: string) => unknown };
  db: AssessmentMutationStrapi["db"];
};

const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";
const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const RUN_UID = "api::csrm-ai-run.csrm-ai-run";

export class RiskProposalWorkflowError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
    super(message);
    this.name = "RiskProposalWorkflowError";
  }
}

/** What a job carries beyond its target: the request it reads, the validated instruction and a rewrite's focus. */
export type RiskProposalJobInput = { requestId: string; instruction: string | null; focus: FocusPart[] | null };
export type RiskProposalJob = ProposalJob<RiskProposalJobInput, AssessmentProposalJobTarget>;

/**
 * Who starts, follows or retries a job, or reads the proposals: the resolved IdamBox User's documentId and, from the
 * policy (13-03), whether the route admitted them through the human Security Analyst role (which excludes a registered
 * source service user). Every risk AI operation is human analyst work (D-43), so without that fact the workflow refuses.
 */
export type RiskProposalViewer = { documentId: string; humanAnalyst: boolean };

const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const relationId = (value: unknown): string | null => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 255;

/* ---------------------------------------------------------------------------------------------------------------------
 * The registry, one per Strapi
 * ------------------------------------------------------------------------------------------------------------------- */

const registryByStrapi = new WeakMap<object, ReturnType<typeof createProposalJobRegistry<RiskProposalJobInput, AssessmentProposalJobTarget>>>();
function registry(strapi: RiskProposalStrapi) {
  const existing = registryByStrapi.get(strapi as object);
  if (existing) return existing;
  const created = createProposalJobRegistry<RiskProposalJobInput, AssessmentProposalJobTarget>({ execute: (job, report) => executeRiskProposalJob(strapi, job, report) });
  registryByStrapi.set(strapi as object, created);
  return created;
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The rules a start meets, each read again by the job where it can change
 * ------------------------------------------------------------------------------------------------------------------- */

/** D-31 and the Phase 16 amendment: an assessment holds at most 100 completed risk proposal runs of both operations. */
export const RISK_PROPOSAL_RUN_LIMIT = 100;
const RUN_LIMIT_MESSAGE = "This risk assessment has reached its limit of AI proposal runs.";
const RISK_PROPOSAL_RUN_OPERATIONS: readonly RiskProposalOperation[] = ["risk-suggestions", "risk-rewrite"];
const NOT_EDITABLE_MESSAGE = "The risk assessment can no longer change, so the AI was not asked.";

async function completedRunCount(strapi: RiskProposalStrapi, assessmentId: string): Promise<number> {
  const runs = await strapi.documents(RUN_UID).findMany({
    filters: { assessment: { documentId: { $eq: assessmentId } }, operation: { $in: [...RISK_PROPOSAL_RUN_OPERATIONS] }, status: { $eq: "completed" } },
    fields: ["documentId"],
    limit: RISK_PROPOSAL_RUN_LIMIT,
  });
  return runs.length;
}

/* The cap counts the runs still queued or running, so concurrent starts cannot pass it together (Phase 15 BE01). */
async function assertRunCapacity(strapi: RiskProposalStrapi, assessmentId: string, reservations: number): Promise<void> {
  if (await completedRunCount(strapi, assessmentId) + reservations >= RISK_PROPOSAL_RUN_LIMIT) throw new RiskProposalWorkflowError(409, RUN_LIMIT_MESSAGE, "AI_PROPOSAL_RUN_LIMIT");
}

/*
 * The AI data policy a run of `operation` on this assessment would face (Phase 12 D-28): its refusal reason and message,
 * or null. It weighs the request's assets and the Risks that operation's context lists (BE2-05, T-16-26).
 */
export async function riskProposalPolicyRefusal(strapi: RiskProposalStrapi, requestId: string, scope: { assessmentId: string; operation: RiskProposalOperation }): Promise<{ reason: ConflictReason; message: string } | null> {
  const request = await strapi.documents(REQUEST_UID).findOne({ documentId: requestId, fields: ["documentId"], populate: { informationAssets: { fields: ["dataClassification"] } } });
  const assets = request && Array.isArray(request.informationAssets) ? request.informationAssets.filter(record) : [];
  const risks = await loadRiskProposalClassifications(strapi as unknown as AssessmentContextStrapi, scope);
  const policy = evaluateAiDataPolicy({ assets: [...assets, ...risks], ...readAiDataPolicyConfiguration(strapi) });
  if (policy.status !== "refused") return null;
  return { reason: policy.reason ?? "AI_POLICY_NOT_CONFIGURED", message: aiPolicyRefusalMessage(policy) ?? "The request cannot be sent to the provider." };
}

/*
 * D-27 (Phase 15 D-18): the Requestor's text an instruction may not repeat, read through Phase 15's corpus, with the
 * request's questionnaire for its submitted answers. A request with no questionnaire contributes no answer.
 */
async function requestorTextCorpus(strapi: RiskProposalStrapi, requestId: string): Promise<string[]> {
  const [questionnaire] = await strapi.documents(QUESTIONNAIRE_UID).findMany({ filters: { assessmentRequest: { documentId: { $eq: requestId } } }, fields: ["documentId"], limit: 1 });
  const questionnaireId = questionnaire && nonEmpty(questionnaire.documentId) ? questionnaire.documentId : null;
  // Without a questionnaire the corpus reads the request, its notes and its files.
  return loadRequestorTextCorpus(strapi as unknown as ProposalWorkflowStrapi, { requestId, questionnaireId });
}

const BODY_INVALID = "CSRM risk AI proposal data is invalid.";

function validatedInstruction(raw: unknown): string | null {
  let parsed: ReturnType<typeof parseAnalystInstruction>;
  try {
    parsed = parseAnalystInstruction(raw);
  } catch (error) {
    if (error instanceof InstructionShapeError) throw new RiskProposalWorkflowError(400, BODY_INVALID);
    throw error;
  }
  if (!parsed.ok) throw new RiskProposalWorkflowError(400, "CSRM analyst instruction is not allowed.", parsed.reason);
  return parsed.instruction;
}

async function assertInstructionAllowed(strapi: RiskProposalStrapi, requestId: string, instruction: string | null): Promise<void> {
  if (instruction !== null && repeatsRequestorText(instruction, await requestorTextCorpus(strapi, requestId))) {
    throw new RiskProposalWorkflowError(400, "The instruction repeats the Requestor’s text, which the AI already reads.", "INSTRUCTION_REPEATS_REQUESTOR_TEXT");
  }
}

/* The closed body `{ instruction? }`: absent, null or an object with only that key, the instruction a string or null. */
function parseSuggestionsBody(body: unknown): { instruction: unknown } {
  if (body === undefined || body === null) return { instruction: undefined };
  if (!record(body) || Object.keys(body).some((key) => key !== "instruction")) throw new RiskProposalWorkflowError(400, BODY_INVALID);
  if (body.instruction !== undefined && body.instruction !== null && typeof body.instruction !== "string") throw new RiskProposalWorkflowError(400, BODY_INVALID);
  return { instruction: body.instruction };
}

function humanAnalyst(viewer: RiskProposalViewer): string {
  if (!record(viewer) || viewer.humanAnalyst !== true || !nonEmpty(viewer.documentId) || viewer.documentId.trim().length === 0) {
    throw new RiskProposalWorkflowError(403, "CSRM risk AI proposals are denied.");
  }
  return viewer.documentId;
}

/* G-1 (the Orchestrator Confirmation narrowing D-44): an analyst who raised the request takes no targeted AI action. */
function assertNotOwnRequest(assessment: Row, analystId: string): void {
  const request = record(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
  if (request && relationId(request.requestor) === analystId) {
    throw new RiskProposalWorkflowError(403, "CSRM risk AI proposals are denied on a request you raised.", "OWN_REQUEST");
  }
}

/* D-22: the one editable guard; its 409 keeps its closed reason. */
function assertEditable(assessment: Row, analystId: string): void {
  try {
    assertAssessmentEditable({ assessment, actor: { documentId: analystId } });
  } catch (error) {
    if (error instanceof AssessmentWorkflowError) throw new RiskProposalWorkflowError(error.status, error.message, error.reason);
    throw error;
  }
}

function requestIdOf(assessment: Row): string {
  const requestId = record(assessment.assessmentRequest) ? relationId(assessment.assessmentRequest) : null;
  if (!requestId) throw new RiskProposalWorkflowError(404, "CSRM assessment was not found.");
  return requestId;
}

const RISK_UID = "api::csrm-risk.csrm-risk";
const RISK_NOT_FOUND = "CSRM Risk was not found.";
const RISK_WITHDRAWN_MESSAGE = "This risk is withdrawn, so the AI cannot rewrite it.";

/* One Risk by documentId with its assessment and withdrawal fact (a withdrawn one included: the caller refuses it). */
async function loadRisk(strapi: RiskProposalStrapi, riskId: string): Promise<Row | null> {
  if (!nonEmpty(riskId)) return null;
  return strapi.documents(RISK_UID).findOne({ documentId: riskId, fields: ["documentId", "withdrawnAt"], populate: { assessment: { fields: ["documentId"] }, withdrawnBy: { fields: ["documentId"] } } });
}

/* D-29: a rewrite targets an active Risk of the assessment; a withdrawn one is 409 RISK_WITHDRAWN, any other 404. */
async function assertRewriteTarget(strapi: RiskProposalStrapi, riskId: string, assessmentId: string): Promise<void> {
  const risk = await loadRisk(strapi, riskId);
  if (!risk || relationId(risk.assessment) !== assessmentId) throw new RiskProposalWorkflowError(404, RISK_NOT_FOUND);
  if (!isActiveRisk(risk)) throw new RiskProposalWorkflowError(409, RISK_WITHDRAWN_MESSAGE, "RISK_WITHDRAWN");
}

/* The closed body `{ instruction?, focus? }`; a focus is a non-empty array of distinct parts (absent or null: every part). */
function parseRewriteBody(body: unknown): { instruction: unknown; focus: FocusPart[] | null } {
  if (body === undefined || body === null) return { instruction: undefined, focus: null };
  if (!record(body) || Object.keys(body).some((key) => key !== "instruction" && key !== "focus")) throw new RiskProposalWorkflowError(400, BODY_INVALID);
  if (body.instruction !== undefined && body.instruction !== null && typeof body.instruction !== "string") throw new RiskProposalWorkflowError(400, BODY_INVALID);
  let focus: FocusPart[] | null;
  try {
    focus = parseRewriteFocus(body.focus);
  } catch {
    throw new RiskProposalWorkflowError(400, "CSRM risk rewrite focus is invalid.");
  }
  return { instruction: body.instruction, focus };
}

/* The assessment with its request's requestor, for the existence and OWN_REQUEST checks before any lock. */
async function loadAssessmentForViewer(strapi: RiskProposalStrapi, assessmentId: string): Promise<Row | null> {
  if (!nonEmpty(assessmentId)) return null;
  return strapi.documents(ASSESSMENT_UID).findOne({ documentId: assessmentId, populate: { assessmentRequest: { populate: { requestor: { fields: ["documentId"] } } } } });
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Execution
 * ------------------------------------------------------------------------------------------------------------------- */

const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/* Any failure as the job keeps it: the closed failures of the loader, the adapter and the hosted provider by their code. */
function toProposalJobFailure(error: unknown): ProposalJobFailure {
  if (error instanceof ProposalJobFailure && SAFE_CODE.test(error.code)) return error;
  if (error instanceof AssessmentContextTooLargeError) return new ProposalJobFailure(error.code, error.safeMessage, error.attachmentDocumentIds);
  return new ProposalJobFailure("AI_PROPOSAL_FAILED", "The AI proposal failed safely.");
}

async function executeRiskProposalJob(strapi: RiskProposalStrapi, job: RiskProposalJob, report: ProposalJobReport): Promise<{ runId: string }> {
  const operation = job.operation as RiskProposalOperation;
  const { assessmentId, riskId } = job.target;
  const core = strapi as unknown as Core.Strapi;
  // 1. The guard may have moved since the start: no run is created when the assessment can no longer change.
  const assessment = await strapi.documents(ASSESSMENT_UID).findOne({ documentId: assessmentId, populate: assessmentReleasePopulate });
  const requestId = assessment && record(assessment.assessmentRequest) ? relationId(assessment.assessmentRequest) : null;
  if (!assessment || requestId !== job.input.requestId) throw new ProposalJobFailure("ASSESSMENT_NOT_FOUND", "The risk assessment was not found.");
  if (!isAssessmentEditable({ assessment, actor: { documentId: job.initiatingAnalystDocumentId } })) throw new ProposalJobFailure("ASSESSMENT_NOT_MUTABLE", NOT_EDITABLE_MESSAGE);
  if (riskId !== null) {
    const risk = await loadRisk(strapi, riskId);
    if (!risk || relationId(risk.assessment) !== assessmentId) throw new ProposalJobFailure("RISK_NOT_FOUND", "The risk was not found.");
    if (!isActiveRisk(risk)) throw new ProposalJobFailure("RISK_WITHDRAWN", RISK_WITHDRAWN_MESSAGE);
  }
  // 2. The run cap and the AI data policy, before anything is built or sent (D-25; Phase 12 D-28).
  if (await completedRunCount(strapi, assessmentId) >= RISK_PROPOSAL_RUN_LIMIT) throw new ProposalJobFailure("AI_PROPOSAL_RUN_LIMIT", RUN_LIMIT_MESSAGE);
  const refusedByPolicy = await riskProposalPolicyRefusal(strapi, requestId, { assessmentId, operation });
  if (refusedByPolicy) throw new ProposalJobFailure(refusedByPolicy.reason, refusedByPolicy.message);
  // 3. The context; one over its bounds fails before any run (06.7 D-10).
  let built: Awaited<ReturnType<typeof buildAssessmentContextFor>>;
  try {
    built = await buildAssessmentContextFor(strapi as unknown as AssessmentContextStrapi, {
      operation, requestId, assessmentId, instruction: job.input.instruction as SlotInstruction | null,
      ...(riskId !== null ? { targetRiskId: riskId, focus: job.input.focus } : {}),
    });
  } catch (error) {
    throw toProposalJobFailure(error);
  }
  if (built.policy.status === "refused") throw new ProposalJobFailure(built.policy.reason ?? "AI_POLICY_NOT_CONFIGURED", aiPolicyRefusalMessage(built.policy) ?? "The request cannot be sent to the provider.");
  const provider = selectRiskProposalProvider();
  // 4. The run, just before the one provider call (Phase 12 D-19, D-20).
  const run = await createRunningAiRun(core, {
    operation, initiatedBy: job.initiatingAnalystDocumentId, providerName: provider.name, providerVersion: provider.version,
    assessmentRequest: requestId, assessment: assessmentId, ...(riskId !== null ? { risk: riskId } : {}), contextSummary: built.context.summary,
    jobId: job.jobId, attempt: job.attempt, ...(job.input.instruction ? { instruction: job.input.instruction } : {}),
  });
  const runId = String(run.documentId);
  report.recordRun(runId);
  try {
    // 5. The provider, outside any lock, and the one adapter.
    const input = { context: built.context, records: built.records, instruction: built.steering.instruction };
    const proposal = riskId !== null
      ? toRiskRewriteProposal(await provider.rewrite(input), built.context)
      : toRiskSuggestionsProposal(await provider.suggest(input), built.context);
    // 6. The run's proposal, under the assessment's lock.
    await completeRiskProposalRun(strapi, { job, runId, proposal });
    return { runId };
  } catch (error) {
    const failure = toProposalJobFailure(error);
    // A run another path already closed (interrupted at a restart) keeps that status; the job still fails with its code.
    try { await failAiRun(core, runId, { code: failure.code, message: failure.safeMessage }); } catch { /* already closed */ }
    throw failure;
  }
}

type Completion = { job: RiskProposalJob; runId: string; proposal: RiskProposalV1 };

const decision = (event: Omit<RiskDecisionEvent, "schemaVersion">): RiskDecisionEvent => ({ schemaVersion: 2, ...event }) as RiskDecisionEvent;

/*
 * D-37 and D-40 (16-RESEARCH Pitfall 12): a newer rewrite that completes with at least one change supersedes every unit
 * of the same Risk that an older completed rewrite still has open, recorded with the newer run's initiating analyst and
 * the newer run as its cause. A damaged older run (a proposal, decisions or fold that does not read) is left as it is:
 * nothing may decide it anyway.
 */
async function supersedeOlderRewrites(strapi: RiskProposalStrapi, input: { assessmentId: string; riskId: string; runId: string; by: string; at: string }): Promise<void> {
  const core = strapi as unknown as Core.Strapi;
  const runs = await strapi.documents(RUN_UID).findMany({
    filters: { assessment: { documentId: { $eq: input.assessmentId } }, risk: { documentId: { $eq: input.riskId } }, operation: { $eq: "risk-rewrite" }, status: { $eq: "completed" } },
    fields: ["documentId", "proposal", "decisions"], sort: ["completedAt:asc", "id:asc"], limit: RISK_PROPOSAL_RUN_LIMIT + 1,
  });
  for (const run of runs) {
    if (typeof run.documentId !== "string" || run.documentId === input.runId) continue;
    const proposal = parseRunProposalFor("risk-rewrite", run.proposal);
    const events = parseRunDecisionsFor("risk-rewrite", run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    if (!proposal || !states) continue;
    const superseded = proposal.items
      .filter((item) => item.kind === "change" && item.riskDocumentId === input.riskId && states.get(item.key) === "open")
      .map((item) => decision({ at: input.at, by: input.by, item: item.key, action: "superseded", cause: { kind: "newer-rewrite", runId: input.runId } }));
    if (superseded.length) await appendAiRunDecisions(core, run.documentId, superseded);
  }
}

/*
 * D-24 and D-40: the run's proposal, inside the assessment's lock (16-RESEARCH Pitfall 9) but without the editable guard
 * or the edit transition: completing a run changes no risk and no review state. Under the same lock:
 *  - an assessment that stopped being editable while the job ran records every item lapsed, by the system;
 *  - a rewrite whose Risk was withdrawn meanwhile records every unit superseded, by the analyst who withdrew it;
 *  - otherwise a rewrite with at least one unit supersedes the older open units of the same Risk.
 */
async function completeRiskProposalRun(strapi: RiskProposalStrapi, completion: Completion): Promise<void> {
  const { job, runId, proposal } = completion;
  const { assessmentId, riskId } = job.target;
  const core = strapi as unknown as Core.Strapi;
  await withAssessmentLock(strapi as unknown as AssessmentMutationStrapi, assessmentId, async ({ assessment }) => {
    const at = new Date().toISOString();
    const editable = isAssessmentEditable({ assessment, actor: { documentId: job.initiatingAnalystDocumentId } });
    const risk = editable && riskId !== null ? await loadRisk(strapi, riskId) : null;
    const withdrawnMeanwhile = risk !== null && !isActiveRisk(risk);
    await completeAiRun(core, runId, { proposal, assessment: assessmentId });
    if (proposal.items.length === 0) return;
    if (!editable) {
      await appendAiRunDecisions(core, runId, proposal.items.map((item) => decision({ at, by: "system", item: item.key, action: "lapsed", cause: { kind: "assessment-not-editable" } })));
      return;
    }
    if (withdrawnMeanwhile && riskId !== null) {
      const by = relationId(risk?.withdrawnBy) ?? "system";
      await appendAiRunDecisions(core, runId, proposal.items.map((item) => decision({ at, by, item: item.key, action: "superseded", cause: { kind: "risk-withdrawn", riskDocumentId: riskId } })));
      return;
    }
    if (riskId !== null) await supersedeOlderRewrites(strapi, { assessmentId, riskId, runId, by: job.initiatingAnalystDocumentId, at });
  });
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Starts
 * ------------------------------------------------------------------------------------------------------------------- */

type StartInput = { strapi: RiskProposalStrapi; body?: unknown; viewer: RiskProposalViewer };

/*
 * The enqueue order (leak-safe): the closed body (400) → the human analyst fact (403) → the assessment exists (404) →
 * the analyst did not raise the request (403 OWN_REQUEST) → under the assessment's lock (read only, so concurrent starts
 * meet the run cap one at a time): the editable guard (409 ASSESSMENT_NOT_MUTABLE) → a rewrite's Risk is active (409
 * RISK_WITHDRAWN) → the instruction is valid (400) and repeats no Requestor text (400) → the run cap (409
 * AI_PROPOSAL_RUN_LIMIT) → the AI data policy (409) → enqueue, or the active job on the same key (202 either way).
 */
async function startRiskProposalJob(input: StartInput & { assessmentId: string }, operation: RiskProposalOperation, riskId: string | null, body: { instruction: unknown; focus: FocusPart[] | null }): Promise<Row> {
  const analystId = humanAnalyst(input.viewer);
  const { strapi } = input;
  const assessmentId = input.assessmentId;
  const viewed = await loadAssessmentForViewer(strapi, assessmentId);
  if (!viewed) throw new RiskProposalWorkflowError(404, "CSRM assessment was not found.");
  assertNotOwnRequest(viewed, analystId);
  let ownsReservation = false;
  let reserved: RiskProposalJob | undefined;
  try {
    await withAssessmentLock(strapi as unknown as AssessmentMutationStrapi, assessmentId, async ({ assessment }) => {
      assertNotOwnRequest(assessment, analystId);
      assertEditable(assessment, analystId);
      if (riskId !== null) await assertRewriteTarget(strapi, riskId, assessmentId);
      const requestId = requestIdOf(assessment);
      const instruction = validatedInstruction(body.instruction);
      await assertInstructionAllowed(strapi, requestId, instruction);
      const key = riskId === null ? `suggestions:${assessmentId}` : `rewrite:${riskId}`;
      const active = registry(strapi).activeFor(assessmentId);
      const existing = active.find((job) => job.key === key);
      if (!existing) await assertRunCapacity(strapi, assessmentId, active.length);
      const refusedByPolicy = await riskProposalPolicyRefusal(strapi, requestId, { assessmentId, operation });
      if (refusedByPolicy) throw new RiskProposalWorkflowError(409, refusedByPolicy.message, refusedByPolicy.reason);
      ownsReservation = !existing;
      try {
        reserved = existing ?? registry(strapi).enqueue({
          key, operation, target: { kind: "assessment", assessmentId, riskId },
          input: { requestId, instruction, focus: body.focus }, initiatingAnalystDocumentId: analystId,
        }, true);
      } catch (error) {
        // As the retry does: the registry's own 400 or 409 answers as this workflow's error, never a 500 (BE2-10).
        if (error instanceof ProposalJobRegistryError) throw new RiskProposalWorkflowError(error.status, error.message);
        throw error;
      }
    });
  } catch (error) {
    if (ownsReservation && reserved) registry(strapi).discardReserved(reserved.jobId);
    throw error;
  }
  const job = reserved as RiskProposalJob;
  registry(strapi).launchReserved(job.jobId);
  return projectedJob(strapi, job, analystId);
}

/** D-30: "Suggest more risks" for an editable assessment, optionally steered by an instruction (the default task without one). */
export function startRiskSuggestions(input: StartInput & { assessmentId: string }): Promise<Row> {
  const body = parseSuggestionsBody(input.body);
  return startRiskProposalJob(input, "risk-suggestions", null, { instruction: body.instruction, focus: null });
}

/**
 * D-34 and D-35: "Rewrite this risk" for one active Risk of an editable assessment, optionally steered by an instruction
 * and narrowed by a focus. An unknown Risk, or one with no assessment, is 404 before anything else is said about it.
 */
export async function startRiskRewrite(input: StartInput & { riskId: string }): Promise<Row> {
  const body = parseRewriteBody(input.body);
  humanAnalyst(input.viewer);
  const risk = await loadRisk(input.strapi, input.riskId);
  const assessmentId = risk ? relationId(risk.assessment) : null;
  if (!risk || !assessmentId) throw new RiskProposalWorkflowError(404, RISK_NOT_FOUND);
  return startRiskProposalJob({ ...input, assessmentId }, "risk-rewrite", input.riskId, body);
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Job read and retry
 * ------------------------------------------------------------------------------------------------------------------- */

type JobRequest = { strapi: RiskProposalStrapi; jobId: string; viewer: RiskProposalViewer };

/*
 * D-26 (Phase 13 D-18): any human Security Analyst follows and retries a retained job, except on a request they raised
 * (403 OWN_REQUEST), whoever started it. An unknown or expired job, or one whose assessment is gone, is 404.
 */
async function accessibleJob(input: JobRequest): Promise<{ job: RiskProposalJob; analystId: string; assessment: Row }> {
  const analystId = humanAnalyst(input.viewer);
  const job = nonEmpty(input.jobId) ? registry(input.strapi).get(input.jobId) : null;
  if (!job) throw new RiskProposalWorkflowError(404, "CSRM risk AI proposal job was not found.");
  const assessment = await loadAssessmentForViewer(input.strapi, job.target.assessmentId);
  if (!assessment) throw new RiskProposalWorkflowError(404, "CSRM risk AI proposal job was not found.");
  assertNotOwnRequest(assessment, analystId);
  return { job, analystId, assessment };
}

/*
 * D-26, D-41: a failed job may be retried while nothing runs on its target and no later job on its target has replaced
 * it (16-REVIEW BE2-08): a retry then would only repeat a run and, for a rewrite, supersede the later run's changes.
 */
function mayRetryRiskJob(strapi: RiskProposalStrapi, job: RiskProposalJob): boolean {
  return registry(strapi).mayRetry(job) && registry(strapi).isNewestOnKey(job);
}

async function jobViewerFacts(strapi: RiskProposalStrapi, job: RiskProposalJob, viewerId: string): Promise<GenerationJobViewerFacts> {
  const initiators = await resolveGenerationJobInitiators(strapi, [job.initiatingAnalystDocumentId]);
  return generationJobViewerFacts({ initiatorDocumentId: job.initiatingAnalystDocumentId, viewerDocumentId: viewerId, canRetry: mayRetryRiskJob(strapi, job), initiators });
}

/* The projection with the files a too-large failure counted, named by what their records say now (Phase 14 D-33). */
async function projectedJob(strapi: RiskProposalStrapi, job: RiskProposalJob, analystId: string): Promise<Row> {
  const names = await resolveContextAttachments(strapi as unknown as ContextAttachmentReader, failureAttachmentIds(job.failure));
  return projectRiskProposalJob(job, await jobViewerFacts(strapi, job, analystId), names);
}

/** D-26: a risk proposal job as the analyst reading it sees it. */
export async function getRiskProposalJob(input: JobRequest): Promise<Row> {
  const { job, analystId } = await accessibleJob(input);
  return projectedJob(input.strapi, job, analystId);
}

/**
 * D-26 and Phase 13 D-18: a failed job's new attempt, initiated by the retrying analyst, so its run names them. Only a
 * failed job whose key has no active job is retried (409 otherwise). A retry meets the start's checks again from the
 * guard on, under the assessment's lock and before anything is queued: the guard, a rewrite's Risk, the instruction
 * against the Requestor's text now, the run cap and the AI data policy. The job re-checks them all before any run.
 */
export async function retryRiskProposalJob(input: JobRequest): Promise<Row> {
  const { job, analystId } = await accessibleJob(input);
  const { strapi } = input;
  const { assessmentId, riskId } = job.target;
  let retried: RiskProposalJob | undefined;
  try {
    await withAssessmentLock(strapi as unknown as AssessmentMutationStrapi, assessmentId, async ({ assessment }) => {
      assertNotOwnRequest(assessment, analystId);
      if (!mayRetryRiskJob(strapi, job)) throw new RiskProposalWorkflowError(409, "Only a failed AI proposal job can be retried.");
      assertEditable(assessment, analystId);
      if (riskId !== null) await assertRewriteTarget(strapi, riskId, assessmentId);
      const requestId = requestIdOf(assessment);
      await assertInstructionAllowed(strapi, requestId, job.input.instruction);
      await assertRunCapacity(strapi, assessmentId, registry(strapi).activeFor(assessmentId).length);
      const refusedByPolicy = await riskProposalPolicyRefusal(strapi, requestId, { assessmentId, operation: job.operation as RiskProposalOperation });
      if (refusedByPolicy) throw new RiskProposalWorkflowError(409, refusedByPolicy.message, refusedByPolicy.reason);
      try {
        retried = registry(strapi).retry(job.jobId, analystId, true);
      } catch (error) {
        if (error instanceof ProposalJobRegistryError) throw new RiskProposalWorkflowError(error.status, error.message);
        throw error;
      }
    });
  } catch (error) {
    // BE2-16: the failed job stays as it was, so its failure is still read and may be retried.
    if (retried) registry(strapi).restoreFailed(job);
    throw error;
  }
  registry(strapi).launchReserved((retried as RiskProposalJob).jobId);
  return projectedJob(strapi, retried as RiskProposalJob, analystId);
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The job projection
 * ------------------------------------------------------------------------------------------------------------------- */

/**
 * The job as an analyst reads it: never the registry's input or initiator field as such. `initiatedBy` names who started
 * the job or its latest retry, resolved at read time, and `initiatedByViewer` whether that is the viewer; `canRetry` is
 * whether this viewer may retry it now (Phase 13 D-18). A CONTEXT_TOO_LARGE failure that kept files names them by their
 * current names (`failureAttachments`, Phase 14 D-33); any other job carries no such key.
 */
export function projectRiskProposalJob(job: RiskProposalJob, viewer: GenerationJobViewerFacts, names: ReadonlyMap<string, ResolvedContextAttachment> = new Map()): Row {
  return {
    jobId: job.jobId,
    operation: job.operation,
    assessmentId: job.target.assessmentId,
    riskId: job.target.riskId,
    status: job.status,
    attempt: job.attempt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    runId: job.runId ?? null,
    failureCode: job.failure?.code ?? null,
    failureMessage: job.failure?.message ?? null,
    ...failureAttachmentsEntry(job.failure, names),
    initiatedBy: viewer.initiatedBy,
    initiatedByViewer: viewer.initiatedByViewer,
    canRetry: viewer.canRetry,
  };
}

/**
 * The jobs the proposals read lists (D-41): the active job per target, then the latest failed job of each target that
 * has no active job, while the registry still retains it, each as `analystId` reads it.
 */
export async function projectedRiskProposalJobs(strapi: RiskProposalStrapi, assessmentId: string, analystId: string): Promise<Row[]> {
  const active = registry(strapi).activeFor(assessmentId);
  const failed = registry(strapi).failedFor(assessmentId).filter((job) => !active.some((candidate) => candidate.key === job.key));
  const projected: Row[] = [];
  for (const job of [...active, ...failed]) projected.push(await projectedJob(strapi, job, analystId));
  return projected;
}

/** The assessment's queued and running risk proposal jobs in this process, oldest first (D-26; R-08-36). */
export function activeRiskProposalJobs(strapi: RiskProposalStrapi, assessmentId: string): readonly RiskProposalJob[] {
  return registry(strapi).activeFor(assessmentId);
}

/**
 * The job once its current attempt has ended, as the registry holds it, or null when no such job is retained. For the
 * harness and in-process callers that must wait for a job; it authorises nothing, so no route may serve it.
 */
export async function settledRiskProposalJob(strapi: RiskProposalStrapi, jobId: string): Promise<RiskProposalJob | null> {
  await registry(strapi).settled(jobId);
  return registry(strapi).get(jobId);
}
