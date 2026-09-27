import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  formatRiskTargetDate,
  mergeSelectedRiskPickerOption,
  parseRiskPickerPayload,
  parseRiskRegisterPayload,
  parseRiskRegisterQuery,
  riskRegisterItemSchema,
  riskRegisterQuerySchema,
  riskRegisterSortValues,
  riskRegisterStateLabels,
  riskRegisterStates,
  riskTreatmentDueStates,
  serializeRiskRegisterQuery,
} from './risk-schema';

const item = {
  documentId: 'risk-1',
  riskNumber: 'RSK-0001',
  riskStatement: 'Privileged access may be misused.',
  inherentRating: 'High',
  residualRating: 'Moderate',
  treatmentStatus: 'In Progress',
  treatmentOwner: { documentId: 'user-1', displayName: 'Alex Analyst' },
  targetDate: '2026-09-30',
  treatmentDueState: 'due-soon',
  assessment: { documentId: 'assessment-1', assessmentNumber: 'ASM-0001', title: 'Customer portal' },
} as const;

const payload = {
  data: [item],
  meta: {
    pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 },
    selectedLabels: {
      riskOwner: { documentId: 'user-2', label: 'Risk Owner' },
      assessment: { documentId: 'assessment-1', label: 'ASM-0001' },
    },
  },
};

describe('Risk Register canonical schemas', () => {
  it('canonicalizes every browser parameter including a closed target-date range', () => {
    const parsed = parseRiskRegisterQuery({
      q: ['  access  ', 'ignored'],
      treatmentStatus: 'In Progress', inherentRating: 'High', residualRating: 'Moderate',
      riskOwner: 'user_1', treatmentOwner: 'user-2', assessment: 'assessment-1',
      system: 'system-1', asset: 'asset-1', mitigationStatus: 'Planned', state: 'closed',
      sort: 'assessment:desc', page: '2', pageSize: '50',
      targetDateFrom: '2026-01-01', targetDateTo: '2026-12-31', forged: 'secret',
    });
    expect(parsed).toEqual({
      q: 'access', treatmentStatus: 'In Progress', inherentRating: 'High', residualRating: 'Moderate',
      riskOwner: 'user_1', treatmentOwner: 'user-2', assessment: 'assessment-1', system: 'system-1',
      asset: 'asset-1', mitigationStatus: 'Planned', state: 'closed', targetDateFrom: '2026-01-01',
      targetDateTo: '2026-12-31', sort: 'assessment:desc', page: 2, pageSize: 50,
    });
  });

  /*
   * The shared parity guard cannot exercise the register parser (its synthesised
   * page size of 1 is outside the closed [10, 25, 50] union, and the failure is
   * reported at the root), so the register's own query and row parsers are
   * pinned to the published operation and component here.
   */
  it('keeps the register query and row parsers in step with the published contract', () => {
    const specification = JSON.parse(readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'));
    const operation = specification.paths['/v1/risks'].get;
    const parameterNames: string[] = operation.parameters.map((parameter: { name: string }) => parameter.name);
    expect(Object.keys(riskRegisterQuerySchema.shape).sort()).toEqual([...parameterNames].sort());
    expect(parameterNames).toContain('state');
    const stateParameter = operation.parameters.find((parameter: { name: string }) => parameter.name === 'state');
    expect(stateParameter.schema.enum).toEqual([...riskRegisterStates]);

    const row = specification.components.schemas.RiskRegisterItem;
    expect(Object.keys(riskRegisterItemSchema.shape).sort()).toEqual(Object.keys(row.properties).sort());
    expect(specification.components.schemas.TreatmentDueState.enum).toEqual([...riskTreatmentDueStates]);
  });

  it('parses and serializes the closed Risk state filter, ignoring anything else', () => {
    expect(riskRegisterStates).toEqual(['open', 'closed']);
    expect(riskRegisterStateLabels).toEqual({ open: 'Open', closed: 'Closed' });
    expect(parseRiskRegisterQuery({ state: 'open' }).state).toBe('open');
    expect(parseRiskRegisterQuery({ state: 'closed' }).state).toBe('closed');
    expect(parseRiskRegisterQuery({ state: ['closed', 'open'] }).state).toBe('closed');
    for (const unknown of ['Open', 'all', '', 'none', 42, { $eq: 'open' }]) {
      expect(parseRiskRegisterQuery({ state: unknown }).state, JSON.stringify(unknown)).toBeUndefined();
    }
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({ state: 'open', residualRating: 'High' }))).toEqual({
      residualRating: 'High', state: 'open', sort: 'targetDate:asc', page: 1, pageSize: 25,
    });
    // Absent means all Risks, so nothing is sent.
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({}))).not.toHaveProperty('state');
  });

  it.each([
    [{ targetDateFrom: '2026-01-01' }, { targetDateFrom: '2026-01-01' }],
    [{ targetDateTo: '2026-12-31' }, { targetDateTo: '2026-12-31' }],
    [
      { targetDateFrom: '2026-01-01', targetDateTo: '2026-12-31' },
      { targetDateFrom: '2026-01-01', targetDateTo: '2026-12-31' },
    ],
    [
      { targetDateFrom: '2026-06-30', targetDateTo: '2026-06-30' },
      { targetDateFrom: '2026-06-30', targetDateTo: '2026-06-30' },
    ],
  ])('preserves calendar-valid target-date bounds from %j', (input, expected) => {
    const parsed = parseRiskRegisterQuery(input);
    expect(parsed).toMatchObject(expected);
    expect(serializeRiskRegisterQuery(parsed)).toMatchObject(expected);
  });

  it.each([
    { targetDateFrom: '' },
    { targetDateFrom: '2026-02-30' },
    { targetDateFrom: '2026-01-01T00:00:00Z' },
    { targetDateFrom: ['2026-01-01', '2026-01-02'] },
    { targetDateTo: ['2026-12-31', '2026-12-30'] },
    { targetDateFrom: '2026-12-31', targetDateTo: '2026-01-01' },
    { targetDateFrom: '2026-01-01', targetDateTo: 'not-a-date' },
  ])('rejects invalid or inverted target-date state from %j', (input) => {
    expect(() => parseRiskRegisterQuery(input)).toThrow();
  });

  it.each(riskRegisterSortValues)('preserves the %s sort', (sort) => {
    expect(parseRiskRegisterQuery({ sort }).sort).toBe(sort);
  });

  it('defaults invalid browser state and serializes only active canonical keys', () => {
    const parsed = parseRiskRegisterQuery({ q: '   ', page: '-1', pageSize: '20', sort: 'createdAt:desc' });
    expect(parsed).toEqual({ q: '', sort: 'targetDate:asc', page: 1, pageSize: 25 });
    expect(serializeRiskRegisterQuery(parsed)).toEqual({ sort: 'targetDate:asc', page: 1, pageSize: 25 });
  });

  it('accepts only the closed list projection and preserves selected labels', () => {
    expect(parseRiskRegisterPayload(payload)).toEqual(payload);
    for (const hostile of [
      { ...payload, debug: true },
      { ...payload, data: [{ ...item, email: 'hidden@example.test' }] },
      { ...payload, data: [{ ...item, inherentRating: 'Extreme' }] },
      { ...payload, data: [{ ...item, targetDate: '30/09/2026' }] },
      { ...payload, data: [{ ...item, treatmentOwner: { ...item.treatmentOwner, email: 'hidden@example.test' } }] },
      { ...payload, data: [{ ...item, assessment: { ...item.assessment, requestor: 'hidden' } }] },
      { ...payload, data: [{ ...item, assessment: undefined }] },
      { ...payload, meta: { ...payload.meta, pagination: { ...payload.meta.pagination, total: -1 } } },
      { ...payload, data: [{ ...item, treatmentDueState: 'soon' }] },
      { ...payload, data: [{ ...item, treatmentDueState: null }] },
      // The due state is server-derived and always served; a row without it is a contract defect.
      { ...payload, data: [{ ...item, treatmentDueState: undefined }] },
      { ...payload, data: [{ ...item, closureDate: '2026-09-01' }] },
    ]) expect(() => parseRiskRegisterPayload(hostile)).toThrow();
  });

  it('parses exactly the server treatment due-state vocabulary on every row', () => {
    expect(riskTreatmentDueStates).toEqual(['overdue', 'due-soon', 'later', 'no-target-date', 'complete-or-closed']);
    for (const treatmentDueState of riskTreatmentDueStates) {
      expect(riskRegisterItemSchema.parse({ ...item, treatmentDueState }).treatmentDueState).toBe(treatmentDueState);
    }
    const { treatmentDueState: _omitted, ...withoutDueState } = item;
    expect(riskRegisterItemSchema.safeParse(withoutDueState).success).toBe(false);
  });

  it('fails every picker at cap plus one and retains an off-page selected label', () => {
    const cases = [
      ['owners', 20, (index: number) => ({ documentId: `user-${index}`, displayName: `User ${index}` })],
      ['assessments', 1_000, (index: number) => ({ documentId: `assessment-${index}`, assessmentNumber: `ASM-${index}`, assessmentStatus: 'draft', summary: null, overallRating: null, generatedDate: null, generatedBy: null, approvalDate: null })],
      ['riskTypes', 1_000, (index: number) => ({ documentId: `type-${index}`, name: `Type ${index}`, description: null })],
      ['controls', 5_000, (index: number) => ({ documentId: `control-${index}`, controlNumber: `CTL-${index}`, name: `Control ${index}`, description: null })],
      ['systems', 100, (index: number) => ({
        documentId: `system-${index}`, name: `System ${index}`, description: null, systemType: null,
        owner: null, environment: null, deploymentModel: null, businessCriticality: null,
        internetFacing: false, externalAccessRequired: false, hostingLocation: null, lifecycleState: null,
        updatedAt: '2026-09-02T00:00:00.000Z',
      })],
      ['assets', 100, (index: number) => ({
        documentId: `asset-${index}`, name: `Asset ${index}`, description: null, location: null, type: null,
        dataClassification: null, confidentialityRating: null, integrityRating: null, availabilityRating: null,
        containsPersonalData: false, containsLegalData: false, containsCreditCardData: false, comments: null,
        updatedAt: '2026-09-02T00:00:00.000Z',
      })],
    ] as const;
    for (const [kind, cap, make] of cases) {
      const envelope = (data: unknown[]) => kind === 'systems' || kind === 'assets'
        ? { data, meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: data.length } } }
        : { data };
      expect(parseRiskPickerPayload(kind, envelope(Array.from({ length: cap }, (_, index) => make(index))))).toHaveLength(cap);
      expect(() => parseRiskPickerPayload(kind, envelope(Array.from({ length: cap + 1 }, (_, index) => make(index))))).toThrow();
    }
    expect(mergeSelectedRiskPickerOption([{ documentId: 'user-1', label: 'Visible' }], { documentId: 'user-99', label: 'Selected' }))
      .toEqual([{ documentId: 'user-99', label: 'Selected' }, { documentId: 'user-1', label: 'Visible' }]);
    expect(parseRiskPickerPayload('owners', { data: [
      { documentId: 'user-1', displayName: 'Visible' },
      { documentId: 'user-1', displayName: 'Visible' },
    ] })).toEqual([{ documentId: 'user-1', label: 'Visible' }]);
  });

  it('keeps rating and UTC date presentation logic outside JSX', () => {
    expect(formatRiskTargetDate('2026-09-30')).toBe('30 Sept 2026');
    expect(formatRiskTargetDate(null)).toBe('No target date');
  });
});
