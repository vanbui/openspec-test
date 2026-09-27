type RecordValue = Record<string, unknown>;

export class AnalystInsightError extends Error {
  constructor(public readonly status: 400 | 403 | 404, message: string) {
    super(message);
    this.name = "AnalystInsightError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every analyst insight controller asserts the policy's decision before it
 * reads anything. The policy grants the "all" insight scope only to a human
 * Security Analyst who also holds each underlying read the insight discloses
 * (D-14), so a missing or different scope is refused here too.
 */
export function assertAnalystInsightScope(state: unknown): void {
  if (!isRecord(state)
    || !isRecord(state.csrmAuthorization)
    || state.csrmAuthorization.analystInsightScope !== "all") {
    throw new AnalystInsightError(403, "CSRM analyst insight access is denied.");
  }
}
