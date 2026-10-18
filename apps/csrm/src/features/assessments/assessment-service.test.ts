import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
import { analystAssessmentReadSchema, releasedAssessmentDetailForActorSchema } from './assessment-server-schema';
import {
  assessmentRatingPresentation,
} from './assessment-domain';
import { riskPickerContractParsers } from '../risks/risk-schema';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get, POST: post, PATCH: patch, DELETE: remove })),
  normalizeTransportError,
  normalizeResponseParserError: (operation: string) => ({ data: null, error: { message: 'contract', operation } }),
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
/* D-18: every job state carries who started it, whether the viewer did, and whether the viewer may retry it. */
const viewerFacts = { canRetry: false, initiatedBy: { documentId: 'user-2', displayName: 'Bob Doe' }, initiatedByViewer: false } as const;

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
  risks: [{ ...persistedRisk, aiProvenance: null, withdrawal: null }],
  generation: null,
  aiProvenance: null,
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
    const base = { jobId: 'job-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: timestamp, ...viewerFacts };
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
    ['queued', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, ...viewerFacts }],
    ['running', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, ...viewerFacts, startedAt: timestamp }],
    ['completed', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, ...viewerFacts, startedAt: timestamp, completedAt: timestamp, assessmentId: 'assessment-1' }],
    ['failed', { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, ...viewerFacts, startedAt: timestamp, completedAt: timestamp, failureCode: 'provider-failed', failureMessage: 'Draft generation failed.' }],
  ] as const)('parses the %s job state and rejects state-incompatible fields', (status, fields) => {
    expect(assessmentDraftJobSchema.parse({ status, ...fields }).status).toBe(status);
    expect(assessmentDraftJobSchema.safeParse({ status, ...fields, approvedBy: analyst }).success).toBe(false);
  });

  /* D-18: the three viewer facts are required in every questionnaire job state and every draft job variant. */
  it.each(['canRetry', 'initiatedBy', 'initiatedByViewer'] as const)('requires %s in every questionnaire generation and draft job state', (field) => {
    const without = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== field));
    const questionnaire = { documentId: 'questionnaire-1', questionnaireNumber: 'QNR-2026-KX2AHV', title: 'Generated questionnaire', generatedDate: timestamp, generatedBy: null };
    const generationBase = { jobId: 'job-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: timestamp, ...viewerFacts };
    const generationStates = [
      { ...generationBase, status: 'queued' },
      { ...generationBase, status: 'running', startedAt: timestamp },
      { ...generationBase, status: 'completed', startedAt: timestamp, completedAt: timestamp, questionnaire },
      { ...generationBase, status: 'failed', startedAt: timestamp, completedAt: timestamp, failureCode: 'PROVIDER_TIMEOUT', failureMessage: 'The provider timed out.' },
    ];
    const draftBase = { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, ...viewerFacts };
    const draftStates = [
      { ...draftBase, status: 'queued' },
      { ...draftBase, status: 'running', startedAt: timestamp },
      { ...draftBase, status: 'completed', startedAt: timestamp, completedAt: timestamp, assessmentId: 'assessment-1' },
      { ...draftBase, status: 'failed', startedAt: timestamp, completedAt: timestamp, failureCode: 'PROVIDER_TIMEOUT', failureMessage: 'The provider timed out.' },
    ];
    for (const state of generationStates) {
      expect(questionnaireGenerationJobSchema.safeParse(state).success, `${state.status} with ${field}`).toBe(true);
      expect(questionnaireGenerationJobSchema.safeParse(without(state)).success, `${state.status} without ${field}`).toBe(false);
    }
    for (const state of draftStates) {
      expect(assessmentDraftJobSchema.safeParse(state).success, `${state.status} with ${field}`).toBe(true);
      expect(assessmentDraftJobSchema.safeParse(without(state)).success, `${state.status} without ${field}`).toBe(false);
    }
  });

  it('parses a failed job naming the files its CONTEXT_TOO_LARGE failure counted, and refuses a file carrying more (D-33)', () => {
    /* Phase 14 D-33: a CONTEXT_TOO_LARGE failure names the files it counted, as they are named now (null when gone). */
    const failureAttachments = [{ documentId: 'attachment-1', fileName: 'access-review-q1.txt' }, { documentId: 'attachment-2', fileName: null }];
    const failedDraft = { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, ...viewerFacts, status: 'failed', startedAt: timestamp, completedAt: timestamp, failureCode: 'CONTEXT_TOO_LARGE', failureMessage: 'The AI context is too large.' };
    const failedGeneration = { jobId: 'job-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: timestamp, ...viewerFacts, status: 'failed', startedAt: timestamp, completedAt: timestamp, failureCode: 'CONTEXT_TOO_LARGE', failureMessage: 'The AI context is too large.' };
    for (const schema of [assessmentDraftJobSchema, questionnaireGenerationJobSchema] as const) {
      const failed = schema === assessmentDraftJobSchema ? failedDraft : failedGeneration;
      expect(schema.safeParse({ ...failed, failureAttachments }).success, 'failure naming its files').toBe(true);
      expect(schema.safeParse(failed).success, 'failure naming no files').toBe(true);
      expect(schema.safeParse({ ...failed, failureAttachments: [{ ...failureAttachments[0], text: 'Vendor access review.' }] }).success, 'a file carrying its text').toBe(false);
      expect(schema.safeParse({ ...failed, failureAttachments: [{ documentId: 'attachment-1' }] }).success, 'a file without its name').toBe(false);
    }
  });

  it('accepts a job whose initiator is no longer readable, and the viewer’s own job', () => {
    const base = { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: timestamp, status: 'queued' as const };
    expect(assessmentDraftJobSchema.safeParse({ ...base, canRetry: false, initiatedBy: null, initiatedByViewer: false }).success).toBe(true);
    expect(assessmentDraftJobSchema.safeParse({ ...base, canRetry: false, initiatedBy: { documentId: 'user-1', displayName: 'Alex Analyst' }, initiatedByViewer: true }).success).toBe(true);
    expect(assessmentDraftJobSchema.safeParse({ ...base, canRetry: false, initiatedBy: { documentId: 'user-1', displayName: 'Alex Analyst', email: 'alex@idambox.com' }, initiatedByViewer: true }).success).toBe(false);
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

  it('parses each analyst Risk with its withdrawal block, null when active and closed when withdrawn (16-06, D-03 item 9)', () => {
    const withdrawal = { at: timestamp, by: analyst, reason: 'Proposed under the wrong Risk Type' };
    const withRisk = (risk: Record<string, unknown>) => ({ ...analystDetail, risks: [risk] });
    const [activeRisk] = analystDetail.risks;
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal: null })).success).toBe(true);
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal })).success).toBe(true);
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal: { ...withdrawal, by: null } })).success).toBe(true);
    const { withdrawal: _required, ...withoutWithdrawal } = activeRisk;
    expect(analystAssessmentDetailSchema.safeParse(withRisk(withoutWithdrawal)).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal: { ...withdrawal, undo: true } })).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal: { ...withdrawal, reason: '' } })).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal: { ...withdrawal, reason: 'x'.repeat(501) } })).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse(withRisk({ ...activeRisk, withdrawal: { ...withdrawal, at: 'yesterday' } })).success).toBe(false);
  });

  it('requires the complete closed generated actor-specific detail projections', () => {
    expect(analystAssessmentDetailSchema.parse(analystDetail)).toEqual(analystDetail);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, assessmentRequest: { ...assessment.assessmentRequest, requestor: analyst } }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, risks: [{ documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: 'lossy', inherentRating: null, residualRating: null }] }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, releaseReadiness: undefined }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, ownerLabels: Array.from({ length: 2_000 }, () => analyst) }).success).toBe(true);
    expect(analystAssessmentDetailSchema.safeParse({ ...analystDetail, ownerLabels: Array.from({ length: 2_001 }, () => analyst) }).success).toBe(false);
    const { generatedBy: _generator, ...requestorFacts } = assessment;
    const requestorDetail = { ...requestorFacts, actor: 'requestor' as const, assessmentStatus: 'approved' as const, assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst, aiAssisted: true };
    expect(requestorReleasedAssessmentDetailSchema.parse(requestorDetail)).toEqual(requestorDetail);
    expect(requestorReleasedAssessmentDetailSchema.safeParse({ ...requestorDetail, assessmentRequest: { ...assessment.assessmentRequest, questionnaire: 'questionnaire-1' } }).success).toBe(false);
    for (const forbidden of ['ownerLabels', 'releaseReadiness', 'risks'] as const) {
      expect(requestorReleasedAssessmentDetailSchema.safeParse({ ...requestorDetail, [forbidden]: forbidden === 'risks' ? [persistedRisk] : [] }).success).toBe(false);
    }
    // D-23: the Requestor learns that AI assisted, and nothing else of it: not who generated the draft (WR-304, IN-107).
    for (const forbidden of ['generation', 'aiProvenance', 'generatedBy'] as const) {
      expect(requestorReleasedAssessmentDetailSchema.safeParse({ ...requestorDetail, [forbidden]: null }).success).toBe(false);
    }
    expect(requestorReleasedAssessmentDetailSchema.safeParse({ ...requestorDetail, generatedBy: analyst }).success).toBe(false);
    const { aiAssisted: _aiAssisted, ...withoutFlag } = requestorDetail;
    expect(requestorReleasedAssessmentDetailSchema.safeParse(withoutFlag).success).toBe(false);
  });

  /*
   * D10, WR-304 (D-23): the released view's parse keeps exactly what ReleasedAssessmentDetailView renders, for either
   * actor, so the route hands the client nothing else: not the generating analyst, not the analyst's aggregate, and of
   * the AI facts only the Requestor's aiAssisted.
   */
  it('keeps exactly what the released view renders, never the generating analyst or the AI facts', () => {
    const released = { assessmentStatus: 'approved' as const, assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst };
    const { generatedBy: _generator, ...requestorFacts } = assessment;
    const requestorView = releasedAssessmentDetailForActorSchema.parse({ ...requestorFacts, ...released, actor: 'requestor', aiAssisted: true })!;
    const analystView = releasedAssessmentDetailForActorSchema.parse({
      ...analystDetail, ...released, released: true,
      generation: { generatedAt: timestamp, generatedBy: { documentId: 'analyst-9', displayName: 'Gen Analyst' }, providerName: 'deterministic-assessment-draft', providerVersion: '2', runId: 'run-1', aiInputsChanged: null },
      generatedBy: { documentId: 'analyst-9', displayName: 'Gen Analyst' },
    })!;
    const viewKeys = ['actor', 'approvalDate', 'approvedBy', 'assessmentDate', 'assessmentNumber', 'assessmentRequest', 'assessmentStatus',
      'nextReviewDate', 'overallControlEffectiveness', 'overallRating', 'overallRiskRationale', 'recommendationsSummary', 'reviewedBy', 'summary'];
    expect(Object.keys(requestorView).sort()).toEqual([...viewKeys, 'aiAssisted'].sort());
    expect(requestorView).toMatchObject({ actor: 'requestor', aiAssisted: true });
    // FE4-01 (19-UI-SPEC §4.3): the analyst's view keeps whether AI assisted, by Strapi's rule, so the paper discloses it.
    expect(Object.keys(analystView).sort()).toEqual([...viewKeys, 'aiAssisted'].sort());
    expect(analystView).toMatchObject({ actor: 'analyst', aiAssisted: true });
    for (const view of [requestorView, analystView]) {
      expect(JSON.stringify(view)).not.toMatch(/generatedBy|generatedDate|generation|Gen Analyst|providerName|deterministic|run-1|ownerLabels|releaseReadiness|aiProvenance/);
    }
  });

  /* Phase 13 D-16, D-25: the analyst's request summary names the assignee, the pick-up state and the notes figures. */
  it('accepts the request summary’s assignee and notes figures, or null for each, and refuses anything else in them', () => {
    const assignment = { assignee: { documentId: 'analyst-1', displayName: 'Bob Doe' }, pickUp: 'allowed' as const };
    const notes = { total: 3, unread: 0 };
    const withSummary = (summary: Record<string, unknown>) => ({ ...analystDetail, assessmentRequest: { ...analystDetail.assessmentRequest, ...summary } });
    expect(analystAssessmentDetailSchema.parse(withSummary({ assignment, notes })).assessmentRequest).toMatchObject({ assignment, notes });
    expect(analystAssessmentDetailSchema.parse(withSummary({ assignment: null, notes: null })).assessmentRequest).toMatchObject({ assignment: null, notes: null });
    for (const summary of [
      { assignment: { ...assignment, pickUp: 'own' }, notes },
      { assignment: { ...assignment, assignee: { ...assignment.assignee, email: 'bob@example.com' } }, notes },
      { assignment, notes: { ...notes, closedReason: null } },
    ]) {
      expect(analystAssessmentDetailSchema.safeParse(withSummary(summary)).success).toBe(false);
    }
  });

  /* Phase 14 D-27: and how many files the request holds and how many are in the AI inputs, closed. */
  it('accepts the request summary’s files figures, or null, and refuses anything else in them', () => {
    const withSummary = (summary: Record<string, unknown>) => ({ ...analystDetail, assessmentRequest: { ...analystDetail.assessmentRequest, ...summary } });
    expect(analystAssessmentDetailSchema.parse(withSummary({ files: { count: 2, included: 1 } })).assessmentRequest).toMatchObject({ files: { count: 2, included: 1 } });
    expect(analystAssessmentDetailSchema.parse(withSummary({ files: null })).assessmentRequest).toMatchObject({ files: null });
    for (const files of [{ count: 2, included: 1, removed: 0 }, { included: 1 }, { count: 2, included: -1 }]) {
      expect(analystAssessmentDetailSchema.safeParse(withSummary({ files })).success).toBe(false);
    }
  });

  it('accepts the analyst’s resolved AI provenance and refuses an unknown key inside it (D-12, D-14, D-21)', () => {
    const citation = { key: 'answer.payment-files', kind: 'answer', label: 'Are payment files signed?', section: 'Payment processing', classification: null } as const;
    const provenance = {
      runId: 'run-1',
      proposalKey: 'risk-1',
      fields: [
        { field: 'riskStatement', state: 'edited', by: analyst, at: timestamp, sources: [citation, { key: 'system-1', kind: 'system', label: 'Source no longer available', section: null, classification: null }] },
        { field: 'residualRating', state: 'proposed', by: null, at: null, sources: null },
      ],
      uncitedClaims: ['Payment files are exchanged daily.'],
      suggestions: [{ key: 'risk-1-control-1', control: { documentId: 'control-1', controlNumber: 'CTL-001', name: 'File integrity verification', description: null }, rationale: 'Signing payment files prevents tampering.', state: 'present', by: null, at: null, implementation: null }],
      adjustments: ['accept-with-suggested-controls'],
      outstanding: 1,
    } as const;
    const detail = {
      ...analystDetail,
      risks: [{ ...persistedRisk, aiProvenance: provenance, withdrawal: null }],
      generation: {
        generatedAt: timestamp, generatedBy: analyst, providerName: 'deterministic-assessment-draft', providerVersion: '2', runId: 'run-1',
        // Phase 13 D-29: a note marked since this draft's run, named by identity and change only.
        aiInputsChanged: { count: 1, notes: [{ documentId: 'note-1', part: 'requestor', sequence: 1, postedAt: timestamp, change: 'marked' }], files: [] },
      },
      aiProvenance: { runId: 'run-1', fields: [{ field: 'summary', state: 'proposed', by: null, at: null, sources: [citation] }], adjustments: [], outstanding: 1 },
    };
    expect(analystAssessmentDetailSchema.parse(detail)).toEqual(detail);
    expect(analystAssessmentDetailSchema.safeParse({ ...detail, risks: [{ ...persistedRisk, withdrawal: null, aiProvenance: { ...provenance, modelPrompt: 'hidden' } }] }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...detail, risks: [{ ...persistedRisk, withdrawal: null, aiProvenance: { ...provenance, fields: [{ ...provenance.fields[0], confidence: 0.9 }] } }] }).success).toBe(false);
    expect(analystAssessmentDetailSchema.safeParse({ ...detail, risks: [persistedRisk] }).success).toBe(false);
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

    expect(riskTypeSchema.safeParse({ documentId: 'risk-type-1', name: 'Internet Exposure', description: null, applicableControls: [] }).success).toBe(true);
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
    ...viewerFacts,
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
    requestTitle: 'Customer portal assessment',
    riskCount: 1,
    highestResidualRating: 'Moderate',
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

  const { generatedBy: _generator, ...releasedRequestorFacts } = assessment;

  it('uses only generated methods for queue, job, assessment, and Requestor reads', async () => {
    get
      .mockResolvedValueOnce(response({ data: [{ documentId: 'request-1', requestNumber: 'REQ-0001', title: 'Review me', requestStatus: 'submitted', submittedDate: timestamp, requestorName: 'Jane Doe', assessmentType: 'Project', businessCriticality: 'High', dueDate: '2026-10-30', daysSinceSubmission: 1, assignee: null, pickUp: 'allowed', unreadNotes: 0 }], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 }, viewer: { documentId: 'bob-id', displayName: 'Bob Doe' } } }))
      .mockResolvedValueOnce(response({ data: job }))
      .mockResolvedValueOnce(response({ data: [summary], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } }))
      .mockResolvedValueOnce(response({ data: { draft: 1, inReview: 1, approved: 0, total: 2 } }))
      .mockResolvedValueOnce(response({ data: { ...analystDetail, released: false } }))
      .mockResolvedValueOnce(response({ data: [{ ...summary, assessmentStatus: 'approved', approvalDate: timestamp }], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } }))
      .mockResolvedValueOnce(response({ data: { Low: 0, Moderate: 0, High: 1, Critical: 0, total: 1 } }))
      .mockResolvedValueOnce(response({ data: { ...releasedRequestorFacts, actor: 'requestor', assessmentStatus: 'approved', assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst, aiAssisted: false } }));
    post
      .mockResolvedValueOnce(response({ data: job }, 202))
      .mockResolvedValueOnce(response({ data: { ...job, attempt: 2 } }, 202));

    await expect(service.listAssessmentRequests()).resolves.toMatchObject({ data: [{ documentId: 'request-1' }], error: null });
    await expect(service.startAssessmentDraft('questionnaire-1')).resolves.toEqual({ data: job, error: null });
    await expect(service.getAssessmentDraftJob('job-1')).resolves.toEqual({ data: job, error: null });
    await expect(service.retryAssessmentDraftJob('job-1')).resolves.toMatchObject({ data: { attempt: 2 }, error: null });
    await expect(service.listAnalystAssessments()).resolves.toMatchObject({ data: [{ assessmentNumber: 'ASM-0001' }], error: null });
    await expect(service.getAssessmentStatusSummary()).resolves.toMatchObject({ data: { total: 2 }, error: null });
    await expect(service.getAnalystAssessment('assessment-1')).resolves.toEqual({ data: { ...analystDetail, released: false }, error: null });
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

  /* D-18: the request's jobs read carries who started each job, whether the viewer did, and whether they may retry it. */
  it('parses the request generation jobs read with each job’s viewer facts', async () => {
    const failedGeneration = { jobId: 'generation-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: timestamp, startedAt: timestamp, completedAt: timestamp, status: 'failed', failureCode: 'PROVIDER_TIMEOUT', failureMessage: 'The provider timed out.', canRetry: true, initiatedBy: { documentId: 'user-2', displayName: 'Bob Doe' }, initiatedByViewer: false };
    const runningDraft = { ...job, status: 'running', startedAt: timestamp, initiatedByViewer: true };
    const aiPolicy = { status: 'allowed', reason: null, requestClassification: 'Internal', classificationSource: 'default', ceiling: null };
    get.mockResolvedValueOnce(response({ data: { questionnaireGeneration: { job: failedGeneration, canRetry: true }, assessmentDraft: { job: runningDraft, canRetry: false }, aiPolicy } }));

    await expect(service.getRequestGenerationJobs('request-1')).resolves.toEqual({
      data: { questionnaireGeneration: { job: failedGeneration, canRetry: true }, assessmentDraft: { job: runningDraft, canRetry: false }, aiPolicy },
      error: null,
    });
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
      .mockResolvedValueOnce(response({ data: [{ documentId: 'risk-type-1', name: 'Internet Exposure', description: null, applicableControls: [] }] }))
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

  /*
   * 19-10 (D-14): the analyst detail says whether the assessment is released, decided by Strapi's one record-read check.
   * Only server-only code parses the flag (assessment-server-schema.ts), so the client-loaded assessment-schema.ts gains
   * no runtime code and the route budgets keep their headroom.
   */
  it('parses the analyst detail’s released flag in server-only code and refuses a detail without it', async () => {
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
    normalizeTransportError.mockImplementation(() => unavailable);
    get
      .mockResolvedValueOnce(response({ data: { ...analystDetail, released: true } }))
      .mockResolvedValueOnce(response({ data: analystDetail }))
      .mockResolvedValueOnce(response({ data: { ...analystDetail, released: 'yes' } }));

    await expect(service.getAnalystAssessment('assessment-1')).resolves.toEqual({ data: { ...analystDetail, released: true }, error: null });
    await expect(service.getAnalystAssessment('assessment-1')).resolves.toEqual(unavailable);
    await expect(service.getAnalystAssessment('assessment-1')).resolves.toEqual(unavailable);

    expect(analystAssessmentReadSchema.parse({ ...analystDetail, released: false })).toEqual({ ...analystDetail, released: false });
    expect(analystAssessmentReadSchema.safeParse(analystDetail).success).toBe(false);
    // The released page's parse still accepts both actors' details, and drops the flag from the view.
    const releasedFacts = { assessmentStatus: 'approved' as const, assessmentDate: timestamp, approvalDate: timestamp, approvedBy: analyst };
    const analystView = releasedAssessmentDetailForActorSchema.parse({ ...analystDetail, ...releasedFacts, released: true });
    expect(analystView).toMatchObject({ actor: 'analyst', assessmentNumber: 'ASM-0001' });
    expect(Object.prototype.hasOwnProperty.call(analystView, 'released')).toBe(false);
    expect(releasedAssessmentDetailForActorSchema.safeParse({ ...analystDetail, ...releasedFacts }).success).toBe(false);
    const { generatedBy: _generator, ...requestorFacts } = assessment;
    expect(releasedAssessmentDetailForActorSchema.safeParse({ ...requestorFacts, ...releasedFacts, actor: 'requestor', aiAssisted: false }).success).toBe(true);

    /*
     * FE4-02 (19-UI-SPEC §4.4): an analyst's read of an assessment that is not released is the released read's missing
     * record, as Strapi answers a Requestor: a 404, never a contract mismatch, so both released routes render the
     * in-shell not-found and log nothing.
     */
    get.mockReset();
    get
      .mockResolvedValueOnce(response({ data: { ...analystDetail, released: false } }))
      .mockResolvedValueOnce(response({ data: { ...analystDetail, ...releasedFacts, released: false } }));
    for (let read = 0; read < 2; read += 1) {
      const unreleased = await service.getReleasedAssessment('assessment-1');
      expect(unreleased).toMatchObject({ data: null, error: { status: 404 } });
      expect(unreleased.error).not.toHaveProperty('kind');
      expect(unreleased.error).not.toHaveProperty('operation');
    }

    const schemaSource = readFileSync(resolve(process.cwd(), 'src/features/assessments/assessment-schema.ts'), 'utf8');
    expect(schemaSource).not.toMatch(/released: z\.boolean\(\)/);
    expect(schemaSource).not.toMatch(/releasedAssessmentDetailForActorSchema =/);
    const serverSource = readFileSync(resolve(process.cwd(), 'src/features/assessments/assessment-server-schema.ts'), 'utf8');
    expect(serverSource.startsWith("import 'server-only';")).toBe(true);
  });
});

describe('the picker Risk Type list carries bounded applicable controls (D-31, D-02)', () => {
  const riskRegisterRiskTypes = riskPickerContractParsers.find(({ label }) => label === 'listRiskRegisterRiskTypes')!.parser;
  const applicableControl = (overrides: Record<string, unknown> = {}) => ({
    documentId: 'control-app-11',
    controlNumber: 'APP-11',
    name: 'APP-11 — Security of personal information',
    framework: 'Privacy Act 1988 — Australian Privacy Principles and Notifiable Data Breaches scheme',
    ...overrides,
  });
  const riskType = (applicableControls: unknown) => ({ documentId: 'risk-type-1', name: 'Internet Exposure', description: null, applicableControls });
  const parsers = [
    ['the assessment editor picker (riskTypeSchema)', (value: unknown) => riskTypeSchema.safeParse(value).success],
    ['the Risk Register picker (listRiskRegisterRiskTypes)', (value: unknown) => riskRegisterRiskTypes.safeParse({ data: [value] }).success],
  ] as const;

  it.each(parsers)('%s accepts strings of 1 and 255 characters and a list of 1,000', (_label, accepts) => {
    for (const field of ['documentId', 'controlNumber', 'name', 'framework']) {
      expect(accepts(riskType([applicableControl({ [field]: 'x' })])), `${field} of 1 character`).toBe(true);
      expect(accepts(riskType([applicableControl({ [field]: 'x'.repeat(255) })])), `${field} of 255 characters`).toBe(true);
    }
    expect(accepts(riskType(Array.from({ length: 1_000 }, (_, index) => applicableControl({ documentId: `control-${index}` }))))).toBe(true);
    expect(accepts(riskType([]))).toBe(true);
  });

  it.each(parsers)('%s rejects a 256-character name, an empty field and a list of 1,001', (_label, accepts) => {
    expect(accepts(riskType([applicableControl({ name: 'x'.repeat(256) })]))).toBe(false);
    expect(accepts(riskType([applicableControl({ framework: '' })]))).toBe(false);
    expect(accepts(riskType(Array.from({ length: 1_001 }, (_, index) => applicableControl({ documentId: `control-${index}` }))))).toBe(false);
  });

  it.each(parsers)('%s requires the list and closes each control to its four fields', (_label, accepts) => {
    expect(accepts({ documentId: 'risk-type-1', name: 'Internet Exposure', description: null })).toBe(false);
    expect(accepts(riskType([applicableControl({ description: 'Not part of the summary' })]))).toBe(false);
    const { framework: _framework, ...withoutFramework } = applicableControl();
    expect(accepts(riskType([withoutFramework]))).toBe(false);
  });
});

/*
 * D-02 item 2: both assessment lists take the overall rating and the released date range from the URL and send them
 * to Strapi exactly as given, and leave each out when absent. A hand-edited URL never reaches Strapi malformed.
 */
describe('countReviewQueue: the sidebar’s one-row queue count (D-11)', () => {
  const response = (data: unknown) => ({ data, response: { status: 200 } });
  const viewer = { documentId: 'bob-id', displayName: 'Bob Doe' };
  const queueItem = { documentId: 'request-1', requestNumber: 'REQ-0001', title: 'Review me', requestStatus: 'submitted', submittedDate: timestamp, requestorName: 'Jane Doe', assessmentType: 'Project', businessCriticality: 'High', dueDate: '2026-10-30', daysSinceSubmission: 1, assignee: null, pickUp: 'allowed', unreadNotes: 0 };

  it('reads one row of the Requires attention queue and returns the queue’s total', async () => {
    get.mockResolvedValueOnce(response({ data: [queueItem], meta: { pagination: { page: 1, pageSize: 1, pageCount: 9, total: 9 }, viewer } }));

    await expect(service.countReviewQueue('requires-attention')).resolves.toEqual({ data: 9, error: null });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]).toEqual(['/v1/assessment_requests', {
      params: { query: { 'filters[queue]': 'requires-attention', 'pagination[page]': 1, 'pagination[pageSize]': 1 } },
    }]);
  });

  it('counts an empty queue as zero', async () => {
    get.mockResolvedValueOnce(response({ data: [], meta: { pagination: { page: 1, pageSize: 1, pageCount: 0, total: 0 }, viewer } }));

    await expect(service.countReviewQueue('requires-attention')).resolves.toEqual({ data: 0, error: null });
  });

  /* D-13 (13-12): each item names its holder, whether the viewer may pick it up and the viewer's new notes; the read names its viewer. */
  it('parses the queue item’s assignee, pick-up and new-note fields and the viewer the read names', async () => {
    const held = { ...queueItem, documentId: 'request-2', assignee: { documentId: 'sam-id', displayName: 'Sam Analyst' }, pickUp: 'not-offered', unreadNotes: 2 };
    const own = { ...queueItem, documentId: 'request-3', pickUp: 'own-request' };
    get.mockResolvedValueOnce(response({ data: [queueItem, held, own], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 3 }, viewer } }));

    const result = await service.listAssessmentRequests({ q: '', queue: 'requires-attention', sort: 'submittedDate:desc', page: 1, pageSize: 25 });
    expect(result.error).toBeNull();
    expect(result.data?.viewer).toEqual(viewer);
    expect(result.data?.records.map((record) => [record.assignee, record.pickUp, record.unreadNotes])).toEqual([
      [null, 'allowed', 0],
      [{ documentId: 'sam-id', displayName: 'Sam Analyst' }, 'not-offered', 2],
      [null, 'own-request', 0],
    ]);
  });

  it('refuses an item whose pick-up state or new-note count the contract does not allow, or a holder with an email', async () => {
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.' } };
    normalizeTransportError.mockReturnValue(unavailable);
    for (const item of [
      { ...queueItem, pickUp: 'claimed' },
      { ...queueItem, unreadNotes: -1 },
      { ...queueItem, unreadNotes: 1.5 },
      { ...queueItem, assignee: { documentId: 'sam-id', displayName: 'Sam Analyst', email: 'sam@example.test' } },
    ]) {
      get.mockResolvedValueOnce(response({ data: [item], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 }, viewer } }));
      const result = await service.listAssessmentRequests({ q: '', queue: 'requires-attention', sort: 'submittedDate:desc', page: 1, pageSize: 25 });
      expect(result, JSON.stringify(item)).toEqual(unavailable);
    }
  });

  /* D-14 (13-13's counts): a count of one person's requests, or of those nobody has picked up, is one more filter. */
  it('counts with the assignee filter when asked, and sends nothing else new', async () => {
    get.mockResolvedValueOnce(response({ data: [], meta: { pagination: { page: 1, pageSize: 1, pageCount: 3, total: 3 }, viewer } }));
    await expect(service.countReviewQueue('requires-attention', { assignee: 'unassigned' })).resolves.toEqual({ data: 3, error: null });
    expect(get.mock.calls[0]).toEqual(['/v1/assessment_requests', {
      params: { query: { 'filters[queue]': 'requires-attention', 'filters[assignee]': 'unassigned', 'pagination[page]': 1, 'pagination[pageSize]': 1 } },
    }]);
  });

  it('sends the queue, assignee and notes filters of the Requests page, and reads them from its URL', async () => {
    const query = service.parseAssessmentRequestReviewQuery({ queue: 'open', assignee: 'me', notes: 'unread', q: 'vendor' });
    expect(query).toEqual({ q: 'vendor', queue: 'open', assignee: 'me', notes: 'unread', sort: 'submittedDate:desc', page: 1, pageSize: 25 });
    // A hand-edited URL falls back to no filter rather than reaching Strapi malformed.
    expect(service.parseAssessmentRequestReviewQuery({ assignee: 'second-analyst', notes: 'read' })).toEqual({ q: '', queue: 'requires-attention', sort: 'submittedDate:desc', page: 1, pageSize: 25 });

    get.mockResolvedValueOnce(response({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, viewer } }));
    await service.listAssessmentRequests(query);
    expect(get.mock.calls[0]).toEqual(['/v1/assessment_requests', {
      params: { query: { 'filters[q]': 'vendor', 'filters[queue]': 'open', 'filters[assignee]': 'me', 'filters[notes]': 'unread', sort: 'submittedDate:desc', 'pagination[page]': 1, 'pagination[pageSize]': 25 } },
    }]);
  });

  it('passes a refusal on as the transport’s error, never a count', async () => {
    const forbidden = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 403 } };
    normalizeTransportError.mockReturnValue(forbidden);
    get.mockResolvedValueOnce({ error: { message: 'Forbidden' }, response: { status: 403 } });

    await expect(service.countReviewQueue('requires-attention')).resolves.toEqual(forbidden);
  });
});

describe('the assessment list filters', () => {
  const empty = { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } };
  const response = (data: unknown) => ({ data, response: { status: 200 } });
  const base = { q: '', sort: 'generatedDate:desc' as const, page: 1, pageSize: 25 as const };

  it('sends the overall rating and the released date range exactly as given on both lists', async () => {
    get.mockResolvedValueOnce(response(empty)).mockResolvedValueOnce(response(empty));

    await service.listAnalystAssessments({ ...base, overallRating: 'High', approvedFrom: '2026-09-01', approvedTo: '2026-09-30' });
    await service.listMyReleasedAssessments({ ...base, q: 'payroll', overallRating: 'Critical' });

    expect(get.mock.calls[0]).toEqual(['/v1/risk_assessments', {
      params: { query: { sort: 'generatedDate:desc', page: 1, pageSize: 25, overallRating: 'High', approvedFrom: '2026-09-01', approvedTo: '2026-09-30' } },
    }]);
    expect(get.mock.calls[1]).toEqual(['/v1/my_risk_assessments', {
      params: { query: { sort: 'generatedDate:desc', page: 1, pageSize: 25, q: 'payroll', overallRating: 'Critical' } },
    }]);
  });

  it('leaves out each filter that is absent', async () => {
    get.mockResolvedValueOnce(response(empty)).mockResolvedValueOnce(response(empty));

    await service.listAnalystAssessments(base);
    await service.listMyReleasedAssessments({ ...base, approvedTo: '2026-09-30' });

    expect(Object.keys(get.mock.calls[0][1].params.query).sort()).toEqual(['page', 'pageSize', 'sort']);
    expect(Object.keys(get.mock.calls[1][1].params.query).sort()).toEqual(['approvedTo', 'page', 'pageSize', 'sort']);
  });

  it('reads the overall rating and the released date range from the URL', () => {
    expect(service.parseAssessmentCollectionQuery({ overallRating: 'High', approvedFrom: '2026-09-01', approvedTo: '2026-09-30' })).toEqual({
      ...base, overallRating: 'High', approvedFrom: '2026-09-01', approvedTo: '2026-09-30',
    });
    expect(service.parseAssessmentCollectionQuery({ overallRating: ['Low', 'High'], approvedFrom: '2026-09-30', approvedTo: '2026-09-30' })).toEqual({
      ...base, overallRating: 'Low', approvedFrom: '2026-09-30', approvedTo: '2026-09-30',
    });
  });

  it('drops a rating off the ladder, a malformed or impossible date, and an inverted range from the URL', () => {
    for (const overallRating of ['Extreme', 'high', '']) {
      expect(service.parseAssessmentCollectionQuery({ overallRating }), overallRating).toEqual(base);
    }
    for (const date of ['2026-02-30', '2026-9-1', '20260930', '2026-09-30T00:00:00Z', '']) {
      expect(service.parseAssessmentCollectionQuery({ approvedFrom: date, approvedTo: date }), date).toEqual(base);
    }
    expect(service.parseAssessmentCollectionQuery({ approvedFrom: '2026-09-21', approvedTo: '2026-09-20' })).toEqual(base);
  });
});
