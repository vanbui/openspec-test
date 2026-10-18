import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import ts from "typescript";

const USER = "api::idambox-user.idambox-user";
const ENTRY_HASH = "f2d7335c713fec9e145f715065cb0e1e03a53f2a8d1952f07ef3de24699014f0";
const operations = ["create", "update", "delete", "createMany", "updateMany", "deleteMany", "attachRelations", "updateRelations", "deleteRelations"];
type Callable = (...args: any[]) => any;
type Permit = { active: boolean; uid: string; operation: string; tables: Set<string>; row: number | null; fields: Set<string> };
export type MutationEvidence = { uid: string; operation: string; table: string; row: number | null; fields: string[]; entry: string };
export type WriteDiscipline = { ledger: MutationEvidence[]; rejected: number; restore(): void; entriesPath: string };

/** Structured call sites are captured synchronously; no process-global formatter survives this call. */
function callers(): NodeJS.CallSite[] {
  const previous = Error.prepareStackTrace;
  const limit = Error.stackTraceLimit;
  try {
    Error.stackTraceLimit = 40;
    Error.prepareStackTrace = (_, frames) => frames;
    const error = new Error();
    Error.captureStackTrace(error, callers);
    return error.stack as unknown as NodeJS.CallSite[];
  } finally { Error.prepareStackTrace = previous; Error.stackTraceLimit = limit; }
}
function normalize(file: string | null): string { return (file ?? "").split("\\").join("/"); }

/** Test-only instrumentation, installed on a loaded instance before exercising workflows. */
export function installIdamboxWriteDiscipline(strapi: Core.Strapi): WriteDiscipline {
  const coreRoot = path.dirname(require.resolve("@strapi/core/package.json", { paths: [path.dirname(require.resolve("@strapi/strapi"))] }));
  const entriesPath = path.join(coreRoot, "dist/services/document-service/entries.js");
  assert.equal(JSON.parse(readFileSync(path.join(coreRoot, "package.json"), "utf8")).version, "5.51.0", "Pinned persistence version drift");
  const source = readFileSync(entriesPath, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), ENTRY_HASH, "Pinned entries persistence drift");
  const databaseRoot = normalize(path.dirname(require.resolve("@strapi/database/package.json")));
  assert.equal(createHash("sha256").update(readFileSync(`${databaseRoot}/dist/entity-manager/regular-relations.js`)).digest("hex"),
    "a3989ae8b2e5ae5d3c59ef5e8738252325fc53b78ec743cab099b2d5fb9defec", "Pinned relation persistence drift");
  const factory = require(entriesPath).createEntriesService;
  assert.equal(typeof factory, "function", "Missing genuine entries persistence callable");
  assert.equal(createHash("sha256").update(factory.toString()).digest("hex"), "b2a42b2c64fc74ad37c7016c6a73ecc7d033c144ded1747a868951e0ed476f39", "Pinned entries callable drift");
  const ast = ts.createSourceFile(entriesPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const entryLines = new Map<number, string>();
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["create", "update", "delete"].includes(node.expression.name.text)
      && ts.isCallExpression(node.expression.expression) && node.expression.expression.expression.getText(ast) === "strapi.db.query") {
      entryLines.set(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, node.expression.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(entryLines.size, 3, "Expected three exact validated persistence calls");
  const context = new AsyncLocalStorage<{ uid: string; action: string } | undefined>();
  const persistence = new AsyncLocalStorage<Permit | undefined>();
  const restorers: Array<() => void> = [];
  let enabled = true;
  const ledger: MutationEvidence[] = [];
  const instrument: WriteDiscipline = { ledger, rejected: 0, entriesPath, restore() { enabled = false; restorers.reverse().forEach((restore) => restore()); } };
  const fail = (): never => { instrument.rejected++; throw new Error("IAM_WRITE_DISCIPLINE_VIOLATION"); };
  function patch(object: Record<string, any>, key: string, replacement: Callable) {
    const original = object[key]; object[key] = replacement; restorers.push(() => { object[key] = original; });
    return original as Callable;
  }
  const protectedTables = new Set<string>([strapi.db.metadata.get(USER).tableName]);
  const tablesByUid = new Map<string, Set<string>>();
  for (const [uid, meta] of strapi.db.metadata) {
    const tables = new Set<string>([meta.tableName]);
    for (const attribute of Object.values(meta.attributes)) {
      if (attribute.type === "relation" && "joinTable" in attribute && attribute.joinTable) {
        tables.add(attribute.joinTable.name);
        if (uid === USER || ("target" in attribute && attribute.target === USER)) protectedTables.add(attribute.joinTable.name);
      }
    }
    tablesByUid.set(uid, tables);
  }
  strapi.documents.use(async (ctx, next) => enabled ? context.run({ uid: ctx.uid, action: ctx.action }, next) : next());
  const lifecycle = strapi.db.lifecycles as unknown as Record<string, any>;
  const runLifecycle = lifecycle.run as Callable;
  patch(lifecycle, "run", function(this: unknown, ...args: unknown[]) {
    // Neither before/after hooks nor their concurrent descendants inherit persistence authority.
    return persistence.run(undefined, () => runLifecycle.apply(this, args));
  });
  const db = strapi.db as unknown as Record<string, any>;
  const query = db.query as Callable;
  const wrapped = new WeakSet<object>();
  patch(db, "query", function(this: unknown, uid: string) {
    const repository = query.call(this, uid) as Record<string, any>;
    if (wrapped.has(repository)) return repository;
    wrapped.add(repository);
    for (const operation of operations) {
      if (typeof repository[operation] !== "function") continue;
      const original = repository[operation] as Callable;
      patch(repository, operation, function(this: unknown, ...args: unknown[]) {
        const tables = tablesByUid.get(uid) ?? new Set<string>();
        if (![...tables].some((table) => protectedTables.has(table))) return original.apply(this, args);
        const caller = callers().find((frame) => normalize(frame.getFileName()) !== normalize(__filename));
        const doc = context.getStore();
        const entryOperation = caller && normalize(caller.getFileName()) === normalize(entriesPath)
          ? entryLines.get(caller.getLineNumber() ?? -1) : undefined;
        const functionName = caller?.getFunctionName()?.split(".").pop();
        const expected = { create: "createEntry", update: "updateEntry", delete: "deleteEntry" }[operation];
        if (!doc || doc.uid !== uid || doc.action !== operation || entryOperation !== operation || functionName !== expected) return fail();
        const params = args[0] as { where?: { id?: number }; data?: Record<string, unknown> } | undefined;
        const fields = new Set(Object.keys(params?.data ?? {}).map((field) => {
          const attribute = strapi.db.metadata.get(uid).attributes[field];
          return attribute && "columnName" in attribute ? attribute.columnName ?? field : field;
        }));
        // The database timestamp lifecycle adds updatedAt after the entries call.
        const timestamp = strapi.db.metadata.get(uid).attributes.updatedAt;
        if (timestamp && "columnName" in timestamp && timestamp.columnName) fields.add(timestamp.columnName);
        if (operation === "create") for (const attribute of Object.values(strapi.db.metadata.get(uid).attributes)) {
          if ("columnName" in attribute && attribute.columnName && ("default" in attribute || attribute.columnName === "created_at")) fields.add(attribute.columnName);
        }
        if (operation === "delete") for (const attribute of Object.values(strapi.db.metadata.get(uid).attributes)) {
          // Non-owning virtual sibling relations are nulled by deleteRelations on
          // dialects that do not rely on foreign keys; discover the exact column.
          if (attribute.type === "relation" && "target" in attribute && attribute.target === uid
            && "joinColumn" in attribute && attribute.joinColumn && !("owner" in attribute && attribute.owner)) {
            fields.add(attribute.joinColumn.referencedColumn);
          }
        }
        if (operation === "delete") {
          const documentId = strapi.db.metadata.get(uid).attributes.documentId;
          if (documentId && "columnName" in documentId && documentId.columnName) fields.add(documentId.columnName);
        }
        // A real user deletion also removes incoming links through the framework's relation cleanup.
        const targets = uid === USER && operation === "delete" ? new Set([...tables, ...protectedTables]) : tables;
        const permit: Permit = { active: true, uid, operation, tables: targets, row: params?.where?.id ?? null, fields };
        return persistence.run(permit, async () => {
          try { return await original.apply(this, args); } finally {
            permit.active = false;
            for (const [key, value] of compiledQueries) if (value === permit) compiledQueries.delete(key);
          }
        });
      });
    }
    return repository;
  });
  const manager = db.entityManager as Record<string, any>;
  for (const operation of operations) {
    if (typeof manager[operation] !== "function") continue;
    const original = manager[operation] as Callable;
    patch(manager, operation, function(this: unknown, uid: string, ...args: unknown[]) {
      const tables = tablesByUid.get(uid) ?? new Set<string>();
      if ([...tables].some((table) => protectedTables.has(table))) {
        const permit = persistence.getStore();
        const caller = callers().find((frame) => normalize(frame.getFileName()) !== normalize(__filename));
        const file = normalize(caller?.getFileName() ?? null);
        if (!permit?.active || permit.uid !== uid || !(file.endsWith("/entity-manager/entity-repository.js") || file.endsWith("/entity-manager/index.js"))) return fail();
      }
      return original.call(this, uid, ...args);
    });
  }
  // Knex's client query event runs before sending SQL, including transaction clients.
  const connection = db.connection;
  const compiledQueries = new Map<string, Permit>();
  const builders = new WeakMap<object, Permit>();
  const knexRoot = path.dirname(require.resolve("knex/package.json"));
  const builderPrototype = require(path.join(knexRoot, "lib/query/querybuilder.js")).prototype as Record<string, any>;
  const cloneBuilder = builderPrototype.clone as Callable;
  patch(builderPrototype, "clone", function(this: object, ...args: unknown[]) {
    const clone = cloneBuilder.apply(this, args);
    const permit = builders.get(this);
    if (permit) builders.set(clone, permit);
    return clone;
  });
  const compileBuilder = builderPrototype.toSQL as Callable;
  patch(builderPrototype, "toSQL", function(this: object, ...args: unknown[]) {
    const sql = compileBuilder.apply(this, args);
    const permit = builders.get(this);
    if (permit?.active) for (const query of Array.isArray(sql) ? sql : [sql]) {
      if (typeof query.__knexQueryUid === "string") compiledQueries.set(query.__knexQueryUid, permit);
    }
    return sql;
  });
  const clientPrototype = Object.getPrototypeOf(connection.client) as Record<string, any>;
  const createBuilder = clientPrototype.queryBuilder as Callable;
  patch(clientPrototype, "queryBuilder", function(this: unknown, ...args: unknown[]) {
    const builder = createBuilder.apply(this, args) as Record<string, any>;
    const permit = persistence.getStore();
    const origin = callers().find((frame) => {
      const file = normalize(frame.getFileName());
      return !!file && file !== normalize(__filename) && !file.includes("/knex/lib/") && file !== `${databaseRoot}/dist/index.js`;
    });
    const originFile = normalize(origin?.getFileName() ?? null);
    const framework = originFile === `${databaseRoot}/dist/query/query-builder.js`
      || originFile.startsWith(`${databaseRoot}/dist/entity-manager/`);
    if (framework && permit?.active) builders.set(builder, permit);
    return builder;
  });
  // The pinned relation orderer uses raw SQL for ROW_NUMBER updates that Knex cannot express.
  // Capture only those two actual callables; arbitrary raw SQL never receives a query identity.
  const rawPrototype = require(path.join(knexRoot, "lib/raw.js")).prototype as Record<string, any>;
  const compileRaw = rawPrototype.toSQL as Callable;
  patch(rawPrototype, "toSQL", function(this: object, ...args: unknown[]) {
    const sql = compileRaw.apply(this, args);
    const permit = builders.get(this);
    if (permit?.active && typeof sql.__knexQueryUid === "string") compiledQueries.set(sql.__knexQueryUid, permit);
    return sql;
  });
  const createRaw = clientPrototype.raw as Callable;
  patch(clientPrototype, "raw", function(this: unknown, ...args: unknown[]) {
    const raw = createRaw.apply(this, args);
    const permit = persistence.getStore();
    const origin = callers().find((frame) => {
      const file = normalize(frame.getFileName());
      return !!file && file !== normalize(__filename) && !file.includes("/knex/lib/");
    });
    if (permit?.active && normalize(origin?.getFileName() ?? null) === `${databaseRoot}/dist/entity-manager/regular-relations.js`
      && ["updateOrderColumn", "updateInverseOrderColumn"].includes(origin?.getFunctionName() ?? "")) builders.set(raw, permit);
    return raw;
  });
  const beforeQuery = (event: { sql: string; bindings?: unknown[]; __knexQueryUid?: string }, record = true) => {
    const sql = event.sql;
    const match = /^\s*(?:insert\s+into|update|delete\s+from|replace\s+into|truncate(?:\s+table)?)\s+([`"\w.]+)/i.exec(sql);
    if (!match) return;
    const table = match[1].replace(/[`\"]/g, "").split(".").pop()!;
    if (!protectedTables.has(table)) return;
    const permit = persistence.getStore();
    const compiled = event.__knexQueryUid ? compiledQueries.get(event.__knexQueryUid) : undefined;
    if (!permit?.active || compiled !== permit || !permit.tables.has(table)) return fail();
    const fields = permit.fields;
    if (table === strapi.db.metadata.get(permit.uid).tableName) {
      // Bind to the validated target row and scalar fields, not merely its table.
      if (permit.row !== null && !(event.bindings ?? []).includes(permit.row)) return fail();
      const inserted = /^\s*insert\s+into\s+[`"\w.]+\s*\(([^)]+)\)/i.exec(sql)?.[1];
      if (inserted) for (const column of inserted.split(",").map((value) => value.trim().replace(/[`\"]/g, ""))) {
        if (!fields.has(column)) return fail();
      }
      const updated = /\bset\s+(.+?)\s+where\b/i.exec(sql)?.[1];
      if (updated) for (const assignment of updated.split(",")) {
        const column = /^\s*[`"]?(\w+)[`"]?\s*=/.exec(assignment)?.[1];
        if (!column || !fields.has(column)) return fail();
      }
    }
    if (record) ledger.push({ uid: permit.uid, operation: permit.operation, table, row: permit.row, fields: [...fields].sort(), entry: `${permit.operation}Entry` });
  };
  const queryListener = (event: Parameters<typeof beforeQuery>[0]) => beforeQuery(event);
  connection.on("query", queryListener);
  restorers.push(() => connection.removeListener("query", queryListener));
  const runner = clientPrototype.runner as Callable;
  patch(clientPrototype, "runner", function(this: unknown, builder: { toSQL(): unknown }) {
    // Reject forbidden raw/builder writes before acquiring a connection. A raw root
    // query inside SQLite's occupied transaction would otherwise wait for that connection.
    const compiled = builder.toSQL();
    for (const query of Array.isArray(compiled) ? compiled : [compiled]) if (query && typeof query.sql === "string") beforeQuery(query, false);
    return runner.call(this, builder);
  });
  return instrument;
}

export function assertIdamboxWriteDiscipline(instrument: WriteDiscipline): void {
  assert.ok(instrument.ledger.some((entry) => entry.uid === USER && entry.operation === "create"), "Missing actual user INSERT evidence");
  assert.ok(instrument.ledger.some((entry) => entry.uid === USER && entry.operation === "update" && entry.row !== null), "Missing target-bound UPDATE evidence");
  assert.ok(instrument.ledger.every((entry) => entry.table && entry.entry && Array.isArray(entry.fields)), "Incomplete persistence ledger");
}
