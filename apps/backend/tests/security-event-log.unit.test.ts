import assert from "node:assert/strict";
import test from "node:test";

import { CONFLICT_REASONS } from "../src/csrm/conflict-reasons";
import * as securityEventLogModule from "../src/csrm/audit/security-event-log";
import {
  ATTACHMENT_SECURITY_EVENT_NAMES,
  formatSecurityEventLine,
  logSecurityEvent,
  SECURITY_EVENT_LEVELS,
  SECURITY_EVENT_LOG_REASONS,
  SECURITY_EVENT_SCHEMA_VERSION,
  SECURITY_EVENT_WARN_REASONS,
  securityEventLevel,
  type AttachmentSecurityEvent,
  type ExportSecurityEvent,
  type ImportSecurityEvent,
} from "../src/csrm/audit/security-event-log";

/*
 * The security event log (14-03; D-37): one named, versioned line per event through Strapi's logger. A line carries
 * the actor, the record ids, the type, the size, the digest and the outcome, and never a file's name, content or text.
 */

const AT = new Date(Date.UTC(2026, 9, 10, 3, 4, 5, 678));
const DIGEST = "a".repeat(64);
const PREFIX = "csrm.security_event ";

const MALWARE_REFUSED: AttachmentSecurityEvent = {
  name: "attachment.refused",
  actor: { documentId: "user-jane", displayName: "Jane Analyst" },
  requestId: "request-123",
  fileType: "txt",
  byteSize: 48,
  sha256: DIGEST,
  outcome: "refused",
  reason: "ATTACHMENT_MALWARE_FOUND",
  detection: "Csrm.Test.Signature",
};

const UPLOADED: AttachmentSecurityEvent = {
  name: "attachment.uploaded",
  actor: { documentId: "user-sam", displayName: "Sam Requestor" },
  requestId: "request-123",
  attachmentId: "attachment-9",
  fileType: "docx",
  byteSize: 2048,
  sha256: DIGEST,
  outcome: "clean",
};

function parse(line: string): Record<string, unknown> {
  assert.ok(line.startsWith(PREFIX), `the line starts with ${PREFIX}`);
  return JSON.parse(line.slice(PREFIX.length)) as Record<string, unknown>;
}

function keysDeep(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...keysDeep(inner)]);
}

test("a malware refusal is one named, versioned line with the actor, ids, type, size, digest, reason and detection", () => {
  const line = formatSecurityEventLine(MALWARE_REFUSED, AT);
  assert.equal(line.includes("\n"), false);
  assert.deepEqual(parse(line), {
    event: "attachment.refused",
    schemaVersion: 1,
    at: "2026-10-10T03:04:05.678Z",
    actor: { documentId: "user-jane", displayName: "Jane Analyst" },
    requestId: "request-123",
    fileType: "txt",
    byteSize: 48,
    sha256: DIGEST,
    outcome: "refused",
    reason: "ATTACHMENT_MALWARE_FOUND",
    detection: "Csrm.Test.Signature",
  });
  assert.equal(SECURITY_EVENT_SCHEMA_VERSION, 1);
});

test("the line's keys come in a fixed order", () => {
  const line = formatSecurityEventLine(UPLOADED, AT);
  assert.deepEqual(Object.keys(parse(line)), ["event", "schemaVersion", "at", "actor", "requestId", "attachmentId", "fileType", "byteSize", "sha256", "outcome"]);
});

test("a line never carries a file name, content or text, even when the caller passes them", () => {
  const smuggled = { ...MALWARE_REFUSED, fileName: "payroll-2026.xlsx", text: "secret text", content: "secret bytes" } as AttachmentSecurityEvent;
  const line = formatSecurityEventLine(smuggled, AT);
  const keys = keysDeep(parse(line));
  for (const forbidden of ["fileName", "name", "text", "content"]) assert.equal(keys.includes(forbidden), false, `no ${forbidden} key`);
  for (const value of ["payroll-2026.xlsx", "secret text", "secret bytes"]) assert.equal(line.includes(value), false, `no ${value}`);
});

test("a system actor is the re-scan, never a person", () => {
  const line = formatSecurityEventLine({ ...UPLOADED, name: "attachment.scan_verdict", actor: { system: "rescan" }, outcome: "clean" }, AT);
  assert.deepEqual(parse(line).actor, { system: "rescan" });
});

test("a reason or detection that is not a closed code is replaced, so no free text reaches the log", () => {
  const line = formatSecurityEventLine({ ...MALWARE_REFUSED, reason: "payroll-2026.xlsx is bad", detection: "Win.Test\n{\"forged\":true}" }, AT);
  const parsed = parse(line);
  assert.equal(parsed.reason, "INVALID_REASON");
  assert.equal(parsed.detection, "INVALID_DETECTION");
  assert.equal(line.includes("payroll"), false);
});

/*
 * WR-501 (contract item 4 of the stage B amendment): ClamAV's names use underscores (the official database reports its
 * antivirus test file as Win.Test.EICAR_HDB-1, a detection name, not the test string). The logged rule is the one
 * pattern the contract serves, ^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$: an underscore is kept, a 129th character, a space
 * or markup is not.
 */
test("a real ClamAV detection name, underscore and all, is logged verbatim, under the one pattern the contract serves (WR-501)", () => {
  const logged = (detection: string) => parse(formatSecurityEventLine({ ...MALWARE_REFUSED, detection }, AT)).detection;
  assert.equal(logged("Win.Test.EICAR_HDB-1"), "Win.Test.EICAR_HDB-1", "THE_CLAMAV_NAME_WAS_NOT_LOGGED");
  assert.equal(logged(`A${"b".repeat(127)}`), `A${"b".repeat(127)}`);
  assert.equal(logged(`A${"b".repeat(128)}`), "INVALID_DETECTION", "A_129_CHARACTER_DETECTION_WAS_LOGGED");
  for (const outside of ["Win Test", "<b>Win</b>", "_Win.Test", "Win.Test\"x"]) assert.equal(logged(outside), "INVALID_DETECTION", `LOGGED_${outside}`);
});

test("an AI inclusion change carries its from and to", () => {
  const line = formatSecurityEventLine({ ...UPLOADED, name: "attachment.ai_inclusion_changed", outcome: "changed", from: false, to: true }, AT);
  const parsed = parse(line);
  assert.equal(parsed.from, false);
  assert.equal(parsed.to, true);
});

function recordingLogger() {
  const calls: Array<{ level: "info" | "warn"; message: string }> = [];
  return {
    calls,
    info: (message: string) => calls.push({ level: "info", message }),
    warn: (message: string) => calls.push({ level: "warn", message }),
  };
}

test("a malware refusal logs at warning level, an upload at info", () => {
  const logger = recordingLogger();
  logSecurityEvent(logger, MALWARE_REFUSED, AT);
  logSecurityEvent(logger, UPLOADED, AT);
  assert.deepEqual(logger.calls.map((call) => call.level), ["warn", "info"]);
  assert.equal(logger.calls[0].message, formatSecurityEventLine(MALWARE_REFUSED, AT));
});

test("blocked and integrity-failure events log at warning level; another refusal at info", () => {
  const logger = recordingLogger();
  logSecurityEvent(logger, { ...UPLOADED, name: "attachment.blocked", outcome: "blocked", detection: "Win.Test.Fake" }, AT);
  logSecurityEvent(logger, { ...UPLOADED, name: "attachment.integrity_failed", outcome: "failed" }, AT);
  logSecurityEvent(logger, { ...MALWARE_REFUSED, reason: "ATTACHMENT_TOO_LARGE", detection: undefined }, AT);
  assert.deepEqual(logger.calls.map((call) => call.level), ["warn", "warn", "info"]);
});

test("the time defaults to now, in UTC", () => {
  const logger = recordingLogger();
  const before = Date.now();
  logSecurityEvent(logger, UPLOADED);
  const at = Date.parse(String(parse(logger.calls[0].message).at));
  assert.ok(at >= before && at <= Date.now());
  assert.match(String(parse(logger.calls[0].message).at), /Z$/);
});

// Read through the module namespace, so this file compiles against a module that does not yet export them.
const stageB = securityEventLogModule as unknown as {
  SECURITY_EVENT_LOG_REASONS?: readonly string[];
  isSecurityEventIdentifier?: (value: unknown) => boolean;
};

/*
 * WR-103 (D-11, D-37; the pilot's ruling): the readers-rule 404 is a refusal line too. It logs the closed log reason
 * NOT_FOUND, which is a log value and never an API reason (the 404 stays reasonless), and only the identifiers the
 * caller asked for, each held to the log's identifier rule: one that fails it is dropped, never echoed or replaced.
 */
test("the readers-rule refusal logs NOT_FOUND, a log reason the API never serves, and only the identifiers that pass the rule (WR-103)", () => {
  assert.ok(stageB.SECURITY_EVENT_LOG_REASONS?.includes("NOT_FOUND"), "NOT_FOUND_IS_NOT_A_LOG_REASON");
  assert.equal((CONFLICT_REASONS as readonly string[]).includes("NOT_FOUND"), false, "NOT_FOUND_IS_AN_API_REASON");
  const notFound = { name: "attachment.refused", actor: { documentId: "user-other", displayName: "Other Requestor" }, outcome: "refused", reason: "NOT_FOUND" } as const;
  assert.deepEqual(parse(formatSecurityEventLine({ ...notFound, requestId: "request-123", attachmentId: "attachment-9" }, AT)), {
    event: "attachment.refused",
    schemaVersion: 1,
    at: "2026-10-10T03:04:05.678Z",
    actor: { documentId: "user-other", displayName: "Other Requestor" },
    requestId: "request-123",
    attachmentId: "attachment-9",
    outcome: "refused",
    reason: "NOT_FOUND",
  });
  // A refusal whose requested request id failed the rule names no request at all.
  const withoutRequest = parse(formatSecurityEventLine(notFound as unknown as AttachmentSecurityEvent, AT));
  assert.equal("requestId" in withoutRequest, false, `A_DROPPED_REQUEST_ID_WAS_LOGGED_AS_${JSON.stringify(withoutRequest.requestId)}`);
  assert.deepEqual(Object.keys(withoutRequest), ["event", "schemaVersion", "at", "actor", "outcome", "reason"]);

  const isIdentifier = stageB.isSecurityEventIdentifier;
  assert.equal(typeof isIdentifier, "function", "NO_IDENTIFIER_RULE_EXPORTED");
  for (const kept of ["request-123", "a", "A_b-9", "x".repeat(128)]) assert.equal(isIdentifier!(kept), true, `REFUSED_${kept}`);
  for (const dropped of ["", "bad.id", "a b", "../etc", "x".repeat(129), "payroll-2026.xlsx", undefined, null, 7]) {
    assert.equal(isIdentifier!(dropped), false, `KEPT_${String(dropped)}`);
  }
});

/*
 * WR-101 (G-3, D-21; the pilot's ruling): a withdrawal or a verdict the attachment's history cannot take still happens,
 * and one warning-level attachment.history_unavailable line records it with its closed fields (never a name or text).
 */
test("a change the attachment's history cannot take is one warning-level attachment.history_unavailable line (WR-101)", () => {
  const name = "attachment.history_unavailable";
  assert.ok((ATTACHMENT_SECURITY_EVENT_NAMES as readonly string[]).includes(name), "NO_HISTORY_UNAVAILABLE_EVENT");
  const event = { ...UPLOADED, name, outcome: "removed", reason: "HISTORY_UNAVAILABLE" } as unknown as AttachmentSecurityEvent;
  const logger = recordingLogger();
  logSecurityEvent(logger, event, AT);
  assert.deepEqual(logger.calls.map((call) => call.level), ["warn"], "THE_HISTORY_LINE_IS_NOT_A_WARNING");
  assert.deepEqual(parse(logger.calls[0]!.message), {
    event: name,
    schemaVersion: 1,
    at: "2026-10-10T03:04:05.678Z",
    actor: { documentId: "user-sam", displayName: "Sam Requestor" },
    requestId: "request-123",
    attachmentId: "attachment-9",
    fileType: "docx",
    byteSize: 2048,
    sha256: DIGEST,
    outcome: "removed",
    reason: "HISTORY_UNAVAILABLE",
  });
});

/*
 * Phase 19 (19-04; D-18; phase-19-exports-and-export-log.md, "The Export Event Log"): every export attempt is one
 * export.completed or export.refused line, and every committed import one import.committed line, on this same log.
 * A line holds the closed, parsed query and never a cell value or the raw query string.
 */

const EXPORT_COMPLETED: ExportSecurityEvent = {
  name: "export.completed",
  actor: { documentId: "user-bob", displayName: "Bob Analyst" },
  view: "risk-register",
  format: "xlsx",
  columns: ["riskNumber", "riskStatement"],
  table: null,
  filters: { state: "withdrawn", residualRating: "High" },
  search: "payroll",
  sort: "targetDate:asc",
  timeZone: "Australia/Sydney",
  rowCount: 12,
  subject: null,
  outcome: "exported",
};

const IMPORT_COMMITTED: ImportSecurityEvent = {
  name: "import.committed",
  actor: { documentId: "user-bob", displayName: "Bob Analyst" },
  collection: "information-systems",
  fileName: "systems.xlsx",
  sha256: DIGEST,
  format: "xlsx",
  counts: { created: 3, updated: 2, unchanged: 1, rejected: 0, ambiguous: 0, skipped: 1 },
  outcome: "committed",
};

test("export.completed is one prefixed line with its keys in a fixed order and no reason", () => {
  const line = formatSecurityEventLine(EXPORT_COMPLETED, AT);
  assert.equal(line.includes("\n"), false);
  const parsed = parse(line);
  assert.deepEqual(Object.keys(parsed), [
    "event", "schemaVersion", "at", "actor", "view", "format", "columns", "table", "filters", "search", "sort", "timeZone", "rowCount", "subject", "outcome",
  ]);
  assert.deepEqual(parsed, {
    event: "export.completed",
    schemaVersion: 1,
    at: "2026-10-10T03:04:05.678Z",
    actor: { documentId: "user-bob", displayName: "Bob Analyst" },
    view: "risk-register",
    format: "xlsx",
    columns: ["riskNumber", "riskStatement"],
    table: null,
    filters: { state: "withdrawn", residualRating: "High" },
    search: "payroll",
    sort: "targetDate:asc",
    timeZone: "Australia/Sydney",
    rowCount: 12,
    subject: null,
    outcome: "exported",
  });
  assert.equal(line.includes("INVALID_REASON"), false);
  assert.equal(line.includes("reason"), false, "a completed export names no reason");
});

test("an export line never carries a cell value or the raw query, even when the caller passes them", () => {
  const smuggled = { ...EXPORT_COMPLETED, cells: [["=HYPERLINK(1)"]], query: "q=payroll&format=xlsx" } as unknown as ExportSecurityEvent;
  const line = formatSecurityEventLine(smuggled, AT);
  for (const forbidden of ["cells", "query"]) assert.equal(keysDeep(parse(line)).includes(forbidden), false, `no ${forbidden} key`);
  for (const value of ["HYPERLINK", "q=payroll"]) assert.equal(line.includes(value), false, `no ${value}`);
});

test("export.refused logs INVALID_QUERY, a log-only reason, at info, and EXPORT_ROW_LIMIT at warn", () => {
  assert.ok((SECURITY_EVENT_LOG_REASONS as readonly string[]).includes("INVALID_QUERY"), "INVALID_QUERY_IS_NOT_A_LOG_REASON");
  assert.equal((CONFLICT_REASONS as readonly string[]).includes("INVALID_QUERY"), false, "INVALID_QUERY_IS_AN_API_REASON");
  const invalid: ExportSecurityEvent = { ...EXPORT_COMPLETED, name: "export.refused", outcome: "refused", reason: "INVALID_QUERY", rowCount: null, filters: {}, search: null, sort: null };
  const limited: ExportSecurityEvent = { ...EXPORT_COMPLETED, name: "export.refused", outcome: "refused", reason: "EXPORT_ROW_LIMIT", rowCount: 10_001 };
  const parsed = parse(formatSecurityEventLine(invalid, AT));
  assert.equal(parsed.reason, "INVALID_QUERY");
  assert.equal(parsed.rowCount, null);
  assert.equal(Object.keys(parsed).slice(-1)[0], "reason", "the reason follows the outcome");
  assert.equal(securityEventLevel(invalid), "info");
  assert.equal(securityEventLevel(limited), "warn");
  assert.equal(securityEventLevel(EXPORT_COMPLETED), "info");
  assert.ok(SECURITY_EVENT_WARN_REASONS.has("EXPORT_ROW_LIMIT"));
  const logger = recordingLogger();
  logSecurityEvent(logger, invalid, AT);
  logSecurityEvent(logger, limited, AT);
  logSecurityEvent(logger, EXPORT_COMPLETED, AT);
  assert.deepEqual(logger.calls.map((call) => call.level), ["info", "warn", "info"]);
  const levels = SECURITY_EVENT_LEVELS as Readonly<Record<string, string>>;
  assert.equal(levels["export.completed"], "info");
  assert.equal(levels["export.refused"], "info");
  assert.equal(levels["import.committed"], "info");
});

test("export keys and enumerated values are closed, free text is cut to 255 characters with controls removed", () => {
  const event = {
    ...EXPORT_COMPLETED,
    view: "risk register; drop",
    columns: ["riskNumber", "bad column"],
    filters: { "bad key": "x", riskOwner: "user\u0000-‮jane", system: ["one", "two\u0085"] },
    search: "s".repeat(300),
    sort: "riskNumber:asc\n{\"forged\":true}",
    timeZone: "Australia/Sydney\u0007",
    rowCount: 1.5,
    subject: { kind: "risk-assessment", documentId: "assessment 9" },
  } as unknown as ExportSecurityEvent;
  const parsed = parse(formatSecurityEventLine(event, AT));
  assert.equal(parsed.view, "INVALID_ID");
  assert.deepEqual(parsed.columns, ["riskNumber", "INVALID_ID"]);
  assert.deepEqual(parsed.filters, { INVALID_ID: "x", riskOwner: "user-jane", system: ["one", "two"] });
  assert.equal(parsed.search, "s".repeat(255));
  assert.equal(parsed.sort, "riskNumber:asc{\"forged\":true}");
  assert.equal(parsed.timeZone, "Australia/Sydney");
  assert.equal(parsed.rowCount, null);
  assert.deepEqual(parsed.subject, { kind: "risk-assessment", documentId: "INVALID_ID" });
});

test("an export view is a list view's key or a report's report:{reportKey}, and nothing wider", () => {
  const viewOf = (view: string) => parse(formatSecurityEventLine({ ...EXPORT_COMPLETED, view }, AT)).view;
  assert.equal(viewOf("report:risk-exposure"), "report:risk-exposure");
  assert.equal(viewOf("released-assessment"), "released-assessment");
  for (const view of ["report:", ":risk-exposure", "report:risk:exposure", "report:risk exposure", "report:risk-exposure%"]) {
    assert.equal(viewOf(view), "INVALID_ID", view);
  }
});

test("import.committed formats its collection, file, digest, format and counts in a fixed order", () => {
  const parsed = parse(formatSecurityEventLine(IMPORT_COMMITTED, AT));
  assert.deepEqual(Object.keys(parsed), ["event", "schemaVersion", "at", "actor", "collection", "fileName", "sha256", "format", "counts", "outcome"]);
  assert.deepEqual(Object.keys(parsed.counts as object), ["created", "updated", "unchanged", "rejected", "ambiguous", "skipped"]);
  assert.deepEqual(parsed.counts, { created: 3, updated: 2, unchanged: 1, rejected: 0, ambiguous: 0, skipped: 1 });
  assert.equal(parsed.fileName, "systems.xlsx");
  assert.equal(parsed.outcome, "committed");
  assert.equal("reason" in parsed, false);
  const long = parse(formatSecurityEventLine({ ...IMPORT_COMMITTED, fileName: `‮${"n".repeat(300)}.xlsx` }, AT));
  assert.equal(long.fileName, "n".repeat(255));
  assert.equal(securityEventLevel(IMPORT_COMMITTED), "info");
});

test("an attachment event's line is byte-identical to before Phase 19", () => {
  assert.equal(
    formatSecurityEventLine(UPLOADED, AT),
    `csrm.security_event {"event":"attachment.uploaded","schemaVersion":1,"at":"2026-10-10T03:04:05.678Z","actor":{"documentId":"user-sam","displayName":"Sam Requestor"},"requestId":"request-123","attachmentId":"attachment-9","fileType":"docx","byteSize":2048,"sha256":"${DIGEST}","outcome":"clean"}`,
  );
  assert.equal(
    formatSecurityEventLine(MALWARE_REFUSED, AT),
    `csrm.security_event {"event":"attachment.refused","schemaVersion":1,"at":"2026-10-10T03:04:05.678Z","actor":{"documentId":"user-jane","displayName":"Jane Analyst"},"requestId":"request-123","fileType":"txt","byteSize":48,"sha256":"${DIGEST}","outcome":"refused","reason":"ATTACHMENT_MALWARE_FOUND","detection":"Csrm.Test.Signature"}`,
  );
});

test("an export or import line's display name loses its control and bidi characters (BE1-04)", () => {
  const actor = { documentId: "user-bob", displayName: "Bob‮\u0007 Analyst⁦" };
  for (const event of [{ ...EXPORT_COMPLETED, actor }, { ...IMPORT_COMMITTED, actor }]) {
    const parsed = parse(formatSecurityEventLine(event, AT));
    assert.deepEqual(parsed.actor, { documentId: "user-bob", displayName: "Bob Analyst" }, event.name);
  }
});

test("EXPORT_FAILED is a log-only reason that logs at warn (the Phase 19 review amendment, BE1-04)", () => {
  assert.ok((SECURITY_EVENT_LOG_REASONS as readonly string[]).includes("EXPORT_FAILED"), "EXPORT_FAILED_NOT_LOG_ONLY");
  assert.ok(SECURITY_EVENT_WARN_REASONS.has("EXPORT_FAILED"), "EXPORT_FAILED_NOT_AT_WARN");
  assert.equal((CONFLICT_REASONS as readonly string[]).includes("EXPORT_FAILED"), false, "EXPORT_FAILED_IS_IN_NO_RESPONSE_ENUM");
  const failed = { ...EXPORT_COMPLETED, name: "export.refused", outcome: "refused", reason: "EXPORT_FAILED" } as unknown as ExportSecurityEvent;
  assert.equal(securityEventLevel(failed), "warn");
});
