import { tokenize } from "../../../csrm/ai/library-ranking";
import type { ProviderQuestionView, QuestionnaireProposalProvider, QuestionnaireProposalProviderInput, QuestionRewriteProvider } from "./questionnaire-proposal-provider";

/*
 * The deterministic questionnaire proposal provider every suite runs (Phase 15 D-15; 15-RESEARCH §J). It returns
 * model-facing wire JSON, exactly as a hosted model would, so the one adapter and its drop rules run in unit,
 * integration and browser tests alike (Pitfall 9). Its sentences are CSRM's own: no Requestor text is copied into a
 * proposal (G-3); notes and the instruction are only read for the rules' triggers.
 *
 * Rules, in order:
 * - W1 (a marked note's topic): a marked note mentioning `offshore`, when no active question does, gives three additions
 *   in a new section "Offshore support", each citing that note. It is the default task when a note is marked, and also
 *   runs when the analyst's instruction itself asks about offshore support.
 * - W2 (only with an analyst instruction): `tax file number` or `tfn` adds a question on tax file numbers in "Personal
 *   information", citing the instruction; `drop`, `remove` or `delete` removes the unanswered active question sharing
 *   the most words with the rest of the instruction; `plain language` changes the first unanswered question rule R1
 *   would change.
 * - W3 (the default task with no marked note): a follow-up on the first answered Single select question offering Yes,
 *   shown when it is Yes, in that question's section, citing it when its answer was sent.
 * - Always, adversarial: one change rewording the first answered question (the adapter leaves it out as
 *   `answered-target`) and one addition repeating the first active question with different punctuation (left out as
 *   `near-duplicate`).
 *
 * The deterministic question rewrite provider applies rule R1, the plain-language glossary, to the target's text: each
 * glossary term (whole words, without case) becomes its plain wording, the help text explains the first term matched in
 * one sentence, and the choice labels stay. A question with no glossary term comes back unchanged (`no-change`).
 *
 * The objects' `propose` and `rewrite` are plain members, so a test harness can hold or replace them (15-06).
 */

type WireItem = {
  kind: "add" | "change" | "remove";
  target: string | null;
  questionText: string | null;
  helpText: string | null;
  answerType: string | null;
  choices: string[];
  required: boolean | null;
  sectionTitle: string | null;
  visibleWhen: { question: string; operator: string; value: string } | null;
  rationale: string;
  sources: string[];
};

function addition(fields: Pick<WireItem, "questionText" | "helpText" | "answerType" | "sectionTitle" | "rationale" | "sources"> & Partial<Pick<WireItem, "choices" | "required" | "visibleWhen">>): WireItem {
  return { kind: "add", target: null, choices: [], required: true, visibleWhen: null, ...fields };
}

export const OFFSHORE_SECTION_TITLE = "Offshore support";
const OFFSHORE_RATIONALE = "A marked note says an offshore support team now works on the service, and no question covers it yet.";
const mentionsOffshore = (text: string): boolean => /offshore/i.test(text);

export const TAX_FILE_NUMBER_QUESTION = "Will the service collect or store tax file numbers?";
export const ACCESS_FOLLOW_UP_QUESTION = "What access will they have to your systems or data, and how is it controlled?";
const REMOVAL_VERBS = /\b(drop|remove|delete)\b/gi;

/* Rule R1's glossary: each entry's terms, their plain wording, and one sentence explaining them. */
export const PLAIN_LANGUAGE_GLOSSARY: ReadonlyArray<{ readonly terms: readonly string[]; readonly plain: string; readonly explanation: string }> = Object.freeze([
  { terms: ["multi-factor authentication", "MFA"], plain: "a second sign-in step (multi-factor authentication)", explanation: "Multi-factor authentication means a second step after the password, such as a code from an app, to confirm who is signing in." },
  { terms: ["privileged"], plain: "administrator", explanation: "Privileged accounts are administrator accounts that can change settings, other accounts or data." },
  { terms: ["federated identities"], plain: "accounts that sign in through another organisation", explanation: "Federated identities are accounts that sign in with a login another organisation manages." },
  { terms: ["break-glass accounts"], plain: "emergency administrator accounts", explanation: "Break-glass accounts are emergency administrator accounts kept for when normal sign-in fails." },
  { terms: ["segregation of duties"], plain: "splitting tasks so no one person can do everything", explanation: "Segregation of duties means splitting a task between people so that no one person can complete it alone." },
]);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GLOSSARY_TERMS = PLAIN_LANGUAGE_GLOSSARY
  .flatMap((entry) => entry.terms.map((term) => ({ term, entry })))
  .sort((left, right) => right.term.length - left.term.length);
const GLOSSARY_PATTERN = new RegExp(`\\b(?:${GLOSSARY_TERMS.map(({ term }) => escapeRegExp(term)).join("|")})\\b`, "gi");

/* Rule R1 in one pass, so a plain wording is never rewritten again: the rewritten text and the first matched term's explanation, or null. */
export function plainLanguageRewrite(text: string): { questionText: string; explanation: string } | null {
  let explanation: string | null = null;
  const questionText = text.replace(GLOSSARY_PATTERN, (match) => {
    const entry = GLOSSARY_TERMS.find(({ term }) => term.toLowerCase() === match.toLowerCase())?.entry;
    if (!entry) return match;
    explanation ??= entry.explanation;
    return entry.plain;
  });
  return explanation === null ? null : { questionText, explanation };
}

/* W2: the analyst instruction's rules, each citing the instruction. */
function instructionRules(input: QuestionnaireProposalProviderInput): WireItem[] {
  const instruction = input.instructionSource === "analyst" ? input.instruction : null;
  if (!instruction) return [];
  const items: WireItem[] = [];
  if (/tax file number|\btfn\b/i.test(instruction)) {
    items.push(addition({ questionText: TAX_FILE_NUMBER_QUESTION, helpText: "A tax file number is the number the Australian Taxation Office gives each taxpayer.", answerType: "Single select", choices: ["Yes", "No"], sectionTitle: "Personal information", rationale: "The analyst asked for questions about tax file numbers.", sources: ["instruction"] }));
  }
  if (new RegExp(REMOVAL_VERBS.source, "i").test(instruction)) {
    const wanted = new Set(tokenize(instruction.replace(REMOVAL_VERBS, " ")));
    let best: { ref: string; overlap: number } | null = null;
    for (const question of input.questions) {
      if (question.answered) continue;
      const overlap = new Set(tokenize(question.questionText).filter((word) => wanted.has(word))).size;
      if (overlap > 0 && (best === null || overlap > best.overlap)) best = { ref: question.ref, overlap };
    }
    if (best) items.push({ kind: "remove", target: best.ref, questionText: null, helpText: null, answerType: null, choices: [], required: null, sectionTitle: null, visibleWhen: null, rationale: "The analyst asked to remove this question.", sources: ["instruction"] });
  }
  if (/plain language/i.test(instruction)) {
    for (const question of input.questions) {
      const rewrite = question.answered ? null : plainLanguageRewrite(question.questionText);
      if (!rewrite) continue;
      items.push({ kind: "change", target: question.ref, questionText: rewrite.questionText, helpText: rewrite.explanation, answerType: null, choices: [], required: null, sectionTitle: null, visibleWhen: null, rationale: "The analyst asked for plain language, and this question used specialist terms.", sources: ["instruction"] });
      break;
    }
  }
  return items;
}

/* W3: a conditional follow-up on the first answered Yes or No question, citing it when its answer was sent. */
function conditionalFollowUp(input: QuestionnaireProposalProviderInput): WireItem[] {
  const controller = input.questions.find((question) => question.answered && question.answerType === "Single select" && question.choiceLabels.some((label) => label.trim().toLowerCase() === "yes"));
  if (!controller) return [];
  const yes = controller.choiceLabels.find((label) => label.trim().toLowerCase() === "yes") as string;
  const sources = input.context.questionnaire?.sourceRefs.has(controller.ref) ? [controller.ref] : [];
  return [addition({ questionText: ACCESS_FOLLOW_UP_QUESTION, helpText: "Describe what they can see or change, and who approves and reviews that access.", answerType: "Long text", sectionTitle: controller.sectionTitle, visibleWhen: { question: controller.ref, operator: "equals", value: yes }, rationale: "An answered question says Yes, so CSRM needs to know what that access involves.", sources })];
}

/* W1: the offshore follow-ups, each citing the first marked note that mentions offshore support. */
function offshoreFollowUps(input: QuestionnaireProposalProviderInput): WireItem[] {
  const note = input.markedNotes.find(({ body }) => mentionsOffshore(body));
  if (!note || input.questions.some(({ questionText }) => mentionsOffshore(questionText))) return [];
  const sources = [note.ref];
  return [
    addition({ questionText: "In which country or countries is the offshore support team based?", helpText: "Name every country where the offshore support team works.", answerType: "Text", sectionTitle: OFFSHORE_SECTION_TITLE, rationale: OFFSHORE_RATIONALE, sources }),
    addition({ questionText: "Will the offshore support team have administrator access to your systems?", helpText: "Administrator access lets someone change settings, accounts or data, not just view them.", answerType: "Single select", choices: ["Yes", "No"], sectionTitle: OFFSHORE_SECTION_TITLE, rationale: OFFSHORE_RATIONALE, sources }),
    addition({ questionText: "How is the offshore team's administrator access approved and logged?", helpText: "Describe who approves the access, how long it lasts, and how its use is recorded.", answerType: "Long text", sectionTitle: OFFSHORE_SECTION_TITLE, rationale: OFFSHORE_RATIONALE, sources }),
  ];
}

/*
 * The adversarial pair the adapter must leave out: a rewording of the first answered question, and the first active
 * question again with its closing punctuation changed. A text of fewer than three scored words is repeated exactly,
 * because the scorer compares short texts exactly and would keep it.
 */
function adversarialPair(questions: readonly ProviderQuestionView[]): WireItem[] {
  const items: WireItem[] = [];
  const answered = questions.find(({ answered: isAnswered }) => isAnswered);
  if (answered) {
    items.push({ kind: "change", target: answered.ref, questionText: `Please confirm: ${answered.questionText}`, helpText: null, answerType: null, choices: [], required: null, sectionTitle: null, visibleWhen: null, rationale: "The wording of this question could be clearer.", sources: [] });
  }
  const first = questions[0];
  if (first) {
    const base = first.questionText.replace(/[\s?.!]+$/, "");
    const repeated = new Set(tokenize(first.questionText)).size < 3 ? first.questionText : first.questionText.trim().endsWith("?") ? `${base}.` : `${base}?`;
    items.push(addition({ questionText: repeated, helpText: null, answerType: "Long text", required: false, sectionTitle: first.sectionTitle, rationale: "This question may need asking again.", sources: [] }));
  }
  return items;
}

export const deterministicQuestionnaireProposalProvider: QuestionnaireProposalProvider = {
  name: "deterministic-questionnaire-proposals",
  version: "1",
  async propose(input) {
    const items: WireItem[] = [];
    const instruction = input.instructionSource === "analyst" ? input.instruction : null;
    if (instruction === null || mentionsOffshore(instruction)) items.push(...offshoreFollowUps(input));
    items.push(...instructionRules(input));
    if (instruction === null && input.markedNotes.length === 0) items.push(...conditionalFollowUp(input));
    items.push(...adversarialPair(input.questions));
    return { schemaVersion: 1, items };
  },
};

export const deterministicQuestionRewriteProvider: QuestionRewriteProvider = {
  name: "deterministic-question-rewrite",
  version: "1",
  async rewrite({ target }) {
    const rewrite = plainLanguageRewrite(target.questionText);
    return {
      schemaVersion: 1,
      questionText: rewrite?.questionText ?? target.questionText,
      helpText: rewrite?.explanation ?? target.helpText,
      choiceLabels: [...target.choiceLabels],
      rationale: rewrite ? "Specialist terms were replaced with plain words, and the help text explains the first one." : "The question has no specialist term to replace.",
    };
  },
};
