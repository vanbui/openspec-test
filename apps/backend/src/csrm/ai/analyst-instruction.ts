/*
 * The analyst instruction validator and the Requestor-text guard (Phase 15 D-17, D-18; the approved Phase 15
 * amendment to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "The instruction", "No Requestor text" and
 * "Bounds"). Shared by Phase 15's questionnaire operations and by Phases 16 and 17, which give the same instruction to
 * their own AI operations.
 *
 * An instruction is the Security Analyst's own text. It reaches a provider only inside the `<analystInstruction>` slot,
 * escaped as data, so markup in it is the slot's to escape, not this module's to refuse. This module bounds what the
 * slot can carry:
 * - 1 to 500 UTF-16 code units once CRLF and CR become LF (the same unit the governance log's 500 bound counts), the
 *   text trimmed, and empty or whitespace only meaning no instruction;
 * - the line feed is the only control character: no other control, format (bidirectional overrides and isolates,
 *   zero-width characters, the byte order mark, the soft hyphen), surrogate or private-use character, and no U+2028
 *   or U+2029;
 * - no 60-character window of it, normalised, repeats the Requestor's text, normalised the same way. The caller builds
 *   the corpus (15-06: request text fields, the Requestor's notes, submitted answers and included file text; never a
 *   draft answer, so a refusal cannot reveal one), and this module reads nothing else.
 *
 * `SlotInstruction` is branded: only `parseAnalystInstruction` and `PLAIN_LANGUAGE_PRESET` produce one, so the slot
 * accepts a validated instruction or CSRM's preset by construction (D-17).
 */

export const INSTRUCTION_MAX_LENGTH = 500;
export const REQUESTOR_TEXT_QUOTE_THRESHOLD = 60;

declare const slotInstructionBrand: unique symbol;
/** A validated analyst instruction, or CSRM's own preset: the only text the instruction slot accepts. */
export type SlotInstruction = string & { readonly [slotInstructionBrand]: true };

export type InstructionRefusal = "INSTRUCTION_TOO_LONG" | "INSTRUCTION_CHARACTERS_NOT_ALLOWED" | "INSTRUCTION_REPEATS_REQUESTOR_TEXT";
/** What steered a run, as the context summary names it (never the text). */
export type InstructionSource = "analyst" | "plain-language-preset" | "default-task";
export type InstructionParseResult = { ok: true; instruction: SlotInstruction | null } | { ok: false; reason: InstructionRefusal };

/** A body whose `instruction` is neither absent, null nor a string: the caller answers 400 with its closed body. */
export class InstructionShapeError extends Error {
  constructor(message = "CSRM analyst instruction must be a string.") {
    super(message);
    this.name = "InstructionShapeError";
  }
}

/* Every control character but the line feed (tested after line feeds are removed), every format, surrogate and private-use character, and the two Unicode separators. */
const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\u2028\u2029]/u;

/** CSRM's own plain-language rewrite request (D-11): typed as a slot instruction, never stored as one. */
export const PLAIN_LANGUAGE_PRESET = "Rewrite this question in plain language: one thing per question, plain words, and help text that explains any specialist term. Keep the answer type, the choice values, the required flag, the section and the order." as SlotInstruction;

/**
 * Validates an analyst instruction in the amendment's order: absent or null is no instruction; a non-string throws
 * `InstructionShapeError`; CRLF and CR become LF; over 500 characters is `INSTRUCTION_TOO_LONG`; a forbidden character
 * is `INSTRUCTION_CHARACTERS_NOT_ALLOWED`; the trimmed text, or null when it is empty. The Requestor-text guard needs
 * the corpus, so the caller runs `repeatsRequestorText` after it.
 */
export function parseAnalystInstruction(input: unknown): InstructionParseResult {
  if (input === undefined || input === null) return { ok: true, instruction: null };
  if (typeof input !== "string") throw new InstructionShapeError();
  const text = input.replace(/\r\n?/g, "\n");
  if (text.length > INSTRUCTION_MAX_LENGTH) return { ok: false, reason: "INSTRUCTION_TOO_LONG" };
  if (FORBIDDEN_CHARACTERS.test(text.replace(/\n/g, ""))) return { ok: false, reason: "INSTRUCTION_CHARACTERS_NOT_ALLOWED" };
  const trimmed = text.trim();
  return { ok: true, instruction: trimmed.length === 0 ? null : (trimmed as SlotInstruction) };
}

/** The quote check's normal form: NFKC, lower case, every whitespace run one space, trimmed. */
export function normaliseForQuoteCheck(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Whether any 60-character window of the normalised instruction appears in a normalised corpus text. An instruction
 * shorter than 60 characters once normalised is never refused. A pure function of its inputs.
 */
export function repeatsRequestorText(instruction: string, corpus: readonly string[]): boolean {
  const needle = normaliseForQuoteCheck(instruction);
  if (needle.length < REQUESTOR_TEXT_QUOTE_THRESHOLD) return false;
  const haystacks = corpus.map(normaliseForQuoteCheck).filter((text) => text.length >= REQUESTOR_TEXT_QUOTE_THRESHOLD);
  if (haystacks.length === 0) return false;
  for (let start = 0; start + REQUESTOR_TEXT_QUOTE_THRESHOLD <= needle.length; start += 1) {
    const window = needle.slice(start, start + REQUESTOR_TEXT_QUOTE_THRESHOLD);
    if (haystacks.some((text) => text.includes(window))) return true;
  }
  return false;
}
