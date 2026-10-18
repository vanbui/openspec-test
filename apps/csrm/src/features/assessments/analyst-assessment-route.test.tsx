import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalystAssessmentDetail, AnalystRiskDetail } from './assessment-schema';

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
  listRiskAiProposals: vi.fn(),
  notFound: vi.fn(),
  viewerCapabilities: vi.fn(async () => new Set<string>()),
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
// Phase 19 (19-12): the released header's Export reads the session's capabilities; its action is the export Server Action.
vi.mock('@/lib/capabilities/viewer-capabilities', () => ({ viewerCapabilities: mocks.viewerCapabilities }));
vi.mock('@/features/exports/export-actions', () => ({ exportReleasedAssessmentAction: vi.fn() }));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: mocks.getAnalystAssessment,
  listAssessmentRisks: mocks.listAssessmentRisks,
  listControlImplementations: mocks.listControlImplementations,
  listRiskTypes: mocks.listRiskTypes,
}));
vi.mock('@/features/requests/request-service', () => ({ getRequest: mocks.getRequest }));
vi.mock('@/features/risk-curation/risk-curation-service', () => ({ listRiskAiProposals: mocks.listRiskAiProposals }));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: async () => ({ displayName: 'Bob Doe', developmentRole: 'security-analyst' }) }),
}));
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
  treatmentOwner: null, treatmentResolveDate: null, treatmentStatus: null, aiProvenance: null, withdrawal: null,
} satisfies AnalystRiskDetail;

const editable: AnalystAssessmentDetail = {
  actor: 'analyst',
  released: false,
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
  generation: null,
  aiProvenance: null,
  releaseReadiness: { ready: false, requirements: [] },
};

const released: AnalystAssessmentDetail = {
  ...editable,
  released: true,
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
    mocks.listRiskAiProposals.mockResolvedValue(failed(503));
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

  /*
   * Phase 13 D-16, D-25 (13-UI-SPEC §11): the page renders who holds the request and its notes figure on the server and
   * hands them to the editor, which sets them under the originating request link; the editor gains no client code.
   */
  it('shows the assignee and notes lines under the originating request link, editable or released', async () => {
    const assessmentRequest = { ...editable.assessmentRequest, assignment: { assignee: null, pickUp: 'allowed' as const }, notes: { total: 2, unread: 1 } };
    mocks.getAnalystAssessment.mockResolvedValue(ok({ ...editable, assessmentRequest }));
    const view = render(await AssessmentEditorContent(props()));

    editorLoaded();
    const block = screen.getByRole('region', { name: 'Originating assessment request' });
    expect(block).toHaveTextContent('Not picked up · Pick up on the request page');
    expect(within(block).getByRole('link', { name: 'Pick up on the request page' })).toHaveAttribute('href', '/app/review/requests/request-1#assignment');
    expect(within(block).getByRole('link', { name: '2 notes, 1 new' })).toHaveAttribute('href', '/app/review/requests/request-1#notes');
    view.unmount();

    mocks.getAnalystAssessment.mockResolvedValue(ok({ ...released, assessmentRequest: { ...assessmentRequest, assignment: { assignee: analyst, pickUp: 'not-offered' as const } } }));
    render(await AssessmentEditorContent(props()));
    expect(screen.getByRole('region', { name: 'Originating assessment request' })).toHaveTextContent('Assigned to Bob Doe');
  });

  it('shows no lines when the read serves neither', async () => {
    render(await AssessmentEditorContent(props()));

    expect(screen.getByRole('region', { name: 'Originating assessment request' })).not.toHaveTextContent(/Assigned to|Not picked up|notes?\b/);
  });

  it.each([[403, 'You don’t have permission to review this assessment'], [503, 'We couldn’t load this assessment']])('keeps the Risk Types read blocking (%s)', async (status, title) => {
    mocks.listRiskTypes.mockResolvedValue(failed(status));
    render(await AssessmentEditorContent(props()));

    expect(screen.getByText(title)).toBeInTheDocument();
  });
});

/*
 * Phase 16 (16-UI-SPEC §1, §2.4, §6.3, §12.3; T-16-39): the page reads the AI proposals beside the assessment. Strapi's
 * OWN_REQUEST refusal shows the requesting analyst's state with no proposal handed on; any other failure shows the
 * section's compact error; `?risks=withdrawn` opens the Withdrawn list.
 */
describe('the analyst assessment route’s AI proposals read (16-14)', () => {
  const allowed = { allowed: true, reason: null };
  const proposals = { assessmentId: 'assessment-1', editable: true, openCount: 0, openByRisk: [], lastAskedAt: null, actions: { suggest: allowed, rewrite: allowed, decide: allowed }, runs: [], items: [], jobs: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.getAnalystAssessment.mockResolvedValue(ok(editable));
    mocks.listRiskTypes.mockResolvedValue(ok([]));
    mocks.listAssessmentRisks.mockResolvedValue(ok([riskListItem]));
    mocks.getRequest.mockResolvedValue(ok(request));
    mocks.listControlImplementations.mockResolvedValue(ok([]));
  });

  it('reads the proposals for the assessment and places the section before Identified Risks', async () => {
    mocks.listRiskAiProposals.mockResolvedValue(ok(proposals));
    render(await AssessmentEditorContent(props()));

    expect(mocks.listRiskAiProposals).toHaveBeenCalledWith('assessment-1');
    editorLoaded();
    const heading = screen.getByRole('heading', { level: 2, name: 'AI proposals' });
    expect(heading.compareDocumentPosition(screen.getByRole('heading', { level: 2, name: 'Identified Risks' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/You raised this request/)).not.toBeInTheDocument();
  });

  it('maps an OWN_REQUEST refusal to the requesting analyst’s line, with the editor still offered', async () => {
    mocks.listRiskAiProposals.mockResolvedValue({ data: null, error: { status: 403, reason: 'OWN_REQUEST', message: 'raw internal detail' } });
    render(await AssessmentEditorContent(props()));

    editorLoaded();
    expect(screen.getByText('You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.')).toBeInTheDocument();
    expect(screen.queryByText('We couldn’t load the AI proposals')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Rewrite this risk/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw risk RSK-0001' })).toBeInTheDocument();
  });

  it('shows the section’s compact error when the read fails for any other reason, and keeps the editor', async () => {
    mocks.listRiskAiProposals.mockResolvedValue(failed(503));
    render(await AssessmentEditorContent(props()));

    editorLoaded();
    expect(screen.getByText('We couldn’t load the AI proposals')).toBeInTheDocument();
  });

  it('opens the Withdrawn list the address names', async () => {
    mocks.listRiskAiProposals.mockResolvedValue(ok(proposals));
    render(await AssessmentEditorContent({ ...props(), searchParams: Promise.resolve({ risks: 'withdrawn' }) }));

    expect(screen.getByRole('radio', { name: 'Withdrawn (0)' })).toBeChecked();
    expect(screen.getByText('No withdrawn risks')).toBeInTheDocument();
  });
});

/*
 * Phase 19 (D-15, D-20, D-21; 19-UI-SPEC §1, §4.1): the analyst's page offers Print report and Export only once the
 * analyst detail's server-computed `released` is true, Export only with released-assessment:export; the page reads the
 * flag and compares no status of its own.
 */
describe('the analyst assessment route’s released header actions (19-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.viewerCapabilities.mockResolvedValue(new Set(['assessment:review', 'released-assessment:export']));
    mocks.listRiskTypes.mockResolvedValue(ok([]));
    mocks.listAssessmentRisks.mockResolvedValue(ok([riskListItem]));
    mocks.getRequest.mockResolvedValue(ok(request));
    mocks.listControlImplementations.mockResolvedValue(ok([]));
    mocks.listRiskAiProposals.mockResolvedValue(failed(503));
  });

  it('offers Print report, then Export {number}, once released', async () => {
    mocks.getAnalystAssessment.mockResolvedValue(ok(released));
    const { container } = render(await AssessmentEditorContent(props()));

    const print = screen.getByRole('link', { name: 'Print report' });
    const exportButton = screen.getByRole('button', { name: 'Export ASM-0001' });
    expect(print).toHaveAttribute('href', '/app/review/assessments/assessment-1/report');
    expect(print.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.page-header')?.lastElementChild).toContainElement(exportButton);
  });

  it('offers Print report alone without the export', async () => {
    mocks.getAnalystAssessment.mockResolvedValue(ok(released));
    mocks.viewerCapabilities.mockResolvedValue(new Set(['assessment:review']));
    render(await AssessmentEditorContent(props()));

    expect(screen.getByRole('link', { name: 'Print report' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
  });

  it('offers neither before release, nor when the read says it is not released whatever its status', async () => {
    mocks.getAnalystAssessment.mockResolvedValue(ok(editable));
    const before = render(await AssessmentEditorContent(props()));
    expect(screen.queryByRole('link', { name: 'Print report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
    before.unmount();

    mocks.getAnalystAssessment.mockResolvedValue(ok({ ...released, released: false }));
    render(await AssessmentEditorContent(props()));
    expect(screen.queryByRole('link', { name: 'Print report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
  });

  it('reads the released flag and compares no status of its own for these actions', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(app)/app/review/assessments/[documentId]/page.tsx'), 'utf8');
    expect(page).toContain('.released');
    expect(page).not.toMatch(/assessmentStatus\s*===/);
  });
});
