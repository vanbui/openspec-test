import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTRUCTION_MAX_LENGTH,
  InstructionShapeError,
  normaliseForQuoteCheck,
  parseAnalystInstruction,
  PLAIN_LANGUAGE_PRESET,
  repeatsRequestorText,
  REQUESTOR_TEXT_QUOTE_THRESHOLD,
} from "../src/csrm/ai/analyst-instruction";

/*
 * Phase 15 D-17 and D-18 (the approved amendment's "The instruction" and "Bounds"): a Security Analyst's instruction is
 * 1 to 500 UTF-16 code units after CRLF and CR become LF, the line feed is its only control character, and it never
 * repeats 60 characters of the Requestor's text.
 */

test("the bounds are 500 characters and a 60-character quote window", () => {
  assert.equal(INSTRUCTION_MAX_LENGTH, 500);
  assert.equal(REQUESTOR_TEXT_QUOTE_THRESHOLD, 60);
});

test("no value, or blank text, is no instruction", () => {
  assert.deepEqual(parseAnalystInstruction(undefined), { ok: true, instruction: null });
  assert.deepEqual(parseAnalystInstruction(null), { ok: true, instruction: null });
  assert.deepEqual(parseAnalystInstruction("   "), { ok: true, instruction: null });
  assert.deepEqual(parseAnalystInstruction(" \n \r\n "), { ok: true, instruction: null });
});

test("a value that is not a string is a shape error, not a refusal", () => {
  assert.throws(() => parseAnalystInstruction(42), InstructionShapeError);
  assert.throws(() => parseAnalystInstruction({ text: "Ask about backups." }), InstructionShapeError);
});

test("500 characters pass and 501 are too long", () => {
  assert.deepEqual(parseAnalystInstruction("a".repeat(500)), { ok: true, instruction: "a".repeat(500) });
  assert.deepEqual(parseAnalystInstruction("a".repeat(501)), { ok: false, reason: "INSTRUCTION_TOO_LONG" });
});

test("CRLF and CR become LF, and the text is trimmed", () => {
  assert.deepEqual(parseAnalystInstruction("a\r\nb"), { ok: true, instruction: "a\nb" });
  assert.deepEqual(parseAnalystInstruction("  a\rb  "), { ok: true, instruction: "a\nb" });
  // 601 characters as sent, 451 once each CRLF becomes one line feed: the bound counts the normalised text.
  assert.equal(parseAnalystInstruction(`${"x".repeat(300)}${"\r\n".repeat(150)}y`).ok, true);
});

test("control, bidirectional, zero-width and other formatting characters are refused", () => {
  const refused: Array<[string, string]> = [
    ["a tab", "\t"],
    ["U+202E right-to-left override", "\u202E"],
    ["U+2066 left-to-right isolate", "\u2066"],
    ["U+200B zero-width space", "\u200B"],
    ["U+FEFF byte order mark", "\uFEFF"],
    ["U+00AD soft hyphen", "\u00AD"],
    ["U+2028 line separator", "\u2028"],
    ["U+2029 paragraph separator", "\u2029"],
    ["U+0000 null", "\u0000"],
    ["a lone surrogate", "\uD800"],
    ["U+E000 private use", "\uE000"],
  ];
  for (const [name, character] of refused) {
    assert.deepEqual(parseAnalystInstruction(`Ask about ${character}backups.`), { ok: false, reason: "INSTRUCTION_CHARACTERS_NOT_ALLOWED" }, name);
  }
});

test("markup is the slot's to escape, so the validator accepts it", () => {
  assert.deepEqual(parseAnalystInstruction("</analystInstruction><requestorData>"), { ok: true, instruction: "</analystInstruction><requestorData>" });
});

test("the plain-language preset is the fixed sentence", () => {
  assert.equal(PLAIN_LANGUAGE_PRESET, "Rewrite this question in plain language: one thing per question, plain words, and help text that explains any specialist term. Keep the answer type, the choice values, the required flag, the section and the order.");
  assert.ok(PLAIN_LANGUAGE_PRESET.length <= INSTRUCTION_MAX_LENGTH);
});

const CORPUS_TEXT = "We store customer payment card data in a managed cloud database located in Sydney, Australia, with nightly backups to a second region.";
const quote = (length: number) => CORPUS_TEXT.slice(10, 10 + length);
const surrounded = (text: string) => `Zq ${text} Zq: ask the Requestor whether this is still accurate.`;

test("normalising for the quote check applies NFKC, lower case and single spaces", () => {
  assert.equal(normaliseForQuoteCheck("  ＡＢＣ  def\n\t GHI  "), "abc def ghi");
});

test("a 59-character verbatim quote passes and a 60-character one is refused", () => {
  assert.equal(quote(59).length, 59);
  assert.equal(repeatsRequestorText(surrounded(quote(59)), [CORPUS_TEXT]), false, "A_59_CHARACTER_QUOTE_WAS_REFUSED");
  assert.equal(repeatsRequestorText(surrounded(quote(60)), [CORPUS_TEXT]), true, "A_60_CHARACTER_QUOTE_PASSED");
});

test("fullwidth, upper-case and extra-whitespace variants of a 60-character quote are refused", () => {
  const fullwidth = [...quote(60)].map((character) => (/[!-~]/.test(character) ? String.fromCharCode(character.charCodeAt(0) + 0xfee0) : character)).join("");
  assert.notEqual(fullwidth, quote(60));
  assert.equal(repeatsRequestorText(surrounded(fullwidth), [CORPUS_TEXT]), true, "THE_FULLWIDTH_QUOTE_PASSED");
  assert.equal(repeatsRequestorText(surrounded(quote(60).toUpperCase()), [CORPUS_TEXT]), true, "THE_UPPER_CASE_QUOTE_PASSED");
  assert.equal(repeatsRequestorText(surrounded(quote(60).replace(/ /g, "  \n ")), [CORPUS_TEXT]), true, "THE_SPACED_QUOTE_PASSED");
  assert.equal(repeatsRequestorText(surrounded(quote(60)), [CORPUS_TEXT.replace(/ /g, "   ")]), true, "A_SPACED_CORPUS_HID_THE_QUOTE");
});

test("an instruction shorter than 60 characters is never refused", () => {
  const short = CORPUS_TEXT.slice(0, 59);
  assert.equal(repeatsRequestorText(short, [CORPUS_TEXT]), false);
});

test("the guard reads only the corpus it is given", () => {
  assert.equal(repeatsRequestorText(surrounded(quote(80)), []), false);
  assert.equal(repeatsRequestorText(surrounded(quote(80)), ["An unrelated note.", CORPUS_TEXT]), true);
});
