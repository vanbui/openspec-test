import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * The interface copy guard (10-CONTEXT D-38, UI-SPEC §17.2). Phase 10 copy drops back-end and internal terms:
 * a person is told what they can do, never how the system enforces it. This guard reads the user-visible
 * strings of each listed file (JSX text, string literals, no-substitution template literals and template
 * literal text) and fails, naming the file, line and term, if one contains an internal term. Comments,
 * identifiers, import and export specifiers, the left operand of `in`, object property names, element-access
 * keys, literal types and directives are not copy, so they are not read. Nor are closed codes such as
 * AI_CLASSIFICATION_ABOVE_CEILING, or the values of data attributes such as data-testid (Phase 12, WR-406).
 *
 * Excluded (UI-SPEC §17.2):
 * - the development-only role switcher (`components/shell/role-switcher.tsx`): not shipped to production;
 * - service modules' type and client names (`createStrapiClient`, `StrapiClient`): identifiers, not copy.
 *
 * The list holds only files that are clean today. Each later plan adds the files it cleans, in order: Phase 11 plan
 * 11-03 adds both not-found pages and the Requests error boundary, whose recovery links now name Home; plan 11-05
 * adds the shell (sidebar and drawer navigation, app shell, wordmark, account menu) and the navigation config; plan
 * 11-12 adds every module of `features/home` (both Homes, the shared section frame and the Requestor Home's
 * presentation and service); plan 11-14 adds the Risk register page, its table and its filters, whose
 * descriptions now name the register's two stages (D-54); plan 11-16 adds every module of `features/analyst-dashboard`,
 * whose exposure copy now says which stage it counts instead of "contextual" (D-54, UI-SPEC §11.1); plan 11-17 adds
 * every module of `features/reports`, whose copy now says whether a figure includes Risks under assessment, and the
 * guard reads every string value of `report-copy.json`, the reports' canonical titles and descriptions (D-54, UI-SPEC
 * §11.2); plan 11-19 adds every module of `features/quick-find` (the action, the dialog and the zod-free domain) and
 * the header's quick-find control (UI-SPEC §11.2). The development role switcher stays excluded. Phase 12 (12-UI-SPEC
 * §14.2; plan 12-15, WR-406) adds every module of `features/ai-assistance` and the status badges, and the terms its
 * voice rules forbid, which the guard reads in every file it guards.
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
  // Phase 11 D-25 (UI-SPEC §2.4, §11.2): Home replaces the workspace in copy; identifiers such as
  // AdministrationWorkspace are names, not copy, so the guard does not read them.
  'workspace',
  // Phase 11 D-25, D-54 (UI-SPEC "Voice, formats and shared copy rules"): copy says which records a person can
  // open, never their "authorised scope", and never names the "bucket" a figure counts.
  'authorised scope',
  'authorized scope',
  'bucket',
] as const;

/*
 * Phase 12 (12-UI-SPEC voice rules, §14.2; plan 12-15, WR-406): copy says what the AI used and where a value came
 * from, never the record's internal names, and says "approved limit", never "ceiling". The guard reads these terms
 * in every guarded file, as it reads the Phase 10 terms: in the AI assistance modules, .ts and .tsx, and in the
 * Phase 12 copy beside them (the editors, the draft card, the questionnaire governance and introduction, the released
 * assessment, the status badges and the refusal copy). A closed code such as AI_CLASSIFICATION_ABOVE_CEILING is not
 * copy, so it is not read (isNotCopy).
 */
export const aiAssistanceTerms = ['provenance', 'run record', 'context summary', 'proposal key', 'deterministic', 'ceiling', 'aiProvenance'] as const;

/** Every term the guard reads in visible copy. */
export const copyTerms: readonly string[] = [...internalTerms, ...aiAssistanceTerms];

/*
 * Copy the UI-SPEC itself words with a term, each phrase exactly as written: the sheet's empty state (12-UI-SPEC
 * §2.4). The phrase is passed over and the rest of the string is still read, so the term anywhere else fails.
 */
export const sanctionedCopy: Readonly<Record<string, readonly string[]>> = {
  'run record': ['No AI run record'],
};

/*
 * A module that ships: not a test, and not a test fixtures module, whose data only tests import
 * (src/test/test-module-isolation.test.ts, IN-401).
 */
const isShippedModule = (name: string) => /\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name) && !/(^|[\\/])test-fixtures\.tsx?$/.test(name);

/** Paths relative to apps/csrm, sorted and unique. */
const guardedDirectories = [
  'src/features/home', 'src/features/analyst-dashboard', 'src/features/reports',
  'src/features/quick-find', 'src/components/shell', 'src/config/navigation',
  // Phase 16 (16-UI-SPEC §16; plan 16-14): every shipped module of risk curation, its schema and service included.
  'src/features/risk-curation',
] as const;
const excludedModules = new Set(['src/components/shell/role-switcher.tsx']);
const directoryModules = guardedDirectories.flatMap((directory) => readdirSync(resolve(webRoot, directory), { recursive: true, encoding: 'utf8' })
  .filter(isShippedModule)
  .map((name) => `${directory}/${name}`)
  .filter((path) => !excludedModules.has(path)));

/*
 * Plan 12-15 and WR-406: every AI assistance module, .ts and .tsx. The .ts modules hold most of its copy: the header
 * lines, the sheet's description and outcomes, the policy captions and failures, every toast and the sheet's errors.
 */
const aiAssistanceModules = readdirSync(resolve(webRoot, 'src/features/ai-assistance'), { encoding: 'utf8' })
  .filter(isShippedModule)
  .map((name) => `src/features/ai-assistance/${name}`);

/*
 * Phase 13 (13-UI-SPEC §16; plan 13-09): every client module and the zod-free domain of `features/request-assignment`,
 * the assignment block, picker and history and the words they show, and its Server Actions, whose sentences the
 * components show as they stand (WR-505). The service and schema modules hold no visible copy: family K lives in
 * `refusal-copy.ts`.
 */
const requestAssignmentModules = readdirSync(resolve(webRoot, 'src/features/request-assignment'), { encoding: 'utf8' })
  .filter(isShippedModule)
  .filter((name) => name.endsWith('.tsx') || name.endsWith('-domain.ts') || name.endsWith('-actions.ts'))
  .map((name) => `src/features/request-assignment/${name}`);

/*
 * Phase 13 (13-UI-SPEC §16; plan 13-10): every client and server-rendered module and the zod-free domain of
 * `features/request-notes`: the section, thread, note, composer, unread marker and skeleton, and the words they show,
 * and its Server Actions, whose sentences the thread shows as they stand (WR-505). The service and schema modules hold
 * no visible copy: family L lives in `refusal-copy.ts`.
 */
const requestNotesModules = readdirSync(resolve(webRoot, 'src/features/request-notes'), { encoding: 'utf8' })
  .filter(isShippedModule)
  .filter((name) => name.endsWith('.tsx') || name.endsWith('-domain.ts') || name.endsWith('-actions.ts'))
  .map((name) => `src/features/request-notes/${name}`);

/*
 * Phase 14 (14-UI-SPEC §13, UI-D33; plan 14-13): every shipped module of `features/attachments` (the section, list,
 * field, queue and store, the zod-free domain and queue model, and the Server Actions, whose sentences the list shows as
 * they stand) and of `lib/files` (the shared size, file-response and save helpers Phase 19 reuses).
 */
export const attachmentModules = (['src/features/attachments', 'src/lib/files'] as const).flatMap((directory) => readdirSync(resolve(webRoot, directory), { encoding: 'utf8' })
  .filter(isShippedModule)
  .map((name) => `${directory}/${name}`));

/*
 * Phase 15 (15-UI-SPEC §16; plans 15-10 and 15-12): every shipped module of `features/questionnaire-ai`, and the X-24
 * comparison it shares with later phases. Their visible copy also never names the analyst's review act with a verb the
 * UI-SPEC "Voice" reserves away from it (UI-D1): `reservedReviewVerbs` below.
 */
export const questionnaireAiModules = [
  ...readdirSync(resolve(webRoot, 'src/features/questionnaire-ai'), { encoding: 'utf8' }).filter(isShippedModule).map((name) => `src/features/questionnaire-ai/${name}`),
  'src/features/ai-assistance/field-comparison.tsx',
];

/*
 * UI-D1: Confirm, Reject and Undo are the review act's verbs; these three never name it in Phase 15's copy. A one-word
 * lowercase literal is the API's own value (`action: 'accept'`, `'accepted'`), never shown, so only a capitalised word or a
 * word inside a phrase counts as copy.
 */
const reservedVerb = /\b(accept|approve|dismiss)/i;
export const reservedReviewVerbs = { test: (text: string): boolean => /\b(Accept|Approve|Dismiss)/.test(text) || (/\s/.test(text.trim()) && reservedVerb.test(text)) };

export const guardedFiles = [...new Set([
  ...aiAssistanceModules,
  ...questionnaireAiModules,
  ...attachmentModules,
  ...directoryModules,
  ...requestAssignmentModules,
  ...requestNotesModules,
  'app/(app)/app/review/requests/error.tsx',
  'app/(app)/app/risks/(register)/page.tsx',
  'app/(app)/not-found.tsx',
  'app/not-found.tsx',
  'src/components/csrm/confirm-dialog.tsx',
  'src/components/csrm/local-time.tsx',
  'src/components/csrm/navigation-guard.tsx',
  'src/components/csrm/relation-picker.tsx',
  'src/components/csrm/revert-audit-summary.tsx',
  'src/components/csrm/save-status.tsx',
  // Phase 12 (WR-406): the AI review badges, `AI proposed` and `No source cited`.
  'src/components/csrm/status-badge.tsx',
  'src/components/shell/account-menu.tsx',
  'src/components/shell/app-shell.tsx',
  'src/components/shell/brand-lockup.tsx',
  'src/components/shell/capability-navigation.tsx',
  'src/components/shell/quick-find-trigger.tsx',
  'src/components/shell/wordmark.tsx',
  'src/components/states/states.tsx',
  'src/config/navigation/navigation.ts',
  'src/config/navigation/page-headings.ts',
  'src/features/administration/administration-actions.ts',
  'src/features/administration/administration-form.tsx',
  'src/features/administration/administration-workspace.tsx',
  'src/features/administration/applicable-controls.ts',
  'src/features/administration/csv-client-parser.ts',
  'src/features/administration/csv-import-flow.tsx',
  // Phase 19 (19-15; 19-UI-SPEC §5.3 to §5.8): the import flow's rules build its visible sentence parts.
  'src/features/administration/import-flow-rules.ts',
  // Phase 19 (19-UI-SPEC §6; plan 19-02): family S, the export and import refusal copy.
  'src/features/administration/import-refusal-copy.ts',
  // Phase 19 (19-13; 19-UI-SPEC §5.6, UI-D16, X-32): the six import row states' labels, off the shared badge map.
  'src/features/administration/import-row-status.tsx',
  'src/features/exports/export-refusal-copy.ts',
  // Phase 19 (19-UI-SPEC §1, §2; plan 19-06): the Export button, the export dialog, its column choice and its words, and
  // the register's filter chips, which moved out of the register table so its header's Export names them too.
  'src/components/csrm/export/column-choice.tsx',
  'src/components/csrm/export/export-button.tsx',
  'src/components/csrm/export/export-dialog.tsx',
  'src/features/exports/export-scope.ts',
  'src/features/risks/risk-register-chips.ts',
  // Phase 19 (19-UI-SPEC §1, §4; plan 19-12): the released header's Print report and Export, and the print-ready report:
  // its model and scope sentence, the document, its toolbar and both report routes' error boundaries.
  'src/features/assessments/assessment-report-model.ts',
  'src/features/assessments/assessment-report.tsx',
  'src/features/assessments/released-assessment-actions.tsx',
  'src/features/assessments/report-toolbar.tsx',
  'app/(app)/app/assessments/[documentId]/report/error.tsx',
  'app/(app)/app/review/assessments/[documentId]/report/error.tsx',
  'src/features/analyst-dashboard/analyst-dashboard-presentation.ts',
  'src/features/analyst-dashboard/analyst-dashboard-schema.ts',
  'src/features/analyst-dashboard/analyst-dashboard-service.ts',
  'src/features/analyst-dashboard/analyst-dashboard.tsx',
  'src/features/assessments/assessment-actions.ts',
  'src/features/assessments/assessment-detail.tsx',
  'src/features/assessments/assessment-draft-job.tsx',
  'src/features/assessments/assessment-editor.tsx',
  'src/features/assessments/assessment-request-link.tsx',
  'src/features/assessments/control-implementation-editor.tsx',
  'src/features/assessments/control-label.ts',
  'src/features/assessments/generation-failure-copy.ts',
  'src/features/assessments/questionnaire-generation-job.tsx',
  'src/features/assessments/release-readiness-summary.ts',
  'src/features/assessments/released-assessment.tsx',
  'src/features/assessments/released-risk-details.tsx',
  // Phase 13 (13-UI-SPEC §11; plan 13-18): the assignee and notes lines under the originating request link.
  'src/features/assessments/request-context-lines.tsx',
  'src/features/assessments/risk-editor.tsx',
  'src/features/home/analyst-home.tsx',
  'src/features/home/home-page-header.tsx',
  'src/features/home/home-section.tsx',
  'src/features/home/requestor-home-presentation.ts',
  'src/features/home/requestor-home-service.ts',
  'src/features/home/requestor-home.tsx',
  // Phase 15 (15-UI-SPEC §16; plan 15-10): the questionnaire AI copy, families Q1 to Q3 and the presentation rules.
  'src/features/questionnaire-ai/questionnaire-ai-actions.ts',
  'src/features/questionnaire-ai/questionnaire-ai-domain.ts',
  'src/features/questionnaire-ai/questionnaire-ai-refusal-copy.ts',
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
  'src/features/quick-find/quick-find-actions.ts',
  'src/features/quick-find/quick-find-dialog.tsx',
  'src/features/quick-find/quick-find-domain.ts',
  'src/features/reports/assessment-throughput-report.tsx',
  'src/features/reports/control-effectiveness-report.tsx',
  'src/features/reports/report-copy.ts',
  'src/features/reports/report-detail.tsx',
  'src/features/reports/report-index.tsx',
  'src/features/reports/report-period-control.tsx',
  'src/features/reports/report-periods.ts',
  'src/features/reports/report-presentation.ts',
  'src/features/reports/report-schema.ts',
  'src/features/reports/report-section.tsx',
  'src/features/reports/report-service.ts',
  'src/features/reports/report-table.tsx',
  'src/features/reports/reports-page-header.tsx',
  'src/features/reports/risk-exposure-report.tsx',
  'src/features/reports/treatment-performance-report.tsx',
  'src/features/requests/request-actions.ts',
  'src/features/requests/request-context-details.tsx',
  'src/features/requests/request-domain.ts',
  'src/features/requests/request-form.tsx',
  'src/features/requests/request-hub.tsx',
  'src/features/requests/request-workflow-actions.tsx',
  // Phase 16 (16-UI-SPEC §16; plan 16-11): the risk curation copy, family R and the presentation rules.
  'src/features/risk-curation/risk-curation-actions.ts',
  'src/features/risk-curation/risk-curation-domain.ts',
  'src/features/risk-curation/risk-curation-refusal-copy.ts',
  // Plan 16-12: the card actions, the withdraw and reinstate form, the withdrawn card and the history sheet.
  'src/features/risk-curation/risk-card-actions.tsx',
  'src/features/risk-curation/risk-history-frame.tsx',
  'src/features/risk-curation/risk-history-sheet.tsx',
  'src/features/risk-curation/risk-history-trigger.tsx',
  'src/features/risk-curation/use-risk-withdrawal.ts',
  'src/features/risk-curation/withdraw-risk-form.tsx',
  'src/features/risk-curation/withdrawn-risk-card.tsx',
  // Plan 16-13: the AI proposals section, proposed risks, Rewrite this risk, the decisions and the signal's action.
  'src/features/risk-curation/ai-proposals-section.tsx',
  'src/features/risk-curation/ai-proposals-section-client.tsx',
  'src/features/risk-curation/ai-proposals-section-loader.tsx',
  'src/features/risk-curation/proposed-risk-card.tsx',
  'src/features/risk-curation/rewrite-form.tsx',
  'src/features/risk-curation/rewrite-form-body.tsx',
  'src/features/risk-curation/risk-proposal-job.tsx',
  'src/features/risk-curation/risk-rewrite.tsx',
  'src/features/risk-curation/suggest-more-risks-button.tsx',
  'src/features/risk-curation/use-risk-proposal-decisions.ts',
  'src/features/risks/mitigation-control-list.tsx',
  'src/features/risks/risk-detail-editor.tsx',
  'src/features/risks/risk-details.tsx',
  'src/features/risks/risk-register-filters.tsx',
  'src/features/risks/risk-register.tsx',
  'src/lib/api/refusal-copy.ts',
  'src/lib/time/format-instant.ts',
])].sort();

/** JSON copy files whose every string value is shown to a person (UI-SPEC §11.2). */
export const guardedJsonFiles = ['src/features/reports/report-copy.json'] as const;

type VisibleString = { line: number; text: string };
type Finding = { line: number; term: string; text: string };

/** A closed code, such as a served reason (AI_CLASSIFICATION_ABOVE_CEILING): a value the copy is chosen by, never shown. */
const closedCode = /^[A-Z][A-Z0-9_]+$/;

/**
 * Whether a string literal sits where it is a name, a key, a type or a directive rather than copy, is a closed code, or
 * is a data attribute's value (a test or state hook such as data-testid or data-print, which no one sees or hears).
 */
function isNotCopy(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  const parent = node.parent;
  if (closedCode.test(node.text)) return true;
  if (ts.isJsxAttribute(parent) && ts.isIdentifier(parent.name) && parent.name.text.startsWith('data-')) return true;
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

/** Every string value of a parsed JSON document, keys excluded, with its path. */
export function jsonStringValues(value: unknown, path = '$'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => jsonStringValues(item, `${path}[${index}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => jsonStringValues(item, `${path}.${key}`));
  }
  return [];
}

/** Whether the text holds the term, case-insensitively, outside the copy the UI-SPEC sanctions for it. */
function holdsTerm(text: string, term: string): boolean {
  const unsanctioned = (sanctionedCopy[term] ?? []).reduce((rest, phrase) => rest.split(phrase).join('\n'), text);
  return unsanctioned.toLowerCase().includes(term.toLowerCase());
}

/* Phase 16 (D-49; plan 16-14): the controls whose names the risk curation copy reserves, and the names it forbids. */
const controlTags = new Set(['Button', 'button', 'DropdownMenuItem', 'DropdownMenuCheckboxItem', 'DropdownMenuRadioItem']);
const reservedControlName = /^(Accept( all)?|Approve|Delete|Remove)\b/;

/** The words a JSX element shows: its text, and the string literals and template text inside it, in order. */
function shownText(node: ts.Node): string {
  const parts: string[] = [];
  const visit = (child: ts.Node): void => {
    if (ts.isJsxText(child)) parts.push(child.text);
    else if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) {
      if (!ts.isJsxAttribute(child.parent)) parts.push(child.text);
    } else if (ts.isTemplateHead(child) || ts.isTemplateMiddle(child) || ts.isTemplateTail(child)) parts.push(child.text);
    if (ts.isJsxAttributes(child)) return;
    ts.forEachChild(child, visit);
  };
  if (ts.isJsxElement(node)) node.children.forEach(visit);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Every button or menu item named with a reserved verb, by its shown text or its `aria-label` (D-49): a decision is
 * `Confirm`, and a withdrawal is never a deletion or a removal.
 */
export function reservedControlNames(source: string, fileName: string): Array<{ line: number; name: string }> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: Array<{ line: number; name: string }> = [];
  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && controlTags.has(opening.tagName.getText(file))) {
      const line = file.getLineAndCharacterOfPosition(opening.getStart(file)).line + 1;
      const names: string[] = [shownText(node)];
      for (const attribute of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.getText(file) !== 'aria-label' || !attribute.initializer) continue;
        const value = ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text
          : ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression ? attribute.initializer.expression.getText(file).replace(/^[`'"]|[`'"]$/g, '') : '';
        names.push(value);
      }
      for (const name of names) if (reservedControlName.test(name)) found.push({ line, name });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

export function findInternalTerms(source: string, fileName: string, terms: readonly string[] = copyTerms): Finding[] {
  return userVisibleStrings(source, fileName).flatMap(({ line, text }) => terms
    .filter((term) => holdsTerm(text, term))
    .map((term) => ({ line, term, text })));
}

describe('the interface copy guard', () => {
  it('covers every production module in the directories required by UI-SPEC §11.2', () => {
    const directories = ['src/features/home', 'src/features/analyst-dashboard', 'src/features/reports', 'src/features/quick-find', 'src/components/shell', 'src/config/navigation'];
    const excluded = new Set(['src/components/shell/role-switcher.tsx']);
    for (const directory of directories) {
      for (const name of readdirSync(resolve(webRoot, directory), { recursive: true, encoding: 'utf8' })) {
        if (!isShippedModule(name)) continue;
        const path = `${directory}/${name}`;
        if (!excluded.has(path)) expect(guardedFiles, path).toContain(path);
      }
    }
  });

  it.each(['authorised scope', 'authorized scope'])('rejects the spelling variant %s in visible copy', (term) => {
    expect(findInternalTerms(`const copy = 'Your ${term}';`, 'in-memory.ts')).toHaveLength(1);
  });

  it('lists existing files, sorted and unique', () => {
    expect([...guardedFiles].sort()).toEqual([...guardedFiles]);
    expect(new Set(guardedFiles).size).toBe(guardedFiles.length);
    for (const path of guardedFiles) expect(existsSync(resolve(webRoot, path)), path).toBe(true);
  });

  it('covers every shipped module of features/questionnaire-ai and the shared comparison', () => {
    expect(questionnaireAiModules.length).toBeGreaterThan(8);
    for (const path of questionnaireAiModules) expect(guardedFiles).toContain(path);
    expect(guardedFiles).toContain('src/features/questionnaire-ai/questionnaire-ai-refusal-copy.ts');
  });

  it.each(questionnaireAiModules)('%s never names the review act with a reserved verb (UI-D1)', (path) => {
    const findings = userVisibleStrings(readFileSync(resolve(webRoot, path), 'utf8'), path).filter(({ text }) => reservedReviewVerbs.test(text));
    expect(findings).toEqual([]);
  });

  it('flags a reserved verb in visible copy', () => {
    expect(userVisibleStrings("const label = 'Approve proposal';", 'in-memory.ts').filter(({ text }) => reservedReviewVerbs.test(text))).toHaveLength(1);
  });

  it.each(guardedFiles)('%s shows no internal term', (path) => {
    const findings = findInternalTerms(readFileSync(resolve(webRoot, path), 'utf8'), path)
      .map(({ line, term, text }) => `${path}:${line} "${term}" in ${JSON.stringify(text.trim())}`);

    expect(findings).toEqual([]);
  });

  it.each(guardedJsonFiles)('%s shows no internal term in any string value', (path) => {
    expect(existsSync(resolve(webRoot, path)), path).toBe(true);
    const values = jsonStringValues(JSON.parse(readFileSync(resolve(webRoot, path), 'utf8')));
    expect(values.length, `${path} holds no copy`).toBeGreaterThan(0);
    const findings = values.flatMap(({ path: at, text }) => copyTerms
      .filter((term) => holdsTerm(text, term))
      .map((term) => `${path} ${at} "${term}" in ${JSON.stringify(text)}`));

    expect(findings).toEqual([]);
  });

  it('reads every string value of a JSON copy file, and never its keys', () => {
    expect(jsonStringValues({ contextual: 'Released Risks', list: [{ title: 'Open contextual Risks' }, 3, null] })).toEqual([
      { path: '$.contextual', text: 'Released Risks' },
      { path: '$.list[0].title', text: 'Open contextual Risks' },
    ]);
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

  it('reads "workspace" in copy and never in a name such as AdministrationWorkspace (UI-SPEC §11.2)', () => {
    const source = [
      "import { AdministrationWorkspace } from './administration-workspace';",
      'export function View() {',
      '  return <AdministrationWorkspace><a href="/app">Open your workspace</a></AdministrationWorkspace>;',
      '}',
    ].join('\n');

    expect(findInternalTerms(source, 'in-memory.tsx').map(({ line, term }) => [line, term])).toEqual([[3, 'workspace']]);
  });

  it('matches case-insensitively and reports every term in a string', () => {
    const findings = findInternalTerms("const copy = 'STRAPI applies its Natural Key and record scope.';", 'in-memory.ts');

    expect(findings.map(({ term }) => term)).toEqual(['Strapi', 'natural key', 'record scope']);
  });
});

describe('the AI assistance copy terms (plan 12-15; WR-406)', () => {
  it('guards every AI assistance module, the .ts modules that hold most of its copy included', () => {
    const directory = 'src/features/ai-assistance';
    const modules = readdirSync(resolve(webRoot, directory), { encoding: 'utf8' }).filter(isShippedModule);
    expect(modules).toEqual(expect.arrayContaining([
      'ai-assistance-actions.ts', 'ai-assistance-domain.ts', 'ai-provenance-domain.ts', 'use-ai-decisions.ts',
      'ai-provenance-header.tsx', 'ai-run-sheet.tsx', 'ai-run-sheet-trigger.tsx', 'ai-assistance-notice.tsx', 'ai-policy-gate.tsx',
    ]));
    for (const name of modules) expect(guardedFiles, name).toContain(`${directory}/${name}`);
  });

  it('guards the Phase 12 copy outside the AI assistance modules', () => {
    for (const path of [
      'src/components/csrm/status-badge.tsx', 'src/features/assessments/assessment-draft-job.tsx', 'src/features/assessments/assessment-editor.tsx',
      'src/features/assessments/released-assessment.tsx', 'src/features/assessments/risk-editor.tsx', 'src/features/questionnaires/questionnaire-governance.tsx',
      'src/features/questionnaires/questionnaire-introduction.tsx', 'src/lib/api/refusal-copy.ts',
    ]) expect(guardedFiles).toContain(path);
  });

  it('lists every internal term the 12-UI-SPEC voice rules forbid', () => {
    expect([...aiAssistanceTerms].sort()).toEqual(['aiProvenance', 'ceiling', 'context summary', 'deterministic', 'proposal key', 'provenance', 'run record'].sort());
  });

  // Read in every guarded file, as the Phase 10 terms are: a .ts module, a component or a Phase 12 copy file elsewhere.
  it.each(aiAssistanceTerms)('rejects %s in the visible copy of any guarded file', (term) => {
    expect(findInternalTerms(`const copy = 'The ${term} is shown here';`, 'in-memory.ts').map((finding) => finding.term)).toContain(term);
    expect(findInternalTerms(`export const View = () => <p>The ${term} is shown here</p>;`, 'in-memory.tsx').map((finding) => finding.term)).toContain(term);
  });

  it('allows the sheet’s empty state, exactly “No AI run record” (12-UI-SPEC §2.4), and no other run record', () => {
    const source = [
      "const empty = 'No AI run record';",
      "const other = 'This run record is missing';",
      "const both = 'No AI run record, so the run record is empty';",
      "const lower = 'There is no AI run record for this draft.';",
    ].join('\n');

    expect(findInternalTerms(source, 'in-memory.ts', [...internalTerms, ...aiAssistanceTerms]).map(({ line, term }) => [line, term]))
      .toEqual([[2, 'run record'], [3, 'run record'], [4, 'run record']]);
  });

  it('reads no closed code such as AI_CLASSIFICATION_ABOVE_CEILING, and still reads the term in copy beside one', () => {
    const source = [
      "const reasons = new Set(['AI_CLASSIFICATION_ABOVE_CEILING', 'AI_POLICY_NOT_CONFIGURED']);",
      "if (reason === 'AI_CLASSIFICATION_ABOVE_CEILING') notify('Above the approved ceiling');",
      'export const View = () => <p>CEILING reached</p>;',
    ].join('\n');

    expect(findInternalTerms(source, 'in-memory.tsx', [...internalTerms, ...aiAssistanceTerms]).map(({ line, term }) => [line, term]))
      .toEqual([[2, 'ceiling'], [3, 'ceiling']]);
  });

  it('reads no data attribute, which is a test or state hook that no one sees or hears', () => {
    const source = 'export const View = () => <div aria-label="AI provenance" data-print="hidden" data-testid="ai-provenance-header-skeleton" />;';

    expect(findInternalTerms(source, 'in-memory.tsx', [...internalTerms, ...aiAssistanceTerms]).map(({ term, text }) => [term, text]))
      .toEqual([['provenance', 'AI provenance']]);
  });
});

/*
 * Phase 13 (13-UI-SPEC §10.2; plan 13-18): the AI-inputs signal is guarded with every AI assistance module, and, being
 * advisory (D-29: no action in this phase), none of its words offers to accept or release anything.
 */
describe('the AI-inputs signal copy (plan 13-18)', () => {
  const signalModule = 'src/features/ai-assistance/ai-inputs-changed.tsx';

  it('guards the signal block and the request lines', () => {
    expect(guardedFiles).toContain(signalModule);
    expect(guardedFiles).toContain('src/features/assessments/request-context-lines.tsx');
  });

  it('words nothing in the signal as accepting or releasing', () => {
    const strings = userVisibleStrings(readFileSync(resolve(webRoot, signalModule), 'utf8'), signalModule);
    expect(strings.map(({ text }) => text).join(' ')).toContain('The AI hasn’t seen these changes.');
    expect(strings.filter(({ text }) => /accept|release/i.test(text))).toEqual([]);
  });
});

/*
 * WR-505: the assignment and notes Server Actions return sentences the components show as they stand (the reason limit,
 * the analyst list's failure, the notes reads' failures), so the guard reads them as it reads the components.
 */
describe('the request assignment and notes Server Actions (WR-505)', () => {
  const actionModules = ['src/features/request-assignment/assignment-actions.ts', 'src/features/request-notes/notes-actions.ts'];

  it('guards both action modules', () => {
    for (const module of actionModules) expect(guardedFiles).toContain(module);
  });

  it('reads the sentences each action returns', () => {
    const [assignment, notes] = actionModules.map((module) => userVisibleStrings(readFileSync(resolve(webRoot, module!), 'utf8'), module!).map(({ text }) => text));
    expect(assignment).toContain('Keep the reason to 500 characters or fewer.');
    expect(notes).toContain('We couldn’t load earlier notes.');
  });
});

/*
 * Phase 14 (14-UI-SPEC "Reserved words", UI-D33; G-14): `Accept` is the risk owner's decision, so no visible string of
 * the files feature uses it, "accepted types" included. The file chooser's `accept` attribute is not copy.
 */
describe('the request attachments copy (plan 14-13; UI-D33)', () => {
  it('guards every shipped module of features/attachments and lib/files', () => {
    for (const directory of ['src/features/attachments', 'src/lib/files']) {
      const modules = readdirSync(resolve(webRoot, directory), { encoding: 'utf8' }).filter(isShippedModule);
      expect(modules.length, directory).toBeGreaterThan(0);
      for (const name of modules) expect(guardedFiles, name).toContain(`${directory}/${name}`);
    }
    expect(guardedFiles).toEqual(expect.arrayContaining(['src/features/attachments/files-list.tsx', 'src/lib/files/save-file.ts']));
  });

  it('shows no Accept in any visible string', () => {
    const accepting = attachmentModules.flatMap((path) => userVisibleStrings(readFileSync(resolve(webRoot, path), 'utf8'), path)
      .filter(({ text }) => /accept/i.test(text))
      .map(({ line, text }) => `${path}:${line} ${JSON.stringify(text.trim())}`));
    expect(accepting).toEqual([]);
  });

  it('reads the list’s and the actions’ words, so a forbidden term there would fail', () => {
    const list = userVisibleStrings(readFileSync(resolve(webRoot, 'src/features/attachments/attachments-domain.ts'), 'utf8'), 'attachments-domain.ts').map(({ text }) => text);
    expect(list).toContain('Hide removed files');
    expect(findInternalTerms("const copy = 'Accepted types';", 'in-memory.ts', ['accept'])).toHaveLength(1);
  });
});

/*
 * Phase 16 (16-UI-SPEC §16, D-49; plan 16-14): every shipped module of `features/risk-curation` is read, and no button or
 * menu item there is named `Accept`, `Accept all`, `Approve`, `Delete` or `Remove`. A decision on an AI proposal is
 * `Confirm` (the API's `accept`), and a withdrawn Risk is withdrawn, never deleted or removed.
 */
describe('the risk curation copy (plan 16-14; D-49)', () => {
  const riskCurationModules = readdirSync(resolve(webRoot, 'src/features/risk-curation'), { encoding: 'utf8' })
    .filter(isShippedModule)
    .map((name) => `src/features/risk-curation/${name}`);

  it('guards every shipped module of features/risk-curation', () => {
    expect(riskCurationModules.length).toBeGreaterThan(20);
    for (const path of riskCurationModules) expect(guardedFiles, path).toContain(path);
  });

  it('flags a control named with a reserved verb, by its text or its accessible name', () => {
    const source = [
      'export const View = () => (',
      '  <>',
      '    <Button type="button">Delete</Button>',
      '    <DropdownMenuItem>Remove</DropdownMenuItem>',
      '    <Button aria-label="Approve proposal">Yes</Button>',
      "    <button type=\"button\">{'Accept all'}</button>",
      '    <Button type="button">Confirm</Button>',
      '    <Button type="button">Withdraw risk</Button>',
      '  </>',
      ');',
    ].join('\n');

    expect(reservedControlNames(source, 'in-memory.tsx').map(({ line, name }) => [line, name])).toEqual([
      [3, 'Delete'],
      [4, 'Remove'],
      [5, 'Approve proposal'],
      [6, 'Accept all'],
    ]);
  });

  it.each(riskCurationModules.filter((path) => path.endsWith('.tsx')))('%s names no control Accept, Accept all, Approve, Delete or Remove', (path) => {
    expect(reservedControlNames(readFileSync(resolve(webRoot, path), 'utf8'), path)).toEqual([]);
  });
});

/*
 * Phase 19 review amendment R1 part 1 (FE4-06; the pilot's ruling of 2026-10-17): the export, report and import copy is
 * an allow-list, not a deny-list. Every literal a person can read in those modules must be admitted by the contract:
 * a backticked string of 19-UI-SPEC.md (its §1 to §10, family S and review amendments R1 and R2), or, for the import flow's
 * copy that Phase 19 kept unchanged, of the contracts §10 supersedes "where named" (10-UI-SPEC.md, 06-UI-SPEC.md).
 * A string 19-UI-SPEC §10 or R1 retires is refused even where an older contract still holds it.
 *
 * How a literal is admitted: JSX text and every string or template literal is read, except where it is not copy (a
 * name, a key, a type, a class list, a data attribute or another attribute no one reads, a selector, a media query, an
 * import path) or is a single lowercase token or closed code. A template's substitutions match any text, so
 * `Export ${heading}` is admitted by `Export {page heading}`. Each sentence of a literal must appear, in order, within
 * one approved string, with the contract's own `{a|b}` choices expanded.
 */
/* The guard's own checked-in copies of those contracts (approved-copy/README.md), so archiving the phase records cannot break it. */
const phase19ContractRoot = resolve(webRoot, 'src/lib/performance/approved-copy');
const phase19Contract = readFileSync(resolve(phase19ContractRoot, '19-UI-SPEC.md'), 'utf8');
const supersededContracts = ['10-UI-SPEC.md', '06-UI-SPEC.md'].map((path) => readFileSync(resolve(phase19ContractRoot, path), 'utf8'));

/** The export, report and import modules whose every readable literal the contract must admit. */
export const phase19CopyModules = [
  'app/(app)/app/admin/[collection]/import/page.tsx',
  'app/(app)/app/assessments/[documentId]/report/error.tsx',
  'app/(app)/app/assessments/[documentId]/report/loading.tsx',
  'app/(app)/app/assessments/[documentId]/report/page.tsx',
  'app/(app)/app/review/assessments/[documentId]/report/error.tsx',
  'app/(app)/app/review/assessments/[documentId]/report/loading.tsx',
  'app/(app)/app/review/assessments/[documentId]/report/page.tsx',
  'src/components/csrm/export/column-choice.tsx',
  'src/components/csrm/export/export-button.tsx',
  'src/components/csrm/export/export-dialog.tsx',
  'src/features/administration/csv-client-parser.ts',
  'src/features/administration/csv-import-flow.tsx',
  'src/features/administration/import-flow-rules.ts',
  'src/features/administration/import-refusal-copy.ts',
  'src/features/administration/import-row-status.tsx',
  'src/features/assessments/assessment-report-model.ts',
  'src/features/assessments/assessment-report.tsx',
  'src/features/assessments/released-assessment-actions.tsx',
  'src/features/assessments/report-toolbar.tsx',
  'src/features/exports/export-actions.ts',
  'src/features/exports/export-file-check.ts',
  'src/features/exports/export-refusal-copy.ts',
  'src/features/exports/export-scope.ts',
  'src/features/exports/list-export-button.tsx',
] as const;

/** A contract string with each `{a|b}` choice written out, so `{semicolons|tabs}` admits `semicolons` and `tabs`. */
function expandChoices(entry: string): string[] {
  const choice = /\{([^{}]*\|[^{}]*)\}/.exec(entry);
  if (!choice) return [entry];
  return choice[1]!.split('|').flatMap((option) => expandChoices(entry.slice(0, choice.index) + option + entry.slice(choice.index + choice[0].length)));
}

/*
 * Every string a contract approves, its table pipes unescaped, with and without its choices written out: a backticked
 * string (19-UI-SPEC and 10-UI-SPEC), or a bold or quoted one (06-UI-SPEC writes its copy as **Back to guidance** or
 * “Current step”).
 */
function contractStrings(contract: string): string[] {
  return [...contract.matchAll(/`([^`\n]+)`|\*\*([^*\n]+)\*\*|“([^”\n]+)”/g)]
    .map((match) => (match[1] ?? match[2] ?? match[3]!).replace(/\\\|/g, '|'))
    .flatMap((entry) => [entry, ...expandChoices(entry)]);
}

/** 19-UI-SPEC §10's "Current (after Phase 10)" strings that its "New" column does not keep: the strings this phase retires. */
function retiredBySection10(contract: string): string[] {
  const section = contract.slice(contract.indexOf('## 10. Strings that change'), contract.indexOf('## 11. Test assertions'));
  const rows = section.split(/\r?\n/).filter((line) => line.startsWith('| ') && !line.startsWith('| Surface') && !line.startsWith('|---'));
  const column = (index: number) => rows.flatMap((line) => [...(line.split('|')[index] ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1]!));
  const kept = new Set(column(3));
  return column(2).filter((text) => !kept.has(text));
}

/* Review amendment R1 retires these two (part 1, row 8; part 2), and part 2 replaces the guessed separator default. */
const retiredByAmendmentR1 = ['The selected file is unavailable.', '“{file name}” is larger than 5 MB.'];
/* Review amendment R2 rewords these three, because the import takes Excel too; its table still quotes them. */
const retiredByAmendmentR2 = ['{} CSV columns', 'CSV row', 'Future step'];

/*
 * Copy this guard found that no contract writes, reported to the coordinator for the pilot rather than reworded here
 * (no copy is invented). Each entry is a module and its literal exactly as the guard reads it, and leaves the list when
 * the pilot approves it into 19-UI-SPEC or when its literal changes or goes; a stale entry fails. Review amendment R2
 * (2026-10-17) ruled on all 21 found by dee88182, so nothing awaits the pilot.
 */
const awaitingThePilot: Readonly<Record<string, readonly string[]>> = {};

const phase19Approved = [...contractStrings(phase19Contract), ...supersededContracts.flatMap(contractStrings)];
const phase19Retired = [...retiredBySection10(phase19Contract), ...retiredByAmendmentR1, ...retiredByAmendmentR2];

/** JSX attributes a person reads or hears; every other attribute (a class, a variant, a type, an id) is not copy. */
const readAttributes = new Set(['noun', 'aria-label', 'aria-description', 'aria-roledescription', 'title', 'placeholder', 'alt', 'label', 'description', 'heading', 'hint', 'message']);
/** Calls whose string arguments are never shown: class lists, selectors, media queries, formats, logs and issues. */
const unreadCallees = new Set([
  'cn', 'cva', 'clsx', 'querySelector', 'querySelectorAll', 'closest', 'getAttribute', 'setAttribute', 'matchMedia', 'addEventListener',
  'removeEventListener', 'NumberFormat', 'Collator', 'DateTimeFormat', 'includes', 'startsWith', 'endsWith', 'set', 'get', 'has', 'append',
  'addIssue', 'error', 'warn', 'log', 'Error',
]);

function calleeName(call: ts.CallExpression | ts.NewExpression): string {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return '';
}

/** Whether a literal sits where no one reads it: a non-copy attribute, an unread call, a type or an import. */
function inUnreadPlace(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxAttribute(current)) return !readAttributes.has(current.name.getText());
    if ((ts.isCallExpression(current) || ts.isNewExpression(current)) && unreadCallees.has(calleeName(current))) return true;
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current) || ts.isTypeNode(current)) return true;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isBlock(current) || ts.isSourceFile(current)) return false;
  }
  return false;
}

/** Whether a literal is a name rather than copy: a directive, a key, a comparison's operand, a case label, a property name. */
function isNameOrKey(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isExpressionStatement(parent) || ts.isCaseClause(parent)) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.InKeyword, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind)) return true;
  return 'name' in parent && (parent as { name?: ts.Node }).name === node;
}

/** Whether a string is prose a person reads, rather than a key, a value, a class list or a closed code. */
function readsAsProse(text: string): boolean {
  const words = text.replace(/\{\}/g, '').trim();
  if (!/[A-Za-z]/.test(words) || closedCode.test(words)) return false;
  if (/-/.test(words) && words.split(/\s+/).every((token) => /^[!a-z0-9@[\]:\-/.%_()&>*=,]+$/.test(token))) return false;
  return /\s/.test(words) || /^[A-Z]/.test(words);
}

/** A literal's text, a template's substitutions written `{}`. */
function literalText(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression): string {
  if (!ts.isTemplateExpression(node)) return node.text;
  return node.head.text + node.templateSpans.map((span) => `{}${span.literal.text}`).join('');
}

/** The readable literals of a module, with their 1-based line, whitespace collapsed. */
export function readableLiterals(source: string, fileName: string): VisibleString[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: VisibleString[] = [];
  const add = (node: ts.Node, text: string) => {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    if (readsAsProse(collapsed)) found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, text: collapsed });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      add(node, node.text);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      if (!isNameOrKey(node) && !inUnreadPlace(node)) add(node, literalText(node));
      if (ts.isTemplateExpression(node)) node.templateSpans.forEach((span) => visit(span.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const asPattern = (text: string) => new RegExp(text.split('{}').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*'));

/** Whether every sentence of a literal appears, in order, within one approved string. */
export function admittedBy(approved: readonly string[], text: string): boolean {
  return text.split(/(?<=[.!?:])\s+/).every((sentence) => !readsAsProse(sentence) || approved.some((entry) => asPattern(sentence).test(entry)));
}

describe('the Phase 19 export, report and import copy is drawn from the contract (R1 part 1; FE4-06)', () => {
  it('lists modules that exist, sorted and unique', () => {
    expect([...phase19CopyModules]).toEqual([...new Set(phase19CopyModules)].sort());
    for (const path of phase19CopyModules) expect(existsSync(resolve(webRoot, path)), path).toBe(true);
  });

  it('admits a contract string, its choices and its placeholders, and refuses anything else', () => {
    const approved = contractStrings('`This file separates columns with {semicolons|tabs}.` and `Export {page heading}` and `Print report {assessment number} \\| IdamBox CSRM`');
    expect(admittedBy(approved, 'This file separates columns with tabs.')).toBe(true);
    expect(admittedBy(approved, 'Export {}')).toBe(true);
    expect(admittedBy(approved, 'Print report {} | IdamBox CSRM')).toBe(true);
    expect(admittedBy(approved, 'This file separates columns with pipes.')).toBe(false);
    expect(admittedBy(approved, 'Export {} now. Something new.')).toBe(false);
  });

  it('reads JSX text, read attributes and literals, and passes over classes, keys, selectors and data attributes', () => {
    const source = [
      "const phone = window.matchMedia('(max-width: 767px)');",
      "const cell = 'whitespace-normal border-b px-2 text-left';",
      "export const View = ({ kind }: { kind: string }) => (",
      "  <div className={cn('flex gap-2', 'md:flex-row')} data-state=\"Open now\">",
      "    <Button aria-label={`Export ${kind}`} type=\"button\" variant=\"outline\">Export</Button>",
      "    {kind === 'Report kind' ? 'A new sentence.' : null}",
      '  </div>',
      ');',
    ].join('\n');
    expect(readableLiterals(source, 'in-memory.tsx').map(({ text }) => text)).toEqual(['Export {}', 'Export', 'A new sentence.']);
  });

  it('keeps the copy awaiting the pilot current: each entry is still in its module and still outside the contract', () => {
    // Review amendment R2: the pilot has ruled on every string the guard found, so nothing awaits.
    expect(Object.keys(awaitingThePilot)).toEqual([]);
    for (const [path, texts] of Object.entries(awaitingThePilot)) {
      const shown = readableLiterals(readFileSync(resolve(webRoot, path), 'utf8'), path).map(({ text }) => text);
      for (const text of texts) {
        expect(shown, `${path} still shows ${text}`).toContain(text);
        expect(admittedBy(phase19Approved, text), `${text} is now approved, so it leaves the list`).toBe(false);
      }
    }
  });

  it('retires §10’s Phase 10 strings, R1’s and R2’s, wherever an older contract still holds them', () => {
    expect(phase19Retired).toEqual(expect.arrayContaining(['Import CSV', 'Download error report CSV', 'The selected file is unavailable.', '{} CSV columns', 'CSV row', 'Future step']));
  });

  it.each(phase19CopyModules)('%s shows only copy the contract approves', (path) => {
    const literals = readableLiterals(readFileSync(resolve(webRoot, path), 'utf8'), path);
    const awaiting = awaitingThePilot[path] ?? [];
    const unapproved = literals.filter(({ text }) => !admittedBy(phase19Approved, text) && !awaiting.includes(text)).map(({ line, text }) => `${path}:${line} ${text}`);
    const retired = literals.filter(({ text }) => phase19Retired.includes(text)).map(({ line, text }) => `${path}:${line} ${text}`);
    expect(unapproved, 'copy outside the contract').toEqual([]);
    expect(retired, 'copy the contract retires').toEqual([]);
  });
});
