import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFLICT_REASONS, isConflictReason } from './conflict-reasons';

type Specification = {
  components: { schemas: Record<string, { properties: { error: { properties: { details: { properties?: { reason?: { type?: string; enum?: string[] } } } } } } }> };
};

const specification = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'),
) as Specification;

function publishedReasons(schemaName: string): string[] {
  const reason = specification.components.schemas[schemaName]?.properties.error.properties.details.properties?.reason;
  expect(reason?.type).toBe('string');
  return [...(reason?.enum ?? [])].sort();
}

describe('conflict reasons', () => {
  it.each(['AssessmentWorkflowErrorResponse', 'QuestionnaireWorkflowErrorResponse'])(
    'match the closed list %s publishes',
    (schemaName) => {
      expect(publishedReasons(schemaName)).toEqual([...CONFLICT_REASONS].sort());
    },
  );

  it('list each code once in a frozen list', () => {
    expect(new Set(CONFLICT_REASONS).size).toBe(CONFLICT_REASONS.length);
    expect(Object.isFrozen(CONFLICT_REASONS)).toBe(true);
  });

  it.each(CONFLICT_REASONS.map((reason) => [reason]))('accept %s', (reason) => {
    expect(isConflictReason(reason)).toBe(true);
  });

  it.each([
    ['an unknown code', 'OTHER'],
    ['an empty string', ''],
    ['a code in the wrong case', 'request_work_started'],
    ['a code with padding', ' REQUEST_WORK_STARTED'],
    ['null', null],
    ['undefined', undefined],
    ['a number', 409],
    ['an array holding a code', ['REQUEST_WORK_STARTED']],
    ['an object holding a code', { reason: 'REQUEST_WORK_STARTED' }],
  ])('reject %s', (_scenario, value) => {
    expect(isConflictReason(value)).toBe(false);
  });
});
