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
  riskRegisterMitigationStatuses,
  riskRegisterQuerySchema,
  riskRegisterSortValues,
  riskRegisterStageLabels,
  riskRegisterStages,
  riskRegisterStateLabels,
  riskRegisterStates,
  riskTreatmentActions,
  riskTreatmentDueStates,
  serializeRiskRegisterQuery,
} from './risk-schema';
import * as riskSchemaModule from './risk-schema';

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
  accepted: false,
  stage: 'released',
  treatmentAction: 'Accept',
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
  it('parses normalized no-value rows and rejects off-vocabulary legacy values', () => {
    const normalized = {
      ...item,
      inherentRating: null, residualRating: null, treatmentStatus: null, treatmentDueState: 'overdue',
    };
    expect(parseRiskRegisterPayload({ ...payload, data: [normalized] }).data).toEqual([normalized]);
    for (const [field, value] of [['inherentRating', 'Extreme'], ['residualRating', 'Severe'], ['treatmentStatus', 'Deferred']]) {
      expect(() => parseRiskRegisterPayload({ ...payload, data: [{ ...normalized, [field]: value }] })).toThrow();
    }
  });

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
    const stageParameter = operation.parameters.find((parameter: { name: string }) => parameter.name === 'stage');
    expect(stageParameter?.schema.enum).toEqual([...riskRegisterStages]);
    const actionParameter = operation.parameters.find((parameter: { name: string }) => parameter.name === 'treatmentAction');
    expect(actionParameter?.schema.enum).toEqual([...riskTreatmentActions]);
    // D-35, G-16: the due state filter publishes the one rule's vocabulary, the row's own.
    const dueStateParameter = operation.parameters.find((parameter: { name: string }) => parameter.name === 'dueState');
    expect(dueStateParameter?.schema.enum).toEqual([...riskTreatmentDueStates]);
    // D-35, research Pitfalls 11 and 21: the figure filters publish exactly the web's closed vocabularies.
    const vocabulary = riskSchemaModule as Record<string, unknown>;
    const enumOf = (name: string) => operation.parameters.find((parameter: { name: string }) => parameter.name === name)?.schema.enum;
    expect(enumOf('inherentRating')).toEqual(vocabulary.riskRegisterRatingFilterValues);
    expect(enumOf('residualRating')).toEqual(vocabulary.riskRegisterRatingFilterValues);
    expect(enumOf('treatmentStatus')).toEqual(vocabulary.riskRegisterTreatmentStatusFilterValues);
    expect(enumOf('mitigationStatus')).toEqual([...riskRegisterMitigationStatuses]);
    expect(enumOf('mitigationEffectiveness')).toEqual(vocabulary.riskRegisterEffectivenessValues);
    expect(enumOf('impactedSystem')).toEqual(['none']);

    const row = specification.components.schemas.RiskRegisterItem;
    expect(Object.keys(riskRegisterItemSchema.shape).sort()).toEqual(Object.keys(row.properties).sort());
    expect(specification.components.schemas.TreatmentDueState.enum).toEqual([...riskTreatmentDueStates]);
    expect(row.required).toContain('stage');
    expect(row.properties.stage.enum).toEqual([...riskRegisterStages]);
    expect(row.required).toContain('treatmentAction');
    expect(row.properties.treatmentAction.enum).toEqual([...riskTreatmentActions, null]);
  });

  /* D-02 item 3, D-44: the JDL's treatment action, Accept or Treat, case and all. */
  it('parses and serializes the closed treatment action filter, ignoring anything else (D-44)', () => {
    expect(riskTreatmentActions).toEqual(['Accept', 'Treat']);
    expect(parseRiskRegisterQuery({ treatmentAction: 'Accept' }).treatmentAction).toBe('Accept');
    expect(parseRiskRegisterQuery({ treatmentAction: 'Treat' }).treatmentAction).toBe('Treat');
    for (const unknown of ['accept', 'ACCEPT', 'Transfer', '', 42, { $eq: 'Accept' }]) {
      expect(parseRiskRegisterQuery({ treatmentAction: unknown }).treatmentAction, JSON.stringify(unknown)).toBeUndefined();
    }
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({ stage: 'released', treatmentAction: 'Accept', state: 'open' }))).toEqual({
      stage: 'released', treatmentAction: 'Accept', state: 'open', sort: 'targetDate:asc', page: 1, pageSize: 25,
    });
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({}))).not.toHaveProperty('treatmentAction');
  });

  /* D-02 item 3, D-35, G-16: the server's due state, filtered by the one rule; anything else lists every Risk. */
  it('parses and serializes the closed due state filter, ignoring anything else (D-35)', () => {
    const labels = (riskSchemaModule as Record<string, unknown>).riskTreatmentDueStateLabels;
    expect(labels).toEqual({
      overdue: 'Overdue',
      'due-soon': 'Due soon',
      later: 'Due later',
      'no-target-date': 'No target date',
      'complete-or-closed': 'Complete or closed',
    });
    const dueStateOf = (value: unknown) => (parseRiskRegisterQuery({ dueState: value }) as Record<string, unknown>).dueState;
    for (const dueState of riskTreatmentDueStates) expect(dueStateOf(dueState), dueState).toBe(dueState);
    expect(dueStateOf(['later', 'overdue'])).toBe('later');
    for (const unknown of ['Overdue', 'due soon', 'dueSoon', '', 'none', 42, { $eq: 'overdue' }]) {
      expect(dueStateOf(unknown), JSON.stringify(unknown)).toBeUndefined();
    }
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({ dueState: 'later', state: 'open' }))).toEqual({
      dueState: 'later', state: 'open', sort: 'targetDate:asc', page: 1, pageSize: 25,
    });
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({}))).not.toHaveProperty('dueState');
  });

  /*
   * D-02 item 3, D-35, UI-SPEC §9.5: the figure filters. A rating or treatment status "none" lists the Risks with
   * none recorded (or one off its vocabulary), "any" any mitigation control, and impactedSystem "none" the Risks
   * with no impacted system. impactedSystem never travels with a chosen system, which Strapi refuses: the system wins.
   */
  it('parses and serializes the none, any, effectiveness and no-system filters, ignoring anything else (D-35)', () => {
    const vocabulary = riskSchemaModule as Record<string, unknown>;
    expect(vocabulary.riskRegisterRatingFilterValues).toEqual(['Low', 'Moderate', 'High', 'Critical', 'none']);
    expect(vocabulary.riskRegisterTreatmentStatusFilterValues).toEqual(['Not Started', 'In Progress', 'Overdue', 'Complete', 'none']);
    expect(riskRegisterMitigationStatuses).toEqual(['Existing', 'Planned', 'Implemented', 'Retired', 'none', 'any']);
    expect(vocabulary.riskRegisterEffectivenessValues).toEqual(['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed', 'none']);
    expect(vocabulary.riskRegisterEffectivenessLabels).toEqual({
      Effective: 'Effective',
      'Partially Effective': 'Partially Effective',
      Ineffective: 'Ineffective',
      'Not Assessed': 'Not Assessed',
      none: 'Not provided',
    });
    expect(vocabulary.riskRegisterMitigationStatusLabels).toEqual({
      Existing: 'Existing', Planned: 'Planned', Implemented: 'Implemented', Retired: 'Retired',
      none: 'No mitigation controls', any: 'Any mitigation control',
    });

    const parsed = parseRiskRegisterQuery({
      inherentRating: 'none', residualRating: 'none', treatmentStatus: 'none', mitigationStatus: 'any',
      mitigationEffectiveness: 'Ineffective', impactedSystem: 'none',
    }) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      inherentRating: 'none', residualRating: 'none', treatmentStatus: 'none', mitigationStatus: 'any',
      mitigationEffectiveness: 'Ineffective', impactedSystem: 'none',
    });
    expect(serializeRiskRegisterQuery(parsed as never)).toEqual({
      treatmentStatus: 'none', inherentRating: 'none', residualRating: 'none', mitigationEffectiveness: 'Ineffective',
      impactedSystem: 'none', mitigationStatus: 'any', sort: 'targetDate:asc', page: 1, pageSize: 25,
    });
    for (const [key, unknown] of [
      ['inherentRating', 'None'], ['residualRating', 'Not rated'], ['treatmentStatus', 'Not provided'], ['mitigationStatus', 'Any'],
      ['mitigationEffectiveness', 'effective'], ['mitigationEffectiveness', 'Not provided'], ['impactedSystem', 'None'],
      ['impactedSystem', 'system-1'], ['impactedSystem', ''],
    ] as const) {
      expect((parseRiskRegisterQuery({ [key]: unknown }) as Record<string, unknown>)[key], `${key}=${unknown}`).toBeUndefined();
    }
    // A chosen system and impactedSystem never travel together; the system wins.
    const both = parseRiskRegisterQuery({ system: 'system-1', impactedSystem: 'none' }) as Record<string, unknown>;
    expect(both.system).toBe('system-1');
    expect(both.impactedSystem).toBeUndefined();
    expect(serializeRiskRegisterQuery(both as never)).not.toHaveProperty('impactedSystem');
  });

  it('requires each row’s treatment action, Accept, Treat or none, and refuses any other (D-44)', () => {
    for (const treatmentAction of [...riskTreatmentActions, null]) {
      expect(riskRegisterItemSchema.parse({ ...item, treatmentAction }).treatmentAction).toBe(treatmentAction);
    }
    const { treatmentAction: _omitted, ...withoutAction } = item;
    expect(riskRegisterItemSchema.safeParse(withoutAction).success).toBe(false);
    for (const treatmentAction of ['accept', 'Transfer', '']) {
      expect(riskRegisterItemSchema.safeParse({ ...item, treatmentAction }).success, treatmentAction).toBe(false);
    }
  });

  /*
   * D-40, D-44: a Risk is released or still under assessment, the two branches of the register's
   * scope. The filter reads exactly those two values; anything else lists both, as absent does.
   */
  it('parses and serializes the closed stage filter, ignoring anything else (D-44)', () => {
    expect(riskRegisterStages).toEqual(['released', 'under-assessment']);
    expect(riskRegisterStageLabels).toEqual({ released: 'Released', 'under-assessment': 'Under assessment' });
    expect(parseRiskRegisterQuery({ stage: 'released' }).stage).toBe('released');
    expect(parseRiskRegisterQuery({ stage: 'under-assessment' }).stage).toBe('under-assessment');
    expect(parseRiskRegisterQuery({ stage: ['under-assessment', 'released'] }).stage).toBe('under-assessment');
    for (const unknown of ['Released', 'closed', '', 'under assessment', 'draft', 42, { $eq: 'released' }]) {
      expect(parseRiskRegisterQuery({ stage: unknown }).stage, JSON.stringify(unknown)).toBeUndefined();
    }
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({ stage: 'released', state: 'open' }))).toEqual({
      stage: 'released', state: 'open', sort: 'targetDate:asc', page: 1, pageSize: 25,
    });
    // Absent means every Risk in scope, so nothing is sent.
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({}))).not.toHaveProperty('stage');
  });

  it('requires each row’s stage and refuses an unknown one (D-44)', () => {
    for (const stage of riskRegisterStages) {
      expect(riskRegisterItemSchema.parse({ ...item, stage }).stage).toBe(stage);
    }
    const { stage: _omitted, ...withoutStage } = item;
    expect(riskRegisterItemSchema.safeParse(withoutStage).success).toBe(false);
    for (const stage of ['draft', 'in-review', 'approved', 'Released', null]) {
      expect(riskRegisterItemSchema.safeParse({ ...item, stage }).success, JSON.stringify(stage)).toBe(false);
    }
  });

  it('parses and serializes the closed Risk state filter, ignoring anything else', () => {
    expect(riskRegisterStates).toEqual(['open', 'closed', 'withdrawn']);
    expect(riskRegisterStateLabels).toEqual({ open: 'Open', closed: 'Closed', withdrawn: 'Withdrawn' });
    expect(parseRiskRegisterQuery({ state: 'open' }).state).toBe('open');
    expect(parseRiskRegisterQuery({ state: 'closed' }).state).toBe('closed');
    // Phase 16 D-08: withdrawn Risks are listed only under this explicit value.
    expect(parseRiskRegisterQuery({ state: 'withdrawn' }).state).toBe('withdrawn');
    expect(serializeRiskRegisterQuery(parseRiskRegisterQuery({ state: 'withdrawn' }))).toEqual({
      state: 'withdrawn', sort: 'targetDate:asc', page: 1, pageSize: 25,
    });
    expect(parseRiskRegisterQuery({ state: 'Withdrawn' }).state).toBeUndefined();
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

  it.each([false, true])('parses the full compound assessment label on a filtered page (empty=%s)', (empty) => {
    const assessmentNumber = 'A'.repeat(255);
    const title = 'T'.repeat(255);
    const assessment = {
      documentId: 'assessment-1', assessmentNumber, title,
    };
    const response = {
      data: empty ? [] : [{ ...item, assessment }],
      meta: {
        pagination: { page: 1, pageSize: 25, pageCount: empty ? 0 : 1, total: empty ? 0 : 1 },
        selectedLabels: { assessment: { documentId: 'assessment-1', label: `${assessmentNumber} · ${title}` } },
      },
    };
    const parsed = parseRiskRegisterPayload(response);
    expect(parsed.data).toHaveLength(empty ? 0 : 1);
    expect(parsed.meta.selectedLabels.assessment).toEqual({
      documentId: 'assessment-1', label: `${assessmentNumber} · ${title}`,
    });
    expect(parsed.meta.selectedLabels.assessment?.label).toHaveLength(513);
  });

  it('keeps selected user labels bounded at 255 and compound assessment labels at 513', () => {
    for (const [field, limit] of [['riskOwner', 255], ['treatmentOwner', 255], ['assessment', 513]] as const) {
      const withLabel = (length: number) => ({
        ...payload,
        meta: { ...payload.meta, selectedLabels: { [field]: { documentId: 'selected-1', label: 'L'.repeat(length) } } },
      });
      expect(() => parseRiskRegisterPayload(withLabel(limit))).not.toThrow();
      expect(() => parseRiskRegisterPayload(withLabel(limit + 1))).toThrow();
    }
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
      ['assessments', 1_000, (index: number) => ({ documentId: `assessment-${index}`, assessmentNumber: `ASM-${index}`, assessmentStatus: 'draft', summary: null, overallRating: null, generatedDate: null, generatedBy: null, approvalDate: null, requestTitle: null, riskCount: 0, highestResidualRating: null })],
      ['riskTypes', 1_000, (index: number) => ({ documentId: `type-${index}`, name: `Type ${index}`, description: null, applicableControls: [] })],
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
