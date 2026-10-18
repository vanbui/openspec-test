import assert from "node:assert/strict";

import type { AuthorizationHttpHarness } from "./strapi-http-harness";

/*
 * The attachment integration files' shared HTTP helpers (Phase 14 IN-305): the request path, the request seed, the
 * persistence snapshot, the refusal reader and the logger captures, once, parameterised by each file's harness promise.
 * Where the files' copies differed, an explicit option keeps each file's behaviour: the request number and title
 * prefixes, the default status and whether a seed carries `submittedDate`, and the capture that records every line
 * (`captureLogs`) beside the one that records the security events and the error lines (`captureSecurityEvents`).
 */

type Json = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

/** One `csrm.security_event` line: its level, the line and its parsed JSON. */
export type LoggedEvent = { level: LogLevel; line: string; event: Json };

/** One line Strapi's logger wrote, with its level, and its security event parsed when it is one. */
export type LoggedLine = { level: LogLevel; line: string; event?: Json };

const SECURITY_EVENT_PREFIX = "csrm.security_event ";

export function attachmentsPath(requestId: string): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/attachments`;
}

/**
 * Runs `action` with every Strapi log line passed to `record` (and still written), and restores the logger after it,
 * whether the action resolves or throws.
 */
async function withLogLines<T>(record: (level: LogLevel, line: string) => void, action: () => Promise<T>): Promise<T> {
  const log = (globalThis as unknown as { strapi: { log: Record<LogLevel, (...args: unknown[]) => unknown> } }).strapi.log;
  const originals = { info: log.info, warn: log.warn, error: log.error };
  for (const level of ["info", "warn", "error"] as const) {
    log[level] = (...args: unknown[]) => {
      record(level, args.map(String).join(" "));
      return originals[level].apply(log, args);
    };
  }
  try {
    return await action();
  } finally {
    log.info = originals.info;
    log.warn = originals.warn;
    log.error = originals.error;
  }
}

/**
 * The `csrm.security_event` lines Strapi's logger writes while `action` runs, with their level and parsed JSON, and
 * every error-level line (IN-704: a malformed record is one error line through Strapi's internal-error path).
 */
export async function captureSecurityEvents<T>(action: () => Promise<T>): Promise<{ result: T; events: LoggedEvent[]; errors: string[] }> {
  const events: LoggedEvent[] = [];
  const errors: string[] = [];
  const result = await withLogLines((level, line) => {
    if (line.startsWith(SECURITY_EVENT_PREFIX)) events.push({ level, line, event: JSON.parse(line.slice(SECURITY_EVENT_PREFIX.length)) as Json });
    if (level === "error") errors.push(line);
  }, action);
  return { result, events, errors };
}

/** Every line Strapi's logger writes while `action` runs, with its level, and the security events parsed. */
export async function captureLogs<T>(action: () => Promise<T>): Promise<{ result: T; lines: LoggedLine[] }> {
  const lines: LoggedLine[] = [];
  const result = await withLogLines((level, line) => {
    const event = line.startsWith(SECURITY_EVENT_PREFIX) ? JSON.parse(line.slice(SECURITY_EVENT_PREFIX.length)) as Json : undefined;
    lines.push({ level, line, ...(event ? { event } : {}) });
  }, action);
  return { result, lines };
}

/**
 * The refusal's status and closed reason. A 404 is the refusal a missing record gets (D-18), so it never names the rule
 * that refused it: any `details` on a 404 fails here (IN-601).
 */
export async function refusalOf(response: Response): Promise<{ status: number; reason: unknown }> {
  const body = await response.json() as Json;
  const error = body.error as Json | undefined;
  if (response.status === 404) assert.equal(error?.details, undefined, `A_404_NAMES_A_RULE: ${JSON.stringify(error?.details)}`);
  return { status: response.status, reason: (error?.details as Json | undefined)?.reason };
}

export type AttachmentHttpOptions = {
  /** The request number's prefix, before the zero-padded sequence (`ATTACH` gives `ATTACH-001`). */
  requestNumberPrefix: string;
  /** The title's prefix, before the sequence (`Attachments request` gives `Attachments request 1`). */
  titlePrefix: string;
  /** The status a seed gets when none is named. */
  defaultStatus: string;
  /**
   * Whether a seed carries `submittedDate`: null for a draft, the fixed submission time otherwise. Off, the seed names
   * no `submittedDate` at all.
   */
  submittedDate: boolean;
};

/** The helpers bound to one file's harness, with the request seed's numbering shared by every seed the file makes. */
export type AttachmentHttp = {
  /** The next request number and title from the file's one sequence, for a seed the file creates itself. */
  nextRequestNames: () => { requestNumber: string; title: string };
  /** A request raised by Jane (or the other Requestor), seeded directly, in `requestStatus` or the default status. */
  seedRequest: (requestStatus?: string, requestor?: "owner" | "otherRequestor") => Promise<string>;
  /**
   * The request's attachment records and the whole database's attachment rows, plugin file records and stored files:
   * the before and after halves of a refusal's persistence check, so a write on another request or on none is seen too.
   * `otherRequestIds` adds those requests' records, for a refusal that targets a record on another request (WR-308): a
   * write to that record changes no count, so only its own records show it.
   */
  persisted: (requestId: string, ...otherRequestIds: string[]) => Promise<unknown[]>;
};

export function attachmentHttp(harnessPromise: Promise<AuthorizationHttpHarness>, options: AttachmentHttpOptions): AttachmentHttp {
  let sequence = 0;
  const nextRequestNames = () => {
    sequence += 1;
    return { requestNumber: `${options.requestNumberPrefix}-${String(sequence).padStart(3, "0")}`, title: `${options.titlePrefix} ${sequence}` };
  };
  return {
    nextRequestNames,
    async seedRequest(requestStatus = options.defaultStatus, requestor = "owner") {
      const harness = await harnessPromise;
      return harness.createAssessmentRequestFixture({
        ...nextRequestNames(),
        requestStatus,
        requestor,
        ...(options.submittedDate ? { submittedDate: requestStatus === "draft" ? null : "2026-10-01T00:00:00.000Z" } : {}),
      });
    },
    async persisted(requestId, ...otherRequestIds) {
      const harness = await harnessPromise;
      return harness.snapshot([
        ...[requestId, ...otherRequestIds].map((id) => () => harness.listRequestAttachments(id)),
        () => harness.countRequestAttachmentRows(),
        () => harness.countUploadFileRecords(),
        () => harness.listAttachmentStorageFiles(),
      ]);
    },
  };
}

const ATTACHMENT_UID = "api::csrm-request-attachment.csrm-request-attachment";

/**
 * WR-101: a well-formed attachment event log of `length` events by `by`: an upload, then remove and restore cycles, the
 * history an ordinary caller can build. The parser accepts it at any length up to the cap.
 */
export function attachmentEventLogOf(length: number, by: string): { schemaVersion: 1; events: Json[] } {
  const at = "2026-10-01T00:00:00.000Z";
  return {
    schemaVersion: 1,
    events: Array.from({ length }, (_, index) => ({ schemaVersion: 1, type: index === 0 ? "uploaded" : index % 2 ? "removed" : "restored", by, at })),
  };
}

/** An attachment event log the parser refuses: an event of a type the closed schema does not name. */
export function malformedAttachmentEventLog(by: string): { schemaVersion: 1; events: Json[] } {
  return { schemaVersion: 1, events: [{ schemaVersion: 1, type: "renamed", by, at: "2026-10-01T00:00:00.000Z" }] };
}

/** One count the attachment query engine is asked for, in call order, with whether it counts the active files. */
export type AttachmentCountCall = { index: number; active: boolean; real: () => Promise<number> };

/**
 * Runs `action` with every attachment count the services ask the query engine for passed to `intercept`, which answers
 * it (with the real count, another number, or a throw), and restores the engine after it. The engine is cached per
 * content type, so the services read this same object. An active count is one that filters on `scanStatus`.
 */
export async function withAttachmentCountIntercepted<T>(intercept: (call: AttachmentCountCall) => Promise<number>, action: () => Promise<T>): Promise<T> {
  type Counter = { count: (query: { where?: Record<string, unknown> }) => Promise<number> };
  const engine = (globalThis as unknown as { strapi: { db: { query: (uid: string) => Counter } } }).strapi.db.query(ATTACHMENT_UID);
  const original = engine.count;
  let index = 0;
  engine.count = (query) => {
    index += 1;
    return intercept({ index, active: query?.where !== undefined && "scanStatus" in query.where, real: () => original.call(engine, query) });
  };
  try {
    return await action();
  } finally {
    engine.count = original;
  }
}
