import type { Core } from "@strapi/strapi";
import type { Knex } from "knex";
import { identityDatabaseLayout } from "./database-invariants";

/** Worker-only bounds. Ordinary identity writes never supply this option. */
export type IdentityCoordination = { timeoutMs: number; signal?: AbortSignal };
export function checkCoordination(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("IAM_WORKER_STOPPED");
}

async function boundCoordination(strapi: Core.Strapi, trx: Knex.Transaction, options?: IdentityCoordination) {
  if (!options) return;
  checkCoordination(options.signal);
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) throw new Error("IAM_WORKER_INVALID_TIMEOUT");
  if (strapi.db.dialect.client === "postgres") {
    // Validated integer literals: PostgreSQL SET does not accept bind parameters.
    await trx.raw(`SET LOCAL lock_timeout = '${options.timeoutMs}ms'`);
    checkCoordination(options.signal);
    await trx.raw(`SET LOCAL statement_timeout = '${options.timeoutMs}ms'`);
  }
  checkCoordination(options.signal);
}

/** All deciding reads belong after this transaction-bound lock. Never mutate a user to lock it. */
export async function lockIdentityUser(strapi: Core.Strapi, documentId: string | undefined, trx: Knex.Transaction): Promise<void> {
  const layout = identityDatabaseLayout(strapi);
  if (strapi.db.dialect.client === "sqlite") {
    // Even an empty-table UPDATE acquires SQLite's RESERVED write lock.
    await trx(layout.outboxTable).whereRaw("1 = 0").update({ [layout.outboxId]: trx.ref(layout.outboxId) });
  } else if (documentId) {
    await trx(layout.userTable).select(layout.userId).where(layout.userDocumentId, documentId).forUpdate();
  }
}

export async function withIdentityUserLock<T>(strapi: Core.Strapi, documentId: string | undefined,
  work: (trx: Knex.Transaction) => Promise<T>, coordination?: IdentityCoordination): Promise<T> {
  const nested = strapi.db.inTransaction();
  for (let attempt = 0; ; attempt++) {
    try {
      checkCoordination(coordination?.signal);
      return await strapi.db.transaction(async ({ trx }) => {
        await boundCoordination(strapi, trx, coordination);
        await lockIdentityUser(strapi, documentId, trx);
        checkCoordination(coordination?.signal);
        const result = await work(trx);
        checkCoordination(coordination?.signal);
        return result;
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      // Retry the entire outer transaction, never a statement in a failed transaction.
      if (nested || strapi.db.dialect.client !== "sqlite" || attempt >= 4
        || !/SQLITE_BUSY|SQLITE_LOCKED/.test(`${code} ${String(error)}`)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
}
