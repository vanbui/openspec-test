import { randomBytes } from "node:crypto";

export const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const DOMAIN_NUMBER_RANDOM_LENGTH = 6;
export const DOMAIN_NUMBER_CREATE_ATTEMPTS = 5;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function normalizedField(value: unknown): string {
  return String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function generateDomainNumber(prefix: string, now: Date = new Date()): string {
  if (!/^[A-Z]{3}$/.test(prefix)) throw new Error("CSRM domain number prefix is invalid.");
  const year = now.getUTCFullYear().toString().padStart(4, "0");
  const bytes = randomBytes(DOMAIN_NUMBER_RANDOM_LENGTH);
  let random = "";
  for (const byte of bytes) random += CROCKFORD_BASE32[byte & 31];
  return `${prefix}-${year}-${random}`;
}

export function isDomainNumberUniqueConflict(error: unknown, fieldName: string): boolean {
  if (!isRecord(error)) return false;
  const message = typeof error.message === "string" ? error.message : "";
  const mentionsField = normalizedField(message).includes(normalizedField(fieldName));
  const details = isRecord(error.details) ? error.details : undefined;
  const detailErrors = Array.isArray(details?.errors) ? details.errors : [];
  const matchingDetail = detailErrors.some((detail) => {
    if (!isRecord(detail)) return false;
    const path = Array.isArray(detail.path) ? detail.path : [];
    return path.some((part) => normalizedField(part) === normalizedField(fieldName))
      && /unique/i.test(String(detail.message ?? ""));
  });
  return matchingDetail
    || (mentionsField && error.code === "SQLITE_CONSTRAINT_UNIQUE")
    || (mentionsField && /unique constraint/i.test(message));
}

export async function createWithDomainNumber<T>(
  create: (domainNumber: string) => Promise<T>,
  generate: () => string,
  isUniqueConflict: (error: unknown) => boolean,
): Promise<T> {
  for (let attempt = 1; attempt <= DOMAIN_NUMBER_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await create(generate());
    } catch (error) {
      if (!isUniqueConflict(error) || attempt === DOMAIN_NUMBER_CREATE_ATTEMPTS) throw error;
    }
  }
  throw new Error("CSRM domain number generation failed.");
}
