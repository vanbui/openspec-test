import {
  createWithDomainNumber,
  DOMAIN_NUMBER_CREATE_ATTEMPTS,
  generateDomainNumber,
  isDomainNumberUniqueConflict,
} from "./domain-number";

export const REQUEST_NUMBER_CREATE_ATTEMPTS = DOMAIN_NUMBER_CREATE_ATTEMPTS;

export function generateAssessmentRequestNumber(now: Date = new Date()): string {
  return generateDomainNumber("RAR", now);
}

export function isRequestNumberUniqueConflict(error: unknown): boolean {
  return isDomainNumberUniqueConflict(error, "requestNumber");
}

export async function createWithAssessmentRequestNumber<T>(
  create: (requestNumber: string) => Promise<T>,
  generate: () => string = generateAssessmentRequestNumber,
): Promise<T> {
  return createWithDomainNumber(create, generate, isRequestNumberUniqueConflict);
}
