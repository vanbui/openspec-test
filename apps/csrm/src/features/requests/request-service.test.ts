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
};

const pagination = { page: 2, pageSize: 20, pageCount: 3, total: 45 };

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
      params: { path: { id: 'request-1' }, query: { populate: ['informationSystems', 'informationAssets', 'revertedBy'] } },
    });
    await serializerClient.GET('/csrm-assessment-requests', {
      params: {
        query: {
          populate: ['questionnaire', 'assessment'],
          _q: 'portal',
          filters: { requestStatus: 'submitted' },
          sort: { updatedAt: 'desc' },
          'pagination[page]': 2,
          'pagination[pageSize]': 20,
        },
      },
    });

    expect(urls[0]).toBe(
      'http://127.0.0.1:43111/api/csrm-assessment-requests/request-1?populate=informationSystems&populate=informationAssets&populate=revertedBy',
    );
    expect(urls[1]).toContain('populate=questionnaire&populate=assessment');
    expect(urls[1]).toContain('_q=portal');
    expect(urls[1]).toContain('filters[requestStatus]=submitted');
    expect(urls[1]).toContain('sort[updatedAt]=desc');
    expect(urls[1]).toContain('pagination[page]=2');
    expect(urls[1]).toContain('pagination[pageSize]=20');

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

    get
      .mockResolvedValueOnce({
        data: { data: [requestPayload], meta: { pagination } },
        error: undefined,
        response: { status: 200 },
      })
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
      })
      .mockResolvedValueOnce({
        data: {
          data: [{
            ...requestPayload,
            informationSystems: [{ documentId: 'hostile-system', name: 'Must not cross projection' }],
            questionnaire: { documentId: 'questionnaire-1', title: 'Standard questionnaire', questions: new Array(500).fill('hidden') },
            assessment: { documentId: 'assessment-1', assessmentStatus: 'draft', risks: new Array(500).fill('hidden') },
          }],
          meta: { pagination },
        },
        error: undefined,
        response: { status: 200 },
      });

    await expect(service.listRequests({ q: 'portal', status: 'submitted', sort: 'updatedAt:desc', page: 2, pageSize: 20 })).resolves.toMatchObject({
      data: { requests: [{ documentId: 'request-1', requestNumber: 'RAR-2026-X7K4Q2', title: 'Customer portal review', requestStatus: 'submitted' }], pagination },
      error: null,
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
    await expect(service.listDashboardRequests({ q: '', status: undefined, sort: 'updatedAt:desc', page: 2, pageSize: 20 })).resolves.toMatchObject({
      data: {
        requests: [{
          questionnaire: { documentId: 'questionnaire-1', title: 'Standard questionnaire' },
          assessment: { documentId: 'assessment-1', assessmentStatus: 'draft' },
          informationSystems: [],
          informationAssets: [],
        }],
        pagination,
      },
      error: null,
    });

    expect(get).toHaveBeenNthCalledWith(1, '/csrm-assessment-requests', {
      params: { query: { _q: 'portal', filters: { requestStatus: 'submitted' }, sort: { updatedAt: 'desc' }, 'pagination[page]': 2, 'pagination[pageSize]': 20 } },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/csrm-assessment-requests/{id}', {
      params: { path: { id: 'request-1' }, query: { populate: ['informationSystems', 'informationAssets', 'revertedBy'] } },
    });
    expect(get).toHaveBeenNthCalledWith(3, '/csrm-assessment-requests', {
      params: { query: { populate: ['questionnaire', 'assessment'], sort: { updatedAt: 'desc' }, 'pagination[page]': 2, 'pagination[pageSize]': 20 } },
    });
  });

  it('normalizes forbidden, transport, and malformed responses safely', async () => {
    const service = await loadService();
    const forbidden = { data: null, error: { message: 'You do not have permission to view these requests.', status: 403 } };
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };

    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => status === 403 ? forbidden : unavailable);
    get
      .mockResolvedValueOnce({ data: undefined, error: { name: 'Forbidden' }, response: { status: 403 } })
      .mockRejectedValueOnce(new Error('internal connection detail'))
      .mockResolvedValueOnce({ data: { data: [{ ...requestPayload, requestStatus: 'forged' }], meta: { pagination } }, response: { status: 200 } });

    await expect(service.listRequests(service.parseRequestListQuery({}))).resolves.toEqual(forbidden);
    await expect(service.listRequests(service.parseRequestListQuery({}))).resolves.toEqual(unavailable);
    await expect(service.listRequests(service.parseRequestListQuery({}))).resolves.toEqual(unavailable);
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
});
