import {
  createWithDomainNumber,
  DOMAIN_NUMBER_CREATE_ATTEMPTS,
  generateDomainNumber,
  isDomainNumberUniqueConflict,
} from "../../csrm-assessment-request/services/domain-number";

export const RISK_NUMBER_CREATE_ATTEMPTS = DOMAIN_NUMBER_CREATE_ATTEMPTS;

export function generateRiskNumber(now: Date = new Date()): string {
  return generateDomainNumber("RSK", now);
}

export function isRiskNumberUniqueConflict(error: unknown): boolean {
  return isDomainNumberUniqueConflict(error, "riskNumber");
}

export function createWithRiskNumber<T>(
  create: (riskNumber: string) => Promise<T>,
  generate: () => string = generateRiskNumber,
): Promise<T> {
  return createWithDomainNumber(create, generate, isRiskNumberUniqueConflict);
}
