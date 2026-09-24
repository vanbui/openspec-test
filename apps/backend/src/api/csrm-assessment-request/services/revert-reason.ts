export const REVERT_REASON_MAX_LENGTH = 500;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRevertReason(body: unknown, messagePrefix: string): string {
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.reason !== "string") {
    throw new Error(`${messagePrefix} reversal data is invalid.`);
  }
  const reason = body.reason.trim();
  if (reason.length < 1 || reason.length > REVERT_REASON_MAX_LENGTH) {
    throw new Error(`${messagePrefix} reversal reason is invalid.`);
  }
  return reason;
}
