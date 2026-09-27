import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * W-5 (direction section 4 Forms: a label sits 6px above its field). A list's filter label wraps its
 * text and its field. Inline, or with space-y utilities, which never reach the text node, it put the
 * field 0 to 1px under the text, and the phone filter sheet's inline search label left its button
 * touching the input. A grid with gap-1.5 sets the text and the field 6px apart. The browser proof
 * measures the Risk Register's bar and sheet (risk-register-workflow.spec.ts); this keeps every list's
 * filter labels on the same rule.
 */
const filterModules = [
  'src/features/administration/administration-workspace.tsx',
  'src/features/alerts/alert-list.tsx',
  'src/features/assessments/assessment-list.tsx',
  'src/features/assessments/released-assessment.tsx',
  'src/features/questionnaires/questionnaire-list.tsx',
  'src/features/questionnaires/questionnaire-review-list.tsx',
  'src/features/requests/request-table.tsx',
  'src/features/risks/risk-register-filters.tsx',
] as const;

const FIELD_TAGS = new Set(['input', 'Input', 'select']);

type FilterLabel = { line: number; classes: readonly string[] };

/** The string literals a className expression is built from: a literal, `cn(…)`, or a local constant of either. */
function classesOf(expression: ts.Expression | undefined, file: ts.SourceFile): string[] {
  if (!expression) return [];
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text.split(/\s+/).filter(Boolean);
  if (ts.isCallExpression(expression)) return expression.arguments.flatMap((argument) => classesOf(argument, file));
  if (ts.isIdentifier(expression)) {
    let found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === expression.text) found = classesOf(node.initializer, file);
      ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
  }
  return [];
}

/** Every `<label>` that wraps a text field or select, with the classes its className resolves to. */
function filterLabels(path: string): FilterLabel[] {
  const file = ts.createSourceFile(path, readFileSync(resolve(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const labels: FilterLabel[] = [];
  const wrapsField = (node: ts.Node): boolean => {
    let wraps = false;
    const visit = (child: ts.Node): void => {
      const tag = ts.isJsxSelfClosingElement(child) ? child.tagName : ts.isJsxOpeningElement(child) ? child.tagName : undefined;
      if (tag && FIELD_TAGS.has(tag.getText(file))) {
        const type = (ts.isJsxSelfClosingElement(child) ? child.attributes : (child as ts.JsxOpeningElement).attributes).properties
          .find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(file) === 'type');
        if (!type || !/checkbox|radio/.test(type.initializer?.getText(file) ?? '')) wraps = true;
      }
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return wraps;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === 'label' && wrapsField(node)) {
      const className = node.openingElement.attributes.properties
        .find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(file) === 'className');
      const initializer = className?.initializer;
      const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer as ts.Expression | undefined;
      labels.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, classes: classesOf(expression, file) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return labels;
}

describe('list filter labels', () => {
  it.each(filterModules)('%s sets every filter label 6px above its field', (path) => {
    const labels = filterLabels(path);
    expect(labels.length, `${path} has filter labels to check`).toBeGreaterThan(0);
    const off = labels.filter(({ classes }) => !classes.includes('grid') || !classes.includes('gap-1.5') || classes.some((name) => name.startsWith('space-y-')));
    expect(off.map(({ line, classes }) => `${path}:${line} ${classes.join(' ')}`)).toEqual([]);
  });

  it('keeps the phone filter sheet\'s search button apart from its input', () => {
    // An inline label cannot take the form's vertical rhythm, so the form lays its label and button out as a grid.
    const source = readFileSync(resolve(process.cwd(), 'src/features/risks/risk-register-filters.tsx'), 'utf8');
    const sheetForm = /<SheetContent[\s\S]*?<form className="([^"]*)" role="search"/.exec(source);
    expect(sheetForm?.[1].split(/\s+/)).toEqual(expect.arrayContaining(['grid', 'gap-2']));
  });
});
