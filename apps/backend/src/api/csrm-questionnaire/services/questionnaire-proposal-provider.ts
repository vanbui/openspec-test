import { CSRM_AI_PROVIDER_MODE } from "../../../csrm/ai-provider-selection";
import type { InstructionSource } from "../../../csrm/ai/analyst-instruction";
import type { AssessmentContext } from "../../../csrm/ai/assessment-context";
import { deterministicQuestionnaireProposalProvider, deterministicQuestionRewriteProvider } from "./deterministic-questionnaire-proposal-provider";
import { openaiCompatibleQuestionnaireProposalProvider, openaiCompatibleQuestionRewriteProvider } from "./openai-compatible-questionnaire-proposal-provider";
import type { QuestionnaireContextQuestion } from "./questionnaire-proposal-context";

/*
 * The questionnaire proposal and question rewrite providers (Phase 15 D-15, D-16). A provider returns model-facing wire
 * JSON, never the stored envelope: the workflow passes whatever it returns through the one adapter
 * (`questionnaire-proposal-adapter.ts`), so the deterministic provider every suite runs exercises every drop rule
 * (15-RESEARCH Pitfall 9). The hosted providers read only the built context (the prompt carries the instruction in its
 * slot); the deterministic ones also read the question list, the marked notes and the instruction the context was built
 * from, which is how their rules stay deterministic.
 */

/** A question as the providers see it: its context ref (`Q1…Qn`), never a documentId or a key. */
export type ProviderQuestionView = {
  ref: string;
  questionText: string;
  helpText: string | null;
  sectionTitle: string;
  answerType: string;
  choiceLabels: readonly string[];
  answered: boolean;
};
/** A marked note by its context source id (`note-{n}`). */
export type ProviderMarkedNote = { ref: string; body: string };

export type QuestionnaireProposalProviderInput = {
  context: AssessmentContext;
  questions: readonly ProviderQuestionView[];
  markedNotes: readonly ProviderMarkedNote[];
  instruction: string | null;
  instructionSource: InstructionSource | null;
};
export type QuestionRewriteProviderInput = {
  context: AssessmentContext;
  target: ProviderQuestionView;
  markedNotes: readonly ProviderMarkedNote[];
  instruction: string | null;
  instructionSource: InstructionSource | null;
};

export interface QuestionnaireProposalProvider {
  readonly name: string;
  readonly version: string;
  propose(input: QuestionnaireProposalProviderInput): Promise<unknown>;
}
export interface QuestionRewriteProvider {
  readonly name: string;
  readonly version: string;
  rewrite(input: QuestionRewriteProviderInput): Promise<unknown>;
}

/** The active questions in the context's display order, numbered as the context numbers them (`Q1…Qn`). */
export function providerQuestionViews(questions: readonly QuestionnaireContextQuestion[]): ProviderQuestionView[] {
  return questions.filter(({ removed }) => !removed).map((question, index) => ({
    ref: `Q${index + 1}`,
    questionText: question.questionText,
    helpText: question.helpText,
    sectionTitle: question.section.title,
    answerType: question.answerType,
    choiceLabels: (question.choices ?? []).map(({ label }) => label),
    answered: question.answered,
  }));
}

/** The providers `CSRM_AI_PROVIDER_MODE` selects: the deterministic ones unless the hosted provider is configured. */
export function activeQuestionnaireProposalProviders(): { proposals: QuestionnaireProposalProvider; rewrite: QuestionRewriteProvider } {
  return CSRM_AI_PROVIDER_MODE === "openai-compatible"
    ? { proposals: openaiCompatibleQuestionnaireProposalProvider, rewrite: openaiCompatibleQuestionRewriteProvider }
    : { proposals: deterministicQuestionnaireProposalProvider, rewrite: deterministicQuestionRewriteProvider };
}
