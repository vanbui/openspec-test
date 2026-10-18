import assert from "node:assert/strict";
import test from "node:test";
import { rankByRelevance, tokenize } from "../src/csrm/ai/library-ranking";

test("tokenize omits short words and stop words", () => assert.deepEqual(tokenize("The HR and pay file"), ["pay", "file"]));
test("ranker prefers matches and breaks ties by id in code-unit order", () => {
  const rows = [{ id: "z", text: "payment file" }, { id: "b", text: "unrelated" }, { id: "a", text: "payment file" }];
  const run = () => rankByRelevance("payment", rows, 3, (row) => row.text, (row) => row.id).map((row) => row.id);
  assert.deepEqual(run(), ["a", "z", "b"]);
  assert.deepEqual(run(), run());
});
/*
 * IN-202 (D-06, D-12): a term fewer rows hold weighs more, so a row matching only the rarer of two query terms outranks
 * rows matching only the common one, whatever its id; and the ranker returns at most `limit` rows.
 */
test("ranker weights a rarer term above a common one and returns at most the limit", () => {
  const rows = [{ id: "a", text: "payroll access review" }, { id: "b", text: "payroll backup" }, { id: "z", text: "payment file signing" }];
  const rank = (limit: number) => rankByRelevance("payroll signing", rows, limit, (row) => row.text, (row) => row.id).map((row) => row.id);
  assert.deepEqual(rank(3), ["z", "a", "b"], "A_RARER_TERM_DID_NOT_OUTRANK_A_COMMON_ONE");
  assert.deepEqual(rank(2), ["z", "a"], "THE_LIMIT_WAS_NOT_APPLIED");
  assert.deepEqual(rank(0), []);
});
