import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  alertKinds,
  alertLinkTypes,
  alertListResponseSchema,
  alertListUrlQuerySchema,
  alertSourceTypes,
  alertSummaryResponseSchema,
  alertUrgencies,
  parseAlertListPayload,
  parseAlertSummaryPayload,
} from './alert-schema';

const specification = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'),
) as { components: { schemas: Record<string, { enum?: unknown[] }> } };

const riskAlert = {
  id: 'risk-treatment-overdue:risk-1',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: {
    type: 'risk',
    documentId: 'risk-1',
    identifier: 'RSK-2026-B2QDZ6',
    title: 'Third-party dependency may reduce availability.',
    released: true,
  },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'Critical',
};
const controlImplementationAlert = {
  id: 'ineffective-control:implementation-1',
  kind: 'ineffective-control',
  urgency: 'attention',
  governingDate: null,
  dayOffset: null,
  source: {
    type: 'control-implementation',
    documentId: 'implementation-1',
    identifier: 'RSK-2026-B2QDZ6',
    title: 'E8-PATCH_APPLICATIONS-003 Patch applications',
    released: false,
  },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: null,
};
const requestAlert = {
  id: 'request-due-soon:request-1',
  kind: 'request-due-soon',
  urgency: 'due-soon',
  governingDate: '2026-09-24',
  dayOffset: 0,
  source: { type: 'assessment-request', documentId: 'request-1', identifier: 'RAR-2026-X7K4Q2', title: 'Customer portal review', released: false },
  link: { type: 'assessment-request', documentId: 'request-1' },
  residualRating: null,
};
const listPayload = {
  data: [riskAlert, controlImplementationAlert, requestAlert],
  meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 3 }, today: '2026-09-24', dueSoonWindowDays: 14 },
};
const summaryPayload = {
  data: {
    byKind: {
      'risk-treatment-overdue': 3,
      'risk-treatment-due-soon': 2,
      'request-overdue': 1,
      'request-due-soon': 2,
      'control-implementation-overdue': 1,
      'assessment-review-due': 2,
      'critical-residual-risk-untreated': 2,
      'ineffective-control': 1,
    },
    byUrgency: { overdue: 6, 'due-soon': 5, attention: 3 },
    total: 14,
    today: '2026-09-24',
    dueSoonWindowDays: 14,
  },
};

describe('alert contract vocabularies', () => {
  it('match the published enumerations exactly, in order', () => {
    expect([...alertKinds]).toEqual(specification.components.schemas.AlertKind?.enum);
    expect([...alertUrgencies]).toEqual(specification.components.schemas.AlertUrgency?.enum);
    expect([...alertSourceTypes]).toEqual(specification.components.schemas.AlertSourceType?.enum);
    expect([...alertLinkTypes]).toEqual(specification.components.schemas.AlertLinkType?.enum);
  });
});

describe('alert response parsers', () => {
  it('parse a served alert page and summary unchanged', () => {
    expect(parseAlertListPayload(listPayload)).toEqual(listPayload);
    expect(parseAlertSummaryPayload(summaryPayload)).toEqual(summaryPayload.data);
  });

  it('refuse anything the closed contract does not declare', () => {
    const hostileLists: unknown[] = [
      { ...listPayload, extra: true },
      { ...listPayload, data: [{ ...riskAlert, extra: 1 }] },
      { ...listPayload, data: [{ ...riskAlert, kind: 'risk-overdue' }] },
      { ...listPayload, data: [{ ...riskAlert, urgency: 'soon' }] },
      { ...listPayload, data: [{ ...riskAlert, source: { ...riskAlert.source, released: undefined } }] },
      { ...listPayload, data: [{ ...riskAlert, source: { ...riskAlert.source, email: 'hidden@example.test' } }] },
      { ...listPayload, data: [{ ...riskAlert, source: { ...riskAlert.source, type: 'questionnaire' } }] },
      { ...listPayload, data: [{ ...riskAlert, link: { type: 'control-implementation', documentId: 'implementation-1' } }] },
      { ...listPayload, data: [{ ...riskAlert, residualRating: 'Severe' }] },
      { ...listPayload, data: [{ ...riskAlert, governingDate: '2026-02-30' }] },
      { ...listPayload, data: [{ ...riskAlert, dayOffset: 1.5 }] },
      { ...listPayload, data: Array.from({ length: 51 }, () => riskAlert) },
      { ...listPayload, meta: { ...listPayload.meta, pagination: { ...listPayload.meta.pagination, pageSize: 7 } } },
      { ...listPayload, meta: { ...listPayload.meta, today: 'today' } },
      { ...listPayload, meta: { ...listPayload.meta, selectedLabels: {} } },
    ];
    for (const payload of hostileLists) {
      expect(alertListResponseSchema.safeParse(payload).success, JSON.stringify(payload).slice(0, 200)).toBe(false);
    }

    const { 'ineffective-control': _omitted, ...sevenKinds } = summaryPayload.data.byKind;
    const hostileSummaries: unknown[] = [
      { data: { ...summaryPayload.data, extra: 1 } },
      { data: { ...summaryPayload.data, byKind: { ...summaryPayload.data.byKind, 'risk-overdue': 1 } } },
      { data: { ...summaryPayload.data, byKind: sevenKinds } },
      { data: { ...summaryPayload.data, byUrgency: { ...summaryPayload.data.byUrgency, attention: -1 } } },
      { data: { ...summaryPayload.data, total: 1.5 } },
    ];
    for (const payload of hostileSummaries) {
      expect(alertSummaryResponseSchema.safeParse(payload).success, JSON.stringify(payload).slice(0, 200)).toBe(false);
    }
  });
});

describe('alert list URL query', () => {
  it('parses the canonical filters, one kind at a time', () => {
    expect(alertListUrlQuerySchema.parse({ kind: 'request-overdue', urgency: 'overdue', page: '2', pageSize: '50' }))
      .toEqual({ kind: 'request-overdue', urgency: 'overdue', page: 2, pageSize: 50 });
    expect(alertListUrlQuerySchema.parse({ kind: ['request-due-soon', 'request-overdue'] }))
      .toEqual({ kind: 'request-due-soon', page: 1, pageSize: 25 });
  });

  it('reads unknown values as all, and any other page size as the default', () => {
    expect(alertListUrlQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(alertListUrlQuerySchema.parse({ kind: 'not-a-kind', urgency: 'Overdue' })).toEqual({ page: 1, pageSize: 25 });
    for (const pageSize of ['7', '5', '100', '', 'x']) {
      expect(alertListUrlQuerySchema.parse({ pageSize }).pageSize, pageSize).toBe(25);
    }
    for (const page of ['0', '-1', '1.5', 'x', '1000001']) {
      expect(alertListUrlQuerySchema.parse({ page }).page, page).toBe(1);
    }
    expect(alertListUrlQuerySchema.parse({ page: '4', pageSize: '10', sort: 'kind:asc' })).toEqual({ page: 4, pageSize: 10 });
  });

  it('reads any non-null object, not only a plain one, as `next dev` resolves searchParams to a proxy', () => {
    class SearchParams { urgency = 'overdue'; page = '2'; }
    const nullPrototype = Object.assign(Object.create(null) as Record<string, string>, { urgency: 'overdue', page: '2' });
    // `next dev` wraps the page's searchParams in a Proxy whose get trap binds every function it returns to the target,
    // so `constructor` is a bound function with no prototype, and zod's plain-object test (z.record) refuses it.
    const nextDevSearchParams = new Proxy({ urgency: 'overdue', page: '2' }, {
      get: (target, property, receiver) => {
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    for (const [name, params] of [['class instance', new SearchParams()], ['null prototype', nullPrototype], ['next dev proxy', nextDevSearchParams]] as const) {
      expect(alertListUrlQuerySchema.parse(params), name).toEqual({ urgency: 'overdue', page: 2, pageSize: 25 });
    }
    for (const notAnObject of [null, undefined, 'urgency=overdue', ['overdue']]) {
      expect(alertListUrlQuerySchema.safeParse(notAnObject).success, String(notAnObject)).toBe(false);
    }
  });
});
