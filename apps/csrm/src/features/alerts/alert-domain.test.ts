import { describe, expect, it } from 'vitest';

import { alertKinds, alertUrgencies, readAlertListUrlQuery } from './alert-domain';
import { alertKinds as schemaAlertKinds, alertListUrlQuerySchema, alertUrgencies as schemaAlertUrgencies } from './alert-schema';

/*
 * The Alerts list reads its URL in the browser with this zod-free reader (plan 11-09); the server page reads it
 * through alert-schema.ts, which delegates to the same reader, so the two never read a URL apart.
 */
describe('readAlertListUrlQuery', () => {
  it('reads one kind, one urgency, a page and a page size from the URL', () => {
    expect(readAlertListUrlQuery({ kind: 'request-overdue', urgency: 'overdue', page: '2', pageSize: '50' }))
      .toEqual({ kind: 'request-overdue', urgency: 'overdue', page: 2, pageSize: 50 });
    expect(readAlertListUrlQuery({ kind: ['request-due-soon', 'request-overdue'] })).toEqual({ kind: 'request-due-soon', page: 1, pageSize: 25 });
  });

  it('reads an unknown kind or urgency as all, and a page or page size out of range as the default', () => {
    expect(readAlertListUrlQuery({})).toEqual({ page: 1, pageSize: 25 });
    expect(readAlertListUrlQuery({ kind: 'not-a-kind', urgency: 'Overdue' })).toEqual({ page: 1, pageSize: 25 });
    for (const page of ['0', '-1', '1.5', 'two', '1000001']) expect(readAlertListUrlQuery({ page }).page, page).toBe(1);
    for (const pageSize of ['5', '100', 'all']) expect(readAlertListUrlQuery({ pageSize }).pageSize, pageSize).toBe(25);
    expect(readAlertListUrlQuery({ page: '4', pageSize: '10', sort: 'kind:asc' })).toEqual({ page: 4, pageSize: 10 });
  });

  it('is the reader the server’s URL schema uses, over the vocabularies the schema module re-exports', () => {
    const params = { kind: 'assessment-review-due', urgency: 'attention', page: '3', pageSize: '10', extra: 'x' };
    expect(alertListUrlQuerySchema.parse(params)).toEqual(readAlertListUrlQuery(params));
    expect(schemaAlertKinds).toBe(alertKinds);
    expect(schemaAlertUrgencies).toBe(alertUrgencies);
  });
});
