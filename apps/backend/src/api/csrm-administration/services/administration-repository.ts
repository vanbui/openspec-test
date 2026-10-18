import { administrationConfig, type AdministrationKind } from "./administration-config";
import { ADMINISTRATION_MAX_RECORDS, type AdministrationQuery } from "./administration-query";
import { isRegisteredSourceServiceUser } from "../../../iam/identity/source-principal";

type RecordValue = Record<string, unknown>;
type QueryBuilder = {
  countDistinct: (value: RecordValue) => QueryBuilder;
  first: () => Promise<RecordValue | undefined>;
  limit: (value: number) => QueryBuilder;
  offset: (value: number) => QueryBuilder;
  orderBy: (column: string, direction: "asc" | "desc") => QueryBuilder;
  select: (column: string) => QueryBuilder;
  where: ((column: string, value: unknown) => QueryBuilder) & ((callback: (query: QueryBuilder) => void) => QueryBuilder);
  orWhereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  whereRaw: (sql: string, bindings?: unknown[]) => QueryBuilder;
  then: Promise<RecordValue[]>["then"];
};
type DocumentService = {
  findOne?: (input: RecordValue) => Promise<RecordValue | null>;
  findMany: (input: RecordValue) => Promise<RecordValue[]>;
  create?: (input: { data: RecordValue }) => Promise<RecordValue>;
  update?: (input: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};
type DatabaseEntityQuery = {
  create: (input: { data: RecordValue }) => Promise<RecordValue>;
  update: (input: { where: { documentId: string }; data: RecordValue }) => Promise<RecordValue>;
};

export type AdministrationRepository = {
  count: (query: AdministrationQuery) => Promise<number>;
  selectPage: (query: AdministrationQuery) => Promise<string[]>;
  hydrate: (documentIds: readonly string[]) => Promise<RecordValue[]>;
  findOne: (documentId: string) => Promise<RecordValue | null>;
  findNaturalKeyRecords: () => Promise<RecordValue[]>;
  resolveApplicableControls: (documentIds: readonly string[]) => Promise<string[]>;
  resolveActiveUser: (documentId: string) => Promise<number>;
  create: (data: RecordValue) => Promise<RecordValue>;
  update: (documentId: string, data: RecordValue) => Promise<RecordValue>;
  transaction: <T>(action: () => Promise<T>) => Promise<T>;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyQuery(query: QueryBuilder, tableAlias: string, config: ReturnType<typeof administrationConfig>, input: AdministrationQuery): QueryBuilder {
  let scoped = query;
  for (const [filter, column] of Object.entries(config.filterColumns)) {
    const value = input[filter as keyof AdministrationQuery];
    if (value !== undefined && value !== "") scoped = scoped.where(`${tableAlias}.${column}`, value);
  }
  const search = input.q;
  if (!search) return scoped;
  const escaped = `%${search.toLocaleLowerCase("en-AU").replace(/[!%_]/g, "!$&")}%`;
  const clauses = config.searchColumns.map((column) => `LOWER(${tableAlias}.${column}) LIKE ? ESCAPE '!'`).join(" OR ");
  return scoped.whereRaw(`(${clauses})`, config.searchColumns.map(() => escaped));
}

export function createStrapiAdministrationRepository(strapi: unknown, kind: AdministrationKind): AdministrationRepository {
  const config = administrationConfig(kind);
  if (!isRecord(strapi) || !isRecord(strapi.db) || typeof strapi.db.connection !== "function"
    || typeof strapi.db.transaction !== "function" || typeof strapi.db.query !== "function"
    || typeof strapi.documents !== "function") {
    throw new Error("CSRM Administration repository is unavailable.");
  }
  const connection = strapi.db.connection as (table: string) => QueryBuilder;
  const database = strapi.db;
  const databaseQueryFor = (database.query as (uid: string) => DatabaseEntityQuery).bind(database);
  const transaction = database.transaction as <T>(callback: () => Promise<T>) => Promise<T>;
  const boundTransaction = transaction.bind(database) as <T>(callback: () => Promise<T>) => Promise<T>;
  const documentsFor = strapi.documents as (uid: string) => DocumentService;
  const documents = documentsFor(config.uid);
  const databaseQuery = databaseQueryFor(config.uid);
  const controls = documentsFor("api::csrm-control.csrm-control");
  const users = documentsFor("api::idambox-user.idambox-user");
  if (!documents.create || !documents.update || !documents.findOne) throw new Error("CSRM Administration repository is unavailable.");

  return {
    async count(query) {
      const row = await applyQuery(connection(`${config.table} as item`), "item", config, query)
        .countDistinct({ total: "item.id" }).first();
      return Number(row?.total ?? 0);
    },
    async selectPage(query) {
      const [sortField, sortDirection] = query.sort.split(":");
      const sortColumn = config.sortColumns[sortField];
      if (!sortColumn || (sortDirection !== "asc" && sortDirection !== "desc")) {
        throw new Error("CSRM Administration sort is unavailable.");
      }
      const rows = await applyQuery(connection(`${config.table} as item`), "item", config, query)
        .select("item.document_id")
        .orderBy(`item.${sortColumn}`, sortDirection)
        .orderBy(`item.${config.naturalKeyColumn}`, "asc")
        .orderBy("item.document_id", "asc")
        .offset((query.page - 1) * query.pageSize)
        .limit(query.pageSize) as unknown as RecordValue[];
      return rows.map((row) => row.document_id).filter((id): id is string => typeof id === "string");
    },
    hydrate(documentIds) {
      return documents.findMany({
        filters: { documentId: { $in: [...documentIds] } },
        fields: [...config.projectedFields],
        ...(kind === "risk-types" ? { populate: { applicableControls: { fields: ["documentId"] } } }
          : kind === "information-systems" ? { populate: { owner: { fields: ["documentId", "displayName"] } } } : {}),
        limit: documentIds.length,
      });
    },
    findOne(documentId) {
      return documents.findOne!({
        documentId,
        fields: [...config.projectedFields],
        ...(kind === "risk-types" ? { populate: { applicableControls: { fields: ["documentId"] } } }
          : kind === "information-systems" ? { populate: { owner: { fields: ["documentId", "displayName"] } } } : {}),
      });
    },
    findNaturalKeyRecords() {
      return documents.findMany({ fields: [...config.projectedFields], limit: ADMINISTRATION_MAX_RECORDS + 1 });
    },
    async resolveApplicableControls(documentIds) {
      if (documentIds.length === 0) return [];
      const rows = await controls.findMany({
        filters: { documentId: { $in: [...documentIds] } },
        fields: ["documentId"],
        limit: documentIds.length,
      });
      const found = new Set(rows.map((row) => row.documentId).filter((id): id is string => typeof id === "string"));
      if (found.size !== documentIds.length || documentIds.some((id) => !found.has(id))) {
        throw new Error("CSRM Administration relation is unavailable.");
      }
      return [...documentIds];
    },
    async resolveActiveUser(documentId) {
      if (await isRegisteredSourceServiceUser(strapi as unknown as Parameters<typeof isRegisteredSourceServiceUser>[0], documentId)) {
        throw new Error("CSRM Administration owner is unavailable.");
      }
      const rows = await users.findMany({
        filters: { documentId: { $eq: documentId }, accountStatus: { $eq: "active" } },
        fields: ["documentId"],
        limit: 1,
      });
      if (rows.length !== 1 || rows[0]?.documentId !== documentId
        || typeof rows[0].id !== "number" || !Number.isInteger(rows[0].id) || rows[0].id < 1) {
        throw new Error("CSRM Administration owner is unavailable.");
      }
      // Database entity queries bind relation join tables by the target numeric primary key.
      // The public contract remains documentId-based; only this validated repository value is translated.
      return rows[0].id;
    },
    create(data) {
      // The frozen Administration contract intentionally exceeds Strapi's implicit 255-character
      // default for selected schema `string` fields. The closed parser is authoritative, so the
      // affected collections use Strapi's database query layer after validation has succeeded.
      if (kind !== "risk-types") return databaseQuery.create({ data });
      return documents.create!({ data });
    },
    update(documentId, data) {
      if (kind !== "risk-types") return databaseQuery.update({ where: { documentId }, data });
      return documents.update!({ documentId, data });
    },
    transaction(action) {
      return boundTransaction(action);
    },
  };
}
