import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/*
 * Phase 16 D-16 (T-16-11): no persisted Risk is ever deleted, by any route or code path, and its history is
 * append-only. This static guard reads every TypeScript file under apps/backend/src and fails, naming the file and the
 * finding, when any of these reaches a Risk or a Risk history row:
 *
 * - a `.delete(` or `.deleteMany(` on a Document Service or query repository bound to `api::csrm-risk.csrm-risk` or
 *   `api::csrm-risk-history-event.csrm-risk-history-event` (directly, through a constant holding the UID, through an
 *   object property holding it, or through a variable or factory bound to `documents(<uid>)` / `query(<uid>)`);
 * - a call whose first argument is either UID and whose method is `delete` or `deleteMany` (`entityService.delete`);
 * - the same forms with `update` or `updateMany` on the history UID, through `documents(`, `query(` or `service(`, and
 *   raw SQL `UPDATE csrm_risk_history_events` or a query builder `update()` on that table (BE1-05: append-only);
 * - raw SQL `DELETE FROM csrm_risks` or `csrm_risk_history_events`, or a query builder `del()` on either table;
 * - a route object with `method: "DELETE"` whose path starts `/v1/risks`;
 * - a core router for either UID that does not limit itself with `only: [...]`, or whose `only` lists `delete`.
 *
 * A synthetic snippet per pattern proves the scanner flags it, and clean snippets prove it does not flag the
 * control implementation removal (D-20, a hard delete that stays) or a Map's `.delete(`.
 */

const RISK_UID = "api::csrm-risk.csrm-risk";
const HISTORY_UID = "api::csrm-risk-history-event.csrm-risk-history-event";
const GUARDED_UIDS = [RISK_UID, HISTORY_UID] as const;

// Emitted to `.tmp/tests-dist/tests`, so three parents up is the Strapi application.
const srcDir = path.resolve(__dirname, "..", "..", "..", "src");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const quotedUid = (uids: readonly string[]) => `["'\`](?:${uids.map(escape).join("|")})["'\`]`;
const IDENTIFIER = "[A-Za-z_$][\\w$]*";
const DELETE_METHOD = "(?:delete|deleteMany)";
// BE1-05: the history is append-only, so an update of a history row is guarded too (a Risk's own update is not).
const UPDATE_METHOD = "(?:update|updateMany)";

/* The expression forms that name one of `uids` in one file: the literal, a constant holding it, a property holding it. */
function uidExpression(text: string, uids: readonly string[] = GUARDED_UIDS): string {
  const QUOTED_UID = quotedUid(uids);
  const constants = new Set<string>();
  for (const match of text.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER})\\s*(?::[^=;]+)?=\\s*${QUOTED_UID}`, "g"))) constants.add(match[1]);
  const properties = new Set<string>();
  for (const match of text.matchAll(new RegExp(`(${IDENTIFIER})\\s*:\\s*${QUOTED_UID}`, "g"))) properties.add(match[1]);
  const forms = [QUOTED_UID];
  if (constants.size) forms.push(`\\b(?:${[...constants].map(escape).join("|")})\\b(?!\\s*:)`);
  if (properties.size) forms.push(`[\\w$.\\]\\[]*\\.(?:${[...properties].map(escape).join("|")})\\b`);
  return `(?:${forms.join("|")})`;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/* The `{ … }` object literal that encloses `index`, found by brace matching (route definitions nest `config`). */
function enclosingObject(text: string, index: number): string | null {
  let depth = 0;
  let start = -1;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const char = text[cursor];
    if (char === "}") depth += 1;
    else if (char === "{") {
      if (depth === 0) { start = cursor; break; }
      depth -= 1;
    }
  }
  if (start < 0) return null;
  depth = 0;
  for (let cursor = start; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, cursor + 1);
    }
  }
  return null;
}

/**
 * The `method` calls (named `verb` in a finding) that reach one of `uids` through the Document Service, a query
 * repository or a service accessor: chained on the accessor, through a variable or factory bound to it, destructured
 * from it, or called with the UID as first argument (`entityService.delete(uid, id)` and the like).
 */
function accessorFindings(text: string, uids: readonly string[], method: string, verb: string): string[] {
  const findings: string[] = [];
  const uid = uidExpression(text, uids);
  const accessor = `\\b(?:documents|query|service)\\s*\\(\\s*${uid}`;

  // A call chained on the accessor itself, within its statement.
  for (const match of text.matchAll(new RegExp(accessor, "g"))) {
    const end = text.indexOf(";", match.index);
    const statement = text.slice(match.index, end < 0 ? match.index + 400 : Math.min(end, match.index + 400));
    if (new RegExp(`\\.\\s*${method}\\s*\\(`).test(statement)) findings.push(`line ${lineOf(text, match.index)}: ${verb} chained on ${match[0]}`);
  }

  // A call reached through a variable or factory bound to the accessor.
  const bound = new Set<string>();
  for (const match of text.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER})\\s*(?::[^=;]+)?=\\s*([^;]*)`, "g"))) {
    if (new RegExp(accessor).test(match[2])) bound.add(match[1]);
  }
  for (const name of bound) {
    const use = new RegExp(`\\b${escape(name)}\\b(?:\\s*\\([^()]*\\))?(?:\\s+as\\s+[\\w$<>\\[\\]., |"']+?)?\\s*\\)?\\s*\\.\\s*${method}\\s*\\(`, "g");
    for (const match of text.matchAll(use)) findings.push(`line ${lineOf(text, match.index)}: ${verb} through ${name}`);
  }
  for (const match of text.matchAll(new RegExp(`\\{[^{}]*\\b${method}\\b[^{}]*\\}\\s*=\\s*[^;]*${accessor}`, "g"))) {
    findings.push(`line ${lineOf(text, match.index)}: ${verb} destructured from a guarded accessor`);
  }

  // A call whose first argument is the UID.
  for (const match of text.matchAll(new RegExp(`\\.\\s*${method}\\s*\\(\\s*${uid}\\s*,`, "g"))) {
    findings.push(`line ${lineOf(text, match.index)}: ${verb} called with a guarded UID`);
  }
  return findings;
}

/** Every finding in one source text, as `line N: description`. */
export function scanForRiskDeletes(text: string): string[] {
  const findings: string[] = [
    ...accessorFindings(text, GUARDED_UIDS, DELETE_METHOD, "delete"),
    ...accessorFindings(text, [HISTORY_UID], UPDATE_METHOD, "history update"),
  ];
  const uid = uidExpression(text);

  // Raw SQL and query-builder updates of a history row.
  for (const match of text.matchAll(/update\s+["`]?csrm_risk_history_events\b/gi)) {
    findings.push(`line ${lineOf(text, match.index)}: raw SQL ${match[0]}`);
  }
  for (const match of text.matchAll(/\(\s*["'`]csrm_risk_history_events["'`]\s*\)[^;]*\.\s*update\s*\(/g)) {
    findings.push(`line ${lineOf(text, match.index)}: query-builder update on the history table`);
  }

  // Raw SQL and query-builder deletes on the two tables.
  for (const match of text.matchAll(/delete\s+from\s+["`]?csrm_risk(s|_history_events)\b/gi)) {
    findings.push(`line ${lineOf(text, match.index)}: raw SQL ${match[0]}`);
  }
  for (const match of text.matchAll(/\(\s*["'`]csrm_risk(?:s|_history_events)["'`]\s*\)[^;]*\.\s*(?:del|delete)\s*\(/g)) {
    findings.push(`line ${lineOf(text, match.index)}: query-builder delete on a guarded table`);
  }

  // A DELETE route under /v1/risks.
  for (const match of text.matchAll(/method\s*:\s*["'`]DELETE["'`]/g)) {
    const route = enclosingObject(text, match.index);
    if (route && /path\s*:\s*["'`]\/v1\/risks(?:[/?"'`]|$)/.test(route)) findings.push(`line ${lineOf(text, match.index)}: DELETE route under /v1/risks`);
  }

  // A core router for either UID that is not limited, or that serves delete.
  for (const match of text.matchAll(new RegExp(`createCoreRouter\\s*\\(\\s*${uid}`, "g"))) {
    const call = text.slice(match.index, match.index + 400);
    const only = /only\s*:\s*\[([^\]]*)\]/.exec(call);
    if (!only || /["'`]delete["'`]/.test(only[1])) findings.push(`line ${lineOf(text, match.index)}: core router serves delete`);
  }
  return findings;
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
  }
  return files.sort();
}

test("no Strapi source deletes a Risk or a Risk history row, and no DELETE route serves /v1/risks (D-16)", () => {
  const files = sourceFiles(srcDir);
  const relative = files.map((file) => path.relative(srcDir, file).split(path.sep).join("/"));
  assert.ok(files.length > 100, `TOO_FEW_SOURCE_FILES_SCANNED_${files.length}`);
  for (const expected of [
    "api/csrm-risk/services/risk-workflow.ts",
    "api/csrm-risk/routes/csrm-risk.ts",
    "api/csrm-risk-history-event/services/risk-history.ts",
    "api/csrm-risk-history-event/routes/csrm-risk-history-event.ts",
    "api/csrm-control-implementation/services/control-implementation-workflow.ts",
  ]) assert.ok(relative.includes(expected), `NOT_SCANNED_${expected}`);
  const findings = files.flatMap((file, index) => scanForRiskDeletes(readFileSync(file, "utf8")).map((finding) => `${relative[index]} ${finding}`));
  assert.deepEqual(findings, [], `RISK_OR_HISTORY_DELETE_FOUND:\n${findings.join("\n")}`);
});

test("the scanner flags every delete pattern it guards against (synthetic positives)", () => {
  const positives: Array<[string, string]> = [
    ["ALIASED_DOCUMENTS_DELETE", `const RISK = "${RISK_UID}";\nawait strapi.documents(RISK).delete({ documentId });`],
    ["CAST_ALIAS_DOCUMENTS_DELETE", `const RISK_UID = '${RISK_UID}' as const;\nawait (strapi.documents(RISK_UID) as Service).delete({ documentId });`],
    ["BOUND_VARIABLE_DELETE", `const RISK_UID = "${RISK_UID}";\nconst risks = strapi.documents(RISK_UID);\nawait risks.delete({ documentId });`],
    ["BOUND_FACTORY_DELETE", `const UID = "${HISTORY_UID}";\nconst rows = (s: unknown) => (s as S).documents(UID) as Rows;\nawait rows(strapi).delete({ documentId });`],
    ["HISTORY_QUERY_DELETE_MANY", `await strapi.db.query("${HISTORY_UID}").deleteMany({ where: {} });`],
    ["PROPERTY_UID_DELETE", `const UIDS = { risk: "${RISK_UID}" };\nawait strapi.documents(UIDS.risk).delete({ documentId });`],
    ["DESTRUCTURED_DELETE", `const { delete: remove } = strapi.documents("${RISK_UID}");`],
    ["ENTITY_SERVICE_DELETE", `await strapi.entityService.delete("${RISK_UID}", id);`],
    ["RAW_SQL_RISKS", "await knex.raw(\"DELETE FROM csrm_risks WHERE id = ?\", [id]);"],
    ["RAW_SQL_HISTORY", "await knex.raw('delete from \"csrm_risk_history_events\"');"],
    ["QUERY_BUILDER_DEL", "await connection(\"csrm_risks\").where({ id }).del();"],
    ["DELETE_ROUTE", `export default { routes: [{ method: "DELETE", path: "/v1/risks/:riskId", handler: "x.y", config: { policies: [] } }] };`],
    ["CORE_ROUTER_UNLIMITED", `export default factories.createCoreRouter("${RISK_UID}");`],
    ["CORE_ROUTER_WITH_DELETE", `export default factories.createCoreRouter('${HISTORY_UID}', { only: ["find", "delete"] });`],
    // BE1-05: the service accessor, and any update of a history row (the history is append-only, D-18).
    ["SERVICE_ACCESSOR_DELETE", `await strapi.service("${RISK_UID}").delete({ documentId });`],
    ["HISTORY_DOCUMENTS_UPDATE", `const HISTORY = "${HISTORY_UID}";
await strapi.documents(HISTORY).update({ documentId, data });`],
    ["HISTORY_BOUND_UPDATE", `const rows = strapi.documents("${HISTORY_UID}");
await rows.update({ documentId, data });`],
    ["HISTORY_QUERY_UPDATE_MANY", `await strapi.db.query("${HISTORY_UID}").updateMany({ where: {}, data });`],
    ["HISTORY_SERVICE_UPDATE", `await strapi.service("${HISTORY_UID}").update({ documentId, data });`],
    ["HISTORY_ENTITY_SERVICE_UPDATE", `await strapi.entityService.update("${HISTORY_UID}", id, { data });`],
    ["RAW_SQL_HISTORY_UPDATE", "await knex.raw('UPDATE csrm_risk_history_events SET reason = ?', [reason]);"],
    ["QUERY_BUILDER_HISTORY_UPDATE", "await connection(\"csrm_risk_history_events\").where({ id }).update({ reason });"],
  ];
  for (const [label, snippet] of positives) {
    assert.ok(scanForRiskDeletes(snippet).length > 0, `SCANNER_MISSED_${label}`);
  }
});

test("the scanner does not flag the control implementation removal, a Map delete, a read, or a limited router", () => {
  const negatives: Array<[string, string]> = [
    ["CONTROL_IMPLEMENTATION_DELETE", `const IMPLEMENTATION_UID = "api::csrm-control-implementation.csrm-control-implementation";\nawait strapi.documents(IMPLEMENTATION_UID).delete({ documentId });`],
    ["MAP_DELETE", `const RISK_UID = "${RISK_UID}";\nconst queues = new Map();\nqueues.delete(RISK_UID);`],
    ["RISK_READ", `const risks = strapi.documents("${RISK_UID}");\nawait risks.findMany({});\nawait risks.update({ documentId, data });`],
    ["LIMITED_ROUTER", `export default factories.createCoreRouter('${HISTORY_UID}', { only: [] });`],
    ["OTHER_DELETE_ROUTE", `export default { routes: [{ method: "DELETE", path: "/v1/control_implementations/:id", handler: "x.y" }] };`],
  ];
  for (const [label, snippet] of negatives) {
    assert.deepEqual(scanForRiskDeletes(snippet), [], `SCANNER_FLAGGED_${label}`);
  }
});
