import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  NOTE_AI_INPUT_LOG_MAX_EVENTS,
  NOTE_AI_INPUT_LOG_SCHEMA_VERSION,
  NoteAiInputLogError,
  appendNoteAiInputEvent,
  parseNoteAiInputLog,
} from "../src/api/csrm-request-note/services/note-ai-input-log";
import {
  NOTE_BODY_MAX_LENGTH,
  NoteBodyError,
  acceptsNotes,
  authorPartFor,
  canUseRequestNotes,
  isUnreadNote,
  notesClosedReason,
  parseNoteBody,
  type NotesCaller,
} from "../src/api/csrm-request-note/services/request-notes-policy";
import { summarizeRequestNotes, type NotesStrapi } from "../src/api/csrm-request-note/services/request-notes";

/*
 * Phase 13 (D-21 to D-24, D-26): the request notes rules, without Strapi. The mounted file proves the same rules
 * through the routes; this one proves each predicate's edges.
 */

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const appDir = path.resolve(__dirname, "..", "..", "..");

const JANE = "jane";
const BOB = "bob";

test("acceptsNotes is true for the four reviewable statuses and false for a draft and a released or closed request (D-22)", () => {
  for (const status of ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"]) {
    assert.equal(acceptsNotes(status), true, `UNEXPECTED_CLOSED_${status}`);
  }
  for (const status of ["draft", "approved", "closed", "unknown", "", null, undefined]) {
    assert.equal(acceptsNotes(status), false, `UNEXPECTED_OPEN_${String(status)}`);
  }
});

test("notesClosedReason names a never-submitted draft, a request returned to draft and a released or closed request", () => {
  assert.equal(notesClosedReason({ requestStatus: "submitted", revertedAt: null }), null);
  assert.equal(notesClosedReason({ requestStatus: "under-review", revertedAt: "2026-10-01T00:00:00.000Z" }), null);
  assert.equal(notesClosedReason({ requestStatus: "draft", revertedAt: null }), "not-submitted");
  assert.equal(notesClosedReason({ requestStatus: "draft" }), "not-submitted");
  assert.equal(notesClosedReason({ requestStatus: "draft", revertedAt: "2026-10-01T00:00:00.000Z" }), "returned-to-draft");
  assert.equal(notesClosedReason({ requestStatus: "approved", revertedAt: null }), "released");
  assert.equal(notesClosedReason({ requestStatus: "closed", revertedAt: null }), "released");
});

test("canUseRequestNotes admits the requestor through either grant and a human Security Analyst, and no one else (D-23, G-12)", () => {
  const janes = { requestorDocumentId: JANE };
  assert.equal(canUseRequestNotes(janes, { documentId: JANE, humanAnalyst: false }), true, "REQUESTOR");
  assert.equal(canUseRequestNotes(janes, { documentId: JANE, humanAnalyst: true }), true, "REQUESTING_ANALYST");
  assert.equal(canUseRequestNotes(janes, { documentId: BOB, humanAnalyst: true }), true, "HUMAN_ANALYST");
  assert.equal(canUseRequestNotes(janes, { documentId: "other", humanAnalyst: false }), false, "OTHER_REQUESTOR");
  // The Security Analyst Agent holds an analyst-shaped role, never the human analyst grant.
  assert.equal(canUseRequestNotes(janes, { documentId: "agent", humanAnalyst: false }), false, "AGENT");
  assert.equal(canUseRequestNotes({ requestorDocumentId: null }, { documentId: "other", humanAnalyst: false }), false, "NO_REQUESTOR");
  assert.equal(canUseRequestNotes(janes, { documentId: "", humanAnalyst: true }), false, "NO_IDENTITY");
});

test("a participant who is not the requestor never reaches notes, and the predicate says widening it needs its own decision (D-23, G-12)", () => {
  const participant = { documentId: "risk-owner", humanAnalyst: false, participant: true } as unknown as NotesCaller;
  assert.equal(canUseRequestNotes({ requestorDocumentId: JANE }, participant), false, "PARTICIPANT_ADMITTED");
  const source = readFileSync(path.join(appDir, "src", "api", "csrm-request-note", "services", "request-notes-policy.ts"), "utf8");
  assert.match(source, /Phase 17's participant read/, "PARTICIPANT_DOC_COMMENT_MISSING");
  assert.match(source, /needs its own decision/, "WIDENING_DOC_COMMENT_MISSING");
});

test("authorPartFor gives the requestor's part to whoever raised the request, a requesting analyst included (G-1)", () => {
  assert.equal(authorPartFor({ requestorDocumentId: JANE }, { documentId: JANE }), "requestor");
  assert.equal(authorPartFor({ requestorDocumentId: BOB }, { documentId: BOB }), "requestor");
  assert.equal(authorPartFor({ requestorDocumentId: JANE }, { documentId: BOB }), "security-analyst");
  assert.equal(authorPartFor({ requestorDocumentId: null }, { documentId: BOB }), "security-analyst");
});

test("isUnreadNote holds only for another part's note, by someone else, above the viewer's lastReadSequence (D-24)", () => {
  const bob = { part: "security-analyst" as const, documentId: BOB, lastReadSequence: 2 };
  assert.equal(isUnreadNote({ authorPart: "requestor", authorDocumentId: JANE, sequence: 3 }, bob), true, "UNREAD");
  assert.equal(isUnreadNote({ authorPart: "requestor", authorDocumentId: JANE, sequence: 2 }, bob), false, "AT_LAST_READ");
  assert.equal(isUnreadNote({ authorPart: "requestor", authorDocumentId: JANE, sequence: 1 }, bob), false, "BELOW_LAST_READ");
  assert.equal(isUnreadNote({ authorPart: "security-analyst", authorDocumentId: "second", sequence: 9 }, bob), false, "SAME_PART");
  assert.equal(isUnreadNote({ authorPart: "requestor", authorDocumentId: BOB, sequence: 9 }, bob), false, "OWN_NOTE");
  assert.equal(isUnreadNote({ authorPart: "security-analyst", authorDocumentId: BOB, sequence: 1 }, { part: "requestor", documentId: JANE, lastReadSequence: 0 }), true, "NEVER_READ");
});

test("parseNoteBody trims, normalises line endings to LF, keeps tabs and newlines, and holds 1 to 5,000 characters with no other control character", () => {
  assert.equal(parseNoteBody("  A note.  "), "A note.");
  assert.equal(parseNoteBody("Line one\r\nLine two\rLine three"), "Line one\nLine two\nLine three");
  assert.equal(parseNoteBody("Column\tvalue\n\nNext paragraph"), "Column\tvalue\n\nNext paragraph");
  assert.equal(parseNoteBody("x".repeat(NOTE_BODY_MAX_LENGTH)).length, 5_000);
  assert.equal(parseNoteBody(`  ${"x".repeat(NOTE_BODY_MAX_LENGTH)}  `).length, 5_000, "TRIMMED_BEFORE_THE_BOUND");
  for (const [label, value] of [
    ["EMPTY", ""],
    ["WHITESPACE", " \n\t "],
    ["TOO_LONG", "x".repeat(5_001)],
    ["BELL", "Ring \u0007 the bell"],
    ["NULL", "A\u0000B"],
    ["ESCAPE", "A\u001bB"],
    ["VERTICAL_TAB", "A\u000bB"],
    ["NOT_A_STRING", 42],
  ] as const) {
    assert.throws(() => parseNoteBody(value), NoteBodyError, `UNEXPECTED_ACCEPTED_${label}`);
  }
});

const AT = "2026-10-09T01:02:03.000Z";

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, by: BOB, at: AT, from: false, to: true, ...overrides };
}

test("the AI-input log parses closed, appends without rewriting and holds at most 200 events (the 06.8 posture)", () => {
  assert.equal(NOTE_AI_INPUT_LOG_SCHEMA_VERSION, 1);
  assert.equal(NOTE_AI_INPUT_LOG_MAX_EVENTS, 200);
  assert.deepEqual(parseNoteAiInputLog(null), []);
  assert.deepEqual(parseNoteAiInputLog(undefined), []);
  const first = appendNoteAiInputEvent(null, event());
  assert.deepEqual(first, { schemaVersion: 1, events: [event()] });
  const second = appendNoteAiInputEvent(first, event({ by: "second", from: true, to: false }));
  assert.deepEqual(second.events, [event(), event({ by: "second", from: true, to: false })], "APPEND_REWROTE_HISTORY");
  assert.deepEqual(first.events, [event()], "APPEND_MUTATED_ITS_INPUT");

  for (const [label, value] of [
    ["UNKNOWN_ENVELOPE_KEY", { schemaVersion: 1, events: [], extra: true }],
    ["UNKNOWN_VERSION", { schemaVersion: 2, events: [] }],
    ["EVENTS_NOT_A_LIST", { schemaVersion: 1, events: {} }],
    ["UNKNOWN_EVENT_KEY", { schemaVersion: 1, events: [event({ reason: "x" })] }],
    ["EVENT_VERSION", { schemaVersion: 1, events: [event({ schemaVersion: 2 })] }],
    ["NO_CHANGE", { schemaVersion: 1, events: [event({ from: true, to: true })] }],
    ["NOT_A_BOOLEAN", { schemaVersion: 1, events: [event({ to: "true" })] }],
    ["BAD_TIME", { schemaVersion: 1, events: [event({ at: "yesterday" })] }],
    ["NO_ACTOR", { schemaVersion: 1, events: [event({ by: "" })] }],
    ["A_STRING", "[]"],
  ] as const) {
    assert.throws(() => parseNoteAiInputLog(value), NoteAiInputLogError, `UNEXPECTED_LOG_ACCEPTED_${label}`);
  }

  const full = { schemaVersion: 1, events: Array.from({ length: 200 }, (_, index) => event(index % 2 === 0 ? {} : { from: true, to: false })) };
  assert.equal(parseNoteAiInputLog(full).length, 200);
  assert.throws(() => appendNoteAiInputEvent(full, event()), NoteAiInputLogError, "UNEXPECTED_APPEND_PAST_THE_CAP");
  assert.throws(() => parseNoteAiInputLog({ schemaVersion: 1, events: [...full.events, event()] }), NoteAiInputLogError, "UNEXPECTED_OVER_CAP_ACCEPTED");
});

/*
 * T-13-24 (D-24, D-25): the request read's notes summary is computed only for a viewer canUseRequestNotes admits. Anyone
 * else reading the request (Phase 17's participants, say) gets null, and nothing about the notes is even read.
 */
test("summarizeRequestNotes answers null, reading nothing, for a viewer who may not use the request's notes (T-13-24)", async () => {
  const touched: string[] = [];
  const strapi = {
    documents(uid: string) {
      touched.push(uid);
      throw new Error(`UNEXPECTED_NOTES_READ_${uid}`);
    },
  } as unknown as NotesStrapi;
  const request = { documentId: "request-1", requestorDocumentId: JANE, requestStatus: "submitted", revertedAt: null };
  for (const caller of [{ documentId: "other", humanAnalyst: false }, { documentId: "", humanAnalyst: true }]) {
    assert.equal(await summarizeRequestNotes(strapi, request, caller), null, `UNEXPECTED_SUMMARY_FOR_${caller.documentId}`);
  }
  assert.deepEqual(touched, [], "UNEXPECTED_NOTES_TOUCHED");
});
