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
import { responseParserModule as dashboardResponseParserModule } from './dashboard/requestor-dashboard-service';
import { responseParserModule as shellResponseParserModule } from './shell/shell-service';

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
  dashboardResponseParserModule,
  shellResponseParserModule,
  riskServiceResponseParserModule,
  riskSchemaResponseParserModule,
  ...parserFreeModules,
];

const parsers: readonly ContractResponseParser[] = [
  ...responseParserModuleInventory.flatMap((module) => module.parsers),
];

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
 *    `.strict()` client schema never rejects something the contract permits.
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

/** A string that satisfies the bounded, non-empty strings the client schemas use. */
function stringFor(schema: JsonObject): string {
  if (typeof schema.const === 'string') return schema.const;
  const enumeration = schema.enum;
  const named = Array.isArray(enumeration) ? enumeration.filter((value) => typeof value === 'string') : [];
  if (named.length > 0) return String(named[0]);
  if (schema.format === 'date-time') return '2026-01-15T09:30:00.000Z';
  if (schema.format === 'date') return '2026-01-15';
  if (typeof schema.pattern === 'string') return 'ASM-2026-33SAEN';
  const minimum = typeof schema.minLength === 'number' ? schema.minLength : 1;
  return 'contract'.padEnd(Math.max(minimum, 1), 'x').slice(0, typeof schema.maxLength === 'number' ? schema.maxLength : undefined);
}

/**
 * Builds an instance of `schema`.  `mode: 'minimal'` emits only required
 * properties; `mode: 'maximal'` emits every declared property.
 */
type Mode = 'minimal' | 'maximal' | 'nullable';

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
  if (type === 'string') return stringFor(schema);
  if (type === 'integer' || type === 'number') {
    const minimum = typeof schema.minimum === 'number' ? schema.minimum : 1;
    return Math.max(minimum, 1);
  }
  if (type === 'boolean') return true;
  if (type === 'null') return null;

  // An untyped schema places no constraint the client can rely on.
  return null;
}

function formatIssues(error: unknown): string {
  const zodError = error as z.ZodError;
  if (!zodError?.issues) return String(error);
  return zodError.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

describe('contract-to-client-schema parity', () => {
  it('declares every workflow parser boundary explicitly', () => {
    // The set must be complete; the order it is assembled in is incidental, and
    // pinning it made the assertion fail when the parser-free declarations moved
    // into their own registry without any boundary changing.
    expect([...responseParserModuleInventory.map((module) => module.modulePath)].sort()).toEqual([
      'features/administration/administration-actions.ts',
      'features/administration/administration-service.ts',
      'features/assessments/assessment-actions.ts',
      'features/assessments/assessment-service.ts',
      'features/dashboard/requestor-dashboard-service.ts',
      'features/questionnaires/questionnaire-actions.ts',
      'features/questionnaires/questionnaire-service.ts',
      'features/requests/request-actions.ts',
      'features/requests/request-service.ts',
      'features/risks/risk-actions.ts',
      'features/risks/risk-schema.ts',
      'features/risks/risk-service.ts',
      'features/shell/shell-service.ts',
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
      const component = schemaFor(entry);

      const narrowed = new Set<string>(entry.narrowedPaths ?? []);

      for (const mode of ['minimal', 'maximal', 'nullable'] as const) {
        const payload = instanceOf(component, mode, entry.branch);
        const result = entry.parser.safeParse(payload);
        if (result.success) continue;

        // A client schema may deliberately be narrower than a shared contract
        // component. Each such path is declared and justified beside the
        // parser, and anything outside that set is undeclared drift.
        const unexpected = result.error.issues
          .map((issue) => issue.path.join('.') || 'data')
          .filter((path) => !narrowed.has(path));
        expect(
          unexpected,
          `${entry.label} rejected the ${mode} ${entry.component ?? `${entry.method?.toUpperCase()} ${entry.path}`} payload permitted by the contract — ${formatIssues(result.error)}`,
        ).toEqual([]);
      }
    },
  );

  it('keeps every declared narrowing pointed at a real contract property', () => {
    // A narrowing that no longer corresponds to a rejected path is stale, and
    // would silently widen what the guard tolerates.
    for (const entry of parsers) {
      const rejected = new Set<string>();
      for (const mode of ['minimal', 'maximal', 'nullable'] as const) {
        const result = entry.parser.safeParse(instanceOf(schemaFor(entry), mode, entry.branch));
        if (result.success) continue;
        for (const issue of result.error.issues) rejected.add(issue.path.join('.') || 'data');
      }
      for (const path of entry.narrowedPaths ?? []) {
        expect(
          [...rejected],
          `${entry.label} declares a narrowing on ${path} that nothing rejects — the contract and client now agree, so remove it.`,
        ).toContain(path);
      }
    }
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
