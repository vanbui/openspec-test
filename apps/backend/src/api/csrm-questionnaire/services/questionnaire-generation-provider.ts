import { parseQuestionnaireDefinition, type QuestionnaireAnswerType, type QuestionnaireDefinitionQuestion } from "./questionnaire-definition";

export type QuestionnaireGenerationContext = { title: string; description?: string | null; assessmentType?: string | null; businessPurpose?: string | null; businessCriticality?: string | null; thirdPartyInvolvement?: boolean | null; thirdPartyDetails?: string | null };
export type QuestionnaireGenerationQuestion = { questionText: string; answerType: QuestionnaireAnswerType; options: Record<string, unknown> };
export type QuestionnaireGenerationProposal = { schemaVersion: 1; title: string; description?: string; questions: QuestionnaireGenerationQuestion[] };
export interface QuestionnaireGenerationProvider { readonly name: string; readonly version: string; generate(context: QuestionnaireGenerationContext): Promise<QuestionnaireGenerationProposal>; }
const keys = ["schemaVersion", "title", "description", "questions"];
const questionKeys = ["questionText", "answerType", "options"];
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 65535): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
function invalid(): never { throw new Error("CSRM questionnaire generation proposal is invalid."); }
export function parseQuestionnaireGenerationProposal(value: unknown): QuestionnaireGenerationProposal {
  if (!record(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key)) || value.schemaVersion !== 1 || !text(value.title, 255) || !Array.isArray(value.questions) || value.questions.length === 0 || value.questions.length > 10000 || (value.description !== undefined && !text(value.description, 2000))) invalid();
  const raw = value.questions.map((question, index) => {
    if (!record(question) || Object.keys(question).length !== questionKeys.length || Object.keys(question).some((key) => !questionKeys.includes(key)) || !text(question.questionText) || !text(question.answerType, 64) || !record(question.options)) invalid();
    return { documentId: `questionnaire-generation-${index + 1}`, questionText: question.questionText, answerType: question.answerType, options: question.options, answer: null };
  });
  const validated = parseQuestionnaireDefinition(raw);
  return { schemaVersion: 1, title: value.title.trim(), ...(typeof value.description === "string" ? { description: value.description.trim() } : {}), questions: validated.map(toProposalQuestion) };
}
function toProposalQuestion(question: QuestionnaireDefinitionQuestion): QuestionnaireGenerationQuestion {
  return { questionText: question.questionText, answerType: question.answerType, options: { schemaVersion: 1, questionKey: question.questionKey, section: question.section, order: question.order, required: question.required, ...(question.visibility ? { visibility: question.visibility } : {}), ...(question.choices ? { choices: question.choices } : {}) } };
}
export function validatedGenerationQuestions(proposal: unknown): QuestionnaireDefinitionQuestion[] {
  const parsed = parseQuestionnaireGenerationProposal(proposal);
  return parseQuestionnaireDefinition(parsed.questions.map((question, index) => ({ documentId: `questionnaire-generation-${index + 1}`, ...question, answer: null })));
}
