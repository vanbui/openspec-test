import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import createClient from 'openapi-fetch';
import type { paths } from '../../lib/api/generated/schema';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: () => ({ GET: get, POST: post, PUT: put }),
  normalizeTransportError,
}));

const servicePath = resolve(process.cwd(), 'src/features/requests/request-service.ts');

const requestPayload = {
  documentId: 'request-1',
  id: 1,
  requestNumber: 'RAR-2026-X7K4Q2',
  title: 'Customer portal review',
  description: 'Review the new customer portal.',
  requestStatus: 'submitted',
  dueDate: '2026-09-12',
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-21T11:30:00.000Z',
  publishedAt: '2026-08-20T10:00:00.000Z',
  /* Phase 13 (D-24): the request read always carries the viewer's notes summary, or null. */
  notes: null,
  /* Phase 13 (D-29): the analyst's AI-inputs signal per target, or null for any other viewer. */
  aiInputs: null,
};

const pagination = { page: 2, pageSize: 20, pageCount: 3, total: 45 };

/** One served my requests item at a released questionnaire, the Requestor's own step. */
const myRequestItem = {
  documentId: 'request-1',
  requestNumber: 'RAR-2026-X7K4Q2',
  title: 'Customer portal review',
  requestStatus: 'questionnaire-in-progress',
  submittedDate: '2026-08-21T11:30:00.000Z',
  dueDate: '2026-09-12',
  updatedAt: '2026-08-22T09:00:00.000Z',
  daysSinceSubmission: 4,
  holder: 'requestor',
  stage: { key: 'questionnaire-released', label: 'Questionnaire released' },
  nextAction: { summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/questionnaire-1' },
  returned: null,
  questionnaire: { documentId: 'questionnaire-1', answered: 1, total: 3 },
  // D-17, D-24: the assignee's display name alone, and the notes new to the Requestor.
  assignee: { displayName: 'Bob Doe' },
  unreadNotes: 2,
};

async function loadService() {
  if (!existsSync(servicePath)) {
    throw new Error('PHASE2_RED_W0_02A_REQUEST_SERVICE_BEHAVIOR_ABSENT');
  }

  const serviceModule = './request-' + 'service';
  return import(/* @vite-ignore */ serviceModule);
}

afterEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  normalizeTransportError.mockReset();
});

describe('request service contract', () => {
  it('maps bounded request queries and normalizes hydrated payloads', async () => {
    const urls: string[] = [];
    const serializerClient = createClient<paths>({
      baseUrl: 'http://127.0.0.1:43111/api',
      fetch: async (request) => {
        urls.push(request.url);
        return Response.json({ data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } });
      },
    });

    await serializerClient.GET('/csrm-assessment-requests/{id}', {
      params: { path: { id: 'request-1' }, query: { populate: ['informationSystems', 'informationAssets'] } },
    });

    expect(urls[0]).toBe(
      'http://127.0.0.1:43111/api/csrm-assessment-requests/request-1?populate=informationSystems&populate=informationAssets',
    );
    expect(urls).toHaveLength(1);

    const service = await loadService();
    expect(service.parseRequestListQuery({
      q: '  portal  ',
      status: 'submitted',
      sort: 'updatedAt:desc',
      page: '999999',
      pageSize: '999',
      owner: 'another-requestor',
    })).toEqual({ q: 'portal', status: 'submitted', sort: 'updatedAt:desc', page: 10_000, pageSize: 50 });
    expect(service.parseRequestListQuery({ status: 'forged', sort: 'owner:asc', page: '-5', pageSize: '7' })).toEqual({
      q: '',
      status: undefined,
      sort: 'updatedAt:desc',
      page: 1,
      pageSize: 10,
    });

    // D-34: My requests and the Requestor Home read GET /v1/my_requests; both core list reads are retired (11-11, 11-12).
    expect(service.listRequests).toBeUndefined();
    expect(service.listDashboardRequests).toBeUndefined();

    get
      .mockResolvedValueOnce({
        data: {
          data: {
            ...requestPayload,
            informationSystems: [{ documentId: 'system-1', name: 'Customer portal', owner: { email: 'hidden' } }],
            informationAssets: [{ documentId: 'asset-1', name: 'Customer records', secret: 'hidden' }],
            questionnaire: null,
            assessment: null,
            relationships: { questionnaire: { availability: 'available', documentId: 'questionnaire/id', questionnaireNumber: 'QUE-1', title: 'Standard questionnaire', state: 'submitted' }, assessment: { availability: 'available', documentId: 'assessment/id', assessmentNumber: 'ASM-1', assessmentStatus: 'approved', residualRiskCounts: { Low: 0, Moderate: 1, High: 0, Critical: 0, total: 1 } } },
          },
        },
        error: undefined,
        response: { status: 200 },
      });

    await expect(service.getRequest('request-1')).resolves.toMatchObject({
      data: {
        documentId: 'request-1',
        informationSystems: [{ documentId: 'system-1', name: 'Customer portal' }],
        informationAssets: [{ documentId: 'asset-1', name: 'Customer records' }],
        questionnaire: null,
        assessment: null,
        relationships: { questionnaire: { availability: 'available', documentId: 'questionnaire/id' }, assessment: { availability: 'available', documentId: 'assessment/id', residualRiskCounts: { Low: 0, Moderate: 1, High: 0, Critical: 0, total: 1 } } },
      },
      error: null,
    });
    expect(get).toHaveBeenNthCalledWith(1, '/csrm-assessment-requests/{id}', {
      params: { path: { id: 'request-1' }, query: { populate: ['informationSystems', 'informationAssets'] } },
    });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('normalizes forbidden, transport, and malformed responses safely', async () => {
    const service = await loadService();
    const forbidden = { data: null, error: { message: 'You do not have permission to view these requests.', status: 403 } };
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };

    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => status === 403 ? forbidden : unavailable);
    get
      .mockResolvedValueOnce({ data: undefined, error: { name: 'Forbidden' }, response: { status: 403 } })
      .mockRejectedValueOnce(new Error('internal connection detail'))
      .mockResolvedValueOnce({ data: { data: { ...requestPayload, requestStatus: 'forged' } }, response: { status: 200 } });

    await expect(service.getRequest('request-1')).resolves.toEqual(forbidden);
    await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);
    await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);
  });

  it('reads the owner-scoped status summary once and maps each count to its request status', async () => {
    const service = await loadService();
    get.mockResolvedValueOnce({
      data: {
        data: {
          draft: 4,
          submitted: 3,
          questionnaireInProgress: 2,
          riskAssessmentDrafted: 1,
          underReview: 5,
          approved: 6,
          closed: 7,
          total: 28,
          byHolder: { requestor: 5, analyst: 10, none: 13 },
          withUnreadNotes: 3,
        },
      },
      error: undefined,
      response: { status: 200 },
    });

    // The counts arrive in lifecycle order, one per status, with who holds the caller's requests (D-11):
    // the analyst Home's Your own requests reads byHolder (11-12), and the sidebar counts read it next (11-13).
    await expect(service.getMyRequestStatusSummary()).resolves.toEqual({
      data: {
        statuses: [
          { status: 'draft', count: 4 },
          { status: 'submitted', count: 3 },
          { status: 'questionnaire-in-progress', count: 2 },
          { status: 'risk-assessment-drafted', count: 1 },
          { status: 'under-review', count: 5 },
          { status: 'approved', count: 6 },
          { status: 'closed', count: 7 },
        ],
        byHolder: { requestor: 5, analyst: 10, none: 13 },
        // D-24: the Requestor Home's new-notes row reads this count.
        withUnreadNotes: 3,
      },
      error: null,
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/v1/my_requests/status_summary');
  });

  it('turns a refused, failed or malformed status summary into an error result', async () => {
    const service = await loadService();
    const forbidden = { data: null, error: { message: 'You do not have permission to view these requests.', status: 403 } };
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
    const byHolder = { requestor: 0, analyst: 0, none: 0 };
    const counts = {
      draft: 0, submitted: 0, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 0, closed: 0, total: 0, byHolder, withUnreadNotes: 0,
    };
    const missingClosed = {
      draft: 0, submitted: 0, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 0, total: 0, byHolder, withUnreadNotes: 0,
    };
    const { withUnreadNotes: _unread, ...missingUnread } = counts;
    const { byHolder: _omitted, ...missingByHolder } = counts;
    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => status === 403 ? forbidden : unavailable);
    const malformed = [
      { data: { ...counts, archived: 1 } },
      { data: { ...counts, closed: -1 } },
      { data: { ...counts, draft: 1.5 } },
      { data: { ...counts, total: '0' } },
      { data: missingClosed },
      // The holder counts are required and closed (D-02 item 6).
      { data: missingByHolder },
      { data: { ...counts, byHolder: { ...byHolder, unassigned: 0 } } },
      { data: { ...counts, byHolder: { requestor: 0, analyst: 0 } } },
      { data: { ...counts, byHolder: { ...byHolder, none: -1 } } },
      // The count of requests with new notes is required and a whole count (D-24).
      { data: missingUnread },
      { data: { ...counts, withUnreadNotes: -1 } },
      { data: { ...counts, withUnreadNotes: 0.5 } },
      { data: counts, meta: {} },
      { data: [counts] },
    ];
    for (const payload of malformed) {
      get.mockResolvedValueOnce({ data: payload, error: undefined, response: { status: 200 } });
      await expect(service.getMyRequestStatusSummary(), JSON.stringify(payload)).resolves.toEqual(unavailable);
    }

    get.mockResolvedValueOnce({ data: undefined, error: { name: 'Forbidden' }, response: { status: 403 } });
    await expect(service.getMyRequestStatusSummary()).resolves.toEqual(forbidden);
    get.mockRejectedValueOnce(new Error('internal connection detail'));
    await expect(service.getMyRequestStatusSummary()).resolves.toEqual(unavailable);
  });

  it('lists my requests through GET /v1/my_requests with exactly the parsed query (D-02 item 6, D-34)', async () => {
    const urls: string[] = [];
    const serializerClient = createClient<paths>({
      baseUrl: 'http://127.0.0.1:43111/api',
      fetch: async (request) => {
        urls.push(request.url);
        return Response.json({ data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } });
      },
    });
    await serializerClient.GET('/v1/my_requests', {
      params: { query: { q: 'portal', status: 'submitted', holder: 'requestor', notes: 'unread', sort: 'dueDate:asc', page: 2, pageSize: 20 } },
    });
    expect(urls[0]).toBe(
      'http://127.0.0.1:43111/api/v1/my_requests?q=portal&status=submitted&holder=requestor&notes=unread&sort=dueDate%3Aasc&page=2&pageSize=20',
    );

    const service = await loadService();
    get.mockResolvedValueOnce({
      data: { data: [myRequestItem], meta: { pagination } },
      error: undefined,
      response: { status: 200 },
    });
    await expect(service.listMyRequests({ q: 'portal', status: 'submitted', holder: 'requestor', notes: 'unread', sort: 'dueDate:asc', page: 2, pageSize: 20 }))
      .resolves.toEqual({ data: { items: [myRequestItem], pagination }, error: null });
    expect(get).toHaveBeenCalledWith('/v1/my_requests', {
      params: { query: { q: 'portal', status: 'submitted', holder: 'requestor', notes: 'unread', sort: 'dueDate:asc', page: 2, pageSize: 20 } },
    });

    // An empty search, no status and no holder are left out rather than sent empty.
    get.mockResolvedValueOnce({ data: { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } }, error: undefined, response: { status: 200 } });
    await service.listMyRequests({ q: '', status: undefined, holder: undefined, notes: undefined, sort: 'updatedAt:desc', page: 1, pageSize: 10 });
    expect(get).toHaveBeenLastCalledWith('/v1/my_requests', { params: { query: { sort: 'updatedAt:desc', page: 1, pageSize: 10 } } });
  });

  it('refuses a my requests payload with an extra key or an unknown holder, and maps a refusal to the forbidden result', async () => {
    const service = await loadService();
    const forbidden = { data: null, error: { message: 'You do not have permission to view these requests.', status: 403 } };
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => status === 403 ? forbidden : unavailable);
    const query = { q: '', status: undefined, holder: undefined, notes: undefined, sort: 'updatedAt:desc' as const, page: 1, pageSize: 10 as const };
    const malformed = [
      { data: [{ ...myRequestItem, assessmentNumber: 'ASM-2026-ABCDEF' }], meta: { pagination } },
      { data: [{ ...myRequestItem, holder: 'security-analyst' }], meta: { pagination } },
      { data: [{ ...myRequestItem, nextAction: { summary: 'Answer and submit the questionnaire.', actor: 'requestor' } }], meta: { pagination } },
      { data: [{ ...myRequestItem, questionnaire: { documentId: 'questionnaire-1', answered: 1, total: 3, percent: 33 } }], meta: { pagination } },
      { data: [myRequestItem], meta: { pagination }, extra: true },
      // D-17: the Requestor sees the assignee's display name and nothing more; both fields are required.
      { data: [{ ...myRequestItem, assignee: { documentId: 'user-bob', displayName: 'Bob Doe' } }], meta: { pagination } },
      { data: [{ ...myRequestItem, assignee: { displayName: 'Bob Doe', email: 'bob@example.test' } }], meta: { pagination } },
      { data: [{ ...myRequestItem, assignee: undefined }], meta: { pagination } },
      { data: [{ ...myRequestItem, unreadNotes: -1 }], meta: { pagination } },
      { data: [{ ...myRequestItem, unreadNotes: undefined }], meta: { pagination } },
      { data: [myRequestItem] },
    ];
    for (const payload of malformed) {
      get.mockResolvedValueOnce({ data: payload, error: undefined, response: { status: 200 } });
      await expect(service.listMyRequests(query), JSON.stringify(payload)).resolves.toEqual(unavailable);
    }
    get.mockResolvedValueOnce({ data: undefined, error: { name: 'Forbidden' }, response: { status: 403 } });
    await expect(service.listMyRequests(query)).resolves.toEqual(forbidden);
    get.mockRejectedValueOnce(new Error('internal connection detail'));
    await expect(service.listMyRequests(query)).resolves.toEqual(unavailable);
  });

  it('uses one bounded server selector page and does not enumerate inventory', async () => {
    const service = await loadService();
    const firstPage = Array.from({ length: 25 }, (_, index) => ({
      documentId: `system-${index + 1}`,
      name: `System ${index + 1}`,
    }));
    get
      .mockResolvedValueOnce({
        data: { data: firstPage, meta: { pagination: { page: 1, pageSize: 25, pageCount: 5, total: 101 } } },
        error: undefined,
        response: { status: 200 },
      })

    await expect(service.searchInformationSystems({ search: 'portal' })).resolves.toEqual({
      data: firstPage,
      error: null,
    });
    expect(get).toHaveBeenNthCalledWith(1, '/v1/information_systems', {
      params: { query: { q: 'portal', page: 1, pageSize: 25 } },
    });
  });

  it('sends exact allowlisted mutation bodies and resolves authorised relation inventory', async () => {
    const service = await loadService();
    expect(service).not.toHaveProperty('listSponsors');
    const editableFields = {
      title: 'Customer portal review',
      description: 'Review the new customer portal.',
      assessmentType: 'Project' as const,
      division: 'Digital',
      businessUnit: 'Customer platforms',
      businessPurpose: 'Serve customers online',
      businessCriticality: 'High' as const,
      thirdPartyInvolvement: true,
      thirdPartyDetails: 'Hosted by an approved provider',
      regulatoryRequirements: 'Privacy Act',
      dueDate: '2026-09-12',
      informationSystems: ['system-1'],
      informationAssets: ['asset-1'],
    };
    const successfulMutation = {
      data: { data: requestPayload },
      error: undefined,
      response: { status: 200 },
    };

    post.mockResolvedValueOnce(successfulMutation);
    put.mockResolvedValueOnce(successfulMutation).mockResolvedValueOnce(successfulMutation);
    get
      .mockResolvedValueOnce({
        data: { data: [{ documentId: 'system-1', id: 1, name: 'Customer portal', internetFacing: true, externalAccessRequired: false, publishedAt: '2026-08-01T00:00:00.000Z' }], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } },
        error: undefined,
        response: { status: 200 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ documentId: 'asset-1', id: 1, name: 'Customer records', containsPersonalData: true, containsLegalData: false, containsCreditCardData: false, publishedAt: '2026-08-01T00:00:00.000Z' }], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } },
        error: undefined,
        response: { status: 200 },
      });

    await expect(service.createRequest(editableFields)).resolves.toMatchObject({ data: { documentId: 'request-1' }, error: null });
    await expect(service.updateRequest('request-1', editableFields)).resolves.toMatchObject({ data: { documentId: 'request-1' }, error: null });
    await expect(service.submitRequest('request-1', editableFields)).resolves.toMatchObject({ data: { documentId: 'request-1' }, error: null });
    await expect(service.listInformationSystems()).resolves.toEqual({
      data: [{ documentId: 'system-1', name: 'Customer portal' }],
      error: null,
    });
    await expect(service.listInformationAssets()).resolves.toEqual({
      data: [{ documentId: 'asset-1', name: 'Customer records' }],
      error: null,
    });

    expect(post).toHaveBeenCalledWith('/csrm-assessment-requests', { body: { data: editableFields } });
    expect(put).toHaveBeenNthCalledWith(1, '/csrm-assessment-requests/{id}', {
      params: { path: { id: 'request-1' } },
      body: { data: editableFields },
    });
    expect(put).toHaveBeenNthCalledWith(2, '/csrm-assessment-requests/{id}', {
      params: { path: { id: 'request-1' } },
      body: { data: { ...editableFields, requestStatus: 'submitted' } },
    });
    expect(get).toHaveBeenNthCalledWith(1, '/v1/information_systems', { params: { query: { q: '', page: 1, pageSize: 25 } } });
    expect(get).toHaveBeenNthCalledWith(2, '/v1/information_assets', { params: { query: { q: '', page: 1, pageSize: 25 } } });

    for (const mutation of [post.mock.calls[0]?.[1], put.mock.calls[0]?.[1], put.mock.calls[1]?.[1]]) {
      const body = mutation?.body?.data;
      expect(body).not.toHaveProperty('requestor');
      expect(body).not.toHaveProperty('requestNumber');
      expect(body).not.toHaveProperty('submittedDate');
      expect(body).not.toHaveProperty('questionnaire');
      expect(body).not.toHaveProperty('assessment');
      expect(body).not.toHaveProperty('sponsor');
    }
  });

  /*
   * Phase 13 (D-04, D-09, D-17): the request read projects people. It carries the analyst's assignment view or the
   * Requestor's display name alone, and revertedBy as a documentId and a display name; the web never asks Strapi
   * to populate a person.
   */
  it('reads both assignment views and the projected revertedBy, and refuses an assignment with a key the contract does not declare', async () => {
    const service = await loadService();
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };
    normalizeTransportError.mockImplementation(() => unavailable);
    const bob = { documentId: 'u1', displayName: 'Bob Doe' };
    const analystView = {
      assignee: bob,
      assignedBy: bob,
      assignedAt: '2026-10-09T01:02:03.000Z',
      actions: ['reassign', 'unassign'],
      ownRequest: false,
      history: [{ action: 'pick-up', by: bob, at: '2026-10-09T01:02:03.000Z', from: null, to: bob, reason: null }],
      viewer: bob,
    };
    const revertedBy = { documentId: 'u1', displayName: 'Bob Doe' };

    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, assignment: analystView, revertedBy } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { assignment: analystView, revertedBy }, error: null });

    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, assignment: { assignee: { displayName: 'Bob Doe' } }, revertedBy: null } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { assignment: { assignee: { displayName: 'Bob Doe' } }, revertedBy: null }, error: null });

    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, assignment: { assignee: null } } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { assignment: { assignee: null } }, error: null });

    for (const assignment of [
      { ...analystView, email: 'bob@example.test' },
      // 13-09: the analyst view always names its viewer, whom a pick-up sends.
      Object.fromEntries(Object.entries(analystView).filter(([key]) => key !== 'viewer')),
      { assignee: { displayName: 'Bob Doe', email: 'bob@example.test' } },
      { assignee: { displayName: 'Bob Doe' }, assignedAt: '2026-10-09T01:02:03.000Z' },
      { ...analystView, assignee: { ...bob, username: 'bob' } },
    ]) {
      get.mockResolvedValueOnce({ data: { data: { ...requestPayload, assignment } }, response: { status: 200 } });
      await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);
    }
    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, revertedBy: { ...revertedBy, email: 'bob@example.test' } } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);

    for (const call of get.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain('revertedBy');
    }
  });

  /*
   * Phase 13 (D-24, D-25): the request read carries the viewer's notes summary from Strapi: how many notes, how many are
   * new to the reader, and whether the request takes a new note and why not; null for a viewer who may not use them.
   */
  it('reads the viewer’s notes summary or null, and refuses a read without it or a summary the contract does not declare', async () => {
    const service = await loadService();
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };
    normalizeTransportError.mockImplementation(() => unavailable);
    const open = { total: 2, unread: 1, accepting: true, closedReason: null };
    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, notes: open } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { notes: open }, error: null });
    for (const closedReason of ['not-submitted', 'returned-to-draft', 'released'] as const) {
      const closed = { total: 0, unread: 0, accepting: false, closedReason };
      get.mockResolvedValueOnce({ data: { data: { ...requestPayload, notes: closed } }, response: { status: 200 } });
      await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { notes: closed }, error: null });
    }
    get.mockResolvedValueOnce({ data: { data: requestPayload }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { notes: null }, error: null });

    const withoutNotes = Object.fromEntries(Object.entries(requestPayload).filter(([key]) => key !== 'notes'));
    for (const data of [
      withoutNotes,
      { ...requestPayload, notes: { ...open, readers: ['u1'] } },
      { ...requestPayload, notes: { ...open, closedReason: 'archived' } },
      { ...requestPayload, notes: { ...open, unread: -1 } },
      { ...requestPayload, notes: { total: 2, unread: 1, accepting: true } },
    ]) {
      get.mockResolvedValueOnce({ data: { data }, response: { status: 200 } });
      await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);
    }
  });

  /*
   * Phase 14 (D-04 item 7, D-18): a reader's request read carries the file summary (the count of files not removed and
   * whether the viewer may add one now); anyone else's read has no `attachments` key. The summary is closed.
   */
  it('reads the viewer’s file summary when Strapi serves it, reads none otherwise, and refuses a summary the contract does not declare', async () => {
    const service = await loadService();
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };
    normalizeTransportError.mockImplementation(() => unavailable);
    const summary = {
      count: 1,
      canAdd: true,
      refusal: null,
      window: 'after-submission',
      needsNote: true,
      remaining: 19,
      activeCount: 1,
      storedCount: 1,
      limits: { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 },
      allowedTypes: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'],
    };
    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, attachments: summary } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { attachments: summary }, error: null });
    const closed = { ...summary, count: 0, canAdd: false, refusal: 'ATTACHMENTS_CLOSED', window: 'closed', needsNote: false, remaining: 20, activeCount: 0 };
    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, attachments: closed } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { attachments: closed }, error: null });

    get.mockResolvedValueOnce({ data: { data: requestPayload }, response: { status: 200 } });
    const without = await service.getRequest('request-1');
    expect(without.error).toBeNull();
    expect(without.data).not.toHaveProperty('attachments');

    for (const attachments of [
      { ...summary, files: [{ documentId: 'a1', fileName: 'data-flow.docx' }] },
      { ...summary, refusal: 'ATTACHMENT_REMOVED' },
      { ...summary, count: -1 },
      Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'count')),
      null,
    ]) {
      get.mockResolvedValueOnce({ data: { data: { ...requestPayload, attachments } }, response: { status: 200 } });
      await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);
    }
  });

  /*
   * Phase 13 (D-29): the analyst's request read says, per target, which notes changed the AI inputs since that record
   * was generated, by identity and change only; null for a target with no baseline and for any viewer but an analyst.
   */
  it('reads the AI-inputs signal per target, and refuses a read without it or a signal the contract does not declare', async () => {
    const service = await loadService();
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };
    normalizeTransportError.mockImplementation(() => unavailable);
    const changed = { count: 1, notes: [{ documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: '2026-10-06T00:00:00.000Z', change: 'marked' }], files: [] };
    const aiInputs = { questionnaire: changed, assessment: null };
    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, aiInputs } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { aiInputs }, error: null });
    // Phase 14 D-36: a files-only change is the same one signal, with no note.
    const filesOnly = { questionnaire: { count: 1, notes: [], files: [{ documentId: 'file-csv', fileName: 'register.csv', change: 'included' }] }, assessment: null };
    get.mockResolvedValueOnce({ data: { data: { ...requestPayload, aiInputs: filesOnly } }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { aiInputs: filesOnly }, error: null });
    get.mockResolvedValueOnce({ data: { data: requestPayload }, response: { status: 200 } });
    await expect(service.getRequest('request-1')).resolves.toMatchObject({ data: { aiInputs: null }, error: null });

    const withoutSignal = Object.fromEntries(Object.entries(requestPayload).filter(([key]) => key !== 'aiInputs'));
    for (const data of [
      withoutSignal,
      { ...requestPayload, aiInputs: { questionnaire: changed } },
      { ...requestPayload, aiInputs: { ...aiInputs, risk: null } },
      { ...requestPayload, aiInputs: { ...aiInputs, questionnaire: { ...changed, notes: [{ ...changed.notes[0], body: 'note text' }] } } },
      { ...requestPayload, aiInputs: { ...aiInputs, questionnaire: { ...changed, notes: [{ ...changed.notes[0], change: 'edited' }] } } },
    ]) {
      get.mockResolvedValueOnce({ data: { data }, response: { status: 200 } });
      await expect(service.getRequest('request-1')).resolves.toEqual(unavailable);
    }
  });
});
