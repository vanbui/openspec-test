import {
  createWithDomainNumber,
  DOMAIN_NUMBER_CREATE_ATTEMPTS,
  generateDomainNumber,
  isDomainNumberUniqueConflict,
} from "../../csrm-assessment-request/services/domain-number";

export const ASSESSMENT_NUMBER_CREATE_ATTEMPTS = DOMAIN_NUMBER_CREATE_ATTEMPTS;

export function generateAssessmentNumber(now: Date = new Date()): string {
  return generateDomainNumber("ASM", now);
}

export function isAssessmentNumberUniqueConflict(error: unknown): boolean {
  return isDomainNumberUniqueConflict(error, "assessmentNumber");
}

export function createWithAssessmentNumber<T>(
  create: (assessmentNumber: string) => Promise<T>,
  generate: () => string = generateAssessmentNumber,
): Promise<T> {
  return createWithDomainNumber(create, generate, isAssessmentNumberUniqueConflict);
}
