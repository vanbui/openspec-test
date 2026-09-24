import assert from "node:assert/strict";
import test from "node:test";

import { deterministicQuestionnaireGenerationProvider } from "../src/api/csrm-questionnaire/services/deterministic-questionnaire-generation-provider";
import { createQuestionnaireGenerationRegistry, QuestionnaireGenerationRegistryError } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import { parseQuestionnaireGenerationProposal } from "../src/api/csrm-questionnaire/services/questionnaire-generation-provider";
import { generateQuestionnaireNumber } from "../src/api/csrm-questionnaire/services/questionnaire-number";
import { hasQuestionnaireAnswerEvidence, persistGeneratedQuestionnaire } from "../src/api/csrm-questionnaire/services/questionnaire-generation-workflow";

test("questionnaire generation validates deterministic contextual proposals", async () => {
  const proposal = await deterministicQuestionnaireGenerationProvider.generate({ title: "Payroll replacement", businessPurpose: "pay employees", businessCriticality: "High", thirdPartyInvolvement: true, thirdPartyDetails: "Hosted provider" });
  assert.equal(parseQuestionnaireGenerationProposal(proposal).questions.length, 4);
  assert.throws(() => parseQuestionnaireGenerationProposal({ ...proposal, unknown: true }), /invalid/);
  assert.match(generateQuestionnaireNumber(new Date("2026-09-03T00:00:00.000Z")), /^QNR-2026-/);
});

test("questionnaire generation jobs are actor-scoped and terminal jobs do not block a fresh request", async () => {
  let next = 0;
  const registry = createQuestionnaireGenerationRegistry({ createJobId: () => `job-${++next}`, execute: async () => ({ questionnaireId: "questionnaire-1" }) });
  const first = registry.enqueue({ requestId: "request-1", initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: false });
  assert.equal(first.status, "queued");
  assert.throws(() => registry.get(first.jobId, { documentId: "analyst-2", canReadAllQuestionnaireGenerationJobs: false }), QuestionnaireGenerationRegistryError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registry.get(first.jobId, { documentId: "analyst-1", canReadAllQuestionnaireGenerationJobs: false }).status, "completed");
  assert.equal(registry.enqueue({ requestId: "request-1", initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: true }).jobId, "job-2");
});

test("replacement guard preserves every requestor answer envelope", () => {
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: null }]), false);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: "  " } }]), false);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: [], state: "draft" } }]), true);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: ["cloud"] } }]), true);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: false } }]), true);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: null, state: "submitted" } }]), true);
});

test("locked replacement refuses answered work before deleting question rows", async () => {
  let deleted = 0;
  const request = {
    documentId: "request-1",
    requestStatus: "submitted",
    title: "Payroll replacement",
    questionnaire: {
      documentId: "questionnaire-1",
      questions: [{ documentId: "question-1", answer: { schemaVersion: 1, value: "do not replace", state: "draft" } }],
    },
  };
  const documents = (uid: string) => ({
    findOne: async () => uid.includes("assessment-request") ? request : null,
    findMany: async () => [],
    create: async () => ({ documentId: "created" }),
    update: async () => ({ documentId: "updated" }),
    delete: async () => { deleted += 1; },
  });
  const chain = { select: () => chain, where: () => chain, forUpdate: () => chain, transacting: () => chain, execute: async <T>() => [] as T };
  const strapi = { documents, db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } };
  await assert.rejects(
    () => persistGeneratedQuestionnaire(strapi, "request-1", "analyst-1", true),
    /Answered questionnaires cannot be regenerated/,
  );
  assert.equal(deleted, 0);
});
