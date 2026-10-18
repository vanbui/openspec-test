import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/*
 * T-19-33 as a persisted test (BE2-11, Phase 19 code review): one module decides who may read a released assessment
 * (src/api/csrm-assessment/services/released-assessment-read.ts), so Phases 17 and 17.1 widen it in one place. No other
 * file under the assessment API or the export modules may compare a request's requestor with the viewer, as a
 * Document Service filter or in memory; each must call the module instead. Comments are blanked before the scan.
 */

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const backendDir = path.resolve(__dirname, "..", "..", "..");
const SCANNED_DIRECTORIES = ["src/api/csrm-assessment", "src/csrm/exports"];
const THE_ONE_MODULE = "src/api/csrm-assessment/services/released-assessment-read.ts";

/** A requestor-ownership predicate: the owner filter, or an in-memory comparison of the requestor's documentId. */
const OWNERSHIP_PREDICATES: readonly RegExp[] = [
  /requestor\s*:\s*\{\s*documentId\s*:\s*\{\s*\$eq\b/u,
  /requestor\??\.documentId\s*[!=]==/u,
  /[!=]==\s*[\w$.?]*requestor\??\.documentId\b/u,
];

function typeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return typeScriptFiles(full);
    return name.endsWith(".ts") ? [full] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " ")).replace(/(^|[^:"'`])\/\/.*$/gmu, "$1");
}

function ownershipLines(file: string): string[] {
  const lines = withoutComments(readFileSync(file, "utf8")).split("\n");
  return lines.flatMap((line, index) => (OWNERSHIP_PREDICATES.some((predicate) => predicate.test(line)) ? [`${index + 1}: ${line.trim()}`] : []));
}

test("the one released-read module holds the requestor-ownership rule, and the scan finds it there (BE2-11)", () => {
  const found = ownershipLines(path.join(backendDir, THE_ONE_MODULE));
  assert.ok(found.length >= 2, `the scan finds the module's filter and its in-memory twin (found ${found.length})`);
});

test("no other assessment or export file compares a requestor with the viewer (T-19-33, BE2-11)", () => {
  const offenders: string[] = [];
  for (const directory of SCANNED_DIRECTORIES) {
    for (const file of typeScriptFiles(path.join(backendDir, directory))) {
      const relative = path.relative(backendDir, file).split(path.sep).join("/");
      if (relative === THE_ONE_MODULE) continue;
      for (const line of ownershipLines(file)) offenders.push(`${relative}:${line}`);
    }
  }
  assert.deepEqual(offenders, [], `requestor-ownership predicates outside ${THE_ONE_MODULE}`);
});
