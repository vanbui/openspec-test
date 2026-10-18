import assert from "node:assert/strict";
import test from "node:test";
import { questionnaireContextQuestions } from "../src/csrm/ai/assessment-context-loader";
import { buildQuestionnaireProposalContext } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-context";
import { parseQuestionnaireDecisionEvents } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-envelope";
import { withQuestionnaireGovernanceLock, type GovernanceStrapi } from "../src/api/csrm-questionnaire/services/questionnaire-governance-workflow";
import { startQuestionnaireProposals, type ProposalWorkflowStrapi } from "../src/api/csrm-questionnaire/services/questionnaire-proposals-workflow";
import { openProposalSummary } from "../src/api/csrm-questionnaire/services/questionnaire-proposal-gates";
import { readQuestionnaireAiProposals } from "../src/api/csrm-questionnaire/services/questionnaire-proposals-read";
import { parseContextSummary } from "../src/api/csrm-ai-run/services/ai-run-record";
import { proposalFixture } from "./helpers/questionnaire-proposal-fixture";

test("BE06: identifier-only provenance accepts legacy omission and rejects answer text, duplicates and withheld mappings", () => {
  const legacy = proposalFixture().context.summary;
  assert.ok(parseContextSummary(legacy));
  const questionnaire = { scope: "questionnaire", questionsOffered: 6, answered: 2, answerContent: "included", openItemsListed: 0, rejectedItemsListed: 0, rejectedItemsTotal: 0, removedListed: 0 };
  const source = { ref: "Q2", questionDocumentId: "doc-third-party" };
  const mapped = { ...legacy, questionnaire: { ...questionnaire, answerSources: [source] } };
  assert.ok(parseContextSummary(mapped), "IDENTIFIER_PROVENANCE_REFUSED");
  for (const answerSources of [[{ ...source, answer: "secret answer" }], [source, source], [{ ...source, ref: "Q201" }]]) assert.equal(parseContextSummary({ ...mapped, questionnaire: { ...questionnaire, answerSources } }), null);
  assert.equal(parseContextSummary({ ...mapped, questionnaire: { ...questionnaire, answerContent: "withheld", answerSources: [source] } }), null);
});

const removalProposal = { schemaVersion: 1, operation: "questionnaire-proposals", outcome: "items", items: [{ key: "i-1", kind: "remove", target: { questionDocumentId: "q-2", questionKey: "other", textSnapshot: "Other question?" }, rationale: "This question is redundant.", sources: [{ kind: "answered-question", ref: "Q1" }], base: { kind: "question", fingerprint: `sha256:${"a".repeat(64)}`, unanswered: true } }], adjustments: [] };

test("BE01: a legacy overflow's final open run remains visible to the release gate", async () => {
  const runs = Array.from({ length: 102 }, (_, index) => ({ documentId: `run-${index}`, operation: "questionnaire-proposals", proposal: index === 101 ? removalProposal : { schemaVersion: 1, operation: "questionnaire-proposals", outcome: "no-change", items: [], adjustments: [] }, decisions: [] }));
  const strapi = { documents: () => ({ findMany: async ({ start = 0, limit }: { start?: number; limit: number }) => runs.slice(start, start + limit) }) } as unknown as ProposalWorkflowStrapi;
  assert.equal((await openProposalSummary(strapi, "legacy-questionnaire")).openCount, 1, "OVERFLOW_OPEN_ITEM_HIDDEN");
});

test("BE06: answer citations use stored identifiers after reordering, omit values, and fall back for removed questions", async () => {
  const q = (id: string, key: string, text: string, order: number) => ({ documentId: id, questionText: text, answerType: "Text", answer: null, options: { schemaVersion: 2, questionKey: key, section: { key: "overview", title: "Overview", order: 0 }, order, required: false } });
  const cited = q("q-1", "cited", "Who approves access?", 5);
  const questionnaire = { documentId: "citation-questionnaire", questions: [q("q-2", "other", "Other question?", 0), cited], governanceLog: [], assessmentRequest: { documentId: "request-1", requestor: { documentId: "owner" } } };
  const run = { documentId: "run-1", operation: "questionnaire-proposals", proposal: removalProposal, decisions: [], contextSummary: { questionnaire: { answerSources: [{ ref: "Q1", questionDocumentId: "q-1" }] } } };
  const strapi = { documents: (uid: string) => ({ findOne: async () => questionnaire, findMany: async () => uid.includes("csrm-ai-run") ? [run] : [] }) } as unknown as ProposalWorkflowStrapi;
  const read = () => readQuestionnaireAiProposals({ strapi, questionnaireId: questionnaire.documentId, analystDocumentId: "analyst", humanAnalyst: true });
  const result = await read();
  assert.ok(JSON.stringify(result).includes("Answered question: Who approves access?"), "ANSWER_CITATION_NOT_NAMED");
  assert.ok(!JSON.stringify(result).includes("secret answer"));
  Object.assign(cited.options, { deleted: { deletedAt: "2026-10-13T00:00:00.000Z", deletedBy: "analyst" } });
  assert.ok(JSON.stringify(await read()).includes("An answered question"), "REMOVED_ANSWER_CITATION_NOT_NEUTRAL");
});

test("BE05: a PostgreSQL-style proposal start waits for the release transaction then refuses the new state", async () => {
  const questionnaire = { documentId: "be05-questionnaire", releasedAt: null as string | null, governanceLog: [], questions: [{ documentId: "q-1", questionText: "What service?", answerType: "Text", answer: null, options: { schemaVersion: 2, questionKey: "service", section: { key: "overview", title: "Overview", order: 0 }, order: 0, required: true } }], assessmentRequest: { documentId: "request-1", requestStatus: "questionnaire-in-progress", requestor: { documentId: "owner" } } };
  const strapi = { documents: (uid: string) => ({ findOne: async () => uid.includes("csrm-questionnaire") ? questionnaire : null, findMany: async () => [], update: async () => questionnaire }), config: { get: () => ({ dataClassificationCeiling: "Internal" }) }, db: { transaction: async (work: (value: { trx: object }) => Promise<unknown>) => work({ trx: {} }), queryBuilder: () => ({ select: () => undefined, where: () => undefined, forUpdate: () => undefined, transacting: () => undefined, execute: async () => [] }) } } as unknown as ProposalWorkflowStrapi;
  let reached!: () => void;
  let finish!: () => void;
  const gateRead = new Promise<void>((resolve) => { reached = resolve; });
  const releaseWrite = new Promise<void>((resolve) => { finish = resolve; });
  const releasing = withQuestionnaireGovernanceLock(strapi as unknown as GovernanceStrapi, questionnaire.documentId, async () => { reached(); await releaseWrite; questionnaire.releasedAt = "2026-10-13T00:00:00.000Z"; });
  await gateRead;
  const starting = startQuestionnaireProposals({ strapi, questionnaireId: questionnaire.documentId, analystDocumentId: "analyst", humanAnalyst: true }).then((job) => ({ status: 202, job }), (error: { status: number; reason?: string }) => ({ status: error.status, reason: error.reason }));
  // Ordinary PostgreSQL reads do not wait for FOR UPDATE. Give admission a turn inside that held write window.
  await new Promise<void>((resolve) => setImmediate(resolve));
  finish();
  await releasing;
  assert.deepEqual(await starting, { status: 409, reason: "QUESTIONNAIRE_NOT_SUBMITTED" }, "PROPOSAL_ADMITTED_INSIDE_RELEASE_WINDOW");
});

test("BE02: follow-up context includes submitted visible answers despite a hidden unanswered dependent, and withholds drafts", () => {
  const questions = (state: "submitted" | "draft") => [
    { documentId: "controller", questionText: "Does a vendor operate the service?", answerType: "Single select", options: { schemaVersion: 2, questionKey: "vendor", section: { key: "overview", title: "Overview", order: 0 }, order: 0, required: true, choices: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }, answer: { schemaVersion: 1, state, value: "no", updatedAt: "2026-10-13T00:00:00.000Z", ...(state === "submitted" ? { submittedAt: "2026-10-13T00:00:00.000Z" } : {}) } },
    { documentId: "dependent", questionText: "Which vendor?", answerType: "Text", options: { schemaVersion: 2, questionKey: "vendor-name", section: { key: "overview", title: "Overview", order: 0 }, order: 1, required: true, visibility: { questionKey: "vendor", operator: "equals", value: "yes" } }, answer: null },
  ];
  const submitted = questionnaireContextQuestions({ questions: questions("submitted") });
  assert.equal(submitted.answerContent, "included", "VISIBLE_SUBMITTED_ANSWER_WITHHELD");
  assert.equal(submitted.questions[0].answerLabel, "No");
  assert.equal(submitted.questions[1].answerLabel, undefined);
  const provider = buildQuestionnaireProposalContext({ ...submitted, scope: "questionnaire", openItems: [], rejectedItems: [], instructionSource: "default-task", contextSourceRefs: [] });
  assert.ok(provider.allowed.sourceRefs.has("Q1"), "SUBMITTED_ANSWER_NOT_CITABLE");
  const draft = questionnaireContextQuestions({ questions: questions("draft") });
  assert.equal(draft.answerContent, "withheld");
  assert.ok(draft.questions.every((question) => question.answerLabel === undefined));
});

test("BE04: historical snapshots preserve distinct values with duplicate manual choice labels", () => {
  const before = { questionDocumentId: "q-1", questionKey: "choice", questionText: "Which kind?", helpText: null, answerType: "Single select", choices: [{ value: "a", label: "Other" }, { value: "b", label: "Other" }], required: false, section: { key: "overview", title: "Overview", order: 0 }, order: 0, visibility: null, removed: false };
  const event = { schemaVersion: 2, at: "2026-10-13T00:00:00.000Z", by: "analyst", item: "i-1", action: "accepted", before, applied: { questionDocumentId: "q-1", questionKey: "choice", fingerprint: `sha256:${"a".repeat(64)}` } };
  assert.deepEqual(parseQuestionnaireDecisionEvents([event]), [event], "LEGAL_MANUAL_SNAPSHOT_REFUSED");
  assert.equal(parseQuestionnaireDecisionEvents([{ ...event, before: { ...before, choices: [{ value: "a", label: "Other" }, { value: "a", label: "Different" }] } }]), null, "DUPLICATE_VALUES_ACCEPTED");
});
