import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { EXPORT_VOCABULARY } from "../src/csrm/exports/export-vocabulary";

/*
 * Every `pattern` the specification publishes is a valid ECMA-262 regular expression with the `u` flag, which is how
 * JSON Schema validators such as Ajv compile it (BE1-03, Phase 19 code review: two export `columns` patterns carried
 * `{0,63 }`, which throws "Incomplete quantifier" with `u` and rejects every value without it). Each export's
 * `columns` pattern must also accept the column keys the export vocabulary defines.
 */

// Tests compile into `.tmp/tests-dist/tests`; five parents resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8")) as {
  paths?: Record<string, Record<string, { parameters?: { name?: string; in?: string; schema?: { pattern?: unknown } }[] }>>;
};

function patterns(value: unknown, at: string, found: { at: string; pattern: string }[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => patterns(item, `${at}[${index}]`, found));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "pattern" && typeof child === "string") found.push({ at, pattern: child });
    else patterns(child, `${at}.${key}`, found);
  }
}

test("every pattern in specification.json compiles with the u flag (BE1-03)", () => {
  const found: { at: string; pattern: string }[] = [];
  patterns(specification, "$", found);
  assert.ok(found.length > 0, "the specification publishes patterns");
  const broken = found.filter(({ pattern }) => {
    try {
      new RegExp(pattern, "u");
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(broken, []);
});

test("every export's columns pattern accepts the column keys of every export view (BE1-03)", () => {
  const exports = Object.entries(specification.paths ?? {})
    .filter(([route]) => route.endsWith("/export"))
    .flatMap(([route, operations]) => Object.entries(operations).map(([method, operation]) => ({ route, method, operation })))
    .map(({ route, method, operation }) => ({
      at: `${method.toUpperCase()} ${route}`,
      pattern: (operation.parameters ?? []).find((parameter) => parameter.in === "query" && parameter.name === "columns")?.schema?.pattern,
    }))
    .filter((entry): entry is { at: string; pattern: string } => typeof entry.pattern === "string");
  assert.ok(exports.length >= 12, `the list exports publish a columns pattern (found ${exports.length})`);
  const keyLists = Object.values(EXPORT_VOCABULARY.views).map((view) => view.columns.slice(0, 40).map((column) => column.key));
  for (const { at, pattern } of exports) {
    const expression = new RegExp(pattern, "u");
    for (const keys of keyLists) {
      assert.match(keys.join(","), expression, `${at} accepts ${keys.join(",")}`);
      assert.match(keys[0], expression, `${at} accepts ${keys[0]}`);
    }
  }
});
