import { foldItemStates, openItemKeys } from "../../../csrm/ai/proposal-items";
import { parseRunDecisionsFor, parseRunProposalFor } from "../../csrm-ai-run/services/ai-run-record";
import type { QuestionnaireProposalOperation } from "./questionnaire-proposal-envelope";
import { completedQuestionnaireProposalRuns } from "./questionnaire-proposal-runs";
import { activeQuestionnaireProposalJobs, QUESTIONNAIRE_PROPOSAL_RUN_LIMIT, type ProposalWorkflowStrapi } from "./questionnaire-proposals-workflow";

/*
 * Phase 15 D-08 and D-20 (decision 6): nothing moves on while an AI proposal is undecided. Release, assessment draft
 * generation and questionnaire replacement each ask this module, at enqueue and again inside their transaction, whether
 * the questionnaire has an open proposal item or a proposal job queued or running in this process.
 *
 * The open set is derived, never stored: each completed proposal run is folded from its append-only decisions. A run
 * whose proposal or decisions do not read (damaged) holds no open item, so it can never block a governance step for
 * good (fail open, T-15-32); it is logged once per process. This module protects no access: the Requestor's access gate
 * reads only the release fact.
 */

type Row = Record<string, unknown>;
type GateStrapi = ProposalWorkflowStrapi & { log?: { warn?: (message: string) => unknown } };

const RUN_UID = "api::csrm-ai-run.csrm-ai-run";
const PROPOSAL_RUN_OPERATIONS: readonly QuestionnaireProposalOperation[] = ["questionnaire-proposals", "question-rewrite"];

export type OpenProposalSummary = { openCount: number; activeJob: boolean; damagedRunIds: string[] };

const loggedDamagedRuns = new Set<string>();

function logDamagedRun(strapi: GateStrapi, runId: string): void {
  if (loggedDamagedRuns.has(runId)) return;
  loggedDamagedRuns.add(runId);
  strapi.log?.warn?.(`csrm.ai_proposals: run ${runId} has a proposal or decisions that do not read; it holds no open item.`);
}

/**
 * The questionnaire's open proposal items (over at most 101 completed proposal runs, the run cap and one), whether a
 * proposal job for it is queued or running, and the runs that could not be folded.
 */
export async function openProposalSummary(strapi: GateStrapi, questionnaireId: string): Promise<OpenProposalSummary> {
  const runs: Row[] = await completedQuestionnaireProposalRuns(strapi, questionnaireId, {
    filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: [...PROPOSAL_RUN_OPERATIONS] }, status: { $eq: "completed" } },
    fields: ["documentId", "operation", "proposal", "decisions"],
    sort: ["id:asc"],
    limit: QUESTIONNAIRE_PROPOSAL_RUN_LIMIT + 1,
  });
  let openCount = 0;
  const damagedRunIds: string[] = [];
  for (const run of runs) {
    const runId = String(run.documentId);
    const operation = PROPOSAL_RUN_OPERATIONS.find((candidate) => candidate === run.operation);
    const proposal = operation ? parseRunProposalFor(operation, run.proposal) : null;
    const events = operation ? parseRunDecisionsFor(operation, run.decisions) : null;
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    if (states === null) {
      damagedRunIds.push(runId);
      logDamagedRun(strapi, runId);
      continue;
    }
    openCount += openItemKeys(states).length;
  }
  return { openCount, activeJob: activeQuestionnaireProposalJobs(strapi, questionnaireId).length > 0, damagedRunIds };
}

/** Refuses (through the caller's own error) with AI_PROPOSALS_OPEN while an item is open or a proposal job is active. */
export async function assertNoOpenProposals(strapi: GateStrapi, questionnaireId: string, refuse: (reason: "AI_PROPOSALS_OPEN") => never): Promise<void> {
  const summary = await openProposalSummary(strapi, questionnaireId);
  if (summary.openCount > 0 || summary.activeJob) refuse("AI_PROPOSALS_OPEN");
}
