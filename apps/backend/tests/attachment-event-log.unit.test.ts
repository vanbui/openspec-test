import assert from "node:assert/strict";
import test from "node:test";

import * as eventLogModule from "../src/api/csrm-request-attachment/services/attachment-event-log";
import { ATTACHMENT_EVENT_LOG_MAX_EVENTS, AttachmentEventLogError, appendAttachmentEvent } from "../src/api/csrm-request-attachment/services/attachment-event-log";

/*
 * WR-101 (G-3, D-21; the pilot's ruling): an attachment's event log keeps a reserve below its 200-event cap. Only the
 * changes that add (a restore, an inclusion in the AI inputs, an upload) are refused once the log is within the reserve,
 * so the changes that withdraw text and the system's verdicts (an exclusion, a removal, a scan verdict, a block) always
 * fit after the last adding change. A withdrawal or a verdict that still does not fit (a log a seed or a legacy record
 * filled) or that meets a malformed log is never blocked: the log is left untouched and the caller records the change
 * elsewhere.
 */

type WithdrawalOutcome = { recorded: true; eventLog: { schemaVersion: 1; events: readonly Record<string, unknown>[] } } | { recorded: false; cause: "full" | "malformed" };

// Read through the module namespace, so this file compiles against a module that does not yet export them.
const stageB = eventLogModule as unknown as {
  ATTACHMENT_EVENT_LOG_RESERVE?: number;
  recordAttachmentWithdrawal?: (value: unknown, events: readonly unknown[]) => WithdrawalOutcome;
};

const AT = "2026-10-11T00:00:00.000Z";
const JANE = "user-jane";
const BOB = "user-bob";

function event(type: string, by: string | null = BOB): Record<string, unknown> {
  if (type === "scan-verdict") return { schemaVersion: 1, type, by: null, at: AT, engine: "clamav", verdict: "clean" };
  if (type === "blocked") return { schemaVersion: 1, type, by: null, at: AT, engine: "clamav", verdict: "infected", detection: "Win.Test.EICAR_HDB-1" };
  return { schemaVersion: 1, type, by, at: AT };
}

/** A well-formed log of `length` events: an upload, then remove and restore cycles, as an ordinary caller can make. */
function logOf(length: number): { schemaVersion: 1; events: Record<string, unknown>[] } {
  return { schemaVersion: 1, events: Array.from({ length }, (_, index) => event(index === 0 ? "uploaded" : index % 2 ? "removed" : "restored", JANE)) };
}

test("the reserve is three events: an adding change is refused within it, and an exclusion, a removal and a verdict still fit (WR-101)", () => {
  assert.equal(ATTACHMENT_EVENT_LOG_MAX_EVENTS, 200);
  assert.equal(stageB.ATTACHMENT_EVENT_LOG_RESERVE, 3, "THE_RESERVE_IS_NOT_THREE_EVENTS");
  // The last adding change fits at 196, leaving 197 events.
  for (const adding of ["restored", "ai-included"]) {
    assert.equal(appendAttachmentEvent(logOf(196), event(adding)).events.length, 197, `${adding}_REFUSED_BELOW_THE_RESERVE`);
  }
  // Within the reserve every adding change is refused.
  for (const length of [197, 198, 199]) {
    for (const adding of ["restored", "ai-included", "uploaded", "quarantined"]) {
      assert.throws(() => appendAttachmentEvent(logOf(length), event(adding)), AttachmentEventLogError, `${adding}_TAKEN_AT_${length}_WITHIN_THE_RESERVE`);
    }
  }
  // After the last adding change, an included file's exclusion and removal (two events) and one verdict all fit.
  let log: unknown = logOf(197);
  for (const withdrawing of ["ai-excluded", "removed", "blocked"]) log = appendAttachmentEvent(log, event(withdrawing));
  assert.equal((log as { events: unknown[] }).events.length, 200, "THE_WITHDRAWALS_AND_THE_VERDICT_DID_NOT_FIT");
  for (const withdrawing of ["ai-excluded", "removed", "scan-verdict", "blocked"]) {
    assert.equal(appendAttachmentEvent(logOf(199), event(withdrawing)).events.length, 200, `${withdrawing}_REFUSED_AT_199`);
    // The cap itself still holds for the appender: a 201st event is never written.
    assert.throws(() => appendAttachmentEvent(logOf(200), event(withdrawing)), AttachmentEventLogError, `${withdrawing}_WRITTEN_PAST_THE_CAP`);
  }
});

test("a withdrawal or a verdict that does not fit, or meets a malformed log, leaves the log untouched and is never refused (WR-101)", () => {
  const record = stageB.recordAttachmentWithdrawal;
  assert.equal(typeof record, "function", "NO_WITHDRAWAL_RECORDER");
  const withdraw = record!;

  const fits = withdraw(logOf(199), [event("removed")]);
  assert.equal(fits.recorded, true, "A_FITTING_WITHDRAWAL_WAS_NOT_RECORDED");
  assert.deepEqual(fits.recorded && fits.eventLog.events.slice(-1), [event("removed")], "THE_WITHDRAWAL_IS_NOT_THE_LAST_EVENT");
  assert.equal(fits.recorded && fits.eventLog.events.length, 200);
  assert.deepEqual(withdraw(null, [event("ai-excluded"), event("removed")]), { recorded: true, eventLog: { schemaVersion: 1, events: [event("ai-excluded"), event("removed")] } }, "AN_EMPTY_LOG_TOOK_NOTHING");

  // A change's events are written together or not at all: an included file's removal at 199 is two events, so neither.
  const at199 = logOf(199);
  const frozen = JSON.stringify(at199);
  assert.deepEqual(withdraw(at199, [event("ai-excluded"), event("removed")]), { recorded: false, cause: "full" }, "A_PARTIAL_HISTORY_WAS_WRITTEN");
  assert.equal(JSON.stringify(at199), frozen, "THE_LOG_WAS_CHANGED");
  for (const type of ["ai-excluded", "removed", "scan-verdict", "blocked"]) {
    assert.deepEqual(withdraw(logOf(200), [event(type)]), { recorded: false, cause: "full" }, `${type}_AT_THE_CAP`);
  }

  // A malformed log (an unknown type, an unknown key, another version, too many events) is never repaired.
  for (const [label, malformed] of [
    ["UNKNOWN_TYPE", { schemaVersion: 1, events: [{ ...event("uploaded"), type: "renamed" }] }],
    ["UNKNOWN_KEY", { schemaVersion: 1, events: [event("uploaded")], extra: true }],
    ["VERSION", { schemaVersion: 2, events: [] }],
    ["OVER_THE_CAP", logOf(201)],
    ["NOT_A_LOG", "history"],
  ] as const) {
    assert.deepEqual(withdraw(malformed, [event("removed")]), { recorded: false, cause: "malformed" }, `MALFORMED_${label}`);
  }

  // Only a withdrawal or a verdict is recorded this way; an adding change goes through the appender and its reserve.
  for (const adding of ["restored", "ai-included", "uploaded", "quarantined"]) {
    assert.throws(() => withdraw(logOf(1), [event(adding)]), AttachmentEventLogError, `${adding}_RECORDED_AS_A_WITHDRAWAL`);
  }
});
