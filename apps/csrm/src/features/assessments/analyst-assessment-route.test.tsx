import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalystAssessmentDetail, AnalystRisk } from './assessment-schema';

/*
 * WR-206: on the analyst assessment route only the reads the editor cannot work without block it. The Risk Types
 * always do; the served Risk list does when the assessment is read-only, because the released view reads it (D-34).
 * The originating request feeds only the pickers' suggestions (D-30), so a failed request read leaves the editor
 * searching only, as the Risk Register's Risk page does (research Open Question 2). For an editable assessment the
 * Risk list only names the saved systems and assets, so its failure leaves those names unavailable, never an id.
 * A permission refusal of a read the editor depends on still shows the permission state.
 */

const mocks = vi.hoisted(() => ({
  canViewerReviewAssessments: vi.fn(),
  getAnalystAssessment: vi.fn(),
  getRequest: vi.fn(),
  listAssessmentRisks: vi.fn(),
  listControlImplementations: vi.fn(),
  listRiskTypes: vi.fn(),
  notFound: vi.fn(),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver);

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/review/assessments/assessment-1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/capabilities/analyst-review-gate', () => ({ canViewerReviewAssessments: mocks.canViewerReviewAssessments }));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: mocks.getAnalystAssessment,
  listAssessmentRisks: mocks.listAssessmentRisks,
  listControlImplementations: mocks.listControlImplementations,
  listRiskTypes: mocks.listRiskTypes,
}));
vi.mock('@/features/requests/request-service', () => ({ getRequest: mocks.getRequest }));
vi.mock('@/features/requests/request-actions', () => ({
  revertRequestToDraftAction: vi.fn(),
  searchInformationAssetsAction: vi.fn(),
  searchInformationSystemsAction: vi.fn(),
}));
vi.mock('@/features/assessments/assessment-actions', () => ({
  createControlImplementationAction: vi.fn(),
  createRiskAction: vi.fn(),
  deleteControlImplementationAction: vi.fn(),
  refreshAnalystAssessmentAction: vi.fn(),
  releaseAssessmentAction: vi.fn(),
  saveAssessmentAction: vi.fn(),
  searchActiveUsersAction: vi.fn(),
  searchControlsAction: vi.fn(),
  updateControlImplementationAction: vi.fn(),
  updateRiskAction: vi.fn(),
}));

import { AssessmentEditorContent } from '../../../app/(app)/app/review/assessments/[documentId]/page';

const props = () => ({ params: Promise.resolve({ documentId: 'assessment-1' }) });
const analyst = { documentId: 'bob-id', displayName: 'Bob Doe' };

const risk = {
  documentId: 'risk-1', riskNumber: 'RSK-0001', issueStatement: null, riskStatement: 'Portal compromise.', riskCategory: null,
  riskSubCategory: null, riskCause: null, potentialImpact: null, riskType: null, riskOwner: null,
  informationSystemImpacted: 'system-1', informationAssetImpacted: null, dataClassification: null, inherentLikelihood: null,
  highestInherentConsequence: null, inherentRating: null, inherentRatingRationale: null, residualLikelihood: null,
  highestResidualConsequence: null, residualRating: null, residualRatingRationale: null, controlEffectiveness: null,
  riskVelocity: null, identifiedDate: null, targetDate: null, closureDate: null, isExempted: null, exemptionReviewDate: null,
  escalationDetails: null, comments: null, riskCommunicationDate: null, treatmentAction: null, treatmentPlan: null,
  treatmentOwner: null, treatmentResolveDate: null, treatmentStatus: null,
} satisfies AnalystRisk;

const editable: AnalystAssessmentDetail = {
  actor: 'analyst',
  documentId: 'assessment-1',
  assessmentNumber: 'ASM-0001',
  assessmentStatus: 'in-review',
  assessmentDate: null,
  generatedDate: '2026-08-30T01:00:00.000Z',
  nextReviewDate: null,
  approvalDate: null,
  summary: 'Portal assessment.',
  overallRating: null,
  overallControlEffectiveness: null,
  recommendationsSummary: null,
  overallRiskRationale: null,
  assessmentRequest: { documentId: 'request-1', requestNumber: 'RAR-0001', title: 'Portal review', requestStatus: 'under-review' },
  generatedBy: analyst,
  reviewedBy: null,
  approvedBy: null,
  risks: [risk],
  ownerLabels: [analyst],
  releaseReadiness: { ready: false, requirements: [] },
};

const released: AnalystAssessmentDetail = {
  ...editable,
  assessmentStatus: 'approved',
  assessmentDate: '2026-08-31T01:00:00.000Z',
  approvalDate: '2026-08-31T01:00:00.000Z',
  approvedBy: analyst,
};

const ok = <T,>(data: T) => ({ data, error: null });
const failed = (status: number) => ({ data: null, error: { status, message: 'raw internal detail' } });
const request = { documentId: 'request-1', informationSystems: [{ documentId: 'system-2', name: 'Payments gateway' }], informationAssets: [] };
const riskListItem = {
  documentId: 'risk-1', riskNumber: 'RSK-0001', riskStatement: 'Portal compromise.',
  informationSystemImpacted: { documentId: 'system-1', name: 'Customer portal' }, informationAssetImpacted: null,
  inherentLikelihood: null, highestInherentConsequence: null, inherentRating: null, residualLikelihood: null,
  highestResidualConsequence: null, residualRating: null, treatmentAction: null, treatmentPlan: null, treatmentStatus: null,
  riskOwner: null, treatmentOwner: null, targetDate: null,
};

function editorLoaded() {
  expect(screen.getByRole('heading', { level: 1, name: 'Risk assessment review' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save assessment' })).toBeInTheDocument();
  expect(screen.queryByText('We couldn’t load this assessment')).not.toBeInTheDocument();
  expect(screen.queryByText('You don’t have permission to review this assessment')).not.toBeInTheDocument();
}

describe('the analyst assessment route’s optional reads (WR-206)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.getAnalystAssessment.mockResolvedValue(ok(editable));
    mocks.listRiskTypes.mockResolvedValue(ok([]));
    mocks.listAssessmentRisks.mockResolvedValue(ok([riskListItem]));
    mocks.getRequest.mockResolvedValue(ok(request));
    mocks.listControlImplementations.mockResolvedValue(ok([]));
  });

  it('keeps the editor when the request read fails, still naming the saved system from the Risk list', async () => {
    mocks.getRequest.mockResolvedValue(failed(503));
    render(await AssessmentEditorContent(props()));

    editorLoaded();
    expect(screen.getByText('Selected system: Customer portal')).toBeInTheDocument();
  });

  it('keeps the editor when Strapi refuses the request read, as the Risk page does', async () => {
    mocks.getRequest.mockResolvedValue(failed(403));
    render(await AssessmentEditorContent(props()));

    editorLoaded();
  });

  it('keeps an editable assessment’s editor when the Risk list read fails, naming no saved system by id', async () => {
    mocks.listAssessmentRisks.mockResolvedValue(failed(503));
    render(await AssessmentEditorContent(props()));

    editorLoaded();
    expect(screen.getByText('Selected system: Name not available')).toBeInTheDocument();
    expect(screen.queryByText(/system-1/)).not.toBeInTheDocument();
  });

  it('shows the permission state when Strapi refuses an editable assessment’s Risk list', async () => {
    mocks.listAssessmentRisks.mockResolvedValue(failed(403));
    render(await AssessmentEditorContent(props()));

    expect(screen.getByText('You don’t have permission to review this assessment')).toBeInTheDocument();
  });

  it('shows the load failure when a read-only assessment’s Risk list fails, because its view reads it', async () => {
    mocks.getAnalystAssessment.mockResolvedValue(ok(released));
    mocks.listAssessmentRisks.mockResolvedValue(failed(503));
    render(await AssessmentEditorContent(props()));

    expect(screen.getByText('We couldn’t load this assessment')).toBeInTheDocument();
    expect(mocks.getRequest).not.toHaveBeenCalled();
  });

  it.each([[403, 'You don’t have permission to review this assessment'], [503, 'We couldn’t load this assessment']])('keeps the Risk Types read blocking (%s)', async (status, title) => {
    mocks.listRiskTypes.mockResolvedValue(failed(status));
    render(await AssessmentEditorContent(props()));

    expect(screen.getByText(title)).toBeInTheDocument();
  });
});
