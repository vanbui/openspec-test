import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

// The parsers live beside the server-only transport; the guard needs the real
// schemas, not the network layer they are used with.
vi.mock('server-only', () => ({}));

import { responseParserModule as assessmentResponseParserModule, type ContractResponseParser } from './assessments/assessment-service';
import { parserFreeModules } from './parser-free-modules';
import { responseParserModule as requestResponseParserModule } from './requests/request-service';
import { responseParserModule as questionnaireResponseParserModule } from './questionnaires/questionnaire-service';
import { responseParserModule as riskSchemaResponseParserModule } from './risks/risk-schema';
import { responseParserModule as riskServiceResponseParserModule } from './risks/risk-service';
import { responseParserModule as administrationResponseParserModule } from './administration/administration-service';
import { responseParserModule as alertResponseParserModule } from './alerts/alert-service';
import { responseParserModule as analystDashboardResponseParserModule } from './analyst-dashboard/analyst-dashboard-service';
import { responseParserModule as reportResponseParserModule } from './reports/report-service';
import { responseParserModule as dashboardResponseParserModule } from './dashboard/requestor-dashboard-service';
import { responseParserModule as accessResponseParserModule } from './access/access-service';

type ResponseParserModule = {
  readonly modulePath: string;
  readonly mode: 'parsers' | 'no-direct-response-parser';
  readonly parsers: readonly ContractResponseParser[];
  readonly reason?: string;
};

const responseParserModuleInventory: readonly ResponseParserModule[] = [
  requestResponseParserModule,
  questionnaireResponseParserModule,
  assessmentResponseParserModule,
  administrationResponseParserModule,
  alertResponseParserModule,
  analystDashboardResponseParserModule,
  reportResponseParserModule,
  dashboardResponseParserModule,
  accessResponseParserModule,
  riskServiceResponseParserModule,
  riskSchemaResponseParserModule,
  ...parserFreeModules,
];

const parsers: readonly ContractResponseParser[] = [
  ...responseParserModuleInventory.flatMap((module) => module.parsers),
];

/**
 * Parsers registered before Phase 8 whose client bounds (`.trim()`, `.min()`,
 * `.max()`) the contract does not declare, excused from the two boundary modes
 * alone, with one reason each (D-40). Every entry is a backlog item: once the
 * contract declares the bound the server guarantees, or the parser drops it,
 * the entry is stale and the guard says so. A parser registered in Phase 7 or
 * later never appears here: its bound is the contract's own, or its path is in
 * `narrowedPaths`.
 */
const boundaryGrandfathered: Readonly<Record<string, string>> = {
  // Phase 2 — the request family (features/requests/request-service.ts)
  'request.listRequests':
    'Phase 2 request list: the client bounds the request number, title, selected system and asset names and questionnaire title with min(1) and the requestor display name with max(255) where the contract declares no bound; the contract bounds for the request family are a Phase 8 backlog item.',
  'request.getRequest':
    'Phase 2 request detail: the request list bounds plus min(1)/max(255) on the related questionnaire and assessment documentIds; the contract bounds for the request family are a Phase 8 backlog item.',
  'request.createRequest':
    'Phase 2 request create: parses the same request document as the list with its client-side title, number, name and display-name bounds; the contract bounds for the request family are a Phase 8 backlog item.',
  'request.updateRequest':
    'Phase 2 request update: parses the same request document as the list with its client-side title, number, name and display-name bounds; the contract bounds for the request family are a Phase 8 backlog item.',
  'request.revertRequestToDraft':
    'Phase 06.1 revert-to-draft summary: min(1) on the request documentId, number, title and the reverting actor documentId; the contract bounds for the request family are a Phase 8 backlog item.',
  // Phase 3 — the questionnaire family (features/questionnaires/questionnaire-service.ts)
  'listMyQuestionnaires':
    'Phase 3 questionnaire list: min(1)/max on documentIds, questionnaire and request numbers, titles, the request status, the description, the revert reason and actor display names; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'listQuestionnairesForReview':
    'Phase 06.8 analyst questionnaire review list: the questionnaire list bounds on documentIds, numbers, titles, statuses, descriptions, revert reasons and actor display names; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'getQuestionnaire':
    'Phase 3 questionnaire detail: the questionnaire bounds on documentIds, numbers, titles, the request status, the description, the revert reason and actor display names; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'getQuestionnaireQuestions':
    'Phase 3 question list: .trim() and min(1)/max on the question documentId, text and key, the section key, title and description, the visibility key and value and the choice values and labels, beyond the minLength 1 the contract declares on the keys, and max(65,535) on a text answer\'s value; hidden while the registration stopped at the envelope (G1) and while the answer check reported at the answer alone (G2), and the contract bounds for the questionnaire family are a backlog item.',
  'saveQuestionnaireDraft':
    'Phase 3 draft save acknowledgement: min(1)/max on the questionnaireId, and the question list bounds of getQuestionnaireQuestions on its answers; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'submitQuestionnaire':
    'Phase 3 submit acknowledgement: min(1)/max on the questionnaireId, and the question list bounds of getQuestionnaireQuestions on its answers; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'revertQuestionnaireToDraft':
    'Phase 06.1 questionnaire revert acknowledgement: min(1)/max on the questionnaireId and the reverting actor documentId, and the question list bounds of getQuestionnaireQuestions on its answers; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'releaseQuestionnaire':
    'Phase 3 release: parses the questionnaire document with its client-side documentId, number, title, status, description, revert-reason and display-name bounds; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'returnQuestionnaireToAnalystReview':
    'Phase 06.8 return to analyst review: the questionnaire bounds plus min(1) on the event actor and the cleared-answer question keys and explanations; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'addQuestionnaireQuestion':
    'Phase 06.8 analyst question add: the questionnaire bounds plus min(1) on the event actor and the cleared-answer question keys and explanations; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'editQuestionnaireQuestion':
    'Phase 06.8 analyst question edit: the questionnaire bounds plus min(1) on the event actor and the cleared-answer question keys and explanations; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  'deleteQuestionnaireQuestion':
    'Phase 06.8 analyst question delete: the questionnaire bounds plus min(1) on the event actor and the cleared-answer question keys and explanations; the contract bounds for the questionnaire family are a Phase 8 backlog item.',
  // Phase 4 — the assessment family (features/assessments/assessment-service.ts)
  'listAssessmentRequests':
    'Phase 4 analyst request queue: min(1)/max on the request documentId, number and title; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'getAssessmentDraftJob':
    'Phase 4 draft job: min(1)/max on the jobId and questionnaireId; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'getQuestionnaireGenerationJob':
    'Phase 06.2 generation job: min(1)/max on the jobId, requestId, provider name and provider version beyond the union restructure already narrowed at data; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'listMyReleasedAssessments':
    'Phase 4 released assessment list: min(1)/max on the documentId and assessment number, max on the summary and min(1)/max on the generating actor documentId and display name; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'listAnalystAssessments':
    'Phase 06.9 analyst assessment list: the assessment list bounds on the documentId, number, summary and generating actor; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'getAssessment':
    'Phase 4 analyst assessment detail: min(1)/max on the documentId, number, request documentId, number and title and every actor documentId and display name, max on the summaries and rationales; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'getReleasedAssessment':
    'Phase 4 released assessment detail: the assessment detail bounds on identifiers, actors, summaries and rationales; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'getReleasedAssessment (analyst actor)':
    'Phase 06.4 analyst view of a released assessment: the assessment detail bounds plus min(1)/max on every risk row field, owner label and release-readiness requirement key, label and destination; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'listAssessmentRisks':
    'Phase 4 assessment risk list: min(1)/max on the risk documentId and number and max on the risk statement; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'listControlImplementations':
    'Phase 4 control implementation list: min(1)/max on the documentId, control, control owner documentId and display name and max on the evidence; the contract bounds for the assessment family are a Phase 8 backlog item.',
  'listRiskTypes':
    'Phase 4 risk type reference list: min(1)/max on the documentId and name and max on the description; the contract bounds for the reference-data family are a Phase 8 backlog item.',
  'listControls':
    'Phase 4 control reference list: min(1)/max on the documentId, control number and name and max on the description; the contract bounds for the reference-data family are a Phase 8 backlog item.',
  'listActiveUsers':
    'Phase 4 active user list: min(1)/max on the documentId and display name; the contract bounds for the reference-data family are a Phase 8 backlog item.',
  // Phase 5 — the Risk family (features/risks/risk-service.ts, features/risks/risk-schema.ts)
  'risks.listRiskRegister':
    'Phase 5 Risk Register: .trim() and min(1)/max(255) on the Risk, treatment owner, assessment and selected-label identifiers, numbers, names and titles, and max(65,535) on the Risk statement, where the contract declares no bound; hidden behind a root-reporting wrapper until G1, and the contract bounds for the Risk family are a backlog item.',
  'risks.getRiskDetail':
    'Phase 5 Risk detail: .trim() and min(1)/max(255) on every identifier, number, name and display name, and max(65,535) on the free-text fields, where the contract declares no bound; the contract bounds for the Risk family are a backlog item.',
  'listRiskRegisterAssessments':
    'Phase 5 Risk Register assessment filter source: min(1)/max on the documentId, assessment number and generating actor and max on the summary; the contract bounds for the Risk family are a Phase 8 backlog item.',
  'listRiskRegisterRiskTypes':
    'Phase 5 Risk Register risk type filter source: min(1)/max on the documentId and name and max on the description; the contract bounds for the reference-data family are a Phase 8 backlog item.',
  'listRiskRegisterControls':
    'Phase 5 Risk Register control filter source: min(1)/max on the documentId, control number and name and max on the description; the contract bounds for the reference-data family are a Phase 8 backlog item.',
  // Phase 6 — the administration family (features/administration/administration-service.ts).
  // Each was hidden behind a root-reporting wrapper until G1; none is new.
  'administration.listRiskTypes':
    'Phase 6 Risk Type administration list: .trim() ahead of min(1) on the name, where the contract declares minLength 1 and so permits whitespace; the contract bounds for the administration family are a backlog item.',
  'administration.getRiskType':
    'Phase 6 Risk Type administration detail: .trim() ahead of min(1) on the name, where the contract declares minLength 1 and so permits whitespace; the contract bounds for the administration family are a backlog item.',
  'administration.listControls':
    'Phase 6 Control administration list: .trim() ahead of min(1) on the control number, name and framework, and on the optional control reference, framework version and framework source, which the contract lets be blank; the contract bounds for the administration family are a backlog item.',
  'administration.getControl':
    'Phase 6 Control administration detail: .trim() ahead of min(1) on the control number, name and framework, and on the optional control reference, framework version and framework source, which the contract lets be blank; the contract bounds for the administration family are a backlog item.',
  'administration.listInformationSystems':
    'Phase 6 Information System administration list: .trim() ahead of min(1) on the name, where the contract declares minLength 1 and so permits whitespace; the contract bounds for the administration family are a backlog item.',
  'administration.getInformationSystem':
    'Phase 6 Information System administration detail: .trim() ahead of min(1) on the name, where the contract declares minLength 1 and so permits whitespace; the contract bounds for the administration family are a backlog item.',
  'administration.listInformationAssets':
    'Phase 6 Information Asset administration list: .trim() ahead of min(1) on the name, where the contract declares minLength 1 and so permits whitespace; the contract bounds for the administration family are a backlog item.',
  'administration.getInformationAsset':
    'Phase 6 Information Asset administration detail: .trim() ahead of min(1) on the name, where the contract declares minLength 1 and so permits whitespace; the contract bounds for the administration family are a backlog item.',
};

const grandfatheredLabels: ReadonlySet<string> = new Set(Object.keys(boundaryGrandfathered));

/** The Phase 7 registrations (IN-03): resolved by contract, never grandfathered. */
const phase7Labels = [
  'alerts.listAlerts',
  'alerts.getAlertSummary',
  'analystDashboard.getDashboardSummary',
  'reports.listReportDefinitions',
  'reports.getReport.riskExposure',
  'reports.getReport.treatmentPerformance',
  'reports.getReport.assessmentThroughput',
  'reports.getReport.controlEffectiveness',
] as const;

/**
 * Contract-to-client-schema parity.
 *
 * The existing parity suites compare served route -> FunctionAPI catalogue ->
 * OpenAPI -> generated `schema.d.ts`.  None of them looks at the Zod layer, and
 * every drift defect found in phases 06.1-06.3 lived exactly there: the server
 * answered 200 and the client's closed schema refused the payload, so a
 * contract mismatch surfaced to the user as an outage.
 *
 * This guard closes that gap from both directions, by synthesising payloads
 * straight out of `docs/references/specification.json`:
 *
 *  - the *minimal* instance carries only contract-required properties, proving
 *    the client never demands more than the contract guarantees;
 *  - the *maximal* instance carries every declared property, proving a
 *    `.strict()` client schema never rejects something the contract permits;
 *  - the *nullable* instance serves null wherever the contract allows it;
 *  - the two *boundary* instances carry the shortest and the longest strings
 *    the contract permits (D-05, D-40), so a client parser stricter than the
 *    contract (`.trim()`, `.min()` or `.max()` without a declared bound) can
 *    no longer stay invisible: the bound is declared in the contract, or the
 *    path is registered in `narrowedPaths`, or a pre-Phase-8 parser is
 *    grandfathered below with its reason.
 */

type JsonObject = Record<string, unknown>;

const specification = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'),
) as { components: { schemas: Record<string, JsonObject> }; paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema?: JsonObject }> }> }>> };

function schemaFor(entry: ContractResponseParser): JsonObject {
  if (entry.component) {
    const component = specification.components.schemas[entry.component];
    if (!component) throw new Error(`Contract component ${entry.component} is missing.`);
    return component;
  }
  if (!entry.path || !entry.method) throw new Error(`${entry.label} must name a contract component or operation.`);
  const schema = specification.paths[entry.path]?.[entry.method]?.responses?.['200']?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`${entry.label} cannot resolve ${entry.method.toUpperCase()} ${entry.path} 200 response schema.`);
  return schema;
}

function validateInventory(inventory: readonly ResponseParserModule[]): void {
  const paths = new Set<string>();
  const labels = new Set<string>();
  for (const module of inventory) {
    if (paths.has(module.modulePath)) throw new Error(`Duplicate parser module declaration: ${module.modulePath}`);
    paths.add(module.modulePath);
    if (module.mode === 'parsers' && module.parsers.length === 0) {
      throw new Error(`Parser-bearing module has no descriptors: ${module.modulePath}`);
    }
    if (module.mode === 'no-direct-response-parser' && (!module.reason || module.parsers.length !== 0)) {
      throw new Error(`Parser-free module declaration contradicts its parser registry: ${module.modulePath}`);
    }
    for (const parser of module.parsers) {
      if (labels.has(parser.label)) throw new Error(`Duplicate response parser descriptor: ${parser.label}`);
      labels.add(parser.label);
      schemaFor(parser);
    }
  }
}

function dereference(schema: JsonObject): JsonObject {
  const ref = schema.$ref;
  if (typeof ref !== 'string') return schema;
  const name = ref.replace('#/components/schemas/', '');
  const resolved = specification.components.schemas[name];
  if (!resolved) throw new Error(`Unresolvable contract reference: ${ref}`);
  return dereference(resolved);
}

/**
 * Builds an instance of `schema`.  `mode: 'minimal'` emits only required
 * properties; `mode: 'maximal'` emits every declared property; `mode:
 * 'nullable'` serves null wherever the contract allows it; the two boundary
 * modes emit every declared property with each free string at the edge the
 * contract permits.
 */
type Mode = 'minimal' | 'maximal' | 'nullable' | 'boundary-empty' | 'boundary-long';

const modes = ['minimal', 'maximal', 'nullable', 'boundary-empty', 'boundary-long'] as const satisfies readonly Mode[];
const boundaryModes = ['boundary-empty', 'boundary-long'] as const satisfies readonly Mode[];

function isBoundaryMode(mode: Mode): boolean {
  return (boundaryModes as readonly Mode[]).includes(mode);
}

/**
 * Longer than any cap a client schema uses (the largest is `max(65_535)`), so
 * a contract string without `maxLength` reaches every client `.max()`.
 */
const OVER_LONG_LENGTH = 70_000;

/**
 * A string for `schema` in `mode`. Constants, enumerations, dates and
 * patterned strings keep one synthesised value in every mode. A free string is
 * bounded and non-empty by default; in `boundary-empty` it is the shortest the
 * contract permits (empty, or exactly `minLength` characters of whitespace, so
 * a `.trim()` ahead of a `.min()` shows up as the narrowing it is); in
 * `boundary-long` it is the longest (exactly `maxLength` characters, or more
 * than any client cap when the contract declares none).
 */
function stringFor(schema: JsonObject, mode: Mode): string {
  if (typeof schema.const === 'string') return schema.const;
  const enumeration = schema.enum;
  const named = Array.isArray(enumeration) ? enumeration.filter((value) => typeof value === 'string') : [];
  if (named.length > 0) return String(named[0]);
  if (schema.format === 'date-time') return '2026-01-15T09:30:00.000Z';
  if (schema.format === 'date') return '2026-01-15';
  if (typeof schema.pattern === 'string') return 'ASM-2026-33SAEN';
  const minLength = typeof schema.minLength === 'number' ? schema.minLength : undefined;
  const maxLength = typeof schema.maxLength === 'number' ? schema.maxLength : undefined;
  if (mode === 'boundary-empty') return ' '.repeat(minLength ?? 0);
  if (mode === 'boundary-long') return 'x'.repeat(maxLength ?? OVER_LONG_LENGTH);
  return 'contract'.padEnd(Math.max(minLength ?? 1, 1), 'x').slice(0, maxLength);
}

function instanceOf(input: JsonObject, mode: Mode, branch?: string, depth = 0): unknown {
  // Strapi's legacy request documents contain cyclic populated relations. The
  // browser parser projects only the first relation level, so stop expanding
  // deeper than that bounded DTO boundary instead of recursing forever.
  if (depth > 12) return {};
  const schema = dereference(input);

  if (Array.isArray(schema.allOf)) {
    return (schema.allOf as JsonObject[]).reduce<JsonObject>(
      (merged, part) => Object.assign(merged, instanceOf(part, mode, branch) as JsonObject),
      {},
    );
  }
  // A union is satisfied by one branch. An entry names the branch its endpoint
  // actually serves; otherwise the contract's own declaration order is used.
  for (const key of ['oneOf', 'anyOf'] as const) {
    const branches = schema[key];
    if (!Array.isArray(branches) || branches.length === 0) continue;
    if (mode === 'nullable' && branches.some((option) => (option as JsonObject).type === 'null')) return null;
    const chosen = branch === undefined
      ? branches[0]
      : branches.find((option) => (option as JsonObject).$ref === `#/components/schemas/${branch}`);
    if (!chosen) throw new Error(`Contract union does not declare branch ${branch}.`);
    // The branch names one union; deeper unions fall back to declaration order.
    return instanceOf(chosen as JsonObject, mode);
  }

  // A discriminator is often declared as a bare `const` with no `type`.
  if (schema.const !== undefined) return schema.const;

  const declared = Array.isArray(schema.type) ? schema.type : [schema.type];
  // Every nullable property is served as null at some point; the client schema
  // has to accept that, and a `.strict()` non-nullable field is the exact shape
  // that turns a healthy 200 into "we couldn't load this".
  if (mode === 'nullable' && declared.includes('null')) return null;
  const type = declared.find((candidate) => candidate !== 'null');

  if (type === 'object' || schema.properties !== undefined) {
    const properties = (schema.properties ?? {}) as Record<string, JsonObject>;
    const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
    const output: JsonObject = {};
    for (const [name, property] of Object.entries(properties)) {
      if (mode === 'minimal' && !required.has(name)) continue;
        output[name] = instanceOf(property, mode, branch, depth + 1);
    }
    return output;
  }

  if (type === 'array') {
    // One element is enough to exercise the item schema, and keeps the
    // generated payload inside the client's max-length bounds.
    return schema.items ? [instanceOf(schema.items as JsonObject, mode, branch, depth + 1)] : [];
  }

  if (schema.nullable === true && type === undefined) return null;
  if (type === 'string') return stringFor(schema, mode);
  if (type === 'integer' || type === 'number') {
    // An enumerated number, such as a page size, is only ever one of its values.
    const enumerated = Array.isArray(schema.enum) ? schema.enum.find((value) => typeof value === 'number') : undefined;
    if (typeof enumerated === 'number') return enumerated;
    const minimum = typeof schema.minimum === 'number' ? schema.minimum : 1;
    return Math.max(minimum, 1);
  }
  if (type === 'boolean') return true;
  if (type === 'null') return null;

  // An untyped schema places no constraint the client can rely on.
  return null;
}

type Leaf = { readonly path: readonly (string | number)[]; readonly value: string | number | boolean };

/** The first string, number or boolean below the root of `value`, depth first. */
function firstLeaf(value: unknown, path: readonly (string | number)[] = []): Leaf | null {
  if (path.length > 0 && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
    return { path, value };
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const leaf = firstLeaf(item, [...path, index]);
      if (leaf) return leaf;
    }
    return null;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const leaf = firstLeaf(item, [...path, key]);
      if (leaf) return leaf;
    }
  }
  return null;
}

function withLeafReplaced(value: unknown, path: readonly (string | number)[], replacement: unknown): unknown {
  if (path.length === 0) return replacement;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    return value.map((item, index) => (index === head ? withLeafReplaced(item, rest, replacement) : item));
  }
  const record = value as JsonObject;
  return { ...record, [head as string]: withLeafReplaced(record[head as string], rest, replacement) };
}

/** A value of another JSON type, which no closed parser accepts in the leaf's place. */
function mistypedValue(value: string | number | boolean): unknown {
  return typeof value === 'string' ? 70_000 : 'mistyped';
}

/**
 * The payload path a dotted guard path names, with list positions as numbers,
 * or null when the payload holds nothing there.
 */
function payloadPath(value: unknown, dotted: string): (string | number)[] | null {
  const path: (string | number)[] = [];
  let current = value;
  for (const segment of dotted.split('.')) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return null;
      path.push(index);
      current = current[index];
    } else if (current !== null && typeof current === 'object' && segment in current) {
      path.push(segment);
      current = (current as JsonObject)[segment];
    } else {
      return null;
    }
  }
  return path;
}

function valueAtPath(value: unknown, path: readonly (string | number)[]): unknown {
  return path.reduce<unknown>(
    (current, segment) => (current !== null && typeof current === 'object'
      ? (current as Record<string | number, unknown>)[segment]
      : undefined),
    value,
  );
}

function formatIssues(error: unknown): string {
  const zodError = error as z.ZodError;
  if (!zodError?.issues) return String(error);
  return zodError.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

function describeContract(entry: ContractResponseParser): string {
  return entry.component ?? `${entry.method?.toUpperCase()} ${entry.path}`;
}

type Rejection = { readonly unexpected: readonly string[]; readonly error: z.ZodError };

/**
 * The paths an issue rejects. A refused key is reported at its own path, so a
 * narrowing names the one field the client refuses and tolerates no other key
 * on that object. A rejection of the whole payload is `<root>`, which no
 * narrowing can name: a parser that reports every inner rejection at the root
 * would otherwise hide them all behind one narrowing (G1).
 */
function issuePaths(issue: z.ZodError['issues'][number]): string[] {
  const path = issue.path.map(String).join('.');
  if (issue.code === 'unrecognized_keys') return issue.keys.map((key) => (path ? `${path}.${key}` : key));
  return [path || '<root>'];
}

/**
 * The parser's rejection of the `mode` payload on paths outside its declared
 * narrowings, or null when it accepts the payload or rejects narrowed paths only.
 */
function unregisteredRejection(entry: ContractResponseParser, mode: Mode): Rejection | null {
  const result = entry.parser.safeParse(instanceOf(schemaFor(entry), mode, entry.branch));
  if (result.success) return null;
  const narrowed = new Set<string>(entry.narrowedPaths ?? []);
  const unexpected = result.error.issues
    .flatMap(issuePaths)
    .filter((path) => !narrowed.has(path));
  return unexpected.length === 0 ? null : { unexpected, error: result.error };
}

describe('contract-to-client-schema parity', () => {
  it('declares every workflow parser boundary explicitly', () => {
    // The set must be complete; the order it is assembled in is incidental, and
    // pinning it made the assertion fail when the parser-free declarations moved
    // into their own registry without any boundary changing.
    expect([...responseParserModuleInventory.map((module) => module.modulePath)].sort()).toEqual([
      'features/access/access-service.ts',
      'features/administration/administration-actions.ts',
      'features/administration/administration-service.ts',
      'features/alerts/alert-service.ts',
      'features/analyst-dashboard/analyst-dashboard-service.ts',
      'features/assessments/assessment-actions.ts',
      'features/assessments/assessment-service.ts',
      'features/dashboard/requestor-dashboard-service.ts',
      'features/questionnaires/questionnaire-actions.ts',
      'features/questionnaires/questionnaire-service.ts',
      'features/reports/report-service.ts',
      'features/requests/request-actions.ts',
      'features/requests/request-service.ts',
      'features/risks/risk-actions.ts',
      'features/risks/risk-schema.ts',
      'features/risks/risk-service.ts',
    ].sort());
    for (const module of responseParserModuleInventory) {
      expect(module.mode === 'parsers' ? module.parsers.length > 0 : Boolean(module.reason)).toBe(true);
    }
  });

  it('rejects missing populated assessment actor summaries', () => {
    const analystDetail = parsers.find((entry) => entry.label === 'getAssessment');
    const releasedDetail = parsers.find((entry) => entry.label === 'getReleasedAssessment');
    expect(analystDetail).toBeDefined();
    expect(releasedDetail).toBeDefined();

    const missingGeneratedBy = instanceOf(schemaFor(analystDetail!), 'maximal') as { data: Record<string, unknown> };
    delete missingGeneratedBy.data.generatedBy;
    expect(analystDetail!.parser.safeParse(missingGeneratedBy).success).toBe(false);

    const missingApprover = instanceOf(schemaFor(releasedDetail!), 'maximal', releasedDetail!.branch) as { data: Record<string, unknown> };
    missingApprover.data.approvedBy = null;
    expect(releasedDetail!.parser.safeParse(missingApprover).success).toBe(false);
  });

  it.each(parsers.map((entry) => [entry.label, entry] as const))(
    '%s accepts the payload its contract component declares',
    (_label, entry) => {
      const grandfathered = grandfatheredLabels.has(entry.label);

      for (const mode of modes) {
        // A pre-Phase-8 parser may be excused from the boundary modes alone
        // (D-40); every other mode still holds it to the contract.
        if (grandfathered && isBoundaryMode(mode)) continue;

        // A client schema may deliberately be narrower than a shared contract
        // component. Each such path is declared and justified beside the
        // parser, and anything outside that set is undeclared drift.
        const rejection = unregisteredRejection(entry, mode);
        if (!rejection) continue;
        const remedy = isBoundaryMode(mode)
          ? ' — declare the bound in docs/references/specification.json or register the path in narrowedPaths'
          : '';
        expect(
          rejection.unexpected,
          `${entry.label} rejected the ${mode} ${describeContract(entry)} payload permitted by the contract — ${formatIssues(rejection.error)}${remedy}`,
        ).toEqual([]);
      }
    },
  );

  it.each(parsers.map((entry) => [entry.label, entry] as const))(
    '%s reports a rejection at the field that caused it',
    (_label, entry) => {
      // The guard can only tell a field-level narrowing from drift when the
      // parser names the field it refused. A wrapper that reports every inner
      // rejection at the root makes one narrowing hide them all (G1), so each
      // registered parser must keep its issue paths.
      const payload = instanceOf(schemaFor(entry), 'maximal', entry.branch);
      const leaf = firstLeaf(payload);
      expect(leaf, `${entry.label}: the contract payload has no field to corrupt`).not.toBeNull();
      const corrupted = withLeafReplaced(payload, leaf!.path, mistypedValue(leaf!.value));
      const result = entry.parser.safeParse(corrupted);
      expect(result.success, `${entry.label} accepted a mistyped ${leaf!.path.join('.')}`).toBe(false);
      const reported = result.success ? [] : result.error.issues.map((issue) => issue.path.map(String));
      const corruptedPath = leaf!.path.map(String);
      const atField = reported.some((path) => path.length > 0
        && path.every((segment, index) => corruptedPath[index] === segment));
      expect(
        atField,
        `${entry.label} reported the mistyped ${corruptedPath.join('.')} at ${reported.map((path) => path.join('.') || '<root>').join(', ')}, not at that field or an enclosing union`,
      ).toBe(true);
    },
  );

  it.each([
    ['getQuestionnaireQuestions', ['data']],
    ['saveQuestionnaireDraft', ['data', 'answers']],
    ['submitQuestionnaire', ['data', 'answers']],
    ['revertQuestionnaireToDraft', ['data', 'answers']],
  ] as const)('%s reads every question it is served', (label, listPath) => {
    // Each of these responses carries the questionnaire's question list, which
    // is parsed after its envelope. The registration must read the list too,
    // or no guard mode can see a question field the client narrows (G1).
    const entry = parsers.find((candidate) => candidate.label === label);
    expect(entry, `${label} is no longer registered`).toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'minimal', entry!.branch);
    const questionKey = [...listPath, 0, 'options', 'questionKey'];
    const result = entry!.parser.safeParse(withLeafReplaced(payload, questionKey, 70_000));
    const reported = result.success ? [] : result.error.issues.map((issue) => issue.path.map(String).join('.'));
    expect(reported, `${label} did not refuse a mistyped question key`).toContain(questionKey.join('.'));
  });

  it.each([
    ['getQuestionnaireQuestions', ['data']],
    ['saveQuestionnaireDraft', ['data', 'answers']],
    ['submitQuestionnaire', ['data', 'answers']],
    ['revertQuestionnaireToDraft', ['data', 'answers']],
  ] as const)('%s reports an answer envelope rejection at the envelope field', (label, listPath) => {
    // Each question's answer is checked against that question's answer type by
    // a nested parse. Unless the parse reports each rejection at the envelope
    // field that caused it, a narrowing at the answer hides every drift inside
    // the envelope from every guard mode (G2).
    const entry = parsers.find((candidate) => candidate.label === label);
    expect(entry, `${label} is no longer registered`).toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'minimal', entry!.branch);
    expect(entry!.parser.safeParse(payload).success, `${label} refused its minimal contract payload`).toBe(true);
    const answer = [...listPath, 0, 'answer'];
    for (const [field, value] of [
      ['state', 70_000],
      ['updatedAt', 70_000],
      ['value', 'x'.repeat(OVER_LONG_LENGTH)],
      ['unexpectedField', 'unexpected'],
    ] as const) {
      const result = entry!.parser.safeParse(withLeafReplaced(payload, [...answer, field], value));
      const reported = result.success ? [] : result.error.issues.flatMap(issuePaths);
      expect(reported, `${label} did not report the corrupted answer ${field} at that field`).toContain([...answer, field].join('.'));
    }
  });

  it('keeps every declared narrowing pointed at a real contract property', () => {
    // A narrowing that no longer corresponds to a rejected path is stale, and
    // would silently widen what the guard tolerates.
    for (const entry of parsers) {
      const rejected = new Set<string>();
      for (const mode of modes) {
        const result = entry.parser.safeParse(instanceOf(schemaFor(entry), mode, entry.branch));
        if (result.success) continue;
        for (const path of result.error.issues.flatMap(issuePaths)) rejected.add(path);
      }
      for (const path of entry.narrowedPaths ?? []) {
        expect(
          [...rejected],
          `${entry.label} declares a narrowing on ${path} that nothing rejects — the contract and client now agree, so remove it.`,
        ).toContain(path);
      }
    }
  });

  it('never lets a narrowing hide a rejection below it', () => {
    // A narrowing tolerates the one path it names. When that path holds an
    // object or a list, a mistyped field inside it must still be reported
    // inside it, or the narrowing tolerates every drift below it as well: a
    // nested parse that reports only at its own root (G2), or a wrapper that
    // reports at data, would pass every other rule. A key the parser refuses
    // outright is exempt, because nothing below a refused key is read.
    const hidden: string[] = [];
    let examined = 0;
    for (const entry of parsers) {
      const payload = instanceOf(schemaFor(entry), 'maximal', entry.branch);
      for (const narrowed of entry.narrowedPaths ?? []) {
        const path = payloadPath(payload, narrowed);
        const held = path ? valueAtPath(payload, path) : undefined;
        const leaf = held !== null && typeof held === 'object' ? firstLeaf(held) : null;
        if (!path || !leaf) continue;
        examined += 1;
        const leafPath = [...path, ...leaf.path];
        const result = entry.parser.safeParse(withLeafReplaced(payload, leafPath, mistypedValue(leaf.value)));
        const issues = result.success ? [] : result.error.issues;
        const refusedOutright = issues.some((issue) => issue.code === 'unrecognized_keys' && issuePaths(issue).includes(narrowed));
        const reportedBelow = issues.some((issue) => issue.path.length > path.length
          && issue.path.every((segment, index) => String(segment) === String(leafPath[index])));
        if (!refusedOutright && !reportedBelow) {
          const reported = issues.map((issue) => issue.path.map(String).join('.') || '<root>').join(', ');
          hidden.push(`${entry.label}: ${narrowed} hides the mistyped ${leafPath.join('.')} (reported at ${reported || 'nothing; the payload was accepted'})`);
        }
      }
    }
    expect(examined, 'no narrowing holds an object or a list, so this rule checked nothing').toBeGreaterThan(0);
    expect(hidden).toEqual([]);
  });

  it('never grandfathers the Phase 7 parsers', () => {
    // IN-03 is resolved by contract (D-05): each of these parsers mirrors the
    // bounds the specification declares, so none may be excused from the
    // boundary modes, and a parser registered since is held to the same rule.
    for (const label of phase7Labels) {
      expect(parsers.some((entry) => entry.label === label), `${label} is no longer registered`).toBe(true);
      expect(grandfatheredLabels.has(label), `${label} is a Phase 7 parser and may not be grandfathered`).toBe(false);
    }
  });

  it('keeps every grandfathered label pointed at a parser that still rejects a boundary payload', () => {
    // An entry that nothing rejects any more would silently widen what the
    // guard tolerates, exactly as a stale narrowedPaths entry would.
    for (const [label, reason] of Object.entries(boundaryGrandfathered)) {
      expect(reason.trim().length, `${label} is grandfathered without a reason`).toBeGreaterThan(0);
      const entry = parsers.find((candidate) => candidate.label === label);
      expect(entry, `STALE_GRANDFATHER ${label}: no registered parser carries this label; remove it`).toBeDefined();
      const rejects = boundaryModes.some((mode) => unregisteredRejection(entry!, mode) !== null);
      expect(rejects, `STALE_GRANDFATHER ${label}: its parser accepts both boundary payloads; remove it`).toBe(true);
    }
  });

  it('records the grandfather backlog count so it changes only deliberately', () => {
    // The VERIFICATION backlog figure (D-40): one pre-Phase-8 parser per entry
    // whose client bound the contract does not declare. Declaring a bound in
    // the contract or dropping it from a parser lowers this number on purpose.
    // It rose from 33 to 43 with G1: the eight administration parsers and the
    // Risk Register parser had been hidden behind a root-reporting wrapper, and
    // the question list behind a registration that stopped at its envelope, so
    // their bounds were already there, not new.
    expect(Object.keys(boundaryGrandfathered).length).toBe(43);
  });

  it('rejects duplicate, omitted, parser-free, and unresolved parser declarations', () => {
    expect(() => validateInventory(responseParserModuleInventory)).not.toThrow();
    expect(() => validateInventory([...responseParserModuleInventory, requestResponseParserModule])).toThrow('Duplicate parser module declaration');
    expect(() => validateInventory([{ ...requestResponseParserModule, parsers: [] }])).toThrow('Parser-bearing module has no descriptors');
    expect(() => validateInventory([{ ...parserFreeModules[0], parsers: requestResponseParserModule.parsers }])).toThrow('Parser-free module declaration contradicts');
    expect(() => validateInventory([{ ...requestResponseParserModule, parsers: [{ ...requestResponseParserModule.parsers[0], path: '/missing' }] }])).toThrow('cannot resolve');
  });

  it('covers every parser the services expose to the guard', () => {
    expect(parsers.length).toBeGreaterThan(0);
    for (const entry of parsers) {
      expect(() => schemaFor(entry), `${entry.label} names an unresolvable contract response.`).not.toThrow();
    }
  });
});
