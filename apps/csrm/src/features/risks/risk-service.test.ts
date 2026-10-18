import { afterEach, describe, expect, it, vi } from 'vitest';

import * as service from './risk-service';
import * as riskSchema from './risk-schema';
import { parseRiskRegisterQuery } from './risk-schema';

const get = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get })),
  normalizeTransportError,
}));

afterEach(() => {
  get.mockReset();
  normalizeTransportError.mockReset();
});

const response = (data: unknown, status = 200) => ({ data, response: { status } });
const registerPayload = {
  data: [{
    documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: 'A risk.', inherentRating: 'High',
    residualRating: 'Moderate', treatmentStatus: 'In Progress', treatmentOwner: null,
    targetDate: '2026-09-30', treatmentDueState: 'later',
    assessment: { documentId: 'assessment-1', assessmentNumber: 'ASM-0001', title: 'Portal' },
    accepted: false,
    stage: 'under-assessment',
    treatmentAction: null,
  }],
  meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 }, selectedLabels: {} },
};
const detail = {
  documentId: 'risk-1', riskNumber: 'RSK-0001', parentLock: 'mutable',
  issueStatement: null, riskStatement: 'A risk.', riskCategory: null, riskSubCategory: null,
  riskCause: null, potentialImpact: null, dataClassification: 'Restricted', inherentLikelihood: null,
  highestInherentConsequence: null, inherentRating: 'High', inherentRatingRationale: null,
  residualLikelihood: null, highestResidualConsequence: null, residualRating: 'Moderate',
  residualRatingRationale: null, controlEffectiveness: 'Effective', riskVelocity: 'High',
  identifiedDate: '2026-08-01', targetDate: '2026-09-30', closureDate: null, isExempted: false,
  exemptionReviewDate: null, escalationDetails: null, comments: null, riskCommunicationDate: null,
  treatmentAction: 'Treat', treatmentPlan: null, treatmentResolveDate: null, treatmentStatus: 'In Progress',
  riskType: { documentId: 'type-1', name: 'Access', description: null },
  riskOwner: { documentId: 'user-1', displayName: 'Alex Analyst' }, treatmentOwner: null,
  informationSystemImpacted: { documentId: 'system-1', name: 'Portal' }, informationAssetImpacted: null,
  assessment: { documentId: 'assessment-1', assessmentNumber: 'ASM-0001', title: 'Portal' },
  controlImplementations: [{
    documentId: 'implementation-1', control: { documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control' },
    controlOwner: null, controlStatus: 'Planned', effectivenessRating: null, evidence: null,
    implementationDueDate: '2026-09-30', implementedDate: null, reviewDate: null,
  }],
  withdrawal: null,
};

describe('Risk Register generated-client boundary', () => {
  it('parses one complete closed Risk detail and rejects invalid or partial aggregates', () => {
    const parse = (riskSchema as unknown as { parseRiskDetailPayload: (payload: unknown) => unknown }).parseRiskDetailPayload;
    expect(parse({ data: detail })).toEqual(detail);
    for (const hostile of [
      { data: { ...detail, parentLock: 'invalid' } },
      { data: { ...detail, assessment: undefined } },
      { data: { ...detail, createdAt: '2026-01-01' } },
      { data: { ...detail, riskOwner: { ...detail.riskOwner, email: 'hidden@example.test' } } },
      { data: { ...detail, targetDate: '2026-02-30' } },
      { data: { ...detail, controlImplementations: [{ ...detail.controlImplementations[0], controlStatus: 'Forged' }] } },
      { data: { ...detail, controlImplementations: Array.from({ length: 1_001 }, () => detail.controlImplementations[0]) } },
    ]) expect(() => parse(hostile)).toThrow();
  });

  /* Phase 16 D-45: the register detail always carries its withdrawal block, null on an active Risk. */
  it('parses the Risk detail withdrawal block, null or who, when and why, and refuses anything else', () => {
    const parse = (riskSchema as unknown as { parseRiskDetailPayload: (payload: unknown) => unknown }).parseRiskDetailPayload;
    const block = { at: '2026-10-15T01:02:03.000Z', by: { documentId: 'user-bob', displayName: 'Bob Doe' }, reason: 'Proposed under the wrong Risk Type' };
    expect(parse({ data: { ...detail, withdrawal: null } })).toEqual({ ...detail, withdrawal: null });
    expect(parse({ data: { ...detail, withdrawal: block } })).toEqual({ ...detail, withdrawal: block });
    expect(parse({ data: { ...detail, withdrawal: { ...block, by: null } } })).toEqual({ ...detail, withdrawal: { ...block, by: null } });
    const { withdrawal: _withdrawal, ...withoutWithdrawal } = detail;
    for (const hostile of [
      { data: withoutWithdrawal },
      { data: { ...detail, withdrawal: { ...block, undo: false } } },
      { data: { ...detail, withdrawal: { ...block, reason: '' } } },
      { data: { ...detail, withdrawal: { ...block, at: 'yesterday' } } },
    ]) expect(() => parse(hostile)).toThrow();
  });

  it('loads Risk detail through the generated opaque path and normalizes safe no-data failures', async () => {
    const load = (service as unknown as { getRiskDetail: (riskId: string) => Promise<unknown> }).getRiskDetail;
    get.mockResolvedValueOnce(response({ data: detail }));
    await expect(load('risk_opaque-1')).resolves.toEqual({ data: detail, error: null });
    expect(get).toHaveBeenCalledWith('/v1/risks/{riskId}', { params: { path: { riskId: 'risk_opaque-1' } } });

    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => ({
      data: null, error: { message: 'Risk is not available.', status: status ?? 503 },
    }));
    for (const status of [403, 404, 409]) {
      get.mockResolvedValueOnce({ error: { message: 'must not leak' }, response: { status } });
      await expect(load('risk_opaque-1')).resolves.toEqual({
        data: null, error: { message: 'Risk is not available.', status },
      });
    }
  });

  it('serializes the exact canonical list query through generated GET', async () => {
    get.mockResolvedValueOnce(response(registerPayload));
    const query = parseRiskRegisterQuery({
      q: 'access', treatmentStatus: 'In Progress', inherentRating: 'High', residualRating: 'Moderate',
      riskOwner: 'user-1', treatmentOwner: 'user-2', assessment: 'assessment-1', system: 'system-1',
      asset: 'asset-1', mitigationStatus: 'Planned', state: 'open', sort: 'riskNumber:desc', page: '2', pageSize: '50',
      targetDateFrom: '2026-01-01', targetDateTo: '2026-12-31', forged: 'hidden',
    });
    await expect(service.listRiskRegister(query)).resolves.toEqual({ data: registerPayload, error: null });
    expect(get).toHaveBeenCalledWith('/v1/risks', { params: { query } });
    expect(get.mock.calls[0]?.[1]?.params.query).toMatchObject({
      state: 'open',
      targetDateFrom: '2026-01-01',
      targetDateTo: '2026-12-31',
    });
    expect(JSON.stringify(get.mock.calls)).not.toMatch(/forged/);

    // Absent means all Risks: no state reaches the server.
    get.mockResolvedValueOnce(response(registerPayload));
    await service.listRiskRegister(parseRiskRegisterQuery({ state: 'Open' }));
    expect(get.mock.calls[1]?.[1]?.params.query).not.toHaveProperty('state');
  });

  it('uses existing generated inventory paths and fails closed on cap overflow', async () => {
    get
      .mockResolvedValueOnce(response({ data: [{ documentId: 'assessment-1', assessmentNumber: 'ASM-0001', assessmentStatus: 'draft', summary: null, overallRating: null, generatedDate: null, generatedBy: null, approvalDate: null, requestTitle: null, riskCount: 0, highestResidualRating: null }] }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'type-1', name: 'Access', description: null }] }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control', description: null }] }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'user-1', displayName: 'Alex Analyst' }] }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'system-1', name: 'Portal', description: null, systemType: null, owner: null, environment: null, deploymentModel: null, businessCriticality: null, internetFacing: false, externalAccessRequired: false, hostingLocation: null, lifecycleState: null, updatedAt: '2026-09-02T00:00:00.000Z' }], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'asset-1', name: 'Customer data', description: null, location: null, type: null, dataClassification: null, confidentialityRating: null, integrityRating: null, availabilityRating: null, containsPersonalData: false, containsLegalData: false, containsCreditCardData: false, comments: null, updatedAt: '2026-09-02T00:00:00.000Z' }], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } }));
    await service.listRiskRegisterAssessments();
    await service.listRiskRegisterRiskTypes();
    await service.listRiskRegisterControls();
    await service.searchRiskRegisterOwners('  Alex  ');
    await service.listRiskRegisterSystems();
    await service.listRiskRegisterAssets();
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/v1/risk_assessments', '/v1/risk_types', '/v1/controls', '/v1/users',
      '/v1/information_systems', '/v1/information_assets',
    ]);
    expect(get.mock.calls[3]).toEqual(['/v1/users', { params: { query: { search: 'Alex' } } }]);
    expect(get.mock.calls[4][1]).toEqual({ params: { query: expect.objectContaining({ page: 1, pageSize: 100 }) } });

    normalizeTransportError.mockReturnValue({ data: null, error: { message: 'Unavailable', status: 503 } });
    get.mockResolvedValueOnce(response({ data: Array.from({ length: 21 }, (_, index) => ({ documentId: `user-${index}`, displayName: `User ${index}` })) }));
    await expect(service.searchRiskRegisterOwners('a')).resolves.toEqual({ data: null, error: { message: 'Unavailable', status: 503 } });
  });

  it('rejects hostile success payloads and normalizes safe transport failures', async () => {
    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => ({
      data: null,
      error: { message: 'Safe failure', status: status ?? 503 },
    }));
    get
      .mockResolvedValueOnce(response({ ...registerPayload, data: [{ ...registerPayload.data[0], email: 'hidden@example.test' }] }))
      .mockResolvedValueOnce({ error: { message: 'validation detail' }, response: { status: 400 } })
      .mockResolvedValueOnce({ error: { message: 'provider secret' }, response: { status: 403 } })
      .mockResolvedValueOnce({ error: { message: 'record detail' }, response: { status: 404 } })
      .mockResolvedValueOnce({ error: { message: 'state detail' }, response: { status: 409 } })
      .mockRejectedValueOnce(new Error('connection string'));
    for (const status of [503, 400, 403, 404, 409, 503]) {
      await expect(service.listRiskRegister(parseRiskRegisterQuery({}))).resolves.toEqual({
        data: null,
        error: { message: 'Safe failure', status },
      });
    }
    expect(normalizeTransportError).toHaveBeenCalledTimes(6);
  });
});

/*
 * D-32, X-4 and UAT-048: the Related assessment picker asks GET /v1/risk_assessments for the term, which the server
 * matches against the number, the summary and the request title, and labels each option by its number and its
 * request's title, or by its number alone when the request has no title.
 */
describe('the Related assessment picker search', () => {
  const assessment = (overrides: Record<string, unknown> = {}) => ({
    documentId: 'assessment-1', assessmentNumber: 'ASM-2026-2XX26G', assessmentStatus: 'approved', summary: null,
    overallRating: 'High', generatedDate: null, generatedBy: null, approvalDate: '2026-09-27T00:30:00.000Z',
    requestTitle: 'UAT-A: Brightwage People cloud HR and payroll platform', riskCount: 4, highestResidualRating: 'Critical',
    ...overrides,
  });
  const page = (data: unknown[]) => ({ data, meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: data.length } } });

  it('sends the term and a page of 25 to the assessment list, and the page alone with no term', async () => {
    get.mockResolvedValueOnce(response(page([assessment()]))).mockResolvedValueOnce(response(page([])));

    await service.listRiskRegisterAssessments('  payroll ');
    await service.listRiskRegisterAssessments();

    expect(get.mock.calls[0]).toEqual(['/v1/risk_assessments', { params: { query: { q: 'payroll', pageSize: 25 } } }]);
    expect(get.mock.calls[1]).toEqual(['/v1/risk_assessments', { params: { query: { pageSize: 25 } } }]);
  });

  it('labels each assessment by its number and its request title, or by its number alone', () => {
    const options = riskSchema.parseRiskPickerPayload('assessments', page([
      assessment(),
      assessment({ documentId: 'assessment-2', assessmentNumber: 'ASM-2026-NOTITLE', requestTitle: null }),
    ]));

    expect(options).toEqual([
      { documentId: 'assessment-1', label: 'ASM-2026-2XX26G · UAT-A: Brightwage People cloud HR and payroll platform' },
      { documentId: 'assessment-2', label: 'ASM-2026-NOTITLE' },
    ]);
  });
});

/*
 * Phase 19 D-19: the register export is read with a binary parse, checked by the shared validator's export rule, and
 * returned with the server's name and row count; a refusal keeps the transport error's reason and counts.
 */
describe('exportRiskRegister', () => {
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const PK = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const fileResponse = (headers: Record<string, string>, bytes: Uint8Array = PK) => ({
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    response: { status: 200, headers: new Headers(headers) },
  });
  const served = {
    'content-type': XLSX,
    'content-disposition': 'attachment; filename="risk-register-2026-10-01.xlsx"; filename*=UTF-8\'\'risk-register-2026-10-01.xlsx',
    'x-csrm-row-count': '1',
  };
  const query = parseRiskRegisterQuery({ q: 'HYPERLINK', treatmentStatus: 'In Progress', page: '3', pageSize: '50' });

  it('sends the register query without its page, the format, the columns and the zone, and returns the checked bytes', async () => {
    get.mockResolvedValueOnce(fileResponse(served));

    const result = await service.exportRiskRegister({ query, format: 'xlsx', columns: ['riskNumber', 'riskStatement'], timeZone: 'Australia/Sydney' });

    expect(get).toHaveBeenCalledWith('/v1/risks/export', {
      params: { query: { q: 'HYPERLINK', treatmentStatus: 'In Progress', sort: 'targetDate:asc', format: 'xlsx', columns: 'riskNumber,riskStatement', timeZone: 'Australia/Sydney' } },
      parseAs: 'arrayBuffer',
    });
    expect(result.error).toBeNull();
    expect(result.data?.bytes).toBeInstanceOf(Uint8Array);
    expect(result.data).toEqual({ fileName: 'risk-register-2026-10-01.xlsx', contentType: XLSX, bytes: PK, rowCount: 1 });
  });

  it('sends neither columns nor a zone when none is given', async () => {
    get.mockResolvedValueOnce(fileResponse(served));

    await service.exportRiskRegister({ query, format: 'xlsx' });

    expect(get.mock.calls[0]?.[1]).toEqual({ params: { query: { q: 'HYPERLINK', treatmentStatus: 'In Progress', sort: 'targetDate:asc', format: 'xlsx' } }, parseAs: 'arrayBuffer' });
  });

  it('returns a 422 as the transport error with its reason, row count and cap', async () => {
    const refusal = { data: null, error: { message: 'CSRM request failed.', status: 422, reason: 'EXPORT_ROW_LIMIT', rowCount: 12_500, rowCap: 10_000 } };
    const body = { error: { status: 422, name: 'UnprocessableEntityError', message: 'x', details: { reason: 'EXPORT_ROW_LIMIT', rowCount: 12_500, rowCap: 10_000 } } };
    get.mockResolvedValueOnce({ error: body, response: { status: 422, headers: new Headers() } });
    normalizeTransportError.mockReturnValueOnce(refusal);

    await expect(service.exportRiskRegister({ query, format: 'csv' })).resolves.toEqual(refusal);
    expect(normalizeTransportError).toHaveBeenCalledWith(body, 422);
  });

  it('refuses a missing, non-integer or out-of-range row count as a file-check failure', async () => {
    for (const count of [null, '1.5', 'one', '-1', '10001', '']) {
      const headers: Record<string, string> = { ...served };
      if (count === null) delete headers['x-csrm-row-count'];
      else headers['x-csrm-row-count'] = count;
      get.mockResolvedValueOnce(fileResponse(headers));
      await expect(service.exportRiskRegister({ query, format: 'xlsx' }), String(count)).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'row-count' } });
    }
  });

  it('refuses bytes the export rule rejects, and never returns them', async () => {
    get.mockResolvedValueOnce(fileResponse({ ...served, 'content-type': 'text/html' }));
    await expect(service.exportRiskRegister({ query, format: 'xlsx' })).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'type' } });
    get.mockResolvedValueOnce(fileResponse(served, new TextEncoder().encode('<html>')));
    await expect(service.exportRiskRegister({ query, format: 'xlsx' })).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'signature' } });
    get.mockResolvedValueOnce(fileResponse({ ...served, 'content-type': 'text/csv; charset=utf-8' }));
    await expect(service.exportRiskRegister({ query, format: 'csv' })).resolves.toEqual({ data: null, error: { kind: 'file-check', failure: 'name' } });
  });

  it('registers the export with the parity guard as a file response of the two export media types', () => {
    expect(service.responseParserModule.fileResponses).toEqual([
      { label: 'risks.exportRiskRegister', path: '/v1/risks/export', method: 'get', contentTypes: ['text/csv; charset=utf-8', XLSX] },
    ]);
  });
});
