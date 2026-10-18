import { foldItemStates, type ProposalItemState } from "../../../csrm/ai/proposal-items";
import { completedQuestionnaireProposalRuns } from "./questionnaire-proposal-runs";
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import { resolveGenerationJobInitiators } from "../../../csrm/generation-job-viewer";
import { parseRunDecisionsFor, parseRunProposalFor } from "../../csrm-ai-run/services/ai-run-record";
import { REQUEST_FIELD_LABELS } from "../../csrm-assessment/services/ai-provenance";
import { isAnsweredValue, type PreservationRow } from "./questionnaire-answer-preservation";
import { parseQuestionnaireDefinition, QuestionnaireDefinitionError, type QuestionnaireDefinitionQuestion } from "./questionnaire-definition";
import { replacementRefusal } from "./questionnaire-generation-workflow";
import { parseGovernanceLog, GovernanceLogError } from "./questionnaire-governance-log";
import { fingerprintInput } from "./questionnaire-proposal-adapter";
import {
  isItemStale,
  questionFingerprint,
  type LiveQuestionnaire,
  type ProposalSource,
  type ProposedQuestion,
  type QuestionnaireDecisionEvent,
  type QuestionnaireProposalItem,
  type QuestionnaireProposalOperation,
} from "./questionnaire-proposal-envelope";
import { openProposalSummary } from "./questionnaire-proposal-gates";
import {
  projectedActiveProposalJobs,
  proposalQuestionnaireState,
  QUESTIONNAIRE_PROPOSAL_RUN_LIMIT,
  QuestionnaireProposalWorkflowError,
  type ProposalQuestionnaireState,
  type ProposalWorkflowStrapi,
} from "./questionnaire-proposals-workflow";

/*
 * Phase 15 D-03 item 4, D-06, D-20, D-28 and D-33: the AI proposals of one questionnaire, as a human Security Analyst
 * reads them. Open items come first, newest run first, then the 50 most recently decided items. Each item says whether
 * its basis still holds (`stale`, null while the Requestor is answering so no refusal or flag reveals a draft answer),
 * what it would change and where, why, what it cites (by label, never an answer), how it was decided and whether its
 * Undo is still safe. The read also carries each run's facts, the active jobs, the answered (fixed) questions where
 * D-06 shows them, and what this viewer may do now. A requesting analyst is refused (G-1).
 */

type Row = Record<string, unknown>;

const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const RUN_UID = "api::csrm-ai-run.csrm-ai-run";
const NOTE_UID = "api::csrm-request-note.csrm-request-note";
const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";
const PROPOSAL_RUN_OPERATIONS: readonly QuestionnaireProposalOperation[] = ["questionnaire-proposals", "question-rewrite"];
/** The decided items the read lists, most recent first (UI-D28). */
export const DECIDED_ITEMS_LISTED = 50;
const NOTES_READ_LIMIT = 500;
const FILES_READ_LIMIT = 21;

const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const relationId = (value: unknown): string | null => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;
const instant = (value: unknown): string | null => {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" && value.length > 0 ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};
const blankToNull = (text: unknown): string | null => typeof text === "string" && text.trim().length > 0 ? text : null;

export type ReadViewer = { analystDocumentId: string; humanAnalyst?: boolean };

const STATE_REASON: Readonly<Partial<Record<ProposalQuestionnaireState, ConflictReason>>> = Object.freeze({
  "awaiting-submission": "QUESTIONNAIRE_NOT_SUBMITTED",
  "draft-in-progress": "ASSESSMENT_DRAFT_IN_PROGRESS",
  "assessment-started": "ASSESSMENT_STARTED",
});

const action = (reason: ConflictReason | null | undefined) => ({ allowed: !reason, reason: reason ?? null });

type LoadedRun = {
  runId: string;
  run: Row;
  operation: QuestionnaireProposalOperation;
  items: readonly QuestionnaireProposalItem[];
  events: readonly QuestionnaireDecisionEvent[];
  states: ReadonlyMap<string, ProposalItemState> | null;
  adjustments: ReadonlyArray<{ code: string; count?: number }>;
};

function questionValues(question: QuestionnaireDefinitionQuestion, helpText: string | null): Row {
  return {
    questionText: question.questionText,
    helpText,
    answerType: question.answerType,
    choices: (question.choices ?? []).map(({ value, label }) => ({ value, label })),
    required: question.required,
  };
}

function proposedValues(proposed: ProposedQuestion): Row {
  return {
    questionText: proposed.questionText,
    helpText: blankToNull(proposed.helpText),
    answerType: proposed.answerType,
    choices: proposed.choices.map(({ value, label }) => ({ value, label })),
    required: proposed.required,
  };
}

/** One read of the request's notes and of the files the run's summary counted, for the citations' labels. */
async function sourceLookups(strapi: ProposalWorkflowStrapi, requestId: string, runs: readonly LoadedRun[]) {
  const notes = await strapi.documents(NOTE_UID).findMany({
    filters: { assessmentRequest: { documentId: { $eq: requestId } } },
    fields: ["documentId", "sequence", "authorPart", "postedAt"], sort: ["sequence:asc", "id:asc"], limit: NOTES_READ_LIMIT,
  });
  const noteBySequence = new Map(notes.filter((note) => typeof note.sequence === "number").map((note) => [note.sequence as number, note]));
  const fileIds = new Set<string>();
  for (const { run } of runs) {
    const summary = record(run.contextSummary) ? run.contextSummary : null;
    const included = summary && record(summary.attachments) && Array.isArray(summary.attachments.included) ? summary.attachments.included : [];
    for (const entry of included) if (record(entry) && typeof entry.documentId === "string") fileIds.add(entry.documentId);
  }
  const files = fileIds.size
    ? await strapi.documents(ATTACHMENT_UID).findMany({ filters: { documentId: { $in: [...fileIds] } }, fields: ["documentId", "fileName"], limit: FILES_READ_LIMIT })
    : [];
  const fileNames = new Map(files.map((file) => [String(file.documentId), typeof file.fileName === "string" ? file.fileName : null]));
  return { noteBySequence, fileNames };
}

/*
 * A citation by its label, never its text: a request field by its form label, a note by its sequence with its part and
 * time, a file by its name, the analyst's instruction, and an answered question generically (the run keeps no map from
 * its `Q` refs to questions, and an answer is never shown).
 */
function projectSource(source: ProposalSource, run: Row, lookups: Awaited<ReturnType<typeof sourceLookups>>, questions: Map<string, PreservationRow>): Row {
  if (source.kind === "request-field") return { kind: source.kind, ref: source.ref, label: REQUEST_FIELD_LABELS[source.ref] ?? "Request detail", note: null };
  if (source.kind === "note") {
    const sequence = Number(source.ref.replace(/^note-/, ""));
    const note = lookups.noteBySequence.get(sequence);
    return {
      kind: source.kind, ref: source.ref, label: `Note ${sequence}`,
      note: note ? { documentId: String(note.documentId), part: note.authorPart === "security-analyst" ? "security-analyst" : "requestor", postedAt: instant(note.postedAt) } : null,
    };
  }
  if (source.kind === "file") {
    const index = Number(source.ref.replace(/^file-/, "")) - 1;
    const summary = record(run.contextSummary) ? run.contextSummary : null;
    const included = summary && record(summary.attachments) && Array.isArray(summary.attachments.included) ? summary.attachments.included : [];
    const entry = included[index];
    const name = record(entry) && typeof entry.documentId === "string" ? lookups.fileNames.get(entry.documentId) ?? null : null;
    return { kind: source.kind, ref: source.ref, label: name ?? "Attached file", note: null };
  }
  if (source.kind === "instruction") return { kind: source.kind, ref: source.ref, label: "The analyst’s instruction", note: null };
  const summary = record(run.contextSummary) && record(run.contextSummary.questionnaire) ? run.contextSummary.questionnaire : null;
  const mapping = summary && Array.isArray(summary.answerSources) ? summary.answerSources.find((entry) => record(entry) && entry.ref === source.ref) : null;
  const question = record(mapping) && typeof mapping.questionDocumentId === "string" ? questions.get(mapping.questionDocumentId)?.question : null;
  return { kind: source.kind, ref: source.ref, label: question && question.deleted === undefined ? `Answered question: ${question.questionText}` : "An answered question", note: null };
}

/**
 * The proposals read (15-09). Refusals: no human analyst fact (403), unknown questionnaire (404), a requesting analyst
 * (403 OWN_REQUEST).
 */
export async function readQuestionnaireAiProposals(input: { strapi: ProposalWorkflowStrapi; questionnaireId: string } & ReadViewer): Promise<Row> {
  const { strapi, questionnaireId } = input;
  if (input.humanAnalyst !== true || typeof input.analystDocumentId !== "string" || input.analystDocumentId.trim().length === 0) {
    throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposals are denied.");
  }
  const questionnaire = typeof questionnaireId === "string" && questionnaireId
    ? await strapi.documents(QUESTIONNAIRE_UID).findOne({ documentId: questionnaireId, populate: { questions: true, assessmentRequest: { populate: { assessment: true, requestor: { fields: ["documentId"] } } } } })
    : null;
  const request = questionnaire && record(questionnaire.assessmentRequest) ? questionnaire.assessmentRequest : null;
  const requestId = request ? relationId(request) : null;
  if (!questionnaire || !request || !requestId) throw new QuestionnaireProposalWorkflowError(404, "CSRM questionnaire was not found.");
  if (relationId(request.requestor) === input.analystDocumentId) {
    throw new QuestionnaireProposalWorkflowError(403, "CSRM questionnaire AI proposals are denied on a request you raised.", "OWN_REQUEST");
  }
  const state = proposalQuestionnaireState(strapi, questionnaireId, questionnaire, request);
  const answeredVisible = state === "analyst-review" || state === "submitted";

  let definition: QuestionnaireDefinitionQuestion[] = [];
  try {
    definition = parseQuestionnaireDefinition(questionnaire.questions);
  } catch (error) {
    if (!(error instanceof QuestionnaireDefinitionError)) throw error;
  }
  const helpTexts = new Map((Array.isArray(questionnaire.questions) ? questionnaire.questions : []).filter(record).map((row) => [row.documentId, blankToNull(row.helpText)]));
  const rows: PreservationRow[] = definition.map((question) => ({ question, helpText: helpTexts.get(question.documentId) ?? null, answer: question.answer }));
  const byDocument = new Map(rows.map((row) => [row.question.documentId, row]));
  const byKey = new Map(rows.map((row) => [row.question.questionKey, row]));
  const live: LiveQuestionnaire = {
    generatedDate: instant(questionnaire.generatedDate),
    questions: rows.map((row) => ({ ...fingerprintInput(row), documentId: row.question.documentId, questionKey: row.question.questionKey, answered: row.question.deleted === undefined && isAnsweredValue(row.answer) })),
  };

  const stored = await completedQuestionnaireProposalRuns(strapi, questionnaireId, {
    filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: [...PROPOSAL_RUN_OPERATIONS] }, status: { $eq: "completed" } },
    fields: ["documentId", "operation", "proposal", "decisions", "startedAt", "completedAt", "providerName", "providerVersion", "instruction", "contextSummary"],
    populate: { initiatedBy: { fields: ["documentId"] } },
    sort: ["completedAt:desc", "id:desc"], limit: QUESTIONNAIRE_PROPOSAL_RUN_LIMIT + 1,
  });
  const runs: LoadedRun[] = [];
  for (const run of stored) {
    const operation = PROPOSAL_RUN_OPERATIONS.find((candidate) => candidate === run.operation);
    if (!operation || typeof run.documentId !== "string") continue;
    const proposal = parseRunProposalFor(operation, run.proposal);
    const events = parseRunDecisionsFor(operation, run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    runs.push({ runId: run.documentId, run, operation, items: proposal?.items ?? [], events: events ?? [], states, adjustments: proposal?.adjustments ?? [] });
  }

  // The question a rewrite run targeted, by its ai-proposal event (a no-change rewrite has no item to say so).
  const rewriteTargets = new Map<string, { questionKey: string; questionText: string }>();
  try {
    for (const event of parseGovernanceLog(questionnaire.governanceLog)) {
      if (event.kind === "ai-proposal" && event.scope === "question" && event.runId && event.questionKey) rewriteTargets.set(event.runId, { questionKey: event.questionKey, questionText: event.questionText ?? "" });
    }
  } catch (error) {
    if (!(error instanceof GovernanceLogError)) throw error;
  }

  const lookups = await sourceLookups(strapi, requestId, runs);
  const people = new Set<string>();
  for (const { run, events } of runs) {
    const initiator = relationId(run.initiatedBy);
    if (initiator) people.add(initiator);
    for (const event of events) if (event.by !== "system") people.add(event.by);
  }
  const names = await resolveGenerationJobInitiators(strapi, people);
  const person = (documentId: string | null) => {
    if (!documentId) return null;
    const found = names.get(documentId);
    return found ? { documentId: found.documentId, displayName: found.displayName } : null;
  };

  const reviewReason = STATE_REASON[state] ?? (state === "submitted" ? "QUESTIONNAIRE_RELEASED" : undefined);
  const frozen = state === "draft-in-progress" || state === "assessment-started";

  type Listed = { order: number; at: number; item: Row };
  const open: Listed[] = [];
  const decided: Listed[] = [];
  let openCount = 0;
  for (const [runIndex, loaded] of runs.entries()) {
    if (!loaded.states) continue;
    for (const [itemIndex, item] of loaded.items.entries()) {
      const itemState = loaded.states.get(item.key) as ProposalItemState;
      const itemEvents = loaded.events.filter((event) => event.item === item.key);
      const last = itemEvents.at(-1) ?? null;
      const accepted = [...itemEvents].reverse().find((event) => event.action === "accepted");
      const targetRow = item.kind === "add" ? undefined : byDocument.get(item.target.questionDocumentId);
      let canUndo = false;
      if (itemState === "accepted" && state === "analyst-review" && accepted?.applied) {
        const applied = byDocument.get(accepted.applied.questionDocumentId);
        canUndo = applied !== undefined && questionFingerprint(fingerprintInput(applied)) === accepted.applied.fingerprint && !isAnsweredValue(applied.answer);
      } else if (itemState === "rejected") {
        canUndo = !frozen;
      }
      const visibility = item.kind === "add" && item.proposed.visibility ? item.proposed.visibility : null;
      const projected: Row = {
        runId: loaded.runId,
        itemKey: item.key,
        kind: item.kind,
        state: itemState,
        stale: state === "awaiting-submission" || itemState !== "open" ? null : isItemStale(item, live),
        target: item.kind === "add" ? null : {
          questionId: item.target.questionDocumentId,
          questionText: targetRow?.question.questionText ?? item.target.textSnapshot,
          available: targetRow !== undefined,
        },
        current: item.kind !== "add" && targetRow ? questionValues(targetRow.question, targetRow.helpText) : null,
        proposed: item.kind === "remove" ? null : proposedValues(item.proposed),
        placement: item.kind === "add" ? {
          sectionTitle: item.base.section.title,
          newSection: item.base.section.kind === "new",
          visibility: visibility ? { controllerText: byKey.get(visibility.questionKey)?.question.questionText ?? null, operator: visibility.operator, value: visibility.value } : null,
        } : null,
        rationale: item.rationale,
        sources: item.sources.map((source) => projectSource(source, loaded.run, lookups, byDocument)),
        decision: itemState === "open" || !last ? null : {
          action: last.action,
          by: last.by === "system" ? null : person(last.by),
          at: last.at,
          reason: last.reason ?? null,
          edited: (accepted?.edits?.length ?? 0) > 0 && itemState === "accepted",
        },
        canUndo,
      };
      if (itemState === "open") {
        openCount += 1;
        open.push({ order: runIndex * 100 + itemIndex, at: 0, item: projected });
      } else {
        decided.push({ order: runIndex * 100 + itemIndex, at: last ? Date.parse(last.at) : 0, item: projected });
      }
    }
  }
  open.sort((left, right) => left.order - right.order);
  decided.sort((left, right) => right.at - left.at || left.order - right.order);

  const runFacts = runs.map((loaded) => {
    const summary = record(loaded.run.contextSummary) ? loaded.run.contextSummary : null;
    const source = summary && record(summary.instruction) && typeof summary.instruction.source === "string" ? summary.instruction.source : null;
    const counts = new Map<string, number>();
    for (const adjustment of loaded.adjustments) counts.set(adjustment.code, (counts.get(adjustment.code) ?? 0) + (adjustment.count ?? 1));
    const target = loaded.operation === "question-rewrite" ? rewriteTargets.get(loaded.runId) : undefined;
    const targetRow = target ? byKey.get(target.questionKey) : undefined;
    return {
      runId: loaded.runId,
      operation: loaded.operation,
      scope: loaded.operation === "question-rewrite" ? "question" : "questionnaire",
      initiatedBy: person(relationId(loaded.run.initiatedBy)),
      startedAt: instant(loaded.run.startedAt),
      completedAt: instant(loaded.run.completedAt),
      providerName: typeof loaded.run.providerName === "string" ? loaded.run.providerName : null,
      providerVersion: typeof loaded.run.providerVersion === "string" ? loaded.run.providerVersion : null,
      instruction: typeof loaded.run.instruction === "string" ? loaded.run.instruction : null,
      instructionSource: source,
      targetQuestion: target ? { questionId: targetRow?.question.documentId ?? null, questionText: targetRow?.question.questionText ?? target.questionText } : null,
      outcome: loaded.items.length ? "items" : "no-change",
      counts: { items: loaded.items.length, open: loaded.states ? [...loaded.states.values()].filter((value) => value === "open").length : 0 },
      adjustments: [...counts].filter(([code]) => code !== "sources-dropped").map(([code, count]) => ({ code, count })),
      sourcesDropped: counts.get("sources-dropped") ?? 0,
    };
  });

  const summary = await openProposalSummary(strapi, questionnaireId);
  const replace = await replacementRefusal(strapi as never, questionnaire);
  const replaceReason: ConflictReason | null = replace?.reason ?? (request.requestStatus !== "submitted" ? "REQUEST_NOT_ELIGIBLE" : null);
  return {
    questionnaireId,
    state,
    openCount,
    actions: {
      start: action(STATE_REASON[state]),
      rewrite: action(STATE_REASON[state]),
      confirm: action(state === "analyst-review" ? null : reviewReason),
      reject: action(frozen ? STATE_REASON[state] : null),
      replace: action(replaceReason ?? (summary.activeJob ? "AI_PROPOSALS_OPEN" : null)),
    },
    runs: runFacts,
    items: [...open.map(({ item }) => item), ...decided.slice(0, DECIDED_ITEMS_LISTED).map(({ item }) => item)],
    jobs: await projectedActiveProposalJobs(strapi, questionnaireId, input.analystDocumentId),
    fixedQuestions: answeredVisible
      ? rows.filter((row) => row.question.deleted === undefined && isAnsweredValue(row.answer)).map((row) => ({ questionId: row.question.documentId, questionText: row.question.questionText }))
      : null,
  };
}
