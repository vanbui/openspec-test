export const REVERT_REASON_MAX_LENGTH = 500;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The one reason-text rule: the trimmed string when it has 1 to `REVERT_REASON_MAX_LENGTH` characters, otherwise
 * null. The revert reasons and Phase 16's withdrawal and reinstatement reasons (D-06) share it.
 */
export function parseReasonText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 1 && reason.length <= REVERT_REASON_MAX_LENGTH ? reason : null;
}

export function parseRevertReason(body: unknown, messagePrefix: string): string {
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.reason !== "string") {
    throw new Error(`${messagePrefix} reversal data is invalid.`);
  }
  const reason = parseReasonText(body.reason);
  if (reason === null) {
    throw new Error(`${messagePrefix} reversal reason is invalid.`);
  }
  return reason;
}
