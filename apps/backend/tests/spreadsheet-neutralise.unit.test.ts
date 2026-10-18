import assert from "node:assert/strict";
import test from "node:test";

import {
  NEUTRALISER_MARK,
  needsNeutraliser,
  sanitizeSpreadsheetCell,
  stripNeutraliserMark,
} from "../src/csrm/spreadsheets/neutralise";

/*
 * The one spreadsheet neutraliser (19-03; D-11, 19-RESEARCH Pitfall 9). Every text cell CSRM writes to a CSV or a
 * workbook passes through it, and the import strips the mark again with its exact inverse, so a value that leaves
 * CSRM comes back unchanged.
 */

const MARKED = [
  "=1+2",
  "+1",
  "-1",
  "-5",
  "@SUM(A1)",
  "\t=x",
  "\r=x",
  "\n=x",
  "＝x",
  "＋x",
  "－x",
  "＠x",
  " =x",
  "'=x",
  "''=x",
  "- n/a",
  // BE1-01: an invisible character the XLSX library would drop (or a format character) before a trigger.
  "=x",
  "�=x",
  "=x",
  "​=x",
  " =x",
  "'=x",
  "	x",
];

const UNMARKED = ["hello", "'quoted'", "x=1", "", "0042", "It's", "'", "''", "'hello", "x", "�x=1"];

test("the mark is one leading single quote", () => {
  assert.equal(NEUTRALISER_MARK, "'");
});

test("every formula trigger, its full-width form, a trigger after whitespace and a quote run before a trigger is marked once", () => {
  for (const value of MARKED) {
    assert.equal(needsNeutraliser(value), true, JSON.stringify(value));
    assert.equal(sanitizeSpreadsheetCell(value), `'${value}`, JSON.stringify(value));
  }
});

test("ordinary text, text with a quote inside and the empty string are left alone", () => {
  for (const value of UNMARKED) {
    assert.equal(needsNeutraliser(value), false, JSON.stringify(value));
    assert.equal(sanitizeSpreadsheetCell(value), value, JSON.stringify(value));
  }
});

test("stripNeutraliserMark is the exact inverse of sanitizeSpreadsheetCell over the corpus", () => {
  for (const value of [...MARKED, ...UNMARKED]) {
    assert.equal(stripNeutraliserMark(sanitizeSpreadsheetCell(value)), value, JSON.stringify(value));
  }
});

test("a quote that is not a mark is kept", () => {
  assert.equal(stripNeutraliserMark("'hello"), "'hello");
  assert.equal(stripNeutraliserMark("'"), "'");
  assert.equal(stripNeutraliserMark("It's"), "It's");
  assert.equal(stripNeutraliserMark("'=x"), "=x");
  assert.equal(stripNeutraliserMark("'''=x"), "''=x");
});

test("mark then strip returns every value, and strip leaves every unmarked value alone (generated corpus)", () => {
  const alphabet = ["'", "=", "+", "-", "@", " ", "\t", "\r", "\n", "＝", "＋", "－", "＠", "a", "0", "　"];
  // A fixed linear congruential sequence, so the corpus is the same on every run.
  let seed = 19_03;
  const next = (): number => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed;
  };
  for (let index = 0; index < 5_000; index += 1) {
    const length = next() % 6;
    let value = "";
    for (let position = 0; position < length; position += 1) value += alphabet[next() % alphabet.length];
    assert.equal(stripNeutraliserMark(sanitizeSpreadsheetCell(value)), value, JSON.stringify(value));
    if (!needsNeutraliser(value)) assert.equal(stripNeutraliserMark(value), value, JSON.stringify(value));
  }
});
