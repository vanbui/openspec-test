import assert from "node:assert/strict";
import test from "node:test";

import { AI_RUN_OPERATIONS } from "../src/api/csrm-ai-run/services/ai-run-record";
import { buildAssessmentContext } from "../src/csrm/ai/assessment-context";
import {
  CONTEXT_WIDE_AI_OPERATIONS,
  aiInputsChanged,
  isContextWideAiOperation,
  loadAiInputsChanged,
  type MarkedNote,
} from "../src/csrm/ai/ai-inputs-signal";
import { uatALikeRecords } from "./fixtures/uat-a-like-context";

/*
 * Phase 13 D-29 (success criterion 5): "AI inputs changed since the last generation", one rule per target. Against a
 * baseline run, the notes marked now but not included, and the notes included but since unmarked; against the generation
 * date of a record generated before run records existed, the marked notes whose latest marking is after it, failing
 * visible when the log cannot say; with no baseline, no signal.
 */

const GENERATED = "2026-10-01T00:00:00.000Z";

function note(sequence: number, extra: Partial<MarkedNote> = {}): MarkedNote {
  return {
    documentId: `note-${sequence}`,
    part: sequence % 2 === 1 ? "requestor" : "security-analyst",
    sequence,
    postedAt: `2026-09-${String(sequence).padStart(2, "0")}T00:00:00.000Z`,
    ...extra,
  };
}

function identity(value: MarkedNote) {
  return { documentId: value.documentId, part: value.part, sequence: value.sequence, postedAt: value.postedAt };
}

function markLog(...events: Array<[at: string, to: boolean]>) {
  return { schemaVersion: 1, events: events.map(([at, to]) => ({ schemaVersion: 1, by: "analyst-1", at, from: !to, to })) };
}

test("no baseline is no signal (D-29)", () => {
  assert.equal(aiInputsChanged({ markedNotes: [note(1)], baseline: null }), null);
  assert.equal(aiInputsChanged({ markedNotes: [], baseline: null }), null);
});

test("against a run: a note marked since is marked, a note included and since unmarked is unmarked, in sequence order", () => {
  const changed = aiInputsChanged({ markedNotes: [note(2), note(1)], baseline: { kind: "run", included: [identity(note(3)), identity(note(2))] } });
  assert.deepEqual(changed, {
    count: 2,
    notes: [{ ...identity(note(1)), change: "marked" }, { ...identity(note(3)), change: "unmarked" }],
    files: [],
  });
});

test("against a run that included exactly the marked notes, nothing changed and the signal is null", () => {
  assert.equal(aiInputsChanged({ markedNotes: [note(1), note(2)], baseline: { kind: "run", included: [identity(note(2)), identity(note(1))] } }), null);
  assert.equal(aiInputsChanged({ markedNotes: [], baseline: { kind: "run", included: [] } }), null);
});

test("against a generation date: only notes whose latest marking is after it count, and a log that cannot say fails visible", () => {
  const markedAfter = note(1, { aiInputLog: markLog(["2026-10-02T00:00:00.000Z", true]) });
  const markedBefore = note(2, { aiInputLog: markLog(["2026-09-30T00:00:00.000Z", true]) });
  const markedAtTheGeneration = note(3, { aiInputLog: markLog([GENERATED, true]) });
  const remarkedAfter = note(4, { aiInputLog: markLog(["2026-09-20T00:00:00.000Z", true], ["2026-09-21T00:00:00.000Z", false], ["2026-10-03T00:00:00.000Z", true]) });
  const unreadableLog = note(5, { aiInputLog: { schemaVersion: 9, events: [] } });
  const noLog = note(6, { aiInputLog: null });
  const noSettingEvent = note(7, { aiInputLog: markLog(["2026-09-25T00:00:00.000Z", false]) });
  const changed = aiInputsChanged({
    markedNotes: [noSettingEvent, noLog, unreadableLog, remarkedAfter, markedAtTheGeneration, markedBefore, markedAfter],
    baseline: { kind: "generated-date", at: GENERATED },
  });
  assert.deepEqual(changed, {
    count: 5,
    notes: [markedAfter, remarkedAfter, unreadableLog, noLog, noSettingEvent].map((value) => ({ ...identity(value), change: "marked" })),
    files: [],
  });
  // Every marked note was marked before the generation: nothing changed.
  assert.equal(aiInputsChanged({ markedNotes: [markedBefore, markedAtTheGeneration], baseline: { kind: "generated-date", at: GENERATED } }), null);
  // A generation date that cannot be read cannot clear any note, so every marked note shows.
  assert.equal(aiInputsChanged({ markedNotes: [markedBefore], baseline: { kind: "generated-date", at: "not a date" } })?.count, 1);
});

test("only context-wide runs move a baseline: questionnaire and draft generation, questionnaire proposals and Suggest more risks, never a question rewrite or a risk-scoped operation such as Rewrite this risk (T-13-56; Phase 15 D-29; Phase 16 D-28)", () => {
  // Phase 16 D-28 (the pilot ruling of 2026-10-15): "Suggest more risks" reads the whole context, "Rewrite this risk" never does.
  assert.deepEqual([...CONTEXT_WIDE_AI_OPERATIONS], ["questionnaire-generation", "assessment-draft", "questionnaire-proposals", "risk-suggestions"]);
  assert.equal(isContextWideAiOperation("risk-suggestions"), true, "RISK_SUGGESTIONS_IS_NOT_CONTEXT_WIDE");
  // Phase 15 D-11 and D-29: a rewrite reads the marked notes but is question-scoped, so it never clears the signal.
  assert.equal(isContextWideAiOperation("question-rewrite"), false, "QUESTION_REWRITE_IS_CONTEXT_WIDE");
  for (const operation of CONTEXT_WIDE_AI_OPERATIONS) assert.ok((AI_RUN_OPERATIONS as readonly string[]).includes(operation), `NOT_A_RUN_OPERATION_${operation}`);
  for (const riskScoped of ["risk-rewrite", "risk-reassessment", "residual-reassessment"]) assert.equal(isContextWideAiOperation(riskScoped), false, riskScoped);
});

type Row = Record<string, unknown>;

/**
 * A Document Service double: one run by documentId, the request's marked notes and its stored files (none unless a case
 * adds them), recording every notes and files read.
 */
function fakeStrapi(input: { runs?: Row[]; notes?: Row[]; files?: Row[] }) {
  const noteReads: Row[] = [];
  const fileReads: Row[] = [];
  const strapi = {
    documents: (uid: string) => ({
      findOne: async (query: Row) => (uid === "api::csrm-ai-run.csrm-ai-run" ? (input.runs ?? []).find((run) => run.documentId === query.documentId) ?? null : null),
      findMany: async (query: Row) => {
        if (uid === "api::csrm-request-attachment.csrm-request-attachment") {
          fileReads.push(query);
          return input.files ?? [];
        }
        if (uid !== "api::csrm-request-note.csrm-request-note") return [];
        noteReads.push(query);
        return input.notes ?? [];
      },
    }),
  };
  return { strapi, noteReads, fileReads };
}

function noteRow(value: MarkedNote): Row {
  return { documentId: value.documentId, sequence: value.sequence, authorPart: value.part, postedAt: value.postedAt, aiInputLog: value.aiInputLog ?? null };
}

const REQUEST = "request-1";

function summaryWith(notes: MarkedNote[]) {
  return buildAssessmentContext({ ...uatALikeRecords(), notes: notes.map((value) => ({ ...identity(value), body: `Note ${value.sequence}.` })) }, { operation: "questionnaire-generation" }).summary;
}

function run(extra: Row): Row {
  return { documentId: "run-1", operation: "questionnaire-generation", status: "completed", assessmentRequest: { documentId: REQUEST }, contextSummary: summaryWith([]), ...extra };
}

test("the loader reads the baseline run's v2 summary, a v1 summary as included none, and an unreadable summary as included none", async () => {
  const marked = note(1, { aiInputLog: markLog(["2026-10-02T00:00:00.000Z", true]) });
  const input = { requestDocumentId: REQUEST, baselineRunId: "run-1", generatedDate: GENERATED };
  const included = fakeStrapi({ runs: [run({ contextSummary: summaryWith([marked]) })], notes: [noteRow(marked)] });
  assert.equal(await loadAiInputsChanged(included.strapi, input), null, "V2_INCLUDED_NOTE_LISTED");

  const { notes: _notes, questionnaire: _questionnaire, instruction: _instruction, riskProposals: _riskProposals, ...v1Fields } = summaryWith([]);
  const v1 = fakeStrapi({ runs: [run({ contextSummary: { ...v1Fields, schemaVersion: 1 } })], notes: [noteRow(marked)] });
  assert.deepEqual(await loadAiInputsChanged(v1.strapi, input), { count: 1, notes: [{ ...identity(marked), change: "marked" }], files: [] }, "V1_NOT_INCLUDED_NONE");

  const unreadable = fakeStrapi({ runs: [run({ contextSummary: { schemaVersion: 99 } })], notes: [noteRow(marked)] });
  assert.deepEqual(await loadAiInputsChanged(unreadable.strapi, input), { count: 1, notes: [{ ...identity(marked), change: "marked" }], files: [] }, "UNREADABLE_SUMMARY_HID_THE_NOTE");
});

test("the loader uses a run only when it is completed, context-wide and on the request, else falls back to the generation date", async () => {
  const before = note(1, { aiInputLog: markLog(["2026-09-30T00:00:00.000Z", true]) });
  const after = note(2, { aiInputLog: markLog(["2026-10-02T00:00:00.000Z", true]) });
  const notes = [noteRow(before), noteRow(after)];
  const fallback = { count: 1, notes: [{ ...identity(after), change: "marked" }], files: [] };
  for (const [label, unusable] of [
    ["FAILED", run({ status: "failed" })],
    ["RUNNING", run({ status: "running" })],
    ["RISK_SCOPED", run({ operation: "risk-rewrite" })],
    ["ANOTHER_REQUEST", run({ assessmentRequest: { documentId: "request-2" } })],
  ] as const) {
    const { strapi } = fakeStrapi({ runs: [unusable], notes });
    assert.deepEqual(await loadAiInputsChanged(strapi, { requestDocumentId: REQUEST, baselineRunId: "run-1", generatedDate: GENERATED }), fallback, `${label}_RUN_USED`);
  }
  // A run the read names but the store no longer holds, and a Date generation date, fall back the same way.
  const missing = fakeStrapi({ notes });
  assert.deepEqual(await loadAiInputsChanged(missing.strapi, { requestDocumentId: REQUEST, baselineRunId: "run-gone", generatedDate: new Date(GENERATED) }), fallback, "MISSING_RUN");
  // No run and no generation date: no baseline, so no notes are read at all.
  const none = fakeStrapi({ notes });
  assert.equal(await loadAiInputsChanged(none.strapi, { requestDocumentId: REQUEST, baselineRunId: null, generatedDate: null }), null, "NO_BASELINE_SIGNAL");
  assert.equal(none.noteReads.length, 0, "NO_BASELINE_READ_NOTES");
  assert.equal(none.fileReads.length, 0, "NO_BASELINE_READ_FILES");
  // The notes read asks for the request's marked notes only, by sequence.
  const usable = fakeStrapi({ runs: [run({})], notes });
  await loadAiInputsChanged(usable.strapi, { requestDocumentId: REQUEST, baselineRunId: "run-1", generatedDate: GENERATED });
  assert.deepEqual(usable.noteReads[0]?.filters, { assessmentRequest: { documentId: { $eq: REQUEST } }, changesAiInputs: { $eq: true } }, "NOTES_READ_FILTER");
});

/*
 * IN-103 (D-29, the fail-visible rule): a marked note the signal cannot name is never silently left out, which would hide
 * a changed input while the context loader refuses the same row. The signal fails as the loader does, with the loader's
 * own message, so the provider and the signal never disagree about a note.
 */
test("a marked note the signal cannot read fails the signal as the context loader fails, never drops out of it (IN-103)", async () => {
  const good = note(1, { aiInputLog: markLog(["2026-10-02T00:00:00.000Z", true]) });
  const input = { requestDocumentId: REQUEST, baselineRunId: "run-1", generatedDate: GENERATED };
  for (const [label, malformed] of [
    ["NO_POSTED_AT", { ...noteRow(note(2)), postedAt: null }],
    ["UNREADABLE_POSTED_AT", { ...noteRow(note(2)), postedAt: "not a date" }],
    ["NO_SEQUENCE", { ...noteRow(note(2)), sequence: null }],
    ["ZERO_SEQUENCE", { ...noteRow(note(2)), sequence: 0 }],
    ["NO_DOCUMENT_ID", { ...noteRow(note(2)), documentId: null }],
    ["UNKNOWN_PART", { ...noteRow(note(2)), authorPart: "agent" }],
  ] as const) {
    const { strapi } = fakeStrapi({ runs: [run({})], notes: [noteRow(good), malformed] });
    await assert.rejects(loadAiInputsChanged(strapi, input), /^Error: CSRM request note is invalid\.$/, `${label}_DROPPED_SILENTLY`);
  }
});

/*
 * Phase 14 D-36 (14-PLAN-CHECK iteration 2, S-1): the signal is one value. Its files half (changedAttachmentInputs, proven in
 * attachment-ai-signal.unit.test.ts) merges here beside Phase 13's notes: count is the notes changed plus the files changed,
 * and the value is non-null when either list has an item, so a files-only change shows the signal with no notes.
 */
const csvIncluded = { documentId: "file-csv", fileName: "register.csv", change: "included" } as const;
const pdfExcluded = { documentId: "file-pdf", fileName: "vendor-security-pack.pdf", change: "excluded" } as const;
const RUN_BASELINE = { kind: "run", included: [] } as const;

test("a files-only change is the signal with no notes, not null (S-1)", () => {
  assert.deepEqual(aiInputsChanged({ markedNotes: [], changedFiles: [csvIncluded, pdfExcluded], baseline: RUN_BASELINE }), {
    count: 2, notes: [], files: [csvIncluded, pdfExcluded],
  });
  // Against a generation date too: the baseline decides whether there is a signal, either list whether it shows.
  assert.equal(aiInputsChanged({ markedNotes: [], changedFiles: [csvIncluded], baseline: { kind: "generated-date", at: GENERATED } })?.count, 1);
});

test("a notes-only change is Phase 13's value with no files, and the same count", () => {
  const marked = aiInputsChanged({ markedNotes: [note(1)], changedFiles: [], baseline: RUN_BASELINE });
  assert.deepEqual(marked, { count: 1, notes: [{ ...identity(note(1)), change: "marked" }], files: [] });
  assert.deepEqual(aiInputsChanged({ markedNotes: [note(1)], baseline: RUN_BASELINE }), marked, "CHANGED_FILES_ABSENT_IS_NONE");
});

test("with notes and files changed, the count sums both and each list keeps its own order", () => {
  assert.deepEqual(aiInputsChanged({ markedNotes: [note(2), note(1)], changedFiles: [csvIncluded, pdfExcluded], baseline: RUN_BASELINE }), {
    count: 4,
    notes: [{ ...identity(note(1)), change: "marked" }, { ...identity(note(2)), change: "marked" }],
    files: [csvIncluded, pdfExcluded],
  });
});

test("with neither changed the signal is null, and with no baseline it is null whatever the files", () => {
  assert.equal(aiInputsChanged({ markedNotes: [], changedFiles: [], baseline: RUN_BASELINE }), null);
  assert.equal(aiInputsChanged({ markedNotes: [note(1)], changedFiles: [csvIncluded], baseline: null }), null);
});

/** One of the request's stored files as the attachment content type holds it. */
function fileRow(documentId: string, fileName: string, day: number, included: boolean): Row {
  return {
    documentId, fileName, uploadedAt: `2026-09-${String(day).padStart(2, "0")}T00:00:00.000Z`, scanStatus: "clean", removedAt: null,
    aiTextIncluded: included,
    aiTextFacts: included ? { available: 4, kept: 4, truncated: false, extractor: "csrm-extract-1", extractedAt: "2026-10-02T00:00:00.000Z" } : null,
  };
}

/** A v3 summary whose attachments section includes the vendor pack. */
function summaryIncludingThePack() {
  const pack = { documentId: "file-pdf", sha256: "a".repeat(64), type: "pdf" as const, part: "requestor" as const, text: "Pack", kept: 4, available: 4, truncated: false };
  return buildAssessmentContext({ ...uatALikeRecords(), notes: [], attachments: [pack] }, { operation: "questionnaire-generation" }).summary;
}

test("the loader compares the files against the same baseline run's v3 attachments section, and reads them only with a baseline", async () => {
  const input = { requestDocumentId: REQUEST, baselineRunId: "run-1", generatedDate: GENERATED };
  const files = [fileRow("file-csv", "register.csv", 1, true), fileRow("file-pdf", "vendor-security-pack.pdf", 2, false)];
  const changed = fakeStrapi({ runs: [run({ contextSummary: summaryIncludingThePack() })], files });
  assert.deepEqual(await loadAiInputsChanged(changed.strapi, input), { count: 2, notes: [], files: [csvIncluded, pdfExcluded] }, "FILES_ONLY_SIGNAL");
  assert.deepEqual(changed.fileReads[0]?.filters, { assessmentRequest: { documentId: { $eq: REQUEST } } }, "FILES_READ_FILTER");

  // A v2 run included no files, so every file in the inputs now is included since.
  const { attachments: _attachments, questionnaire: _questionnaire, instruction: _instruction, riskProposals: _riskProposalsV2, ...v2Fields } = summaryWith([]);
  const v2 = fakeStrapi({ runs: [run({ contextSummary: { ...v2Fields, schemaVersion: 2 } })], files });
  assert.deepEqual(await loadAiInputsChanged(v2.strapi, input), { count: 1, notes: [], files: [csvIncluded] }, "V2_RUN_INCLUDED_FILES");

  // No usable run: the generation date is the baseline for the files too (the CSV's text was extracted after it).
  const legacy = fakeStrapi({ files });
  assert.deepEqual(await loadAiInputsChanged(legacy.strapi, { ...input, baselineRunId: null }), { count: 1, notes: [], files: [csvIncluded] }, "GENERATED_DATE_FILES");
});
