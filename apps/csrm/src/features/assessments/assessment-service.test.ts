import { afterEach, describe, expect, it, vi } from 'vitest';

import * as service from './assessment-service';

import {
  analystAssessmentDetailSchema,
  assessmentDraftJobSchema,
  questionnaireGenerationJobSchema,
  assessmentRatings,
  assessmentStatuses,
  controlImplementationCreateInputSchema,
  controlImplementationSchema,
  controlImplementationWritableFields,
  releasedAssessmentDetailSchema,
  requestorReleasedAssessmentDetailSchema,
  riskCreateInputSchema,
  riskSchema,
  riskTypeSchema,
  riskUpdateInputSchema,
  riskWritableFields,
  releaseReadinessSchema,
} from './assessment-schema';
import {
  assessmentRatingPresentation,
} from './assessment-domain';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get, POST: post, PATCH: patch, DELETE: remove })),
  normalizeTransportError,
}));

afterEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  remove.mockReset();
  normalizeTransportError.mockReset();
});

const timestamp = '2026-08-30T01:02:03.000Z';

const analyst = { documentId: 'user-1', displayName: 'Alex Analyst' };

const assessment = {
  documentId: 'assessment-1',
  assessmentNumber: 'ASM-0001',
  assessmentStatus: 'in-review',
  assessmentDate: null,
  generatedDate: timestamp,
  nextReviewDate: '2026-12-01',
  approvalDate: null,
  summary: 'Reviewed assessment',
  overallRating: 'High',
  overallControlEffectiveness: 'Partially Effective',
  recommendationsSummary: 'Complete the treatment plan.',
  overallRiskRationale: 'Material residual exposure remains.',
  assessmentRequest: {
    documentId: 'request-1',
    requestNumber: 'REQ-0001',
    title: 'Review me',
    requestStatus: 'under-review',
  },
  generatedBy: analyst,
  reviewedBy: analyst,
  approvedBy: null,
} as const;

const riskInput = {
  issueStatement: 'Access is broader than required.',
  riskStatement: 'An unauthorised actor may access restricted data.',
  riskCategory: 'Access control',
  riskSubCategory: 'Privileged access',
  riskCause: 'Excessive permissions',
  potentialImpact: 'Restricted data disclosure',
  riskType: 'risk-type-1',
  riskOwner: 'user-1',
  informationSystemImpacted: 'system-1',
  informationAssetImpacted: 'asset-1',
  dataClassification: 'Restricted',
  inherentLikelihood: 'Likely',
  highestInherentConsequence: 'Major',
  inherentRating: 'High',
  inherentRatingRationale: 'Broad access increases exposure.',
  residualLikelihood: 'Possible',
  highestResidualConsequence: 'Moderate',
  residualRating: 'Moderate',
  residualRatingRationale: 'Monitoring reduces likelihood.',
  controlEffectiveness: 'Partially Effective',
  riskVelocity: 'High',
  identifiedDate: '2026-08-30',
  targetDate: '2026-10-30',
  closureDate: null,
  isExempted: false,
  exemptionReviewDate: null,
  escalationDetails: null,
  comments: 'Owner confirmed treatment.',
  riskCommunicationDate: '2026-08-30',
  treatmentAction: 'Treat',
  treatmentPlan: 'Reduce privileged membership.',
  treatmentOwner: 'user-1',
  treatmentResolveDate: '2026-10-30',
  treatmentStatus: 'In Progress',
} as const;

const persistedRisk = { documentId: 'risk-1', riskNumber: 'RSK-0001', ...riskInput } as const;

const analystDetail = {
  ...assessment,
  actor: 'analyst' as const,
  risks: [persistedRisk],
  ownerLabels: [analyst],
  releaseReadiness: {
    ready: true,
    requirements: [
      { scope: 'assessment', key: 'summary', label: 'Summary', state: 'met' },
      { scope: 'risk', key: 'riskStatement', label: 'Risk statement', state: 'met', riskNumber: 'RSK-0001', destination: 'risk-risk-1' },
    ],
  },
};

const controlInput = {
  control: 'control-1',
  controlOwner: 'user-1',
  controlStatus: 'Implemented',
  effectivenessRating: 'Effective',
  evidence: 'Quarterly access review evidence.',
  implementationDueDate: '2026-09-30',
  implementedDate: '2026-08-15',
  reviewDate: '2026-11-15',
} as const;

const controlSummary = { documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control', framework: 'NIST SP 800-53' } as const;

describe('assessment contract schemas', () => {
  it('requires a populated questionnaire only for completed questionnaire generation jobs', () => {
    const base = { jobId: 'job-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: timestamp };
    expect(questionnaireGenerationJobSchema.safeParse({ ...base, status: 'queued' }).success).toBe(true);
    expect(questionnaireGenerationJobSchema.safeParse({ ...base, status: 'completed', startedAt: timestamp, completedAt: timestamp }).success).toBe(false);
    const questionnaire = { documentId: 'questionnaire-1', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Generated questionnaire', generatedDate: timestamp, generatedBy: { documentId: 'user-1', displayName: 'Alex Analyst' } };
    expect(questionnaireGenerationJobSchema.safeParse({ ...base, status: 'completed', startedAt: timestamp, completedAt: timestamp, questionnaire }).success).toBe(true);
    // The summary is bounded: the server projects these five fields and nothing
    // else, so a raw questionnaire record must not parse.
    expect(questionnaireGenerationJobSchema.safeParse({ ...base, status: 'completed', startedAt: timestamp, completedAt: timestamp, questionnaire: { ...questionnaire, id: 1, publishedAt: timestamp, questions: [] } }).success).toBe(false);
  });
  it.each(assessmentRatings)('accepts and presents the %s rating exhaustively', (rating) => {
    expect(assessmentRatingPresentation[rating].label).toBe(rating);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, overallRating: rating }).success).toBe(true);
  });

  it.each(assessmentStatuses)('accepts the %s assessment state', (assessmentStatus) => {
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, assessmentStatus }).success).toBe(true);
  });

  it.each([
    ['queued', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp }],
    ['running', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, startedAt: timestamp }],
    ['completed', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, startedAt: timestamp, completedAt: timestamp, assessmentId: 'assessment-1' }],
    ['failed', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, startedAt: timestamp, completedAt: timestamp, failureCode: 'provider-failed', failureMessage: 'Draft generation failed.' }],
  ] as const)('parses the %s job state and rejects state-incompatible fields', (status, fields) => {
    expect(assessmentDraftJobSchema.parse({ status, ...fields }).status).toBe(status);
    expect(assessmentDraftJobSchema.safeParse({ status, ...fields, approvedBy: analyst }).success).toBe(false);
  });

  it('keeps analyst and Requestor assessment projections separate and rejects partial release facts', () => {
    expect(analystAssessmentDetailSchema.safeParse(analystDetail).success).toBe(true);
    expect(releasedAssessmentDetailSchema.safeParse(assessment).success).toBe(false);

    const released = {
      ...assessment,
      assessmentStatus: 'approved',
      assessmentDate: timestamp,
      approvalDate: timestamp,
      approvedBy: analyst,
    };
    expect(releasedAssessmentDetailSchema.safeParse(released).success).toBe(true);
    for (const partial of [
      { ...released, approvedBy: null },
      { ...released, approvalDate: null },
      { ...released, assessmentDate: null },
      { ...released, assessmentStatus: 'in-review' },
    ]) {
      expect(releasedAssessmentDetailSchema.safeParse(partial).success).toBe(false);
    }
    expect(releasedAssessmentDetailSchema.safeParse({ ...released, requestorEmail: 'hidden@example.test' }).success).toBe(false);
    expect(releasedAssessmentDetailSchema.safeParse({ ...released, assessmentRequest: { ...assessment.assessmentRequest, requestor: analyst } }).success).toBe(false);
  });

  it('requires the complete closed generated actor-specific detail projections', () => {
    expect(analystAssessmentDetailSchema.parse(analystDetail)).toEqual(analystDetail);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, assessmentRequest: { ...assessment.assessmentRequest, requestor: analyst } }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, risks: [{ documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: 'lossy', inherentRating: null, residualRating: null }] }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, releaseReadiness: undefined }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, ownerLabels: Array.from({ length: 2_000 }, () => analyst) }).success).toBe(true);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, ownerLabels: Array.from({ length: 2_001 }, () => analyst) }).success).toBe(false);
    const requestorDetail = { ...assessment, actor: 'requestor' as const, assessmentStatus: 'approved' as const, assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst };
    expect(requestorReleasedAssessmentDetailSchema.parse(requestorDetail)).toEqual(requestorDetail);
    expect(requestorReleasedAssessmentDetailSchema.safeParse({ ...requestorDetail, assessmentRequest: { ...assessment.assessmentRequest, questionnaire: 'questionnaire-1' } }).success).toBe(false);
    for (const forbidden of ['ownerLabels', 'releaseReadiness', 'risks'] as const) {
      expect(requestorReleasedAssessmentDetailSchema.safeParse({ ...requestorDetail, [forbidden]: forbidden === 'risks' ? [persistedRisk] : [] }).success).toBe(false);
    }
  });

  it('enumerates the complete frozen Risk writable surface and rejects server-owned fields', () => {
    expect(riskWritableFields).toEqual(Object.keys(riskInput));
    expect(riskCreateInputSchema.parse(riskInput)).toEqual(riskInput);
    expect(riskUpdateInputSchema.parse(riskInput)).toEqual(riskInput);

    for (const forbidden of ['documentId', 'id', 'riskNumber', 'assessment', 'createdAt', 'updatedAt', 'generatedBy', 'reviewedBy', 'approvedBy', 'approvalDate']) {
      expect(riskCreateInputSchema.safeParse({ ...riskInput, [forbidden]: 'forged' }).success).toBe(false);
    }
    expect(riskCreateInputSchema.safeParse({ ...riskInput, inherentRating: 'Extreme' }).success).toBe(false);
    expect(riskCreateInputSchema.safeParse({ ...riskInput, targetDate: '30/10/2026' }).success).toBe(false);
    expect(riskCreateInputSchema.safeParse({ ...riskInput, exemptionReviewDate: '2026-10-30' }).success).toBe(false);
  });

  it('enumerates the exact ControlImplementation surface and preserves domain terminology', () => {
    expect(controlImplementationWritableFields).toEqual(Object.keys(controlInput));
    expect(controlImplementationCreateInputSchema.parse(controlInput)).toEqual(controlInput);
    for (const forbidden of ['documentId', 'id', 'risk', 'assessment', 'createdAt', 'updatedAt']) {
      expect(controlImplementationCreateInputSchema.safeParse({ ...controlInput, [forbidden]: 'forged' }).success).toBe(false);
    }

    expect(riskTypeSchema.safeParse({ documentId: 'risk-type-1', name: 'Internet Exposure', description: null }).success).toBe(true);
    expect(riskSchema.safeParse({ documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: 'A risk.', inherentRating: 'High', residualRating: 'Moderate' }).success).toBe(true);
    expect(riskTypeSchema.safeParse({ documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: 'A risk.' }).success).toBe(false);
    expect(controlImplementationSchema.safeParse({ documentId: 'implementation-1', ...controlInput, controlSummary, controlOwner: analyst }).success).toBe(true);
    expect(controlImplementationSchema.safeParse({ documentId: 'implementation-1', ...controlInput, controlSummary: null, controlOwner: analyst }).success).toBe(true);
    // D-34: the summary is required, so a served implementation can never fall back to naming its control by id.
    expect(controlImplementationSchema.safeParse({ documentId: 'implementation-1', ...controlInput, controlOwner: analyst }).success).toBe(false);
    expect(controlImplementationSchema.safeParse({ documentId: 'implementation-1', ...controlInput, controlSummary: { ...controlSummary, framework: '' }, controlOwner: analyst }).success).toBe(false);
    expect(controlImplementationSchema.safeParse({ documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control' }).success).toBe(false);
  });
});

describe('release readiness response boundary', () => {
  const assessmentRequirement = { scope: 'assessment' as const, key: 'summary', label: 'Summary', state: 'met' as const };
  const riskRequirement = { scope: 'risk' as const, key: 'riskOwner', label: 'Risk owner', state: 'outstanding' as const, riskNumber: 'RSK-0001', destination: 'risk-risk-1' };

  it('accepts the complete server-authoritative assessment and Risk requirement variants', () => {
    expect(releaseReadinessSchema.parse({ ready: false, requirements: [assessmentRequirement, riskRequirement] })).toEqual({ ready: false, requirements: [assessmentRequirement, riskRequirement] });
  });

  it('rejects retired paths, unknown states, duplicate identities, index-only Risk identity, and variant overpopulation', () => {
    expect(releaseReadinessSchema.safeParse({ ready: false, missing: ['risks[0].riskOwner'] }).success).toBe(false);
    expect(releaseReadinessSchema.safeParse({ ready: false, requirements: [{ ...assessmentRequirement, state: 'missing' }] }).success).toBe(false);
    expect(releaseReadinessSchema.safeParse({ ready: false, requirements: [assessmentRequirement, assessmentRequirement] }).success).toBe(false);
    expect(releaseReadinessSchema.safeParse({ ready: false, requirements: [{ ...riskRequirement, riskNumber: undefined, index: 0 }] }).success).toBe(false);
    expect(releaseReadinessSchema.safeParse({ ready: false, requirements: [{ ...assessmentRequirement, riskNumber: 'RSK-0001' }] }).success).toBe(false);
    expect(releaseReadinessSchema.safeParse({ ready: false, requirements: [{ ...riskRequirement, extra: 'forbidden' }] }).success).toBe(false);
  });
});

describe('assessment generated-client service boundary', () => {
  const response = (data: unknown, status = 200) => ({ data, response: { status } });
  const job = {
    jobId: 'job-1',
    questionnaireId: 'questionnaire-1',
    attempt: 1,
    queuedAt: timestamp,
    status: 'queued',
  };
  const summary = {
    documentId: assessment.documentId,
    assessmentNumber: assessment.assessmentNumber,
    assessmentStatus: assessment.assessmentStatus,
    summary: assessment.summary,
    overallRating: assessment.overallRating,
    generatedDate: assessment.generatedDate,
    generatedBy: assessment.generatedBy,
    approvalDate: assessment.approvalDate,
  };
  const risk = {
    documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: riskInput.riskStatement,
    inherentRating: 'High', residualRating: 'Moderate',
  };
  // D-34: the assessment's risk list item, wider than the five-field create and update response.
  const riskListItem = {
    ...risk,
    informationSystemImpacted: { documentId: 'system-1', name: 'Customer portal' },
    informationAssetImpacted: null,
    inherentLikelihood: 'Likely',
    highestInherentConsequence: 'Major',
    residualLikelihood: 'Possible',
    highestResidualConsequence: 'Moderate',
    treatmentAction: 'Treat',
    treatmentPlan: 'Apply the control.',
    treatmentStatus: 'In Progress',
    riskOwner: analyst,
    treatmentOwner: null,
    targetDate: '2026-12-31',
  };
  const implementation = {
    documentId: 'implementation-1',
    ...controlInput,
    controlSummary,
    controlOwner: analyst,
  };

  it('uses only generated methods for queue, job, assessment, and Requestor reads', async () => {
    get
      .mockResolvedValueOnce(response({ data: [{ documentId: 'request-1', requestNumber: 'REQ-0001', title: 'Review me', requestStatus: 'submitted', submittedDate: timestamp }], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } }))
      .mockResolvedValueOnce(response({ data: job }))
      .mockResolvedValueOnce(response({ data: [summary], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } }))
      .mockResolvedValueOnce(response({ data: { draft: 1, inReview: 1, approved: 0, total: 2 } }))
      .mockResolvedValueOnce(response({ data: analystDetail }))
      .mockResolvedValueOnce(response({ data: [{ ...summary, assessmentStatus: 'approved', approvalDate: timestamp }], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } }))
      .mockResolvedValueOnce(response({ data: { Low: 0, Moderate: 0, High: 1, Critical: 0, total: 1 } }))
      .mockResolvedValueOnce(response({ data: { ...assessment, actor: 'requestor', assessmentStatus: 'approved', assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst } }));
    post
      .mockResolvedValueOnce(response({ data: job }, 202))
      .mockResolvedValueOnce(response({ data: { ...job, attempt: 2 } }, 202));

    await expect(service.listAssessmentRequests()).resolves.toMatchObject({ data: [{ documentId: 'request-1' }], error: null });
    await expect(service.startAssessmentDraft('questionnaire-1')).resolves.toEqual({ data: job, error: null });
    await expect(service.getAssessmentDraftJob('job-1')).resolves.toEqual({ data: job, error: null });
    await expect(service.retryAssessmentDraftJob('job-1')).resolves.toMatchObject({ data: { attempt: 2 }, error: null });
    await expect(service.listAnalystAssessments()).resolves.toMatchObject({ data: [{ assessmentNumber: 'ASM-0001' }], error: null });
    await expect(service.getAssessmentStatusSummary()).resolves.toMatchObject({ data: { total: 2 }, error: null });
    await expect(service.getAnalystAssessment('assessment-1')).resolves.toEqual({ data: analystDetail, error: null });
    await expect(service.listMyReleasedAssessments()).resolves.toMatchObject({ data: [{ assessmentStatus: 'approved' }], error: null });
    await expect(service.getMyAssessmentRatingSummary()).resolves.toMatchObject({ data: { High: 1, total: 1 }, error: null });
    await expect(service.getReleasedAssessment('assessment-1')).resolves.toMatchObject({ data: { actor: 'requestor', approvedBy: analyst }, error: null });

    expect(post).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/generate_assessment', {
      params: { path: { questionnaireId: 'questionnaire-1' } },
    });
    expect(post).toHaveBeenCalledWith('/v1/assessment_draft_jobs/{jobId}/retry', {
      params: { path: { jobId: 'job-1' } },
    });
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/v1/assessment_requests',
      '/v1/assessment_draft_jobs/{jobId}',
      '/v1/risk_assessments',
      '/v1/risk_assessments/status_summary',
      '/v1/risk_assessments/{assessmentId}',
      '/v1/my_risk_assessments',
      '/v1/my_risk_assessments/rating_summary',
      '/v1/risk_assessments/{assessmentId}',
    ]);
    expect(JSON.stringify([...get.mock.calls, ...post.mock.calls])).not.toMatch(/identity|requestor|email/i);
  });

  it('routes only exact assessment, Risk, and ControlImplementation bodies', async () => {
    patch
      .mockResolvedValueOnce(response({ data: assessment }))
      .mockResolvedValueOnce(response({ data: risk }))
      .mockResolvedValueOnce(response({ data: implementation }));
    post
      .mockResolvedValueOnce(response({ data: risk }, 201))
      .mockResolvedValueOnce(response({ data: implementation }, 201))
      .mockResolvedValueOnce(response({ data: { ...assessment, assessmentStatus: 'approved', assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst } }));
    remove.mockResolvedValueOnce({ response: { status: 204 } });

    await service.updateAssessment('assessment-1', { summary: 'Updated', overallRating: 'High' });
    await service.createRisk('assessment-1', riskInput);
    await service.updateRisk('risk-1', riskInput);
    await service.createControlImplementation('risk-1', controlInput);
    await service.updateControlImplementation('implementation-1', controlInput);
    await expect(service.deleteControlImplementation('implementation-1')).resolves.toEqual({ data: undefined, error: null });
    await service.releaseAssessment('assessment-1');

    expect(patch.mock.calls[0]).toEqual(['/v1/risk_assessments/{assessmentId}', { params: { path: { assessmentId: 'assessment-1' } }, body: { summary: 'Updated', overallRating: 'High' } }]);
    expect(post.mock.calls[0]).toEqual(['/v1/risk_assessments/{assessmentId}/risks', { params: { path: { assessmentId: 'assessment-1' } }, body: riskInput }]);
    expect(patch.mock.calls[1]).toEqual(['/v1/risks/{riskId}', { params: { path: { riskId: 'risk-1' } }, body: riskInput }]);
    expect(post.mock.calls[1]).toEqual(['/v1/risks/{riskId}/control_implementations', { params: { path: { riskId: 'risk-1' } }, body: controlInput }]);
    expect(patch.mock.calls[2]).toEqual(['/v1/control_implementations/{implementationId}', { params: { path: { implementationId: 'implementation-1' } }, body: controlInput }]);
    expect(remove).toHaveBeenCalledWith('/v1/control_implementations/{implementationId}', { params: { path: { implementationId: 'implementation-1' } } });
    expect(post.mock.calls[2]).toEqual(['/v1/risk_assessments/{assessmentId}/release', { params: { path: { assessmentId: 'assessment-1' } } }]);
    expect(service).not.toHaveProperty('deleteRisk');
  });

  it('parses descendants and bounded reference pickers through their generated paths', async () => {
    get
      .mockResolvedValueOnce(response({ data: [riskListItem] }))
      .mockResolvedValueOnce(response({ data: [implementation] }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'risk-type-1', name: 'Internet Exposure', description: null }] }))
      .mockResolvedValueOnce(response({ data: [{ documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control', description: null }] }))
      .mockResolvedValueOnce(response({ data: [analyst] }));

    await expect(service.listAssessmentRisks('assessment-1')).resolves.toMatchObject({ data: [riskListItem], error: null });
    await expect(service.listControlImplementations('risk-1')).resolves.toMatchObject({ data: [implementation], error: null });
    await expect(service.listRiskTypes()).resolves.toMatchObject({ data: [{ name: 'Internet Exposure' }], error: null });
    await expect(service.listControls()).resolves.toMatchObject({ data: [{ controlNumber: 'AC-1' }], error: null });
    await expect(service.searchActiveUsers('  Alex  ')).resolves.toMatchObject({ data: [analyst], error: null });

    expect(get.mock.calls.at(-1)).toEqual(['/v1/users', { params: { query: { search: 'Alex' } } }]);
    expect(service.parseActiveUserSearch('x'.repeat(300))).toBe('x'.repeat(100));
  });

  it('fails closed on over-populated success payloads and normalizes status/network errors', async () => {
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
    const forbidden = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 403 } };
    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => status === 403 ? forbidden : unavailable);
    get
      .mockResolvedValueOnce(response({ data: [{ ...riskListItem, assessment: { documentId: 'secret' } }] }))
      .mockResolvedValueOnce({ error: { message: 'raw provider detail' }, response: { status: 403 } })
      .mockRejectedValueOnce(new Error('connection string'))
      .mockResolvedValueOnce(response({ data: Array.from({ length: 21 }, (_, index) => ({ documentId: `user-${index}`, displayName: `User ${index}` })) }));

    await expect(service.listAssessmentRisks('assessment-1')).resolves.toEqual(unavailable);
    await expect(service.getAnalystAssessment('assessment-1')).resolves.toEqual(forbidden);
    await expect(service.listAssessmentRequests()).resolves.toEqual(unavailable);
    await expect(service.searchActiveUsers('Alex')).resolves.toEqual(unavailable);
  });
});
