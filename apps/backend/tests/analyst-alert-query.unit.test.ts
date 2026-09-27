import assert from "node:assert/strict";
import test from "node:test";

import {
  AlertQueryError,
  assertEmptyInsightQuery,
  parseAlertListQuery,
} from "../src/api/csrm-analyst-insight/services/alert-query";
import { REVIEWABLE_REQUEST_STATUSES } from "../src/api/csrm-assessment-request/services/collection-scope";
import { ALERT_KINDS, REQUEST_ALERT_STATUSES } from "../src/csrm/insights/alert-rules";

/*
 * D-12: the alert list takes a closed query. Every accepted value is chosen
 * from a closed vocabulary or matches a closed pattern, so nothing a caller
 * sends can reach the SQL except as a member of those sets.
 */

test("an empty alert query reads every kind, all urgencies, page 1 at the default page size", () => {
  assert.deepEqual(parseAlertListQuery({}), { kinds: [...ALERT_KINDS], urgency: undefined, page: 1, pageSize: 25 });
});

test("one kind or several kinds select those kinds, always in the closed kind order", () => {
  assert.deepEqual(parseAlertListQuery({ kind: "request-overdue" }).kinds, ["request-overdue"]);
  assert.deepEqual(
    parseAlertListQuery({ kind: ["risk-treatment-due-soon", "risk-treatment-overdue"] }).kinds,
    ["risk-treatment-overdue", "risk-treatment-due-soon"],
  );
  assert.deepEqual(parseAlertListQuery({ kind: [...ALERT_KINDS].reverse() }).kinds, [...ALERT_KINDS]);
});

test("urgency, page and page size parse from their closed forms", () => {
  assert.deepEqual(
    parseAlertListQuery({ kind: "request-overdue", urgency: "overdue", page: "2", pageSize: "50" }),
    { kinds: ["request-overdue"], urgency: "overdue", page: 2, pageSize: 50 },
  );
  for (const urgency of ["overdue", "due-soon", "attention"] as const) {
    assert.equal(parseAlertListQuery({ urgency }).urgency, urgency);
  }
  for (const pageSize of [5, 10, 25, 50] as const) {
    assert.equal(parseAlertListQuery({ pageSize: String(pageSize) }).pageSize, pageSize, `PAGE_SIZE_REFUSED_${pageSize}`);
  }
  assert.equal(parseAlertListQuery({ page: "1000000" }).page, 1_000_000);
});

test("every malformed alert query is refused with the closed query error", () => {
  const refused: unknown[] = [
    { kind: "x" },
    { kind: [] },
    { kind: ["request-overdue", "request-overdue"] },
    { kind: { $eq: "x" } },
    { kind: ["request-overdue", { $eq: "request-due-soon" }] },
    { kind: ["request-overdue", 1] },
    { kind: "Request-Overdue" },
    { urgency: ["overdue", "attention"] },
    { urgency: "Overdue" },
    { urgency: "" },
    { urgency: { $ne: "overdue" } },
    { page: "0" },
    { page: "1.5" },
    { page: "-1" },
    { page: "01" },
    { page: "1000001" },
    { page: ["1", "2"] },
    { pageSize: "20" },
    { pageSize: "100" },
    { pageSize: "" },
    { pageSize: ["25"] },
    { sort: "governingDate:asc" },
    { filters: { kind: "request-overdue" } },
    { populate: "*" },
    null,
    [],
    "kind=request-overdue",
  ];
  for (const query of refused) {
    assert.throws(() => parseAlertListQuery(query), AlertQueryError, `ALERT_QUERY_ACCEPTED_${JSON.stringify(query)}`);
  }
});

test("the closed query error carries one safe message", () => {
  try {
    parseAlertListQuery({ kind: "x" });
    assert.fail("ALERT_QUERY_NOT_REFUSED");
  } catch (error) {
    assert.ok(error instanceof AlertQueryError);
    assert.equal(error.message, "CSRM alert query is invalid.");
    assert.doesNotMatch(error.message, /SQL|stack|database/i);
  }
});

test("an operation that takes no query refuses every key", () => {
  assert.doesNotThrow(() => assertEmptyInsightQuery({}));
  for (const query of [{ x: "1" }, { kind: "request-overdue" }, { page: "1" }, null, [], "x"]) {
    assert.throws(() => assertEmptyInsightQuery(query), AlertQueryError, `EMPTY_QUERY_ACCEPTED_${JSON.stringify(query)}`);
  }
});

test("request alerts read exactly the review queue's reviewable statuses (D-29)", () => {
  assert.deepEqual([...REQUEST_ALERT_STATUSES], [...REVIEWABLE_REQUEST_STATUSES]);
});
