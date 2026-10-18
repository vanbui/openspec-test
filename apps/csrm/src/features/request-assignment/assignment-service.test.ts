import { afterEach, describe, expect, it, vi } from 'vitest';

const put = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const createStrapiClient = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
/*
 * IN-506: the real normalizeTransportError, so a refusal's closed reason (OWN_REQUEST, ASSIGNMENT_CHANGED, NOTES_CLOSED)
 * is proven to reach the actions that branch on it through this seam. Only the client and the parser error (whose wording
 * depends on NODE_ENV) are stood in for.
 */
vi.mock('../../lib/api/transport/server-client', async (importOriginal) => ({
  createStrapiClient,
  normalizeTransportError: (await importOriginal<typeof import('../../lib/api/transport/server-client')>()).normalizeTransportError,
  normalizeResponseParserError: (operation: string) => ({
    data: null,
    error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation },
  }),
}));

import * as service from './assignment-service';

afterEach(() => {
  put.mockReset();
  get.mockReset();
  createStrapiClient.mockReset();
});

function useMockClient(): void {
  createStrapiClient.mockResolvedValue({ PUT: put, GET: get });
}

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const assignment = {
  assignee: bob,
  assignedBy: bob,
  assignedAt: '2026-10-09T01:02:03.000Z',
  actions: ['reassign', 'unassign'],
  ownRequest: false,
  history: [{ action: 'pick-up', by: bob, at: '2026-10-09T01:02:03.000Z', from: null, to: bob, reason: null }],
  viewer: bob,
};

describe('request assignment service', () => {
  it('changes the assignee through the generated path with the published body and returns the parsed assignment', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: { data: assignment }, response: { status: 200 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null }))
      .resolves.toEqual({ data: assignment, error: null });
    expect(put).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/assignee', {
      params: { path: { requestId: 'r1' } },
      body: { data: { analyst: 'u1', expectedAnalyst: null } },
    });
  });

  it('sends a trimmed reason and unassigns with a null analyst', async () => {
    useMockClient();
    const unassigned = { ...assignment, assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'] };
    put.mockResolvedValueOnce({ data: { data: unassigned }, response: { status: 200 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: null, expectedAnalyst: 'u1', reason: '  Back to the queue  ' }))
      .resolves.toEqual({ data: unassigned, error: null });
    expect(put).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/assignee', {
      params: { path: { requestId: 'r1' } },
      body: { data: { analyst: null, expectedAnalyst: 'u1', reason: 'Back to the queue' } },
    });
  });

  it('refuses a response with a key the contract does not declare', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: { data: { ...assignment, email: 'bob@example.test' } }, response: { status: 200 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null })).resolves.toMatchObject({
      data: null,
      error: { kind: 'response-contract-mismatch', operation: 'changeRequestAssignee' },
    });
    put.mockResolvedValueOnce({ data: { data: { ...assignment, assignee: { ...bob, email: 'bob@example.test' } } }, response: { status: 200 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null })).resolves.toMatchObject({
      data: null,
      error: { kind: 'response-contract-mismatch' },
    });
  });

  it('returns the refusal status without parsing a body', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: undefined, error: { error: { status: 409 } }, response: { status: 409 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null })).resolves.toMatchObject({
      data: null,
      error: { status: 409 },
    });
  });

  it('keeps a refusal’s closed reason for the actions that branch on it (IN-506)', async () => {
    useMockClient();
    put.mockResolvedValueOnce({ data: undefined, error: { error: { status: 409, details: { reason: 'ASSIGNMENT_CHANGED' } } }, response: { status: 409 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null })).resolves.toEqual({
      data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 409, reason: 'ASSIGNMENT_CHANGED' },
    });
    put.mockResolvedValueOnce({ data: undefined, error: { error: { status: 403, details: { reason: 'OWN_REQUEST' } } }, response: { status: 403 } });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null })).resolves.toMatchObject({
      data: null, error: { status: 403, reason: 'OWN_REQUEST' },
    });
  });

  it('refuses invalid input before calling Strapi', async () => {
    useMockClient();
    await expect(service.changeRequestAssignee({ requestId: '', analyst: 'u1', expectedAnalyst: null })).resolves.toMatchObject({ data: null });
    await expect(service.changeRequestAssignee({ requestId: 'r1', analyst: 'u1', expectedAnalyst: null, reason: 'x'.repeat(501) })).resolves.toMatchObject({ data: null });
    expect(put).not.toHaveBeenCalled();
  });

  it('registers its response parser for the contract parity guard', () => {
    expect(service.responseParserModule.modulePath).toBe('features/request-assignment/assignment-service.ts');
    expect(service.responseParserModule.parsers.map((entry) => [entry.label, entry.component])).toEqual([
      ['changeRequestAssignee', 'AssessmentRequestAssignmentResponse'],
      ['listAssignableAnalysts', 'AssignableAnalystListResponse'],
    ]);
  });

  it('lists the eligible analysts through the generated path with the trimmed search term (D-06)', async () => {
    useMockClient();
    const people = [bob, { documentId: 'u2', displayName: 'Second Analyst' }];
    get.mockResolvedValueOnce({ data: { data: people }, response: { status: 200 } });
    await expect(service.listAssignableAnalysts('r1', ' sec ')).resolves.toEqual({ data: people, error: null });
    expect(get).toHaveBeenCalledWith('/v1/assessment_requests/{requestId}/assignable_analysts', {
      params: { path: { requestId: 'r1' }, query: { q: 'sec' } },
    });
  });

  it('sends no search term when there is none or it is blank', async () => {
    useMockClient();
    get.mockResolvedValue({ data: { data: [] }, response: { status: 200 } });
    await expect(service.listAssignableAnalysts('r1')).resolves.toEqual({ data: [], error: null });
    await expect(service.listAssignableAnalysts('r1', '   ')).resolves.toEqual({ data: [], error: null });
    for (const call of get.mock.calls) {
      expect(call).toEqual(['/v1/assessment_requests/{requestId}/assignable_analysts', { params: { path: { requestId: 'r1' } } }]);
    }
  });

  it('refuses a list over 50 people or a person with a key the contract does not declare', async () => {
    useMockClient();
    const many = Array.from({ length: 51 }, (_, index) => ({ documentId: `u${index}`, displayName: `Analyst ${index}` }));
    get.mockResolvedValueOnce({ data: { data: many }, response: { status: 200 } });
    await expect(service.listAssignableAnalysts('r1')).resolves.toMatchObject({
      data: null,
      error: { kind: 'response-contract-mismatch', operation: 'listAssignableAnalysts' },
    });
    get.mockResolvedValueOnce({ data: { data: [{ ...bob, email: 'bob@example.test' }] }, response: { status: 200 } });
    await expect(service.listAssignableAnalysts('r1')).resolves.toMatchObject({ data: null, error: { kind: 'response-contract-mismatch' } });
    get.mockResolvedValueOnce({ data: { data: [], total: 0 }, response: { status: 200 } });
    await expect(service.listAssignableAnalysts('r1')).resolves.toMatchObject({ data: null, error: { kind: 'response-contract-mismatch' } });
  });

  it('returns a refused list read as its status, and refuses invalid input before calling Strapi', async () => {
    useMockClient();
    get.mockResolvedValueOnce({ data: undefined, error: { error: { status: 403 } }, response: { status: 403 } });
    await expect(service.listAssignableAnalysts('r1')).resolves.toMatchObject({ data: null, error: { status: 403 } });
    get.mockReset();
    await expect(service.listAssignableAnalysts('')).resolves.toMatchObject({ data: null });
    await expect(service.listAssignableAnalysts('r1', 'x'.repeat(101))).resolves.toMatchObject({ data: null });
    expect(get).not.toHaveBeenCalled();
  });
});
