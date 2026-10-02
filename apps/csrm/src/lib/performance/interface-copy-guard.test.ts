import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * The interface copy guard (10-CONTEXT D-38, UI-SPEC §17.2). Phase 10 copy drops back-end and internal terms:
 * a person is told what they can do, never how the system enforces it. This guard reads the user-visible
 * strings of each listed file (JSX text, string literals, no-substitution template literals and template
 * literal text) and fails, naming the file, line and term, if one contains an internal term. Comments,
 * identifiers, import and export specifiers, the left operand of `in`, object property names, element-access
 * keys, literal types and directives are not copy, so they are not read.
 *
 * Excluded, with the phase that cleans them (UI-SPEC §17.2):
 * - the analyst dashboard and reports (`features/analyst-dashboard/**`, `features/reports/**`): Phase 11, DASH-03;
 * - the Risk Register list description (`features/risks/risk-register.tsx`): Phase 11, UX-09;
 * - the development-only role switcher (`components/shell/role-switcher.tsx`): not shipped to production;
 * - service modules' type and client names (`createStrapiClient`, `StrapiClient`): identifiers, not copy.
 *
 * The list holds only files that are clean today. Each later Phase 10 plan adds the files it cleans, in order.
 */

const webRoot = process.cwd();

/** UI-SPEC §17.2, matched case-insensitively. */
export const internalTerms = [
  'Strapi',
  'server-owned',
  'server-directed',
  'server-authorised',
  'release fact',
  'mutation control',
  'natural key',
  'natural-key',
  'Invalid Administration CSV',
  'non-editable',
  'contextual',
  'effective CSRM capabilities',
  'record scope',
  'Navigation visibility',
  'authoritative',
  'answer batch',
  'least-privilege',
  'Server validation',
] as const;

/** Paths relative to apps/csrm, sorted and unique. */
export const guardedFiles = [
  'src/components/csrm/confirm-dialog.tsx',
  'src/components/csrm/local-time.tsx',
  'src/components/csrm/navigation-guard.tsx',
  'src/components/csrm/relation-picker.tsx',
  'src/components/csrm/revert-audit-summary.tsx',
  'src/components/csrm/save-status.tsx',
  'src/components/states/states.tsx',
  'src/features/administration/administration-actions.ts',
  'src/features/administration/administration-form.tsx',
  'src/features/administration/administration-workspace.tsx',
  'src/features/administration/applicable-controls.ts',
  'src/features/administration/csv-client-parser.ts',
  'src/features/administration/csv-import-flow.tsx',
  'src/features/assessments/assessment-actions.ts',
  'src/features/assessments/assessment-detail.tsx',
  'src/features/assessments/assessment-draft-job.tsx',
  'src/features/assessments/control-implementation-editor.tsx',
  'src/features/assessments/control-label.ts',
  'src/features/assessments/questionnaire-generation-job.tsx',
  'src/features/assessments/released-assessment.tsx',
  'src/features/assessments/released-risk-details.tsx',
  'src/features/assessments/risk-editor.tsx',
  'src/features/questionnaires/questionnaire-actions.ts',
  'src/features/questionnaires/questionnaire-detail.tsx',
  'src/features/questionnaires/questionnaire-governance.tsx',
  'src/features/questionnaires/questionnaire-introduction.tsx',
  'src/features/questionnaires/questionnaire-placement.ts',
  'src/features/questionnaires/questionnaire-renderer.tsx',
  'src/features/questionnaires/questionnaire-review.tsx',
  'src/features/questionnaires/questionnaire-revision-timeline.tsx',
  'src/features/questionnaires/questionnaire-workflow-rules.ts',
  'src/features/questionnaires/use-answer-autosave.ts',
  'src/features/requests/request-actions.ts',
  'src/features/requests/request-context-details.tsx',
  'src/features/requests/request-domain.ts',
  'src/features/requests/request-form.tsx',
  'src/features/requests/request-hub.tsx',
  'src/features/requests/request-workflow-actions.tsx',
  'src/features/risks/mitigation-control-list.tsx',
  'src/features/risks/risk-detail-editor.tsx',
  'src/lib/api/refusal-copy.ts',
  'src/lib/time/format-instant.ts',
] as const;

type VisibleString = { line: number; text: string };
type Finding = { line: number; term: string; text: string };

/** Whether a string literal sits where it is a name, a key, a type or a directive rather than copy. */
function isNotCopy(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  const parent = node.parent;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return true;
  if (ts.isImportTypeNode(parent) || ts.isLiteralTypeNode(parent)) return true;
  if (ts.isExpressionStatement(parent)) return true; // a directive such as 'use client'
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.InKeyword && parent.left === node) return true;
  if ('name' in parent && (parent as { name?: ts.Node }).name === node) return true; // property names, enum members, module names
  return false;
}

/** The strings a person can see, with their 1-based line. */
export function userVisibleStrings(source: string, fileName: string): VisibleString[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found: VisibleString[] = [];
  const add = (node: ts.Node, text: string) => {
    if (text.trim()) found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, text });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) add(node, node.text);
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isNotCopy(node)) add(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) add(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

export function findInternalTerms(source: string, fileName: string): Finding[] {
  return userVisibleStrings(source, fileName).flatMap(({ line, text }) => internalTerms
    .filter((term) => text.toLowerCase().includes(term.toLowerCase()))
    .map((term) => ({ line, term, text })));
}

describe('the interface copy guard', () => {
  it('lists existing files, sorted and unique', () => {
    expect([...guardedFiles].sort()).toEqual([...guardedFiles]);
    expect(new Set(guardedFiles).size).toBe(guardedFiles.length);
    for (const path of guardedFiles) expect(existsSync(resolve(webRoot, path)), path).toBe(true);
  });

  it.each(guardedFiles)('%s shows no internal term', (path) => {
    const findings = findInternalTerms(readFileSync(resolve(webRoot, path), 'utf8'), path)
      .map(({ line, term, text }) => `${path}:${line} "${term}" in ${JSON.stringify(text.trim())}`);

    expect(findings).toEqual([]);
  });

  it('finds a term in copy and ignores it everywhere that is not copy', () => {
    const source = [
      "'use client';",
      "import { contextualLabel } from './contextual-copy';",
      "export { contextualLabel as contextualAlias } from './contextual-copy';",
      '// A contextual Risk is explained in a comment.',
      '/* contextual, again, in a block comment */',
      "type Kind = 'contextual' | 'other';",
      "const lookup = { contextual: 1, 'contextual-key': 2 };",
      'const contextualRisk = lookup.contextual;',
      "const present = 'contextual' in lookup;",
      "const value = lookup['contextual-key'];",
      "const message = 'Contextual Risks identified for this assessment.';",
      'const template = `Linked ${contextualRisk} contextual controls`;',
      'export function View() {',
      '  return <p>These contextual Risks stay.</p>;',
      '}',
    ].join('\n');

    const findings = findInternalTerms(source, 'in-memory.tsx');

    expect(findings.map(({ line, term }) => [line, term])).toEqual([
      [11, 'contextual'],
      [12, 'contextual'],
      [14, 'contextual'],
    ]);
  });

  it('matches case-insensitively and reports every term in a string', () => {
    const findings = findInternalTerms("const copy = 'STRAPI applies its Natural Key and record scope.';", 'in-memory.ts');

    expect(findings.map(({ term }) => term)).toEqual(['Strapi', 'natural key', 'record scope']);
  });
});
