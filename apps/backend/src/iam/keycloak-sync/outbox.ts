import type { Core } from "@strapi/strapi";
import type { Knex } from "knex";
import { identityDatabaseLayout } from "../identity/database-invariants";
import { randomUUID } from "node:crypto";
import type { KeycloakSyncErrorCode } from "../../keycloak/admin-client";
import { withIdentityUserLock, checkCoordination, type IdentityCoordination } from "../identity/user-lock";

const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
const MAX_GENERATION = 2147483647;
type DeactivatedUser = { documentId: string; externalSubject?: string | null };

/** Caller holds the user lock first; outbox coordination must use that same transaction. */
async function readLockedWork(strapi: Core.Strapi, trx: Knex.Transaction, userDocumentId: string) {
  if (!strapi.db.inTransaction()) throw new Error("IAM_OUTBOX_TRANSACTION_REQUIRED");
  const layout = identityDatabaseLayout(strapi);
  const query = trx(layout.outboxTable).select(layout.outboxId).where(layout.outboxUserDocumentId, userDocumentId);
  if (strapi.db.dialect.client !== "sqlite") query.forUpdate();
  await query;
  const row = await strapi.documents(OUTBOX).findFirst({ filters: { userDocumentId }, populate: { idamboxUser: true } });
  if (row && row.idamboxUser?.documentId !== userDocumentId) throw new Error("IAM_DATABASE_OUTBOX_USER_MISMATCH");
  return row;
}

/**
 * Strapi's PostgreSQL datetime columns are timestamp without time zone, and the driver
 * writes them in this process's local wall time. Database time is therefore converted to
 * the same zone, so raw comparisons agree with Document Service writes whatever the
 * database session zone is. All Strapi instances sharing a database must share a zone.
 */
function processTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(zone)) throw new Error("IAM_OUTBOX_PROCESS_TIME_ZONE_INVALID");
  return zone;
}

/** PostgreSQL now() is frozen at transaction start, including time spent waiting for a user lock. */
function databaseNow(strapi: Core.Strapi, trx: Knex.Transaction, offsetMs = 0): Knex.Raw {
  switch (strapi.db.dialect.client) {
    case "postgres": return trx.raw("(clock_timestamp() + (? * interval '1 millisecond')) at time zone ?", [offsetMs, processTimeZone()]);
    case "mysql": return trx.raw("timestampadd(MICROSECOND, ?, current_timestamp(3))", [offsetMs * 1000]);
    case "sqlite": return trx.raw("cast(round((julianday('now') - 2440587.5) * 86400000) as integer) + ?", [offsetMs]);
    default: throw new Error("IAM_OUTBOX_DATABASE_DIALECT_UNSUPPORTED");
  }
}

export async function databaseTime(strapi: Core.Strapi, trx: Knex.Transaction): Promise<string> {
  const row = await trx.select({ now: databaseNow(strapi, trx) }).first();
  const raw: unknown = row.now;
  // Drivers return a Date, epoch milliseconds (SQLite), or UTC date text.
  const value = typeof raw === "number" ? new Date(raw) : raw instanceof Date ? raw : new Date(typeof raw === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(" ", "T")}Z` : String(raw));
  if (!Number.isFinite(value.getTime())) throw new Error("IAM_OUTBOX_DATABASE_TIME_INVALID");
  return value.toISOString();
}

/** One durable row per user; replay never resets attempts, backoff, leases or completion. */
export async function enqueueDeactivation(strapi: Core.Strapi, trx: Knex.Transaction, user: DeactivatedUser,
  newDeactivation: boolean): Promise<void> {
  const row = await readLockedWork(strapi, trx, user.documentId);
  if (row && !newDeactivation) return;
  const oldGeneration = row?.generation ?? 0;
  if (!Number.isInteger(oldGeneration) || oldGeneration < (row ? 1 : 0) || oldGeneration >= MAX_GENERATION) {
    throw new Error("IAM_OUTBOX_GENERATION_OVERFLOW");
  }
  // Runtime accepts null cleanup; generated optional-attribute inputs omit null from their types.
  const cleanup: Record<string, unknown> = { externalSubject: user.externalSubject ?? null,
    lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null, completedAt: null };
  const data = {
    ...cleanup, userDocumentId: user.documentId, idamboxUser: user.documentId,
    operation: "disableAndEndSessions" as const, syncStatus: "pending" as const, generation: oldGeneration + 1,
    attempts: 0, nextAttemptAt: await databaseTime(strapi, trx),
  };
  if (row) await strapi.documents(OUTBOX).update({ documentId: row.documentId, data });
  else await strapi.documents(OUTBOX).create({ data });
}

export type DeactivationClaim = { id: number; generation: number; leaseOwner: string; userDocumentId: string; attempts: number };

function coordination(strapi: Core.Strapi, trx: Knex.Transaction) {
  const layout = identityDatabaseLayout(strapi);
  const attributes = strapi.db.metadata.get(OUTBOX).attributes;
  const column = (field: string) => {
    const attribute = attributes[field];
    if (!attribute || !("columnName" in attribute) || !attribute.columnName) throw new Error("IAM_DATABASE_COLUMN_METADATA_MISSING");
    return attribute.columnName;
  };
  return { table: layout.outboxTable, column, query: () => trx(layout.outboxTable) };
}

/** Candidate reads are hints. Only the conditional update grants ownership, in an outbox-only transaction. */
export async function claimDueDeactivation(strapi: Core.Strapi, leaseMs = 60_000, bounds?: IdentityCoordination): Promise<DeactivationClaim | null> {
  if (strapi.db.inTransaction()) throw new Error("IAM_OUTBOX_CLAIM_MUST_COMMIT_SEPARATELY");
  // An undefined user id takes no user lock; the helper only reserves SQLite writes and bounds busy retries.
  return withIdentityUserLock(strapi, undefined, async (trx) => {
    const { query, column: c } = coordination(strapi, trx);
    const eligible = (q: Knex.QueryBuilder) => q.where((pending) => pending.where(c("syncStatus"), "pending")
      .where(c("nextAttemptAt"), "<=", databaseNow(strapi, trx)))
      .orWhere((expired) => expired.where(c("syncStatus"), "processing").where(c("leaseExpiresAt"), "<=", databaseNow(strapi, trx)));
    const row = await query().where(eligible).orderBy(c("nextAttemptAt")).first();
    checkCoordination(bounds?.signal);
    if (!row) return null;
    const leaseOwner = randomUUID();
    const count = await query().where(c("id"), row[c("id")]).where(c("generation"), row[c("generation")]).where(eligible)
      .update({ [c("syncStatus")]: "processing", [c("leaseOwner")]: leaseOwner,
        [c("leaseExpiresAt")]: databaseNow(strapi, trx, leaseMs),
        [c("attempts")]: trx.raw("case when ?? < 2147483647 then ?? + 1 else 2147483647 end", [c("attempts"), c("attempts")]),
        [c("updatedAt")]: databaseNow(strapi, trx) });
    checkCoordination(bounds?.signal);
    if (count !== 1) return null;
    // A competing writer may have changed attempts while the conditional update waited.
    // The hint is never the authority for the newly owned row's retry count.
    const claimed = await query().where(c("id"), row[c("id")]).first();
    checkCoordination(bounds?.signal);
    return { id: Number(row[c("id")]), generation: Number(row[c("generation")]), leaseOwner,
      userDocumentId: String(row[c("userDocumentId")]), attempts: Number(claimed[c("attempts")]) };
  }, bounds);
}

function fenced(strapi: Core.Strapi, trx: Knex.Transaction, claim: DeactivationClaim) {
  const { query, column: c } = coordination(strapi, trx);
  return { c, query: query().where(c("id"), claim.id).where(c("generation"), claim.generation)
    .where(c("leaseOwner"), claim.leaseOwner).where(c("syncStatus"), "processing")
    .where(c("leaseExpiresAt"), ">", databaseNow(strapi, trx)) };
}

/** Must run under the user lock; updating before network I/O also locks the outbox row. */
export async function renewClaim(strapi: Core.Strapi, trx: Knex.Transaction, claim: DeactivationClaim, leaseMs: number): Promise<boolean> {
  const { query, c } = fenced(strapi, trx, claim);
  return (await query.update({ [c("leaseExpiresAt")]: databaseNow(strapi, trx, leaseMs), [c("updatedAt")]: databaseNow(strapi, trx) })) === 1;
}

async function finishClaim(strapi: Core.Strapi, trx: Knex.Transaction, claim: DeactivationClaim,
  status: "completed" | "cancelled" | "pending", fields: Record<string, unknown> = {}): Promise<boolean> {
  const { query, c } = fenced(strapi, trx, claim);
  const extra = Object.fromEntries(Object.entries(fields).map(([key, value]) => [c(key), value]));
  return (await query.update({ [c("syncStatus")]: status, [c("leaseOwner")]: null, [c("leaseExpiresAt")]: null,
    [c("updatedAt")]: databaseNow(strapi, trx), ...extra })) === 1;
}

export function completeClaim(strapi: Core.Strapi, trx: Knex.Transaction, claim: DeactivationClaim): Promise<boolean> {
  return finishClaim(strapi, trx, claim, "completed", { completedAt: databaseNow(strapi, trx), lastErrorCode: null });
}
export function cancelClaim(strapi: Core.Strapi, trx: Knex.Transaction, claim: DeactivationClaim): Promise<boolean> {
  return finishClaim(strapi, trx, claim, "cancelled");
}

export function retryDelayMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(3600, 5 * 2 ** Math.min(10, Math.max(0, attempts - 1)));
  return Math.round(base * 1000 * (1 + Math.max(0, Math.min(1, random())) * 0.2));
}
export function retryClaim(strapi: Core.Strapi, trx: Knex.Transaction, claim: DeactivationClaim,
  errorCode: KeycloakSyncErrorCode, random: () => number = Math.random): Promise<boolean> {
  return finishClaim(strapi, trx, claim, "pending", { lastErrorCode: errorCode,
    nextAttemptAt: databaseNow(strapi, trx, retryDelayMs(claim.attempts, random)) });
}

/** Retain generation/history and invalidate any old worker's exact generation/owner fence. */
export async function cancelPendingDeactivation(strapi: Core.Strapi, trx: Knex.Transaction, userDocumentId: string): Promise<void> {
  const row = await readLockedWork(strapi, trx, userDocumentId);
  if (!row || (row.syncStatus !== "pending" && row.syncStatus !== "processing")) return;
  const layout = identityDatabaseLayout(strapi);
  const attributes = strapi.db.metadata.get(OUTBOX).attributes;
  const column = (field: string) => {
    const attribute = attributes[field];
    if (!attribute || !("columnName" in attribute) || !attribute.columnName) throw new Error("IAM_DATABASE_COLUMN_METADATA_MISSING");
    return attribute.columnName;
  };
  const count = await trx(layout.outboxTable).where(layout.outboxId, row.id)
    .where(column("generation"), row.generation).where(column("leaseOwner"), row.leaseOwner ?? null)
    .whereIn(column("syncStatus"), ["pending", "processing"])
    .update({ [column("syncStatus")]: "cancelled", [column("leaseOwner")]: null,
      [column("leaseExpiresAt")]: null, [column("updatedAt")]: databaseNow(strapi, trx) });
  if (count !== 1) throw new Error("IAM_OUTBOX_CANCELLATION_FENCE_LOST");
}
