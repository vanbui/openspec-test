import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

// The parsers live beside the server-only transport; the guard needs the real
// schemas, not the network layer they are used with.
vi.mock('server-only', () => ({}));

import { responseParserModule as assessmentResponseParserModule, type ContractResponseParser } from './assessments/assessment-service';
import { analystRiskDetailSchema, riskWithdrawalSchema } from './assessments/assessment-schema';
import { parserFreeModules } from './parser-free-modules';
import { responseParserModule as requestResponseParserModule } from './requests/request-service';
import { responseParserModule as questionnaireResponseParserModule } from './questionnaires/questionnaire-service';
import { responseParserModule as riskSchemaResponseParserModule, riskDetailSchema, riskRegisterQuerySchema } from './risks/risk-schema';
import { responseParserModule as riskServiceResponseParserModule } from './risks/risk-service';
import { responseParserModule as administrationResponseParserModule } from './administration/administration-service';
import { responseParserModule as alertResponseParserModule } from './alerts/alert-service';
import { responseParserModule as analystDashboardResponseParserModule } from './analyst-dashboard/analyst-dashboard-service';
import { responseParserModule as reportResponseParserModule } from './reports/report-service';
import { responseParserModule as requestorHomeResponseParserModule } from './home/requestor-home-service';
import { responseParserModule as accessResponseParserModule } from './access/access-service';
import { responseParserModule as aiAssistanceResponseParserModule } from './ai-assistance/ai-assistance-service';
import { responseParserModule as questionnaireAiResponseParserModule } from './questionnaire-ai/questionnaire-ai-service';
import { responseParserModule as riskCurationResponseParserModule } from './risk-curation/risk-curation-service';
import { responseParserModule as requestAssignmentResponseParserModule } from './request-assignment/assignment-service';
import { responseParserModule as requestNotesResponseParserModule } from './request-notes/notes-service';
import { responseParserModule as requestAttachmentsResponseParserModule } from './attachments/attachments-service';
import { ATTACHMENT_RESPONSE_CONTENT_TYPES, EXPORT_RESPONSE_CONTENT_TYPES } from '../lib/files/file-response';

/**
 * A binary success response a service reads with a binary parse (Phase 14 D-24, Phase 19 D-19): the operation, and the
 * media types its shared file-response validator accepts, which must be exactly the 200's declared content.
 */
type ContractFileResponse = {
  readonly label: string;
  readonly path: string;
  readonly method: 'get' | 'post';
  readonly contentTypes: readonly string[];
};

/**
 * `parsers`: the module parses JSON responses (and may also read files); `file-response`: it reads files only, each
 * checked by the shared validator rather than a zod parser; `no-direct-response-parser`: it parses nothing itself.
 */
type ResponseParserModule = {
  readonly modulePath: string;
  readonly mode: 'parsers' | 'no-direct-response-parser' | 'file-response';
  readonly parsers: readonly ContractResponseParser[];
  readonly fileResponses?: readonly ContractFileResponse[];
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
  requestorHomeResponseParserModule,
  accessResponseParserModule,
  aiAssistanceResponseParserModule,
  questionnaireAiResponseParserModule,
  riskCurationResponseParserModule,
  requestAssignmentResponseParserModule,
  requestNotesResponseParserModule,
  requestAttachmentsResponseParserModule,
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
  // Phase 2 — the request family (features/requests/request-service.ts). The request list parser retired with
  // its last caller, the Requestor dashboard read, when the Requestor Home moved to GET /v1/my_requests (11-12).
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

/**
 * The file-response mode (14-RESEARCH Pitfall 12): a binary 200 declares no JSON, and each of its media types is a
 * string with that `contentMediaType`. The validator's accepted types must be exactly the declared ones, so the
 * contract cannot add a type the web would refuse, or the web accept one the contract does not serve.
 */
function checkFileResponse(entry: ContractFileResponse): void {
  const content = specification.paths[entry.path]?.[entry.method]?.responses?.['200']?.content;
  if (!content) throw new Error(`${entry.label} cannot resolve ${entry.method.toUpperCase()} ${entry.path} 200 file response.`);
  const declared = Object.keys(content);
  if (declared.includes('application/json')) throw new Error(`${entry.label} declares a JSON 200, not a file response.`);
  for (const mediaType of declared) {
    const schema = content[mediaType]?.schema as JsonObject | undefined;
    if (schema?.type !== 'string' || schema.contentMediaType !== mediaType) {
      throw new Error(`${entry.label} declares ${mediaType} without a string schema of that contentMediaType.`);
    }
  }
  if ([...declared].sort().join(' ') !== [...entry.contentTypes].sort().join(' ')) {
    throw new Error(`${entry.label} file response content types differ from the contract: ${declared.join(', ')}`);
  }
}

function validateInventory(inventory: readonly ResponseParserModule[]): void {
  const paths = new Set<string>();
  const labels = new Set<string>();
  for (const module of inventory) {
    if (paths.has(module.modulePath)) throw new Error(`Duplicate parser module declaration: ${module.modulePath}`);
    paths.add(module.modulePath);
    const fileResponses = module.fileResponses ?? [];
    if (module.mode === 'parsers' && module.parsers.length === 0) {
      throw new Error(`Parser-bearing module has no descriptors: ${module.modulePath}`);
    }
    if (module.mode === 'no-direct-response-parser' && (!module.reason || module.parsers.length !== 0 || fileResponses.length !== 0)) {
      throw new Error(`Parser-free module declaration contradicts its parser registry: ${module.modulePath}`);
    }
    if (module.mode === 'file-response' && (fileResponses.length === 0 || module.parsers.length !== 0)) {
      throw new Error(`File-response module declaration contradicts its registry: ${module.modulePath}`);
    }
    for (const parser of module.parsers) {
      if (labels.has(parser.label)) throw new Error(`Duplicate response parser descriptor: ${parser.label}`);
      labels.add(parser.label);
      schemaFor(parser);
    }
    for (const fileResponse of fileResponses) {
      if (labels.has(fileResponse.label)) throw new Error(`Duplicate response parser descriptor: ${fileResponse.label}`);
      labels.add(fileResponse.label);
      checkFileResponse(fileResponse);
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
  // A patterned string the contract gives an example for (a closed key such as a proposal item's `i-1`) takes that example.
  if (typeof schema.pattern === 'string') return Array.isArray(schema.examples) && typeof schema.examples[0] === 'string' ? schema.examples[0] : 'ASM-2026-33SAEN';
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
      'features/ai-assistance/ai-assistance-actions.ts',
      'features/ai-assistance/ai-assistance-service.ts',
      'features/administration/administration-actions.ts',
      'features/administration/administration-service.ts',
      'features/alerts/alert-service.ts',
      'features/analyst-dashboard/analyst-dashboard-service.ts',
      'features/assessments/assessment-actions.ts',
      'features/assessments/assessment-service.ts',
      'features/attachments/attachments-service.ts',
      'features/home/requestor-home-service.ts',
      'features/questionnaire-ai/questionnaire-ai-actions.ts',
      'features/questionnaire-ai/questionnaire-ai-service.ts',
      'features/questionnaires/questionnaire-actions.ts',
      'features/questionnaires/questionnaire-service.ts',
      'features/reports/report-service.ts',
      'features/request-assignment/assignment-service.ts',
      'features/request-notes/notes-service.ts',
      'features/requests/request-actions.ts',
      'features/requests/request-service.ts',
      'features/risk-curation/risk-curation-actions.ts',
      'features/risk-curation/risk-curation-service.ts',
      'features/risks/risk-actions.ts',
      'features/risks/risk-schema.ts',
      'features/risks/risk-service.ts',
    ].sort());
    for (const module of responseParserModuleInventory) {
      const declared = module.mode === 'parsers'
        ? module.parsers.length > 0
        : module.mode === 'file-response' ? (module.fileResponses ?? []).length > 0 : Boolean(module.reason);
      expect(declared).toBe(true);
    }
  });

  it('registers the request attachment download in the file-response mode against the contract’s eight media types (14-07, D-23, D-24)', () => {
    const fileResponses: readonly ContractFileResponse[] = (requestAttachmentsResponseParserModule as ResponseParserModule).fileResponses ?? [];
    expect(fileResponses.map((entry) => [entry.label, entry.method, entry.path])).toEqual([
      ['downloadRequestAttachment', 'get', '/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content'],
    ]);
    const content = specification.paths['/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content']?.get?.responses?.['200']?.content ?? {};
    expect(Object.keys(content)).toEqual([...ATTACHMENT_RESPONSE_CONTENT_TYPES]);
    expect(fileResponses[0]?.contentTypes).toEqual(ATTACHMENT_RESPONSE_CONTENT_TYPES);
    expect(() => validateInventory([requestAttachmentsResponseParserModule])).not.toThrow();
    // The mode is checked both ways: a type the contract does not serve, a JSON 200 and an empty file-only module fail.
    const download = fileResponses[0]!;
    expect(() => validateInventory([{ ...requestAttachmentsResponseParserModule, fileResponses: [{ ...download, contentTypes: [...download.contentTypes, 'text/html'] }] }]))
      .toThrow('file response content types differ from the contract');
    expect(() => validateInventory([{ ...requestAttachmentsResponseParserModule, fileResponses: [{ ...download, path: '/v1/assessment_requests/{requestId}/attachments' }] }]))
      .toThrow('declares a JSON 200');
    expect(() => validateInventory([{ modulePath: 'features/exports/export-service.ts', mode: 'file-response', parsers: [], fileResponses: [] }]))
      .toThrow('File-response module declaration contradicts');
  });

  it('registers the Risk register export in the file-response mode against the two export media types (19-06, D-19)', () => {
    const fileResponses: readonly ContractFileResponse[] = (riskServiceResponseParserModule as ResponseParserModule).fileResponses ?? [];
    expect(fileResponses.map((entry) => [entry.label, entry.method, entry.path])).toEqual([
      ['risks.exportRiskRegister', 'get', '/v1/risks/export'],
    ]);
    // Exactly the validator's registered values, the CSV with its charset parameter: the guard drops no parameter.
    expect(fileResponses[0]?.contentTypes).toEqual(Object.values(EXPORT_RESPONSE_CONTENT_TYPES));
    expect([...(fileResponses[0]?.contentTypes ?? [])].sort()).toEqual([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv; charset=utf-8',
    ]);
    const content = specification.paths['/v1/risks/export']?.get?.responses?.['200']?.content ?? {};
    expect(Object.keys(content).sort()).toEqual([...Object.values(EXPORT_RESPONSE_CONTENT_TYPES)].sort());
    expect(() => validateInventory([riskServiceResponseParserModule])).not.toThrow();
    const exported = fileResponses[0]!;
    // The essence alone is not the declared type, so the guard refuses a registration that drops the parameter.
    expect(() => validateInventory([{ ...riskServiceResponseParserModule, fileResponses: [{ ...exported, contentTypes: ['text/csv', EXPORT_RESPONSE_CONTENT_TYPES.xlsx] }] }]))
      .toThrow('file response content types differ from the contract');
  });

  /*
   * 19-15 (D-31 to D-33; 19-PLAN-CHECK recheck C NB1): the Administration files the import flow and the reference lists
   * read, each registered in the task that adds its call: the four templates (Task 1), the four error reports (Task 2)
   * and the four reference-list exports (Task 3).
   */
  it('registers the Administration import files in the file-response inventory against the two export media types (19-15)', () => {
    const fileResponses: readonly ContractFileResponse[] = (administrationResponseParserModule as ResponseParserModule).fileResponses ?? [];
    expect(fileResponses.map((entry) => `${entry.method.toUpperCase()} ${entry.path}`)).toEqual([
      'GET /v1/risk_types/import/template',
      'GET /v1/controls/import/template',
      'GET /v1/information_systems/import/template',
      'GET /v1/information_assets/import/template',
      'POST /v1/risk_types/import/error_report',
      'POST /v1/controls/import/error_report',
      'POST /v1/information_systems/import/error_report',
      'POST /v1/information_assets/import/error_report',
      'GET /v1/risk_types/export',
      'GET /v1/controls/export',
      'GET /v1/information_systems/export',
      'GET /v1/information_assets/export',
    ]);
    for (const entry of fileResponses) {
      expect(entry.contentTypes, entry.label).toEqual(['text/csv; charset=utf-8', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
      expect(() => checkFileResponse(entry), entry.label).not.toThrow();
    }
    expect(() => validateInventory([administrationResponseParserModule])).not.toThrow();
  });

  it('registers all ten export operations in the file-response mode against the two export media types (19-11, D-19)', () => {
    const exports = responseParserModuleInventory
      .flatMap((module) => module.fileResponses ?? [])
      .filter((entry) => !entry.path.includes('/import/') && !['/v1/risk_types/export', '/v1/controls/export', '/v1/information_systems/export', '/v1/information_assets/export'].includes(entry.path))
      .filter((entry) => !(ATTACHMENT_RESPONSE_CONTENT_TYPES as readonly string[]).every((type) => entry.contentTypes.includes(type)));
    expect(exports.map((entry) => `${entry.method.toUpperCase()} ${entry.path}`).sort()).toEqual([
      'GET /v1/alerts/export',
      'GET /v1/assessment_requests/export',
      'GET /v1/my_questionnaires/export',
      'GET /v1/my_requests/export',
      'GET /v1/my_risk_assessments/export',
      'GET /v1/questionnaires/export',
      'GET /v1/risk_assessments/export',
      'GET /v1/risk_assessments/{assessmentId}/export',
      'GET /v1/risks/export',
      'POST /v1/reports/{reportKey}/export',
    ]);
    for (const entry of exports) {
      expect(entry.contentTypes, entry.label).toEqual(['text/csv; charset=utf-8', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
      expect(() => checkFileResponse(entry), entry.label).not.toThrow();
    }
  });

  it('registers the request attachment removal against its closed body and the attachment response (14-08, D-04 item 4)', () => {
    const removal = ((specification.paths as unknown as Record<string, JsonObject>)['/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal'] as JsonObject | undefined)?.put as JsonObject | undefined;
    expect(removal).toBeDefined();
    expect(((removal!.requestBody as JsonObject).content as JsonObject)).toEqual({
      'application/json': { schema: { $ref: '#/components/schemas/RequestAttachmentRemovalRequest' } },
    });
    expect((((removal!.responses as JsonObject)['200'] as JsonObject).content as JsonObject)).toEqual({
      'application/json': { schema: { $ref: '#/components/schemas/RequestAttachmentResponse' } },
    });
    const body = specification.components.schemas.RequestAttachmentRemovalRequest as JsonObject;
    expect(body.additionalProperties).toBe(false);
    expect(((body.properties as JsonObject).data as JsonObject).additionalProperties).toBe(false);
    expect(Object.keys(((body.properties as JsonObject).data as JsonObject).properties as JsonObject)).toEqual(['removed']);
  });

  it('registers the request attachment AI inclusion against its closed body and the preview against its closed text response (14-09, D-30, D-31)', () => {
    const paths = specification.paths as unknown as Record<string, JsonObject>;
    const setAiInput = (paths['/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input'] as JsonObject | undefined)?.put as JsonObject | undefined;
    expect(setAiInput).toBeDefined();
    expect(((setAiInput!.requestBody as JsonObject).content as JsonObject)).toEqual({
      'application/json': { schema: { $ref: '#/components/schemas/RequestAttachmentAiInputRequest' } },
    });
    expect((((setAiInput!.responses as JsonObject)['200'] as JsonObject).content as JsonObject)).toEqual({
      'application/json': { schema: { $ref: '#/components/schemas/RequestAttachmentResponse' } },
    });
    const body = specification.components.schemas.RequestAttachmentAiInputRequest as JsonObject;
    expect(body.additionalProperties).toBe(false);
    expect(((body.properties as JsonObject).data as JsonObject).additionalProperties).toBe(false);
    expect(Object.keys(((body.properties as JsonObject).data as JsonObject).properties as JsonObject)).toEqual(['included']);
    const getAiText = (paths['/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text'] as JsonObject | undefined)?.get as JsonObject | undefined;
    expect(getAiText).toBeDefined();
    expect((((getAiText!.responses as JsonObject)['200'] as JsonObject).content as JsonObject)).toEqual({
      'application/json': { schema: { $ref: '#/components/schemas/RequestAttachmentAiTextResponse' } },
    });
    // The analysts' AI facts on a file are optional, so a Requestor's file, which carries none, is the same component.
    const attachment = specification.components.schemas.RequestAttachment as JsonObject;
    expect(((attachment.properties as JsonObject).ai as JsonObject | undefined)?.$ref).toBe('#/components/schemas/RequestAttachmentAi');
    expect(attachment.required as string[]).not.toContain('ai');
    // The section's AI policy is the analysts' optional meta (D-28, D-30).
    const meta = specification.components.schemas.RequestAttachmentListMeta as JsonObject;
    expect(((meta.properties as JsonObject).aiPolicy as JsonObject | undefined)?.$ref).toBe('#/components/schemas/RequestAttachmentAiPolicy');
    expect(meta.required as string[]).not.toContain('aiPolicy');
  });

  it('publishes the request read’s optional file summary as the closed RequestAttachmentSummary, and the delete’s second reason (14-08, D-04 items 7 and 11)', () => {
    const read = ((specification.paths as unknown as Record<string, JsonObject>)['/csrm-assessment-requests/{id}'] as JsonObject).get as JsonObject;
    const data = ((((read.responses as JsonObject)['200'] as JsonObject).content as JsonObject)['application/json'] as JsonObject).schema as JsonObject;
    const document = (data.properties as JsonObject).data as JsonObject;
    expect(((document.properties as JsonObject).attachments as JsonObject | undefined)?.$ref).toBe('#/components/schemas/RequestAttachmentSummary');
    // Optional: only a reader of the request's attachments gets it (D-18).
    expect(document.required as string[]).not.toContain('attachments');
    const summary = specification.components.schemas.RequestAttachmentSummary as JsonObject | undefined;
    expect(summary?.additionalProperties).toBe(false);
    const addFacts = specification.components.schemas.RequestAttachmentAddFacts as JsonObject;
    expect(Object.keys((summary?.properties ?? {}) as JsonObject)).toEqual(['count', ...Object.keys(addFacts.properties as JsonObject)]);
    expect(summary?.required).toEqual(['count', ...(addFacts.required as string[])]);
    const remove = ((specification.paths as unknown as Record<string, JsonObject>)['/csrm-assessment-requests/{id}'] as JsonObject).delete as JsonObject;
    expect(String(((remove.responses as JsonObject)['409'] as JsonObject).description)).toContain('REQUEST_HAS_ATTACHMENTS');
  });

  it('registers the request attachments parsers against their components, and the upload sends multipart (14-06, D-04)', () => {
    expect(requestAttachmentsResponseParserModule.parsers.map((entry) => [entry.label, entry.component])).toEqual([
      ['listRequestAttachments', 'RequestAttachmentListResponse'],
      ['uploadRequestAttachment', 'RequestAttachmentResponse'],
      ['setRequestAttachmentRemoval', 'RequestAttachmentResponse'],
      ['setRequestAttachmentAiInput', 'RequestAttachmentResponse'],
      ['getRequestAttachmentAiText', 'RequestAttachmentAiTextResponse'],
    ]);
    const upload =((specification.paths as unknown as Record<string, JsonObject>)['/v1/assessment_requests/{requestId}/attachments'] as JsonObject).post as JsonObject;
    const content = (upload.requestBody as JsonObject).content as JsonObject;
    expect(Object.keys(content)).toEqual(['multipart/form-data']);
    const body = specification.components.schemas.RequestAttachmentUploadRequest as JsonObject;
    expect(body.additionalProperties).toBe(false);
    expect(Object.keys(body.properties as JsonObject).sort()).toEqual(['file', 'noteId']);
    expect(((upload.responses as JsonObject)['201'] as JsonObject).content).toEqual({
      'application/json': { schema: { $ref: '#/components/schemas/RequestAttachmentResponse' } },
    });
    // D-05: no stored-file fact is part of the served attachment.
    const served = Object.keys((specification.components.schemas.RequestAttachment as JsonObject).properties as JsonObject);
    for (const secret of ['sha256', 'hash', 'url', 'aiText', 'file']) expect(served).not.toContain(secret);
  });

  it('registers the Phase 16 risk curation parsers against their components (16-11, D-02)', () => {
    expect(riskCurationResponseParserModule.parsers.map((entry) => [entry.label, entry.component])).toEqual([
      ['withdrawRisks', 'RiskCurationResponse'],
      ['reinstateRisks', 'RiskCurationResponse'],
      ['getRiskHistory', 'RiskHistoryResponse'],
      ['startRiskSuggestions', 'RiskProposalJobResponse'],
      ['startRiskRewrite', 'RiskProposalJobResponse'],
      ['getRiskProposalJob', 'RiskProposalJobResponse'],
      ['retryRiskProposalJob', 'RiskProposalJobResponse'],
      ['listRiskAiProposals', 'RiskAiProposalsResponse'],
      ['decideRiskProposals', 'AiProposalDecisionResponse'],
    ]);
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
    ['getQuestionnaireQuestionPlacements', ['data']],
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

  it('parses the request queue item with its five triage fields, closed against any other key (D-02 item 1)', () => {
    const triageFields = ['requestorName', 'assessmentType', 'businessCriticality', 'dueDate', 'daysSinceSubmission'];
    const item = specification.components.schemas.AssessmentRequestQueueItem as { required?: string[]; additionalProperties?: unknown };
    expect(item.required ?? []).toEqual(expect.arrayContaining(triageFields));
    expect(item.additionalProperties).toBe(false);

    const entry = parsers.find((candidate) => candidate.label === 'listAssessmentRequests');
    expect(entry, 'listAssessmentRequests is no longer registered').toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>> };
    const parsed = entry!.parser.safeParse(payload);
    expect(parsed.success, formatIssues(parsed.error)).toBe(true);
    expect(Object.keys((parsed.data as { data: Array<Record<string, unknown>> }).data[0])).toEqual(expect.arrayContaining(triageFields));

    const extra = { ...payload, data: [{ ...payload.data[0], requestorEmail: 'jane.doe@idambox.com' }] };
    const refused = entry!.parser.safeParse(extra);
    expect(refused.success).toBe(false);
    expect(refused.success ? [] : refused.error.issues.flatMap(issuePaths)).toContain('data.0.requestorEmail');
  });

  it('parses the request queue item’s assignee, pick-up state and new-note count, and the read’s viewer, all required (13-12; D-13)', () => {
    const fields = ['assignee', 'pickUp', 'unreadNotes'];
    const item = specification.components.schemas.AssessmentRequestQueueItem as { required?: string[]; properties?: Record<string, { enum?: unknown[] }> };
    expect(item.required ?? []).toEqual(expect.arrayContaining(fields));
    expect(item.properties?.pickUp?.enum).toEqual(['allowed', 'own-request', 'not-offered']);
    const meta = specification.components.schemas.AssessmentRequestQueueMeta as { required?: string[]; additionalProperties?: unknown };
    expect(meta.required ?? []).toEqual(['pagination', 'viewer']);
    expect(meta.additionalProperties).toBe(false);

    const entry = parsers.find((candidate) => candidate.label === 'listAssessmentRequests');
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
    const parsed = entry!.parser.safeParse(payload);
    expect(parsed.success, formatIssues(parsed.error)).toBe(true);
    expect(Object.keys((parsed.data as { data: Array<Record<string, unknown>> }).data[0])).toEqual(expect.arrayContaining(fields));

    const { viewer: _viewer, ...metaWithoutViewer } = payload.meta;
    expect(entry!.parser.safeParse({ ...payload, meta: metaWithoutViewer }).success).toBe(false);
    const assigneeWithEmail = { ...payload, data: [{ ...payload.data[0], assignee: { documentId: 'sam-id', displayName: 'Sam Analyst', email: 'sam@example.test' } }] };
    expect(entry!.parser.safeParse(assigneeWithEmail).success).toBe(false);
  });

  it('parses the assessment list item with its request title, Risk count and highest residual rating, closed against any other key (D-02 item 2)', () => {
    const listFields = ['requestTitle', 'riskCount', 'highestResidualRating'];
    const item = specification.components.schemas.AssessmentSummary as { required?: string[]; additionalProperties?: unknown };
    expect(item.required ?? []).toEqual(expect.arrayContaining(listFields));
    expect(item.additionalProperties).toBe(false);

    for (const label of ['listAnalystAssessments', 'listMyReleasedAssessments', 'listRiskRegisterAssessments']) {
      const entry = parsers.find((candidate) => candidate.label === label);
      expect(entry, `${label} is no longer registered`).toBeDefined();
      const generated = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>> };
      // A released item, so the Requestor parser's released-only narrowing (data.0.assessmentStatus) holds too.
      const payload = { ...generated, data: [{ ...generated.data[0], assessmentStatus: 'approved', approvalDate: '2026-09-27T00:30:00.000Z' }] };
      const parsed = entry!.parser.safeParse(payload);
      expect(parsed.success, `${label}: ${formatIssues(parsed.error)}`).toBe(true);
      expect(Object.keys((parsed.data as { data: Array<Record<string, unknown>> }).data[0])).toEqual(expect.arrayContaining(listFields));

      const extra = { ...payload, data: [{ ...payload.data[0], requestNumber: 'RAR-2026-EXTRA' }] };
      const refused = entry!.parser.safeParse(extra);
      expect(refused.success, label).toBe(false);
      expect(refused.success ? [] : refused.error.issues.flatMap(issuePaths)).toContain('data.0.requestNumber');
    }
  });

  it('parses the Risk Register detail with its required, closed withdrawal block and reads the withdrawn state filter (16-07, D-02, D-08, D-45)', () => {
    const detail = specification.components.schemas.RiskDetail as { required?: string[]; properties?: Record<string, JsonObject>; additionalProperties?: unknown };
    expect(detail.additionalProperties).toBe(false);
    expect(detail.required ?? []).toContain('withdrawal');
    expect(detail.properties?.withdrawal?.anyOf).toEqual([{ $ref: '#/components/schemas/RiskWithdrawal' }, { type: 'null' }]);
    expect(Object.keys(riskDetailSchema.shape).sort()).toEqual(Object.keys(detail.properties ?? {}).sort());
    const block = { at: '2026-10-15T01:02:03.000Z', by: { documentId: 'user-bob', displayName: 'Bob Doe' }, reason: 'Proposed under the wrong Risk Type' };
    const withdrawalSchema = (riskDetailSchema.shape as Record<string, { safeParse: (value: unknown) => { success: boolean } }>).withdrawal;
    expect(withdrawalSchema, 'the register detail parser has no withdrawal').toBeDefined();
    for (const value of [null, block, { ...block, by: null }]) {
      expect(withdrawalSchema!.safeParse(value).success).toBe(riskWithdrawalSchema.nullable().safeParse(value).success);
    }
    expect(withdrawalSchema!.safeParse({ ...block, undo: false }).success).toBe(false);

    const operation = specification.paths['/v1/risks'].get as { parameters: Array<{ name: string; schema: { enum?: unknown[] } }> };
    const published = operation.parameters.find((parameter) => parameter.name === 'state')?.schema.enum;
    expect(published).toEqual(['open', 'closed', 'withdrawn']);
    for (const value of published ?? []) {
      expect(riskRegisterQuerySchema.parse({ state: value }).state, `state=${String(value)}`).toBe(value);
    }
    expect(riskRegisterQuerySchema.parse({ state: 'off-the-vocabulary' }).state).toBeUndefined();
  });

  it('parses the analyst Risk detail with its required, closed withdrawal block, key for key with the contract (16-06, D-02, D-03 item 9)', () => {
    const detail = specification.components.schemas.AnalystRiskDetail as { required?: string[]; properties?: Record<string, JsonObject>; additionalProperties?: unknown };
    expect(detail.additionalProperties).toBe(false);
    expect(detail.required ?? []).toContain('withdrawal');
    expect(detail.properties?.withdrawal?.anyOf).toEqual([{ $ref: '#/components/schemas/RiskWithdrawal' }, { type: 'null' }]);
    expect(Object.keys(analystRiskDetailSchema.shape).sort()).toEqual(Object.keys(detail.properties ?? {}).sort());

    const withdrawal = specification.components.schemas.RiskWithdrawal as { required?: string[]; properties?: Record<string, JsonObject>; additionalProperties?: unknown };
    expect(withdrawal, 'RiskWithdrawal is not published').toBeDefined();
    expect(withdrawal.additionalProperties).toBe(false);
    expect(withdrawal.required).toEqual(['at', 'by', 'reason']);
    expect(Object.keys(riskWithdrawalSchema.shape).sort()).toEqual(Object.keys(withdrawal.properties ?? {}).sort());
    expect(withdrawal.properties?.reason).toMatchObject({ type: 'string', minLength: 1, maxLength: 500 });

    // The analyst detail's registered parser; a released instance, so its released-only narrowings hold too.
    const entry = parsers.find((candidate) => candidate.label === 'getReleasedAssessment (analyst actor)');
    expect(entry, 'the analyst assessment detail is not registered').toBeDefined();
    const generated = instanceOf(schemaFor(entry!), 'maximal', entry!.branch) as { data: { risks: Array<Record<string, unknown>> } };
    const released = { assessmentStatus: 'approved', assessmentDate: '2026-10-15T01:02:03.000Z', approvalDate: '2026-10-15T01:02:03.000Z', approvedBy: { documentId: 'user-bob', displayName: 'Bob Doe' } };
    const payload = { ...generated, data: { ...generated.data, ...released } };
    expect(entry!.parser.safeParse(payload).success, 'the maximal analyst detail does not parse').toBe(true);
    const withRisk = (risk: Record<string, unknown>) => ({ ...payload, data: { ...payload.data, risks: [risk] } });
    const [risk] = payload.data.risks;
    const block = { at: '2026-10-15T01:02:03.000Z', by: { documentId: 'user-bob', displayName: 'Bob Doe' }, reason: 'Proposed under the wrong Risk Type' };
    expect(entry!.parser.safeParse(withRisk({ ...risk, withdrawal: null })).success).toBe(true);
    expect(entry!.parser.safeParse(withRisk({ ...risk, withdrawal: block })).success).toBe(true);
    const refused = entry!.parser.safeParse(withRisk({ ...risk, withdrawal: { ...block, undo: false } }));
    expect(refused.success).toBe(false);
    expect(refused.success ? [] : refused.error.issues.flatMap(issuePaths)).toContain('data.risks.0.withdrawal.undo');
  });

  it('parses my requests closed, with each item\'s holder, stage and next step and no assessment field (D-02 item 6, T-11-53)', () => {
    const item = specification.components.schemas.MyRequestItem as { required?: string[]; properties?: Record<string, { enum?: string[] }>; additionalProperties?: unknown };
    expect(item, 'MyRequestItem is not published').toBeDefined();
    expect(item.additionalProperties).toBe(false);
    expect(item.properties?.holder?.enum).toEqual(['requestor', 'analyst', 'none']);
    expect(Object.keys(item.properties ?? {}).filter((key) => /assessment/i.test(key))).toEqual([]);

    const entry = parsers.find((candidate) => candidate.label === 'request.listMyRequests');
    expect(entry, 'request.listMyRequests is not registered').toBeDefined();
    expect(entry!.path).toBe('/v1/my_requests');
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>> };
    const parsed = entry!.parser.safeParse(payload);
    expect(parsed.success, formatIssues(parsed.error)).toBe(true);

    const extra = { ...payload, data: [{ ...payload.data[0], assessmentNumber: 'ASM-2026-ABCDEF' }] };
    const refusedExtra = entry!.parser.safeParse(extra);
    expect(refusedExtra.success).toBe(false);
    expect(refusedExtra.success ? [] : refusedExtra.error.issues.flatMap(issuePaths)).toContain('data.0.assessmentNumber');

    const unknownHolder = { ...payload, data: [{ ...payload.data[0], holder: 'security-analyst' }] };
    const refusedHolder = entry!.parser.safeParse(unknownHolder);
    expect(refusedHolder.success).toBe(false);
    expect(refusedHolder.success ? [] : refusedHolder.error.issues.flatMap(issuePaths)).toContain('data.0.holder');
  });

  it('parses my requests with the assignee as a display name alone and the unread note count, and the summary with withUnreadNotes (D-17, D-24)', () => {
    const item = specification.components.schemas.MyRequestItem as { required?: string[]; properties?: Record<string, Record<string, unknown>> };
    expect(item.required ?? []).toEqual(expect.arrayContaining(['assignee', 'unreadNotes']));
    expect(item.properties?.unreadNotes).toMatchObject({ type: 'integer', minimum: 0 });
    const assignee = specification.components.schemas.MyRequestAssignee as { required?: string[]; properties?: Record<string, unknown>; additionalProperties?: unknown };
    expect(assignee, 'MyRequestAssignee is not published').toBeDefined();
    expect(Object.keys(assignee.properties ?? {})).toEqual(['displayName']);
    expect(assignee.required).toEqual(['displayName']);
    expect(assignee.additionalProperties).toBe(false);
    const summary = specification.components.schemas.MyRequestStatusSummary as { required?: string[]; properties?: Record<string, Record<string, unknown>> };
    expect(summary.required ?? []).toContain('withUnreadNotes');
    expect(summary.properties?.withUnreadNotes).toMatchObject({ type: 'integer', minimum: 0 });

    const entry = parsers.find((candidate) => candidate.label === 'request.listMyRequests');
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>> };
    const withItem = (changes: Record<string, unknown>) => ({ ...payload, data: [{ ...payload.data[0], ...changes }] });
    expect(entry!.parser.safeParse(withItem({ assignee: null, unreadNotes: 0 })).success).toBe(true);
    expect(entry!.parser.safeParse(withItem({ assignee: { displayName: 'Bob Doe' }, unreadNotes: 3 })).success).toBe(true);
    const moreThanTheName = entry!.parser.safeParse(withItem({ assignee: { displayName: 'Bob Doe', documentId: 'user-bob' } }));
    expect(moreThanTheName.success).toBe(false);
    expect(moreThanTheName.success ? [] : moreThanTheName.error.issues.flatMap(issuePaths)).toContain('data.0.assignee.documentId');
    const { unreadNotes: _omitted, ...withoutUnread } = payload.data[0]!;
    const missingUnread = entry!.parser.safeParse({ ...payload, data: [withoutUnread] });
    expect(missingUnread.success).toBe(false);
    expect(missingUnread.success ? [] : missingUnread.error.issues.flatMap(issuePaths)).toContain('data.0.unreadNotes');

    const summaryEntry = parsers.find((candidate) => candidate.label === 'request.getMyRequestStatusSummary');
    const summaryPayload = instanceOf(schemaFor(summaryEntry!), 'maximal') as { data: Record<string, unknown> };
    expect(summaryEntry!.parser.safeParse(summaryPayload).success).toBe(true);
    const { withUnreadNotes: _missing, ...withoutCount } = summaryPayload.data;
    const refusedSummary = summaryEntry!.parser.safeParse({ ...summaryPayload, data: withoutCount });
    expect(refusedSummary.success).toBe(false);
    expect(refusedSummary.success ? [] : refusedSummary.error.issues.flatMap(issuePaths)).toContain('data.withUnreadNotes');
  });

  it('parses the Risk register row with its stage, refusing a missing or unknown stage (D-02 item 3, D-44)', () => {
    const item = specification.components.schemas.RiskRegisterItem as { required?: string[]; properties?: Record<string, { enum?: string[] }>; additionalProperties?: unknown };
    expect(item.required ?? []).toContain('stage');
    expect(item.properties?.stage?.enum).toEqual(['released', 'under-assessment']);
    expect(item.additionalProperties).toBe(false);

    const entry = parsers.find((candidate) => candidate.label === 'risks.listRiskRegister');
    expect(entry, 'risks.listRiskRegister is no longer registered').toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>> };
    for (const stage of ['released', 'under-assessment']) {
      const parsed = entry!.parser.safeParse({ ...payload, data: [{ ...payload.data[0], stage }] });
      expect(parsed.success, `${stage}: ${formatIssues(parsed.error)}`).toBe(true);
    }

    const { stage: _omitted, ...withoutStage } = payload.data[0];
    const refusedMissing = entry!.parser.safeParse({ ...payload, data: [withoutStage] });
    expect(refusedMissing.success).toBe(false);
    expect(refusedMissing.success ? [] : refusedMissing.error.issues.flatMap(issuePaths)).toContain('data.0.stage');

    const refusedUnknown = entry!.parser.safeParse({ ...payload, data: [{ ...payload.data[0], stage: 'in-review' }] });
    expect(refusedUnknown.success).toBe(false);
    expect(refusedUnknown.success ? [] : refusedUnknown.error.issues.flatMap(issuePaths)).toContain('data.0.stage');
  });

  it('parses the Risk register row with its treatment action, Accept, Treat or none, refusing any other (D-02 item 3, D-44)', () => {
    const item = specification.components.schemas.RiskRegisterItem as { required?: string[]; properties?: Record<string, { enum?: unknown[] }> };
    expect(item.required ?? []).toContain('treatmentAction');
    expect(item.properties?.treatmentAction?.enum).toEqual(['Accept', 'Treat', null]);

    const entry = parsers.find((candidate) => candidate.label === 'risks.listRiskRegister');
    expect(entry, 'risks.listRiskRegister is no longer registered').toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Array<Record<string, unknown>> };
    for (const treatmentAction of ['Accept', 'Treat', null]) {
      const parsed = entry!.parser.safeParse({ ...payload, data: [{ ...payload.data[0], treatmentAction }] });
      expect(parsed.success, `${String(treatmentAction)}: ${formatIssues(parsed.error)}`).toBe(true);
    }

    const { treatmentAction: _omitted, ...withoutAction } = payload.data[0];
    const refusedMissing = entry!.parser.safeParse({ ...payload, data: [withoutAction] });
    expect(refusedMissing.success).toBe(false);
    expect(refusedMissing.success ? [] : refusedMissing.error.issues.flatMap(issuePaths)).toContain('data.0.treatmentAction');

    const refusedUnknown = entry!.parser.safeParse({ ...payload, data: [{ ...payload.data[0], treatmentAction: 'accept' }] });
    expect(refusedUnknown.success).toBe(false);
    expect(refusedUnknown.success ? [] : refusedUnknown.error.issues.flatMap(issuePaths)).toContain('data.0.treatmentAction');
  });

  /*
   * D-02 item 4, D-40 to D-42: the analyst Home's exposure is three rating counts (released, released and
   * accepted, under assessment). The parser requires all three and refuses the Phase 7 flat shape, which
   * counted both stages as one total, so it can never be read as released.
   */
  /*
   * Phase 13 (D-15): the summary's review queue carries the viewer's own counts as a closed block and the team's
   * pick-up pool, both required. The parser refuses either missing, and an `open` count no surface shows.
   */
  it('parses the dashboard review queue with the viewer’s own counts and the pick-up pool, both required (D-15)', () => {
    const queue = specification.components.schemas.DashboardReviewQueue as { required?: string[]; properties?: Record<string, unknown> } | undefined;
    expect(queue, 'DashboardReviewQueue is not published').toBeDefined();
    expect(queue!.required).toEqual(expect.arrayContaining(['mine', 'unassigned']));
    expect(queue!.properties?.mine).toEqual({ $ref: '#/components/schemas/DashboardReviewQueueMine' });
    const mine = specification.components.schemas.DashboardReviewQueueMine as { required?: string[]; additionalProperties?: unknown } | undefined;
    expect(mine, 'DashboardReviewQueueMine is not published').toBeDefined();
    expect(mine!.required).toEqual(['requiresAttention', 'awaitingRequestor', 'generationInProgress', 'withUnreadNotes']);
    expect(mine!.additionalProperties).toBe(false);

    const entry = parsers.find((candidate) => candidate.label === 'analystDashboard.getDashboardSummary');
    expect(entry, 'analystDashboard.getDashboardSummary is no longer registered').toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Record<string, unknown> & { reviewQueue: Record<string, unknown> & { mine: Record<string, unknown> } } };
    expect(entry!.parser.safeParse(payload).success).toBe(true);
    const { mine: _mine, ...withoutMine } = payload.data.reviewQueue;
    const { unassigned: _unassigned, ...withoutPool } = payload.data.reviewQueue;
    for (const [path, reviewQueue] of [
      ['data.reviewQueue.mine', withoutMine],
      ['data.reviewQueue.unassigned', withoutPool],
      ['data.reviewQueue.mine', { ...payload.data.reviewQueue, mine: { ...payload.data.reviewQueue.mine, open: 1 } }],
    ] as const) {
      const refused = entry!.parser.safeParse({ ...payload, data: { ...payload.data, reviewQueue } });
      expect(refused.success, path).toBe(false);
      expect(refused.success ? [] : refused.error.issues.flatMap(issuePaths).some((issue) => issue.startsWith(path)), path).toBe(true);
    }
  });

  it('parses the dashboard summary exposure as three rating counts, refusing the flat shape of both stages (D-02 item 4, D-42)', () => {
    const exposure = specification.components.schemas.DashboardRiskExposure as { required?: string[]; properties?: Record<string, unknown>; additionalProperties?: unknown } | undefined;
    expect(exposure, 'DashboardRiskExposure is not published').toBeDefined();
    expect(exposure!.required).toEqual(['released', 'releasedAccepted', 'underAssessment']);
    expect(exposure!.additionalProperties).toBe(false);
    for (const key of ['released', 'releasedAccepted', 'underAssessment']) {
      expect(exposure!.properties?.[key], key).toEqual({ $ref: '#/components/schemas/RatingCounts' });
    }

    const entry = parsers.find((candidate) => candidate.label === 'analystDashboard.getDashboardSummary');
    expect(entry, 'analystDashboard.getDashboardSummary is no longer registered').toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Record<string, unknown> & { riskExposure: Record<string, unknown> } };
    const parsed = entry!.parser.safeParse(payload);
    expect(parsed.success, formatIssues(parsed.error)).toBe(true);

    const flat = { ...payload, data: { ...payload.data, riskExposure: payload.data.riskExposure.released } };
    const refusedFlat = entry!.parser.safeParse(flat);
    expect(refusedFlat.success).toBe(false);
    expect(refusedFlat.success ? [] : refusedFlat.error.issues.flatMap(issuePaths)).toContain('data.riskExposure.released');

    const { underAssessment: _omitted, ...withoutUnderAssessment } = payload.data.riskExposure;
    const refusedMissing = entry!.parser.safeParse({ ...payload, data: { ...payload.data, riskExposure: withoutUnderAssessment } });
    expect(refusedMissing.success).toBe(false);
    expect(refusedMissing.success ? [] : refusedMissing.error.issues.flatMap(issuePaths)).toContain('data.riskExposure.underAssessment');
  });

  /*
   * D-02 item 4, D-40 to D-42: the Risk exposure report's sections count released open Risks, and it carries
   * the accepted Risks by residual rating and the Risks under assessment apart. The parser requires both and
   * refuses the under-assessment figure as a flat count, so it is never read as a released section.
   */
  it('parses the risk exposure report with its accepted and under-assessment counts, refusing it without them (D-02 item 4, D-42)', () => {
    const report = specification.components.schemas.RiskExposureReport as { required?: string[]; properties?: Record<string, unknown> } | undefined;
    expect(report?.required ?? []).toEqual(expect.arrayContaining(['acceptedByResidualRating', 'underAssessment']));
    expect(report?.properties?.acceptedByResidualRating).toEqual({ $ref: '#/components/schemas/RatingCounts' });
    expect(report?.properties?.underAssessment).toEqual({ $ref: '#/components/schemas/RiskExposureUnderAssessment' });
    const underAssessment = specification.components.schemas.RiskExposureUnderAssessment as { required?: string[]; properties?: Record<string, unknown>; additionalProperties?: unknown } | undefined;
    expect(underAssessment, 'RiskExposureUnderAssessment is not published').toBeDefined();
    expect(underAssessment!.required).toEqual(['byResidualRating']);
    expect(underAssessment!.additionalProperties).toBe(false);
    expect(underAssessment!.properties).toEqual({ byResidualRating: { $ref: '#/components/schemas/RatingCounts' } });

    const entry = parsers.find((candidate) => candidate.label === 'reports.getReport.riskExposure');
    expect(entry, 'reports.getReport.riskExposure is no longer registered').toBeDefined();
    const payload = instanceOf(schemaFor(entry!), 'maximal') as { data: Record<string, unknown> & { underAssessment: { byResidualRating: unknown } } };
    const parsed = entry!.parser.safeParse(payload);
    expect(parsed.success, formatIssues(parsed.error)).toBe(true);

    const flat = { ...payload, data: { ...payload.data, underAssessment: payload.data.underAssessment.byResidualRating } };
    const refusedFlat = entry!.parser.safeParse(flat);
    expect(refusedFlat.success).toBe(false);

    for (const key of ['acceptedByResidualRating', 'underAssessment']) {
      const { [key]: _omitted, ...without } = payload.data;
      const refusedMissing = entry!.parser.safeParse({ ...payload, data: without });
      expect(refusedMissing.success, key).toBe(false);
      expect(refusedMissing.success ? [] : refusedMissing.error.issues.flatMap(issuePaths)).toContain(`data.${key}`);
    }
  });

  /*
   * D-02 item 3, D-35: every figure that counts Risks opens the register through a closed filter. The web query
   * parser keeps exactly each published value and drops anything else, so it never sends a value Strapi refuses.
   */
  it('reads each Risk register figure filter closed on its published values (D-02 item 3, D-35)', () => {
    const operation = specification.paths['/v1/risks'].get as { parameters: Array<{ name: string; schema: { enum?: unknown[] } }> };
    for (const name of ['dueState', 'mitigationEffectiveness', 'impactedSystem', 'inherentRating', 'residualRating', 'treatmentStatus', 'mitigationStatus']) {
      const published = operation.parameters.find((parameter) => parameter.name === name)?.schema.enum;
      expect(published, `${name} is not a published closed filter`).toEqual(expect.any(Array));
      for (const value of published ?? []) {
        expect((riskRegisterQuerySchema.parse({ [name]: value }) as Record<string, unknown>)[name], `${name}=${String(value)}`).toBe(value);
      }
      expect((riskRegisterQuerySchema.parse({ [name]: 'off-the-vocabulary' }) as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it('parses the lifecycle next action with its holder, refusing a missing or unknown holder (D-02 item 5, D-27)', () => {
    const nextActionSchema = specification.components.schemas.AssessmentRequestLifecycleNextAction as { required?: string[]; properties?: Record<string, { enum?: string[] }>; additionalProperties?: unknown };
    expect(nextActionSchema.required ?? []).toEqual(expect.arrayContaining(['actor', 'holder', 'summary']));
    expect(nextActionSchema.properties?.holder?.enum).toEqual(['requestor', 'analyst', 'none']);
    expect(nextActionSchema.additionalProperties).toBe(false);

    const entry = parsers.find((candidate) => candidate.label === 'request.getRequest');
    expect(entry, 'request.getRequest is no longer registered').toBeDefined();
    const generated = instanceOf(schemaFor(entry!), 'maximal') as { data: Record<string, unknown> };
    const stepKeys = ['draft', 'submitted', 'questionnaire-generated', 'questionnaire-released', 'questionnaire-submitted', 'assessment-drafted', 'assessment-reviewed', 'assessment-released'];
    const withNextAction = (nextAction: Record<string, unknown>) => ({ ...generated, data: { ...generated.data, lifecycle: {
      currentKey: 'submitted', currentLabel: 'Submitted', terminal: false, nextAction,
      steps: stepKeys.map((key, index) => ({ key, label: key, state: index < 1 ? 'completed' : index === 1 ? 'current' : 'future' })),
    } } });
    const served = { actor: 'requestor', holder: 'analyst', summary: 'Bob Doe is reviewing your request and will send you a questionnaire to answer.' };

    const parsed = entry!.parser.safeParse(withNextAction(served));
    expect(parsed.success, formatIssues(parsed.error)).toBe(true);
    expect((parsed.data as { data: { lifecycle: { nextAction: Record<string, unknown> } } }).data.lifecycle.nextAction.holder).toBe('analyst');

    const { holder: _omitted, ...missing } = served;
    const refusedMissing = entry!.parser.safeParse(withNextAction(missing));
    expect(refusedMissing.success).toBe(false);
    expect(refusedMissing.success ? [] : refusedMissing.error.issues.flatMap(issuePaths)).toContain('data.lifecycle.nextAction.holder');

    const refusedUnknown = entry!.parser.safeParse(withNextAction({ ...served, holder: 'security-analyst' }));
    expect(refusedUnknown.success).toBe(false);
    expect(refusedUnknown.success ? [] : refusedUnknown.error.issues.flatMap(issuePaths)).toContain('data.lifecycle.nextAction.holder');
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
    // their bounds were already there, not new. It fell from 43 to 42 in plan 10-15 (D-34): the assessment's
    // risk list parser became listAssessmentRiskItems, whose bounds AssessmentRiskListResponse declares. It fell
    // from 42 to 41 in plan 11-12 (D-34): the request list parser retired with its last caller, the Requestor
    // dashboard read, and both Homes read GET /v1/my_requests, whose bounds MyRequestListResponse declares. It fell
    // from 41 to 39 in plan 13-08 (D-18): the by-id job operations and the job components declare every bound the
    // job parsers enforce, so getAssessmentDraftJob and getQuestionnaireGenerationJob are held to the boundary modes.
    expect(Object.keys(boundaryGrandfathered).length).toBe(39);
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
