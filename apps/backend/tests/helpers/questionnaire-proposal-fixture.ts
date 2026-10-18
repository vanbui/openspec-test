import { buildAssessmentContext, contextSourceRefs, type AssessmentContextRecords, type ContextNote } from "../../src/csrm/ai/assessment-context";
import { parseAnalystInstruction, type InstructionSource, type SlotInstruction } from "../../src/csrm/ai/analyst-instruction";
import { parseQuestionnaireDefinition, type QuestionnaireAnswerType } from "../../src/api/csrm-questionnaire/services/questionnaire-definition";
import { isAnsweredValue, type PreservationRow } from "../../src/api/csrm-questionnaire/services/questionnaire-answer-preservation";
import { buildQuestionnaireProposalContext, type QuestionnaireContextQuestion } from "../../src/api/csrm-questionnaire/services/questionnaire-proposal-context";
import type { QuestionnaireAdapterContext } from "../../src/api/csrm-questionnaire/services/questionnaire-proposal-adapter";
import { providerQuestionViews, type QuestionRewriteProviderInput, type QuestionnaireProposalProviderInput } from "../../src/api/csrm-questionnaire/services/questionnaire-proposal-provider";

/*
 * A questionnaire as a proposal or rewrite run sees it (15-05): one set of questions turned into the context the providers
 * read (15-04's questionnaire part inside the assessment context), the context-time rows the adapter checks against, and
 * the provider inputs. Every question carries its stored answer envelope, so the one answered rule decides what is fixed.
 */

export type FixtureChoice = { value: string; label: string };
export type FixtureQuestion = {
  key: string;
  text: string;
  type: QuestionnaireAnswerType;
  section: { key: string; title: string; order: number };
  order: number;
  required?: boolean;
  helpText?: string | null;
  choices?: FixtureChoice[];
  visibility?: { questionKey: string; operator: "equals" | "notEquals" | "includes" | "notIncludes"; value: string | boolean };
  answer?: string | boolean | string[] | null;
  removed?: boolean;
};

export const YES_NO_NOT_SURE: FixtureChoice[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }];
const OVERVIEW = { key: "overview", title: "Service overview", order: 0 };
const CONTROLS = { key: "controls", title: "Security controls", order: 1 };

/*
 * The default questionnaire, in display order:
 * Q1 an unanswered free-text question; Q2 an answered Yes or No question; Q3 its unanswered dependent; Q4 the unanswered
 * logging question; Q5 an unanswered controller (hosting model) whose answered dependent Q6 reads its Cloud value; and one
 * removed question (R1).
 */
export function defaultFixtureQuestions(): FixtureQuestion[] {
  return [
    { key: "service-purpose", text: "What does the payroll service do for the business?", type: "Long text", section: OVERVIEW, order: 0, helpText: "Describe the work the service supports." },
    { key: "third-party", text: "Does a third party operate the payroll service?", type: "Single select", section: OVERVIEW, order: 1, choices: YES_NO_NOT_SURE, answer: "yes" },
    { key: "third-party-name", text: "Which company operates the payroll service?", type: "Text", section: OVERVIEW, order: 2, required: false, visibility: { questionKey: "third-party", operator: "equals", value: "yes" } },
    { key: "logging", text: "How is access logging for payroll records reviewed?", type: "Long text", section: CONTROLS, order: 0 },
    { key: "hosting-model", text: "Where is the payroll service hosted?", type: "Single select", section: CONTROLS, order: 1, choices: [{ value: "on-premises", label: "On premises" }, { value: "cloud", label: "Cloud" }, { value: "not-sure", label: "Not sure" }] },
    { key: "cloud-provider", text: "Which cloud provider hosts the payroll service?", type: "Text", section: CONTROLS, order: 2, visibility: { questionKey: "hosting-model", operator: "equals", value: "cloud" }, answer: "Example Cloud" },
    { key: "backup-tapes", text: "Is the old backup tape process still used?", type: "Single select", section: CONTROLS, order: 3, choices: YES_NO_NOT_SURE, removed: true },
  ];
}

export const OFFSHORE_NOTE = "Jane: the vendor now uses an offshore support team with administrator access to the payroll system.";

export type ProposalFixtureOptions = {
  questions?: FixtureQuestion[];
  notes?: Array<{ sequence: number; body: string }>;
  instruction?: string;
  answerContent?: "included" | "withheld";
  openItemTexts?: string[];
  rejectedItemTexts?: string[];
  generatedDate?: string | null;
};

const STAMP = "2026-10-10T00:00:00.000Z";

function envelope(value: FixtureQuestion["answer"]): unknown {
  if (value === undefined) return null;
  return { schemaVersion: 1, value, state: "submitted", updatedAt: STAMP, submittedAt: STAMP };
}

function rawQuestion(question: FixtureQuestion, index: number): Record<string, unknown> {
  return {
    documentId: `doc-${question.key}`,
    questionText: question.text,
    answerType: question.type,
    options: {
      schemaVersion: 2,
      questionKey: question.key,
      section: question.section,
      order: question.order,
      required: question.required ?? true,
      ...(question.visibility ? { visibility: question.visibility } : {}),
      ...(question.choices ? { choices: question.choices } : {}),
      ...(question.removed ? { deleted: { deletedAt: STAMP, deletedBy: `analyst-${index}` } } : {}),
    },
    answer: envelope(question.answer),
  };
}

function answerLabel(question: FixtureQuestion): string | undefined {
  const { answer } = question;
  if (answer === undefined || answer === null) return undefined;
  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  const labelOf = (value: string) => question.choices?.find((choice) => choice.value === value)?.label ?? value;
  return Array.isArray(answer) ? answer.map(labelOf).join(", ") : labelOf(answer);
}

function instructionOf(text: string | undefined): SlotInstruction | null {
  if (text === undefined) return null;
  const parsed = parseAnalystInstruction(text);
  if (!parsed.ok) throw new Error(`Fixture instruction refused: ${parsed.reason}`);
  return parsed.instruction;
}

function build(options: ProposalFixtureOptions, scope: "questionnaire" | "question", targetKey?: string) {
  const questions = options.questions ?? defaultFixtureQuestions();
  const definition = parseQuestionnaireDefinition(questions.map(rawQuestion));
  const byKey = new Map(questions.map((question) => [question.key, question]));
  const rows: PreservationRow[] = definition.map((question) => ({ question, helpText: byKey.get(question.questionKey)?.helpText ?? null, answer: question.answer }));
  const contextQuestions: QuestionnaireContextQuestion[] = definition.map((question) => {
    const source = byKey.get(question.questionKey) as FixtureQuestion;
    const answered = question.deleted === undefined && isAnsweredValue(question.answer);
    const label = answerLabel(source);
    return {
      documentId: question.documentId,
      questionKey: question.questionKey,
      section: { key: question.section.key, title: question.section.title, order: question.section.order },
      order: question.order,
      questionText: question.questionText,
      helpText: source.helpText ?? null,
      answerType: question.answerType,
      choices: question.choices ?? null,
      required: question.required,
      visibility: question.visibility ?? null,
      removed: question.deleted !== undefined,
      answered,
      ...(answered && label !== undefined ? { answerLabel: label } : {}),
    };
  });
  const notes: ContextNote[] = (options.notes ?? []).map(({ sequence, body }) => ({ documentId: `note-doc-${sequence}`, part: "requestor", sequence, postedAt: STAMP, body }));
  const records: AssessmentContextRecords = {
    request: { documentId: "request-1", title: "Payroll replacement", description: "Replace the payroll platform with a hosted service.", assessmentType: "Project", businessCriticality: "High", thirdPartyInvolvement: true },
    systems: [], assets: [], riskTypes: [], controls: [], notes,
  };
  const operation = scope === "question" ? "question-rewrite" as const : "questionnaire-proposals" as const;
  const instruction = instructionOf(options.instruction);
  const instructionSource: InstructionSource = instruction !== null ? "analyst" : scope === "question" ? "plain-language-preset" : "default-task";
  const part = buildQuestionnaireProposalContext({
    scope,
    ...(targetKey ? { targetQuestionDocumentId: `doc-${targetKey}` } : {}),
    questions: contextQuestions,
    answerContent: options.answerContent ?? "included",
    openItems: (options.openItemTexts ?? []).map((questionText) => ({ kind: "add" as const, questionText })),
    rejectedItems: (options.rejectedItemTexts ?? []).map((questionText) => ({ kind: "add" as const, questionText, reason: null, decidedAt: STAMP })),
    instructionSource,
    contextSourceRefs: contextSourceRefs(records),
  });
  const context = buildAssessmentContext(records, { operation, instruction, instructionSource, questionnaire: part });
  const adapter: QuestionnaireAdapterContext = {
    allowed: part.allowed,
    rows,
    generatedDate: options.generatedDate === undefined ? STAMP : options.generatedDate,
    openItemTexts: options.openItemTexts ?? [],
    rejectedItemTexts: options.rejectedItemTexts ?? [],
  };
  const views = providerQuestionViews(contextQuestions);
  const markedNotes = notes.map(({ sequence, body }) => ({ ref: `note-${sequence}`, body }));
  return { context, adapter, views, markedNotes, instruction, instructionSource, contextQuestions };
}

/** A questionnaire-wide proposal run's context, adapter context and provider input. */
export function proposalFixture(options: ProposalFixtureOptions = {}) {
  const built = build(options, "questionnaire");
  const input: QuestionnaireProposalProviderInput = { context: built.context, questions: built.views, markedNotes: built.markedNotes, instruction: built.instruction, instructionSource: built.instructionSource };
  return { context: built.context, adapter: built.adapter, input };
}

/** A question rewrite run's context, adapter context and provider input, for the question with `targetKey`. */
export function rewriteFixture(targetKey: string, options: ProposalFixtureOptions = {}) {
  const built = build(options, "question", targetKey);
  const target = built.views.find((view) => built.context.questionnaire?.refs.get(view.ref) === `doc-${targetKey}`);
  if (!target) throw new Error("Fixture rewrite target is not an active question.");
  const input: QuestionRewriteProviderInput = { context: built.context, target, markedNotes: built.markedNotes, instruction: built.instruction, instructionSource: built.instructionSource };
  return { context: built.context, adapter: built.adapter, input };
}

/** A question for a custom fixture questionnaire. */
export function fixtureQuestion(key: string, text: string, overrides: Partial<FixtureQuestion> = {}): FixtureQuestion {
  return { key, text, type: "Long text", section: OVERVIEW, order: 0, ...overrides };
}
