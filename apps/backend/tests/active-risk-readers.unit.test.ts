import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/*
 * Phase 16 D-13, D-14 (T-16-18, research Pitfall 3): every Strapi reader that lists, counts or rates Risks applies the
 * one active-risk rule (src/csrm/active-risk.ts) through one of its forms, so a withdrawn Risk counts in no figure and
 * reaches no default list. This static guard reads every TypeScript file under apps/backend/src, with its comments
 * blanked, and finds the reader sites:
 *
 * - SQL: the `csrm_risks` table (optionally aliased) as a call's first argument (`from(`, `join(`, `leftJoin(`, a knex
 *   `connection(`), or after FROM or JOIN in raw SQL;
 * - Document Service and query repository: a `.findMany(`, `.findFirst(` or `.count(` on `documents(<risk uid>)` or
 *   `query(<risk uid>)`, chained on the accessor or reached through a variable or factory bound to it, with the UID
 *   resolved per file through a constant or an object property holding it (as risk-no-delete.unit.test.ts does).
 *
 * A site passes when one of the rule's names appears within the next 25 lines, or when its file is in EXEMPT_READERS
 * with a written reason and exactly the number of unruled sites the reason covers. Any other site fails the suite,
 * naming the file and the line, so a later phase's new reader cannot skip the rule (D-14). An exemption whose file is
 * gone, or whose file no longer holds its unruled sites, fails too: no stale exemption survives.
 */

const RISK_UID = "api::csrm-risk.csrm-risk";
/** The rule's forms (active-risk.ts) and the SQL helpers beside the register's disclosure predicate (risk-register.ts). */
export const RULE_NAMES = [
  "activeRiskSql",
  "applyActiveRisk",
  "applyWithdrawnRisk",
  "ACTIVE_RISK_FILTER",
  "WITHDRAWN_RISK_FILTER",
  "activeRisks",
  "isActiveRisk",
] as const;
const RULE_WINDOW_LINES = 25;

/**
 * The readers that must see withdrawn Risks by design, each with why and the exact number of its unruled sites (0 for
 * a file that reads no Risk today but whose future readers must count withdrawn Risks, so adding one there is a
 * reviewed change of this entry). Paths are relative to apps/backend/src.
 */
export const EXEMPT_READERS: Readonly<Record<string, { reason: string; sites: number }>> = {
  "api/csrm-risk/services/risk-number.ts": {
    reason: "Risk numbers are never reused (D-06): any allocation or uniqueness read here must count withdrawn Risks too, so it never applies the active-risk rule.",
    sites: 0,
  },
  "api/csrm-risk/services/risk-curation.ts": {
    reason: "Withdrawal and reinstatement load the Risks the analyst named, by documentId, with their current withdrawal fact (D-05, D-10): a reinstatement reads withdrawn Risks by design.",
    sites: 1,
  },
  "api/csrm-risk/services/risk-workflow.ts": {
    reason: "loadAnalystAssessmentRiskDetails lists every Risk of the analyst's assessment detail, withdrawn ones marked with their withdrawal block (D-08); release readiness drops them in memory through activeRisks (16-06).",
    sites: 1,
  },
  "api/csrm-risk/services/risk-register.ts": {
    reason: "hydrate reads exactly the documentIds the ruled register query already chose, in either branch; filtering it again would drop the rows of the explicit Withdrawn list (D-08).",
    sites: 1,
  },
  "bootstrap/seed-risk-register-workflow.ts": {
    reason: "The development seed reconciles its fixture Risk by its stable Risk number, withdrawn or not, so a rerun never creates a second Risk under the same number.",
    sites: 1,
  },
};

/** Why an exemption is stale: its file is gone, it has no reason, or its file no longer holds exactly its sites. */
export function staleExemptions(
  exemptions: Readonly<Record<string, { reason: string; sites: number }>>,
  unruledSites: (file: string) => number | null,
): string[] {
  const findings: string[] = [];
  for (const [file, exemption] of Object.entries(exemptions)) {
    const count = unruledSites(file);
    if (count === null) findings.push(`${file}: the file is gone`);
    else if (count !== exemption.sites) findings.push(`${file}: holds ${count} unruled sites, the exemption covers ${exemption.sites}`);
    if (exemption.reason.trim().length < 40) findings.push(`${file}: no written reason`);
    if (!Number.isSafeInteger(exemption.sites) || exemption.sites < 0) findings.push(`${file}: an invalid site count`);
  }
  return findings;
}

// Emitted to `.tmp/tests-dist/tests`, so three parents up is the Strapi application.
const srcDir = path.resolve(__dirname, "..", "..", "..", "src");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const QUOTED_UID = `["'\`]${escape(RISK_UID)}["'\`]`;
const IDENTIFIER = "[A-Za-z_$][\\w$]*";
const READ_METHOD = "(?:findMany|findFirst|count)";
const RULE = new RegExp(`\\b(?:${RULE_NAMES.join("|")})\\b`);

/**
 * The source with every comment replaced by spaces (newlines kept), so line numbers hold and neither a commented-out
 * reader nor a rule name in a comment counts. Strings, including template literals, are kept as they are.
 */
export function blankComments(text: string): string {
  let result = "";
  let index = 0;
  let quote: string | null = null;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (quote) {
      result += char;
      if (char === "\\") { result += next ?? ""; index += 2; continue; }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") { result += " "; index += 1; }
      continue;
    }
    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end < 0 ? text.length : end + 2;
      result += text.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") quote = char;
    result += char;
    index += 1;
  }
  return result;
}

/* The expression forms that name the Risk UID in one file: the literal, a constant holding it, a property holding it. */
function uidExpression(text: string): string {
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

export type ReaderSite = { line: number; kind: "sql" | "document"; source: string; ruled: boolean };

/** Every reader site of one source text, in line order, each with whether the rule follows it within the window. */
export function findRiskReaderSites(original: string): ReaderSite[] {
  const text = blankComments(original);
  const lines = text.split("\n");
  const sites = new Map<number, ReaderSite["kind"]>();
  const add = (index: number, kind: ReaderSite["kind"]) => {
    const line = lineOf(text, index);
    if (!sites.has(line)) sites.set(line, kind);
  };

  // SQL: the table as a call's first argument, and raw FROM or JOIN.
  for (const match of text.matchAll(/\(\s*["'`]csrm_risks(?:\s+as\s+\w+)?["'`]/gi)) add(match.index, "sql");
  for (const match of text.matchAll(/\b(?:from|join)\s+["`]?csrm_risks\b/gi)) add(match.index, "sql");

  // Document Service and query repository reads, chained on the accessor within its statement.
  const uid = uidExpression(text);
  // `documents(uid)`, `query(uid)`, `documentsFor(uid)`, `service(strapi, uid)`: an optional leading argument, then the UID.
  const accessor = `\\b(?:documents|query|service)\\w*\\s*\\(\\s*(?:[\\w$.]+\\s*,\\s*)?${uid}`;
  for (const match of text.matchAll(new RegExp(accessor, "g"))) {
    const end = text.indexOf(";", match.index);
    const statement = text.slice(match.index, end < 0 ? match.index + 400 : Math.min(end, match.index + 400));
    const read = new RegExp(`\\.\\s*${READ_METHOD}\\s*\\(`).exec(statement);
    if (read) add(match.index + read.index, "document");
  }
  // ...and reached through a variable or factory bound to the accessor.
  const bound = new Set<string>();
  for (const match of text.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER})\\s*(?::[^=;]+)?=\\s*([^;]*)`, "g"))) {
    if (new RegExp(accessor).test(match[2])) bound.add(match[1]);
  }
  for (const name of bound) {
    const use = new RegExp(`\\b${escape(name)}\\b(?:\\s*\\([^()]*\\))?(?:\\s+as\\s+[\\w$<>\\[\\]., |"']+?)?\\s*\\)?\\s*\\??\\.\\s*${READ_METHOD}\\s*\\??\\.?\\s*\\(`, "g");
    for (const match of text.matchAll(use)) add(match.index, "document");
  }

  return [...sites.entries()].sort(([left], [right]) => left - right).map(([line, kind]) => ({
    line,
    kind,
    source: original.split("\n")[line - 1]?.trim() ?? "",
    ruled: RULE.test(lines.slice(line - 1, line - 1 + RULE_WINDOW_LINES).join("\n")),
  }));
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

function scanSource(): Array<{ file: string; sites: ReaderSite[] }> {
  return sourceFiles(srcDir).map((file) => ({
    file: path.relative(srcDir, file).split(path.sep).join("/"),
    sites: findRiskReaderSites(readFileSync(file, "utf8")),
  }));
}

test("every Strapi reader of Risks applies the active-risk rule or is an exempt reader with a reason (D-13, D-14)", () => {
  const scanned = scanSource();
  assert.ok(scanned.length > 100, `TOO_FEW_SOURCE_FILES_SCANNED_${scanned.length}`);
  const readers = scanned.filter(({ sites }) => sites.length > 0).map(({ file }) => file);
  for (const expected of [
    "api/csrm-risk/services/risk-register.ts",
    "api/csrm-analyst-insight/services/dashboard-summary.ts",
    "api/csrm-analyst-insight/services/alert-repository.ts",
    "api/csrm-analyst-insight/services/report-repository.ts",
    "api/csrm-risk/services/risk-workflow.ts",
  ]) assert.ok(readers.includes(expected), `READER_NOT_FOUND_${expected}`);

  const unruled = scanned.flatMap(({ file, sites }) => {
    const open = sites.filter((site) => !site.ruled);
    if (open.length === 0) return [];
    const exemption = EXEMPT_READERS[file];
    if (exemption && exemption.sites === open.length) return [];
    return open.map((site) => `${file}:${site.line} (${site.kind}) ${site.source}`);
  });
  assert.deepEqual(unruled, [], `RISK_READER_WITHOUT_THE_ACTIVE_RISK_RULE:\n${unruled.join("\n")}`);
});

function unruledSitesIn(scanned: Array<{ file: string; sites: ReaderSite[] }>): (file: string) => number | null {
  const counts = new Map(scanned.map(({ file, sites }) => [file, sites.filter((site) => !site.ruled).length]));
  return (file) => {
    if (!existsSync(path.join(srcDir, ...file.split("/")))) return null;
    return counts.get(file) ?? 0;
  };
}

test("no stale exemption: each exempt reader exists, gives a reason and still holds exactly its unruled sites", () => {
  assert.ok(EXEMPT_READERS["api/csrm-risk/services/risk-number.ts"], "RISK_NUMBER_EXEMPTION_MISSING");
  const findings = staleExemptions(EXEMPT_READERS, unruledSitesIn(scanSource()));
  assert.deepEqual(findings, [], `STALE_EXEMPTION:\n${findings.join("\n")}`);
});

test("the guard flags a reader without the rule and passes the same reader with it (synthetic sources)", () => {
  const flagged = (source: string) => findRiskReaderSites(source).filter((site) => !site.ruled).length;
  const sqlReader = "const rows = await connection.queryBuilder().from(\"csrm_risks as r\")\n  .whereRaw(\"r.closure_date IS NULL\")\n  .select(\"r.id\");";
  assert.equal(flagged(sqlReader), 1, "GUARD_MISSED_AN_SQL_READER");
  assert.equal(flagged(sqlReader.replace(".select(", ".whereRaw(activeRiskSql(\"r\"))\n  .select(")), 0, "GUARD_FLAGGED_A_RULED_SQL_READER");
  assert.equal(flagged(`${sqlReader}${"\n".repeat(RULE_WINDOW_LINES)}applyActiveRisk(query);`), 1, "GUARD_ACCEPTED_A_RULE_PAST_THE_WINDOW");
  assert.equal(flagged("const query = applyDisclosableParent(connection(\"csrm_risks as r\"));"), 1, "GUARD_MISSED_A_CONNECTION_READER");
  assert.equal(flagged("await knex.raw(\"SELECT COUNT(*) FROM csrm_risks AS r WHERE r.closure_date IS NULL\");"), 1, "GUARD_MISSED_RAW_SQL");
  assert.equal(flagged("// from(\"csrm_risks as r\") in a comment\nconst text = \"see csrm_risks_assessment_lnk\";"), 0, "GUARD_FLAGGED_A_COMMENT_OR_A_LINK_TABLE");
  assert.equal(flagged("const query = connection(\"csrm_risks as r\"); // applyActiveRisk"), 1, "GUARD_ACCEPTED_A_RULE_IN_A_COMMENT");

  const documentReader = `const RISK_UID = "${RISK_UID}";\nconst risks = await strapi.documents(RISK_UID).findMany({ filters: { assessment: { documentId } } });`;
  assert.equal(flagged(documentReader), 1, "GUARD_MISSED_A_DOCUMENT_READER");
  assert.equal(flagged(documentReader.replace("filters: {", "filters: { ...ACTIVE_RISK_FILTER,")), 0, "GUARD_FLAGGED_A_RULED_DOCUMENT_READER");
  for (const [label, source] of [
    ["BOUND_VARIABLE", `const risks = strapi.documents("${RISK_UID}");\nconst total = await risks.count({ filters: {} });`],
    ["BOUND_FACTORY", `const UID = "${RISK_UID}";\nconst risks = (s: unknown) => (s as S).documents(UID) as Risks;\nawait risks(strapi).findFirst({});`],
    ["PROPERTY_UID", `const UIDS = { risk: "${RISK_UID}" };\nawait strapi.db.query(UIDS.risk).findMany({ where: {} });`],
    ["DOCUMENTS_FOR", `const documents = documentsFor("${RISK_UID}");\nawait documents.findMany({ filters: {} });`],
  ] as const) {
    assert.equal(flagged(source), 1, `GUARD_MISSED_${label}`);
  }
  for (const [label, source] of [
    ["OTHER_UID", "await strapi.documents(\"api::csrm-control.csrm-control\").findMany({});"],
    ["RISK_UPDATE", `await strapi.documents("${RISK_UID}").update({ documentId, data });`],
    ["RISK_FIND_ONE", `await strapi.documents("${RISK_UID}").findOne({ documentId });`],
  ] as const) {
    assert.equal(flagged(source), 0, `GUARD_FLAGGED_${label}`);
  }
});

test("the guard flags a stale exemption: a file that is gone, a changed site count or a missing reason", () => {
  const reason = "A reviewed reason long enough to explain why this reader sees withdrawn Risks.";
  const unruled = unruledSitesIn(scanSource());
  assert.equal(unruled("api/csrm-risk/services/no-such-reader.ts"), null, "STALE_EXEMPTION_PROBE_EXISTS");
  assert.deepEqual(
    staleExemptions({ "api/csrm-risk/services/no-such-reader.ts": { reason, sites: 1 } }, unruled),
    ["api/csrm-risk/services/no-such-reader.ts: the file is gone"],
    "GUARD_KEPT_AN_EXEMPTION_FOR_A_MISSING_FILE",
  );
  // dashboard-summary.ts applies the rule at every site, so an exemption for it covers nothing.
  assert.deepEqual(
    staleExemptions({ "api/csrm-analyst-insight/services/dashboard-summary.ts": { reason, sites: 1 } }, unruled),
    ["api/csrm-analyst-insight/services/dashboard-summary.ts: holds 0 unruled sites, the exemption covers 1"],
    "GUARD_KEPT_AN_EXEMPTION_WITH_NO_UNRULED_SITE",
  );
  assert.deepEqual(
    staleExemptions({ "api/csrm-risk/services/risk-curation.ts": { reason: "because", sites: 1 } }, unruled),
    ["api/csrm-risk/services/risk-curation.ts: no written reason"],
    "GUARD_KEPT_AN_EXEMPTION_WITHOUT_A_REASON",
  );
});
