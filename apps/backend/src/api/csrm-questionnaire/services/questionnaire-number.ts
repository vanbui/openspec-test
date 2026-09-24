import { createWithDomainNumber, DOMAIN_NUMBER_CREATE_ATTEMPTS, generateDomainNumber, isDomainNumberUniqueConflict } from "../../csrm-assessment-request/services/domain-number";

export const QUESTIONNAIRE_NUMBER_CREATE_ATTEMPTS = DOMAIN_NUMBER_CREATE_ATTEMPTS;
export function generateQuestionnaireNumber(now: Date = new Date()): string { return generateDomainNumber("QNR", now); }
export function isQuestionnaireNumberUniqueConflict(error: unknown): boolean { return isDomainNumberUniqueConflict(error, "questionnaireNumber"); }
export function createWithQuestionnaireNumber<T>(create: (questionnaireNumber: string) => Promise<T>, generate: () => string = generateQuestionnaireNumber): Promise<T> {
  return createWithDomainNumber(create, generate, isQuestionnaireNumberUniqueConflict);
}
