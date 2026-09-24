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
    targetDate: '2026-09-30', assessment: { documentId: 'assessment-1', assessmentNumber: 'ASM-0001', title: 'Portal' },
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
      asset: 'asset-1', mitigationStatus: 'Planned', sort: 'riskNumber:desc', page: '2', pageSize: '50',
      targetDateFrom: '2026-01-01', targetDateTo: '2026-12-31', forged: 'hidden',
    });
    await expect(service.listRiskRegister(query)).resolves.toEqual({ data: registerPayload, error: null });
    expect(get).toHaveBeenCalledWith('/v1/risks', { params: { query } });
    expect(get.mock.calls[0]?.[1]?.params.query).toMatchObject({
      targetDateFrom: '2026-01-01',
      targetDateTo: '2026-12-31',
    });
    expect(JSON.stringify(get.mock.calls)).not.toMatch(/forged/);
  });

  it('uses existing generated inventory paths and fails closed on cap overflow', async () => {
    get
      .mockResolvedValueOnce(response({ data: [{ documentId: 'assessment-1', assessmentNumber: 'ASM-0001', assessmentStatus: 'draft', summary: null, overallRating: null, generatedDate: null, generatedBy: null, approvalDate: null }] }))
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
