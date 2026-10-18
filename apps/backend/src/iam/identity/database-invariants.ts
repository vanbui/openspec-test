import { createHash } from "node:crypto";
import type { Core } from "@strapi/strapi";

const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
const OUTBOX = "api::keycloak-sync-outbox.keycloak-sync-outbox";
type DatabaseHost = Pick<Core.Strapi, "db">;
type UniqueColumn = { table: string; column: string; index: string };

function column(strapi: DatabaseHost, uid: string, attribute: string): string {
  const value = strapi.db.metadata.get(uid).attributes[attribute];
  const name = value && "columnName" in value ? value.columnName : undefined;
  if (!name) throw new Error("IAM_DATABASE_COLUMN_METADATA_MISSING");
  return name;
}

function relation(strapi: DatabaseHost, uid: string, attribute: string) {
  const value = strapi.db.metadata.get(uid).attributes[attribute];
  if (value?.type !== "relation" || !("joinTable" in value) || !value.joinTable || !("inverseJoinColumn" in value.joinTable)) {
    throw new Error("IAM_DATABASE_RELATION_METADATA_MISSING");
  }
  return value.joinTable;
}

function uniqueColumn(table: string, columnName: string): UniqueColumn {
  // Bounded identifiers work with PostgreSQL's 63-byte identifier limit.
  const digest = createHash("sha256").update(JSON.stringify([table, columnName])).digest("hex").slice(0, 24);
  return { table, column: columnName, index: `iam_unique_${digest}` };
}

/** Physical identifiers discovered from the pinned runtime, also used by the production-dialect gate. */
export function identityDatabaseLayout(strapi: DatabaseHost) {
  const user = strapi.db.metadata.get(USER);
  const outbox = strapi.db.metadata.get(OUTBOX);
  const sourceServiceUser = relation(strapi, SOURCE, "serviceUser");
  const outboxUser = relation(strapi, OUTBOX, "idamboxUser");
  return {
    userTable: user.tableName,
    userId: column(strapi, USER, "id"),
    userDocumentId: column(strapi, USER, "documentId"),
    outboxTable: outbox.tableName,
    outboxId: column(strapi, OUTBOX, "id"),
    outboxUserDocumentId: column(strapi, OUTBOX, "userDocumentId"),
    sourceServiceUser,
    outboxUser,
    uniqueColumns: [
      uniqueColumn(user.tableName, column(strapi, USER, "sourceIdentityKey")),
      uniqueColumn(outbox.tableName, column(strapi, OUTBOX, "userDocumentId")),
      uniqueColumn(sourceServiceUser.name, sourceServiceUser.inverseJoinColumn.name),
      uniqueColumn(outboxUser.name, outboxUser.inverseJoinColumn.name),
    ],
  };
}

async function hasUniqueColumn(strapi: DatabaseHost, invariant: UniqueColumn) {
  const indexes = await strapi.db.dialect.schemaInspector.getIndexes(invariant.table);
  return indexes.some((index) => index.type === "unique" && index.columns.length === 1 && index.columns[0] === invariant.column);
}

async function assertConsistentRows(strapi: DatabaseHost) {
  const layout = identityDatabaseLayout(strapi);
  // getConnection(table) applies the configured schema; without a table it returns a
  // schema-bound query builder on PostgreSQL, which cannot start a new query.
  const connection = (table: string) => strapi.db.getConnection(table);
  for (const invariant of layout.uniqueColumns) {
    const duplicate = await connection(invariant.table)
      .select(invariant.column).whereNotNull(invariant.column)
      .groupBy(invariant.column).havingRaw("count(*) > 1").first();
    if (duplicate) throw new Error("IAM_DATABASE_DUPLICATE_IDENTITY_BINDING");
  }
  // Required one-way relation: exactly one target, whose stable id agrees with the outbox key.
  const link = layout.outboxUser;
  const invalid = await connection(`${layout.outboxTable} as work`)
    .leftJoin(`${link.name} as binding`, `binding.${link.joinColumn.name}`, `work.${link.joinColumn.referencedColumn}`)
    .leftJoin(`${layout.userTable} as person`, `person.${link.inverseJoinColumn.referencedColumn}`, `binding.${link.inverseJoinColumn.name}`)
    .where((query) => query.whereNull(`person.${layout.userDocumentId}`)
      .orWhereRaw("?? <> ??", [`work.${layout.outboxUserDocumentId}`, `person.${layout.userDocumentId}`]))
    .select(`work.${layout.outboxId}`).first();
  if (invalid) throw new Error("IAM_DATABASE_OUTBOX_USER_MISMATCH");
  const duplicateOwner = await connection(link.name).select(link.joinColumn.name)
    .groupBy(link.joinColumn.name).havingRaw("count(*) > 1").first();
  if (duplicateOwner) throw new Error("IAM_DATABASE_OUTBOX_USER_MISMATCH");
}

/** Fail closed on corrupt persisted data or missing physical uniqueness; never choose a winner. */
export async function assertIdentityDatabaseInvariants(strapi: DatabaseHost): Promise<void> {
  await assertConsistentRows(strapi);
  for (const invariant of identityDatabaseLayout(strapi).uniqueColumns) {
    if (!(await hasUniqueColumn(strapi, invariant))) {
      throw new Error("IAM_DATABASE_UNIQUE_INDEX_MISSING");
    }
  }
}

/** Called after every schema sync, before seeds or other application writes. */
export async function ensureIdentityDatabaseInvariants(strapi: DatabaseHost): Promise<void> {
  await assertConsistentRows(strapi);
  for (const invariant of identityDatabaseLayout(strapi).uniqueColumns) {
    if (await hasUniqueColumn(strapi, invariant)) continue;
    try {
      await strapi.db.getSchemaConnection().alterTable(invariant.table, (table) => {
        table.unique([invariant.column], { indexName: invariant.index });
      });
    } catch (error) {
      // A simultaneous boot may have created the same index. Any other failure remains fatal.
      if (!(await hasUniqueColumn(strapi, invariant))) throw error;
    }
  }
  await assertIdentityDatabaseInvariants(strapi);
}
