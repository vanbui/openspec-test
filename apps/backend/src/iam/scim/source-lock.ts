import type { Core } from "@strapi/strapi";
import type { Knex } from "knex";

const SOURCE = "api::identity-source.identity-source";

/** Serialize source metadata decisions before any deciding reads or Document Service writes. */
export async function withSourceLock<T>(strapi: Core.Strapi, documentId: string,
  work: (trx: Knex.Transaction, onCommit: (callback: () => void) => void) => Promise<T>): Promise<T> {
  const metadata = strapi.db.metadata.get(SOURCE);
  const column = (attribute: string) => {
    const value = metadata.attributes[attribute];
    if (!value || !("columnName" in value) || !value.columnName) throw new Error("IAM_SCIM_SOURCE_LOCK_METADATA_MISSING");
    return value.columnName;
  };
  const id = column("id");
  const document = column("documentId");
  const nested = strapi.db.inTransaction();
  for (let attempt = 0; ; attempt++) {
    try {
      return await strapi.db.transaction(async ({ trx, onCommit }) => {
        if (strapi.db.dialect.client === "sqlite") {
          // An empty update reserves SQLite's writer without changing any record.
          await trx(metadata.tableName).whereRaw("1 = 0").update({ [id]: trx.ref(id) });
        } else if (strapi.db.dialect.client === "postgres") {
          await trx(metadata.tableName).select(id).where(document, documentId).forUpdate();
        } else {
          throw new Error("IAM_SCIM_SOURCE_LOCK_UNSUPPORTED_DATABASE");
        }
        return work(trx, onCommit);
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      // Retry only a complete outer transaction, never a failed nested statement.
      if (nested || strapi.db.dialect.client !== "sqlite" || attempt >= 4
        || !/SQLITE_BUSY|SQLITE_LOCKED/.test(`${code} ${String(error)}`)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
}
