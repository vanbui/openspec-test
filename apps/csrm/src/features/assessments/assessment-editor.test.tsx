import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Suspense, use, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { searchAfterPause } from '@/test/debounced-search';

import type {
  AiFieldReview,
  AnalystAssessmentDetail,
  AssessmentRiskListItem,
  ControlImplementation,
  AnalystRisk,
  RiskType,
  RiskUpdateInput,
} from './assessment-schema';
import { controlImplementationWritableFields, riskWritableFields } from './assessment-schema';
import { canMutateAssessment } from './assessment-domain';
import type { AiProvenanceHeaderProps } from '@/features/ai-assistance/ai-provenance-domain';
import type { RiskAiProposals, RiskAiRunFacts, RiskProposalJob } from '@/features/risk-curation/risk-curation-domain';

const actionMocks = vi.hoisted(() => ({
  createControlImplementationAction: vi.fn(),
  createRiskAction: vi.fn(),
  deleteControlImplementationAction: vi.fn(),
  refreshAnalystAssessmentAction: vi.fn(),
  releaseAssessmentAction: vi.fn(),
  saveAssessmentAction: vi.fn(),
  updateControlImplementationAction: vi.fn(),
  updateRiskAction: vi.fn(),
}));
const decisionMock = vi.hoisted(() => vi.fn());
vi.mock('./assessment-actions', () => actionMocks);
vi.mock('@/features/ai-assistance/ai-assistance-actions', () => ({ decideAiProposalsAction: decisionMock }));
/* Phase 16 (16-14): the risk curation and AI proposal actions the editor's cards and section send, and the router they refresh. */
const curationActions = vi.hoisted(() => ({
  withdrawRisksAction: vi.fn(),
  reinstateRisksAction: vi.fn(),
  undoWithdrawalAction: vi.fn(),
  undoReinstatementAction: vi.fn(),
  readRiskHistoryAction: vi.fn(),
  startRiskSuggestionsAction: vi.fn(),
  startRiskRewriteAction: vi.fn(),
  readRiskProposalJobAction: vi.fn(),
  retryRiskProposalJobAction: vi.fn(),
  readRiskAiProposalsAction: vi.fn(),
  decideRiskProposalsAction: vi.fn(),
}));
const routerRefresh = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn((href: string) => { window.history.replaceState(window.history.state, '', href); }));
vi.mock('@/features/risk-curation/risk-curation-actions', () => curationActions);
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/review/assessments/assessment%2Fid',
  useRouter: () => ({ push: vi.fn(), refresh: routerRefresh, replace: routerReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);
Element.prototype.scrollIntoView ??= () => {};

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { installTestResizeObserver } from '@/test/layout-stubs';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import {
  AssessmentEditor,
  AssessmentEditorSkeleton,
} from './assessment-editor';
import { ControlImplementationEditor } from './control-implementation-editor';
import { RiskEditor } from './risk-editor';

const analyst = { documentId: 'bob-id', displayName: 'Bob Doe' };
const assessment: AnalystAssessmentDetail = {
  actor: 'analyst',
  released: false,
  documentId: 'assessment/id',
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'in-review',
  assessmentDate: null,
  generatedDate: '2026-08-30T01:00:00.000Z',
  nextReviewDate: '2026-12-01',
  approvalDate: null,
  summary: 'Customer portal assessment.',
  overallRating: 'High',
  overallControlEffectiveness: 'Partially Effective',
  recommendationsSummary: 'Complete the treatment plan.',
  overallRiskRationale: 'Internet exposure increases likelihood.',
  assessmentRequest: { documentId: 'request-42', requestNumber: 'RAR-2026-0042', title: 'Customer portal security assessment', requestStatus: 'under-review' },
  generatedBy: analyst,
  reviewedBy: analyst,
  approvedBy: null,
  risks: [],
  ownerLabels: [analyst],
  generation: null,
  aiProvenance: null,
  releaseReadiness: {
    ready: true,
    requirements: [
      { scope: 'assessment', key: 'summary', label: 'Summary', state: 'met' },
      { scope: 'risk', key: 'riskStatement', label: 'Risk statement', state: 'met', riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
    ],
  },
};

const riskValues: RiskUpdateInput = {
  issueStatement: 'Public endpoint',
  riskStatement: 'Attackers may compromise the portal.',
  riskCategory: 'Cyber security',
  riskSubCategory: 'Application security',
  riskCause: 'Insufficient hardening',
  potentialImpact: 'Loss of customer data',
  riskType: 'risk-type-1',
  riskOwner: 'bob-id',
  informationSystemImpacted: 'system-1',
  informationAssetImpacted: 'asset-1',
  dataClassification: 'Restricted',
  inherentLikelihood: 'Likely',
  highestInherentConsequence: 'Major',
  inherentRating: 'High',
  inherentRatingRationale: 'Internet-facing service',
  residualLikelihood: 'Possible',
  highestResidualConsequence: 'Moderate',
  residualRating: 'Moderate',
  residualRatingRationale: 'Controls reduce likelihood',
  controlEffectiveness: 'Partially Effective',
  riskVelocity: 'High',
  identifiedDate: '2026-08-30',
  targetDate: '2026-10-30',
  closureDate: null,
  isExempted: false,
  exemptionReviewDate: null,
  escalationDetails: 'Escalate overdue treatment.',
  comments: 'Reviewed with the owner.',
  riskCommunicationDate: '2026-08-31',
  treatmentAction: 'Treat',
  treatmentPlan: 'Deploy stronger controls.',
  treatmentOwner: 'bob-id',
  treatmentResolveDate: '2026-10-30',
  treatmentStatus: 'In Progress',
};

const risk = {
  ...riskValues,
  documentId: 'risk-1',
  riskNumber: 'RSK-0042',
  riskStatement: riskValues.riskStatement ?? null,
  inherentRating: riskValues.inherentRating ?? null,
  residualRating: riskValues.residualRating ?? null,
} as AnalystRisk;

const implementation: ControlImplementation = {
  documentId: 'implementation-1',
  control: 'control-1',
  controlSummary: { documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control', framework: 'NIST SP 800-53' },
  controlOwner: analyst,
  controlStatus: 'Implemented',
  effectivenessRating: 'Effective',
  evidence: 'Configuration report',
  implementationDueDate: '2026-09-30',
  implementedDate: '2026-09-01',
  reviewDate: '2026-12-01',
};

const searchOwners = vi.fn(async () => ({ ok: true as const, data: [analyst] }));

const releasedAssessment: AnalystAssessmentDetail = {
  ...assessment,
  released: true,
  assessmentStatus: 'approved',
  assessmentDate: '2026-08-30T02:00:00.000Z',
  approvalDate: '2026-08-30T02:00:00.000Z',
  approvedBy: analyst,
};

/** The served list item for risk-1 (D-34): names, not ids, for the system, asset and both owners. */
const riskListItem: AssessmentRiskListItem = {
  documentId: 'risk-1',
  riskNumber: 'RSK-0042',
  riskStatement: 'Attackers may compromise the portal.',
  informationSystemImpacted: { documentId: 'system-1', name: 'Customer portal' },
  informationAssetImpacted: { documentId: 'asset-1', name: 'Customer data' },
  inherentLikelihood: 'Likely',
  highestInherentConsequence: 'Major',
  inherentRating: 'High',
  residualLikelihood: 'Possible',
  highestResidualConsequence: 'Moderate',
  residualRating: 'Moderate',
  treatmentAction: 'Treat',
  treatmentPlan: 'Deploy stronger controls.',
  treatmentStatus: 'In Progress',
  riskOwner: { documentId: 'bob-id', displayName: 'Bob Doe' },
  treatmentOwner: { documentId: 'bob-id', displayName: 'Bob Doe' },
  targetDate: '2026-10-30',
};

function definitionValue(term: string): HTMLElement {
  const terms = screen.getAllByText(term, { selector: 'dt' });
  expect(terms, `exactly one ${term} row`).toHaveLength(1);
  return terms[0]!.nextElementSibling as HTMLElement;
}

const applicableAc1 = { documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control', framework: 'NIST SP 800-53' };
const applicableApp11 = {
  documentId: 'control-2',
  controlNumber: 'APP-11',
  name: 'APP-11 — Security of personal information',
  framework: 'Privacy Act 1988 — Australian Privacy Principles and Notifiable Data Breaches scheme',
};

const internetExposure: RiskType = { documentId: 'risk-type-1', name: 'Internet Exposure', description: null, applicableControls: [applicableAc1, applicableApp11] };

const searchControls = vi.fn(async () => ({ ok: true as const, data: [] }));

/** An active user who is on no Risk yet: the control owner search finds her (D-28, UAT-034). */
const zoe = { documentId: 'zoe-id', displayName: 'Zoe Owner' };

/** The control editor's options: the owner search, the Risk Type's applicable controls first, and the control search. */
const controlEditorOptions = {
  searchOwners,
  suggestedControls: {
    label: 'Applicable to Internet Exposure',
    items: [
      { documentId: 'control-1', name: 'AC-1 · Access control', detail: 'NIST SP 800-53' },
      { documentId: 'control-2', name: 'APP-11 · Security of personal information', detail: applicableApp11.framework },
    ],
  },
  searchControls,
};

type PickerRecord = { documentId: string; name: string };
type PickerSearchResult = { ok: true; data: readonly PickerRecord[] } | { ok: false; formError: string };

/** The originating request's selections, offered first in the system and asset pickers (D-30). */
const requestSystems = [{ documentId: 'system-1', name: 'Customer portal' }, { documentId: 'system-2', name: 'Payments gateway' }];
const requestAssets = [{ documentId: 'asset-1', name: 'Customer data' }, { documentId: 'asset-2', name: 'Card records' }];
const searchSystems = vi.fn(async (_input: { search: string }): Promise<PickerSearchResult> => ({ ok: true, data: [] }));
const searchAssets = vi.fn(async (_input: { search: string }): Promise<PickerSearchResult> => ({ ok: true, data: [] }));

const editorProps = {
  assessment,
  risks: [risk],
  controlImplementations: { 'risk-1': [implementation] },
  riskTypes: [internetExposure],
  users: [analyst],
  requestSystems,
  requestAssets,
  // The served Risk list names each Risk's system and asset (D-30).
  relationLabels: { 'system-1': 'Customer portal', 'asset-1': 'Customer data' },
  searchOwners,
  searchSystems,
  searchAssets,
} as const;

/** The record each system or asset picker chooses when a test edits every field. */
const pickerChoices: Readonly<Record<string, string>> = {
  'Information system impacted': 'Payments gateway',
  'Information asset impacted': 'Card records',
};

const persistedOwner = { documentId: 'persisted-owner-id', displayName: 'Persisted inactive owner' };

const riskLabels = [
  'Issue statement', 'Risk statement', 'Risk category', 'Risk sub-category', 'Risk cause',
  'Potential impact', 'Risk type', 'Risk owner', 'Information system impacted',
  'Information asset impacted', 'Data classification', 'Inherent likelihood',
  'Highest inherent consequence', 'Inherent rating', 'Inherent rating rationale',
  'Residual likelihood', 'Highest residual consequence', 'Residual rating',
  'Residual rating rationale', 'Control effectiveness', 'Risk velocity', 'Identified date',
  'Target date', 'Closure date', 'Exempted', 'Exemption review date', 'Escalation details',
  'Comments', 'Risk communication date', 'Treatment action', 'Treatment plan',
  'Treatment owner', 'Treatment resolve date', 'Treatment status',
];
const selectRiskLabels = riskLabels.filter((label) => label !== 'Risk owner' && label !== 'Treatment owner');

const controlLabels = [
  'Control', 'Control owner', 'Control status', 'Effectiveness rating', 'Evidence',
  'Implementation due date', 'Implemented date', 'Review date',
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

function DeferredView<T>({ promise, children }: { promise: Promise<T>; children: (value: T) => ReactNode }) {
  return children(use(promise));
}

describe('analyst assessment editor contract', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    searchOwners.mockResolvedValue({ ok: true, data: [analyst] });
    searchSystems.mockResolvedValue({ ok: true, data: [] });
    searchAssets.mockResolvedValue({ ok: true, data: [] });
    actionMocks.updateRiskAction.mockResolvedValue({ ok: true, data: risk });
    actionMocks.createRiskAction.mockResolvedValue({ ok: true, data: risk });
    actionMocks.updateControlImplementationAction.mockResolvedValue({ ok: true, data: implementation });
    actionMocks.createControlImplementationAction.mockResolvedValue({ ok: true, data: implementation });
    actionMocks.deleteControlImplementationAction.mockResolvedValue({ ok: true, data: undefined });
    actionMocks.saveAssessmentAction.mockResolvedValue({ ok: true, data: assessment });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: assessment });
  });

  it('renders icon-and-label semantics for every risk rating', () => {
    render(<div>{(['Low', 'Moderate', 'High', 'Critical'] as const).map((rating) => <RiskRatingBadge key={rating} rating={rating} />)}</div>);
    for (const rating of ['Low', 'Moderate', 'High', 'Critical']) {
      const badge = screen.getByText(rating).closest('[data-slot="badge"]');
      expect(badge?.querySelector('svg')).not.toBeNull();
    }
  });

  it('shows the header status through the shared tinted badge and announces it politely', () => {
    const headerBadge = (root: HTMLElement) => root.querySelector<HTMLElement>('.page-header > [data-slot="badge"]');
    const inReview = render(<AssessmentEditor {...editorProps} />);
    const reviewBadge = headerBadge(inReview.container);
    expect(reviewBadge).toHaveTextContent('In review');
    expect(reviewBadge).toHaveAttribute('data-tone', 'warning');
    expect(reviewBadge).toHaveAttribute('data-variant', 'warning');
    expect(reviewBadge).toHaveAttribute('aria-live', 'polite');
    expect(reviewBadge?.querySelectorAll('svg')).toHaveLength(1);
    inReview.unmount();

    const released = render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, assessmentStatus: 'approved', assessmentDate: '2026-08-30T02:00:00.000Z', approvalDate: '2026-08-30T02:00:00.000Z', approvedBy: analyst }} />);
    const releasedBadge = headerBadge(released.container);
    expect(releasedBadge).toHaveTextContent(/^Released$/);
    expect(releasedBadge).toHaveAttribute('data-tone', 'success');
    expect(releasedBadge).toHaveAttribute('aria-live', 'polite');
  });

  it('places a passed header action last in the header, after the status, and renders none by default', () => {
    const plain = render(<AssessmentEditor {...editorProps} />);
    expect(plain.container.querySelector('.page-header-actions')).toBeNull();
    plain.unmount();

    const { container } = render(<AssessmentEditor {...editorProps} headerAction={<a href="/app/review/assessments/assessment-1/report">Print report</a>} />);
    const header = container.querySelector<HTMLElement>('.page-header')!;
    const actions = header.lastElementChild as HTMLElement;
    expect(actions).toHaveClass('page-header-actions');
    expect(within(actions).getByRole('link', { name: 'Print report' })).toBeInTheDocument();
    const badge = header.querySelector('[data-slot="badge"]')!;
    expect(badge.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actions).not.toContainElement(badge as HTMLElement);
  });

  it('renders the analyst request link and shared read-only lifecycle context', () => {
    const { container } = render(<AssessmentEditor {...editorProps} />);

    expect(screen.getByRole('link', { name: 'RAR-2026-0042 · Customer portal security assessment' })).toHaveAttribute('href', '/app/review/requests/request-42');
    expect(screen.getByRole('heading', { name: 'Current lifecycle state: In review' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label="Risk assessment lifecycle"]')).toHaveLength(1);
  });

  it('exposes and edits every frozen Risk field with only add/update affordances', async () => {
    const view = render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    for (const label of riskLabels) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove risk/i })).not.toBeInTheDocument();

    for (const label of selectRiskLabels) {
      const field = screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (field instanceof HTMLInputElement && field.type === 'checkbox') fireEvent.click(field);
      else if (pickerChoices[label]) {
        // The system and asset fields are record pickers (D-28): choose another record on the request.
        expect(field).toHaveAttribute('role', 'combobox');
        fireEvent.click(field);
        fireEvent.click(screen.getByRole('option', { name: pickerChoices[label] }));
      } else if (field instanceof HTMLSelectElement) {
        const next = [...field.options].map((option) => option.value).find((value) => value !== field.value) ?? '';
        fireEvent.change(field, { target: { value: next } });
      } else if (field instanceof HTMLInputElement && field.type === 'date') fireEvent.change(field, { target: { value: '2026-11-11' } });
      else fireEvent.change(field, { target: { value: `Updated ${label}` } });
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledTimes(1));
    const update = actionMocks.updateRiskAction.mock.calls[0]?.[0];
    expect(update).toMatchObject({ assessmentId: 'assessment/id', riskId: 'risk-1' });
    expect(Object.keys(update.values).sort()).toEqual([...riskWritableFields].filter((field) => field !== 'riskOwner' && field !== 'treatmentOwner').sort());
    // D-32: the exemption review date is a date like every other, saved as that calendar date at 00:00 UTC.
    expect(update.values.exemptionReviewDate).toBe('2026-11-11T00:00:00.000Z');

    view.unmount();
    render(<RiskEditor assessmentId="assessment/id" mode="create" options={editorProps} searchOwners={searchOwners} />);
    fireEvent.change(screen.getByLabelText('Risk statement'), { target: { value: 'New contextual Risk' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    await waitFor(() => expect(actionMocks.createRiskAction).toHaveBeenCalledTimes(1));
  });

  it('hydrates every persisted Risk field after an editor remount', () => {
    // A legacy exemption review date with a time of day shows its UTC date (D-32).
    const persisted = { ...risk, exemptionReviewDate: '2026-10-15T13:45:00Z' };
    const view = render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={persisted} searchOwners={searchOwners} />);
    view.unmount();
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={persisted} searchOwners={searchOwners} />);
    for (const label of selectRiskLabels) {
      if (pickerChoices[label]) continue;
      const field = screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (field instanceof HTMLInputElement && field.type === 'checkbox') expect(field.checked).toBe(Boolean(persisted.isExempted));
      else if (label === 'Exemption review date') expect(field).toHaveValue('2026-10-15');
      else expect(field).toHaveValue(String(persisted[riskWritableFields[riskLabels.indexOf(label)]!] ?? ''));
    }
    expect(screen.getAllByText(`Selected owner: ${analyst.displayName}`)).toHaveLength(2);
    expect(screen.getByText('Selected system: Customer portal')).toBeInTheDocument();
    expect(screen.getByText('Selected asset: Customer data')).toBeInTheDocument();
  });

  it('offers the request’s systems first and searches the whole inventory for the rest (D-28, D-30, UI-SPEC §13.1)', async () => {
    vi.useFakeTimers();
    searchSystems.mockResolvedValue({ ok: true, data: [{ documentId: 'system-2', name: 'Payments gateway' }, { documentId: 'system-26', name: 'Payroll ledger' }] });
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    const optionNames = (group: HTMLElement) => within(group).getAllByRole('option').map((option) => option.getAttribute('aria-label'));

    const systemPicker = screen.getByRole('combobox', { name: 'Information system impacted' });
    // WR-303: the record already chosen is part of each picker's description.
    expect(systemPicker).toHaveAccessibleDescription('Search by name. Systems selected on the request come first. Selected system: Customer portal');
    expect(screen.getByRole('combobox', { name: 'Information asset impacted' })).toHaveAccessibleDescription('Search by name. Assets selected on the request come first. Selected asset: Customer data');
    expect(document.querySelector('select[name="informationSystemImpacted"], select[name="informationAssetImpacted"]')).toBeNull();

    fireEvent.click(systemPicker);
    expect(optionNames(screen.getByRole('group', { name: 'On this request' }))).toEqual(['Customer portal', 'Payments gateway']);
    expect(searchSystems).not.toHaveBeenCalled();

    fireEvent.change(systemPicker, { target: { value: 'pay' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchSystems).toHaveBeenCalledWith({ search: 'pay' });
    // The request's own match stays in its group; the server's copy of it is not listed twice.
    expect(optionNames(screen.getByRole('group', { name: 'On this request' }))).toEqual(['Payments gateway']);
    expect(optionNames(screen.getByRole('group', { name: 'Other information systems' }))).toEqual(['Payroll ledger']);
  });

  it('says when a system or asset search fills its page or finds nothing (UI-SPEC §13.1)', async () => {
    vi.useFakeTimers();
    searchSystems.mockResolvedValue({ ok: true, data: Array.from({ length: 25 }, (_, index) => ({ documentId: `system-page-${index + 1}`, name: `Server ${index + 1}` })) });
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    const systemPicker = screen.getByRole('combobox', { name: 'Information system impacted' });

    fireEvent.change(systemPicker, { target: { value: 'Server' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText('Showing the first 25 matches. Keep typing to narrow the list.')).toBeInTheDocument();

    searchSystems.mockResolvedValue({ ok: true, data: [] });
    fireEvent.change(systemPicker, { target: { value: 'Zebra' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText('No matching information systems. Try another name.')).toBeInTheDocument();

    fireEvent.keyDown(systemPicker, { key: 'Escape' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Information asset impacted' }), { target: { value: 'Zebra' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchAssets).toHaveBeenCalledWith({ search: 'Zebra' });
    expect(screen.getByText('No matching information assets. Try another name.')).toBeInTheDocument();
  });

  it('names the chosen system and asset from the request, then the served Risk list, never an id (D-30)', () => {
    const view = render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    expect(screen.getByText('Selected system: Customer portal')).toBeInTheDocument();
    expect(screen.getByText('Selected asset: Customer data')).toBeInTheDocument();
    view.unmount();

    const farRisk = { ...risk, informationSystemImpacted: 'system-far', informationAssetImpacted: 'asset-gone' };
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={{ ...editorProps, relationLabels: { 'system-far': 'Archive server' } }} risk={farRisk} searchOwners={searchOwners} />);
    expect(screen.getByText('Selected system: Archive server')).toBeInTheDocument();
    expect(screen.getByText('Selected asset: Name not available')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('system-far');
    expect(document.body.textContent).not.toContain('asset-gone');
  });

  it('chooses a system found by typing and saves only that change (D-28)', async () => {
    vi.useFakeTimers();
    searchSystems.mockResolvedValue({ ok: true, data: [{ documentId: 'system-26', name: 'Picker proof 26' }] });
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Information system impacted' }), { target: { value: 'Picker proof 26' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.click(screen.getByRole('option', { name: 'Picker proof 26' }));
    expect(screen.getByText('Selected system: Picker proof 26')).toBeInTheDocument();

    vi.useRealTimers();
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { informationSystemImpacted: 'system-26' } }));
  });

  it('keeps a searched system’s name after adding a Risk refreshes the editor (D-30)', async () => {
    vi.useFakeTimers();
    searchSystems.mockResolvedValue({ ok: true, data: [{ documentId: 'system-26', name: 'Picker proof 26' }] });
    const createdRisk = { ...risk, documentId: 'risk-created', riskNumber: 'RSK-0043', informationSystemImpacted: 'system-26' };
    actionMocks.createRiskAction.mockResolvedValue({ ok: true, data: createdRisk });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [createdRisk] } });
    render(<AssessmentEditor {...editorProps} risks={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Information system impacted' }), { target: { value: 'Picker' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.click(screen.getByRole('option', { name: 'Picker proof 26' }));
    vi.useRealTimers();
    await userEvent.click(screen.getByRole('button', { name: 'Add risk' }));

    await waitFor(() => expect(actionMocks.createRiskAction).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ informationSystemImpacted: 'system-26' }) })));
    const card = await waitFor(() => {
      const element = document.getElementById('risk-risk-created');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(within(card).getByText('Selected system: Picker proof 26')).toBeInTheDocument();
  });

  it('wires both owner pickers to the injected action and retains persisted labels outside search results', async () => {
    vi.useFakeTimers();
    const persistedRisk = { ...risk, riskOwner: persistedOwner.documentId, treatmentOwner: persistedOwner.documentId };
    const view = render(<RiskEditor assessmentId="assessment/id" mode="edit" options={{ ...editorProps, users: [persistedOwner] }} risk={persistedRisk} searchOwners={searchOwners} />);

    expect(screen.getAllByText(`Selected owner: ${persistedOwner.displayName}`)).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox', { name: 'Risk owner' }), { target: { value: 'Bob' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchOwners).toHaveBeenCalledWith({ search: 'Bob' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Treatment owner' }), { target: { value: 'Bob' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchOwners).toHaveBeenCalledTimes(2);

    view.unmount();
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={{ ...editorProps, users: [persistedOwner] }} risk={persistedRisk} searchOwners={async () => ({ ok: true, data: [] })} />);
    expect(screen.getAllByText(`Selected owner: ${persistedOwner.displayName}`)).toHaveLength(2);
  });

  it('retains a searched owner outside initial options and submits its documentId', async () => {
    vi.useFakeTimers();
    const searchedOwner = { documentId: 'searched-owner-id', displayName: 'Zoe Owner' };
    searchOwners.mockResolvedValue({ ok: true, data: [searchedOwner] });
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    const picker = screen.getByRole('combobox', { name: 'Risk owner' });
    fireEvent.change(picker, { target: { value: 'Zoe' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => {});
    fireEvent.click(screen.getByRole('option', { name: 'Zoe Owner' }));
    expect(screen.getByText('Selected owner: Zoe Owner')).toBeInTheDocument();
    vi.useRealTimers();
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { riskOwner: searchedOwner.documentId } }));
  });

  it('retains a searched owner label after creating a Risk refreshes and remounts its editor', async () => {
    vi.useFakeTimers();
    const searchedOwner = { documentId: 'searched-owner-id', displayName: 'Zoe Owner' };
    const createdRisk = { ...risk, documentId: 'risk-created', riskOwner: searchedOwner.documentId };
    searchOwners.mockResolvedValue({ ok: true, data: [searchedOwner] });
    actionMocks.createRiskAction.mockResolvedValue({ ok: true, data: createdRisk });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, ownerLabels: [analyst, searchedOwner], risks: [createdRisk] } });
    render(<AssessmentEditor {...editorProps} risks={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    const picker = screen.getByRole('combobox', { name: 'Risk owner' });
    fireEvent.change(picker, { target: { value: 'Zoe' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => {});
    fireEvent.click(screen.getByRole('option', { name: 'Zoe Owner' }));
    fireEvent.change(screen.getByLabelText('Risk statement'), { target: { value: 'New contextual Risk' } });
    vi.useRealTimers();
    await userEvent.click(screen.getByRole('button', { name: 'Add risk' }));

    await waitFor(() => expect(actionMocks.createRiskAction).toHaveBeenCalledWith(expect.objectContaining({ assessmentId: 'assessment/id', values: expect.objectContaining({ riskOwner: searchedOwner.documentId }) })));
    expect(await screen.findByText('Selected owner: Zoe Owner')).toBeInTheDocument();
  });

  it('enters the exemption review date as a date like every other, with no UTC hint (D-32, UI-SPEC §13.3)', () => {
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={{ ...risk, exemptionReviewDate: '2026-11-11T00:00:00.000Z' }} searchOwners={searchOwners} />);
    const field = screen.getByLabelText('Exemption review date');
    expect(field).toHaveAttribute('type', 'date');
    expect(field).toHaveValue('2026-11-11');
    expect(field).not.toHaveAccessibleDescription();
    expect(screen.queryByText(/UTC format/)).not.toBeInTheDocument();
    // The old hint spelled out an ISO timestamp pattern; nothing on the form asks for a time any more.
    expect(document.body.textContent).not.toMatch(/HH:mm/);
  });

  it('keeps an untouched legacy exemption review date exactly as it was (D-32)', async () => {
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={{ ...risk, exemptionReviewDate: '2026-10-15T13:45:00Z' }} searchOwners={searchOwners} />);
    await userEvent.clear(screen.getByLabelText('Risk statement'));
    await userEvent.type(screen.getByLabelText('Risk statement'), 'Updated risk statement');
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { riskStatement: 'Updated risk statement' } }));
  });

  it('saves a chosen exemption review date at 00:00 UTC and a cleared one as no date (D-32)', async () => {
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={{ ...risk, exemptionReviewDate: '2026-10-15T13:45:00Z' }} searchOwners={searchOwners} />);
    fireEvent.change(screen.getByLabelText('Exemption review date'), { target: { value: '2026-11-11' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { exemptionReviewDate: '2026-11-11T00:00:00.000Z' } }));

    fireEvent.change(screen.getByLabelText('Exemption review date'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { exemptionReviewDate: null } }));
  });

  it('adds a Risk with its exemption review date at 00:00 UTC (D-32)', async () => {
    render(<RiskEditor assessmentId="assessment/id" mode="create" options={editorProps} searchOwners={searchOwners} />);
    fireEvent.change(screen.getByLabelText('Risk statement'), { target: { value: 'New contextual Risk' } });
    fireEvent.change(screen.getByLabelText('Exemption review date'), { target: { value: '2027-02-28' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    await waitFor(() => expect(actionMocks.createRiskAction).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.objectContaining({ riskStatement: 'New contextual Risk', exemptionReviewDate: '2027-02-28T00:00:00.000Z' }),
    })));
  });

  it('does not coerce an unspecified exemption while saving another Risk field', async () => {
    const exemptedUnknown = { ...risk, isExempted: null };
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={exemptedUnknown} searchOwners={searchOwners} />);
    expect(screen.getByLabelText('Exempted')).toHaveValue('');
    await userEvent.clear(screen.getByLabelText('Risk statement'));
    await userEvent.type(screen.getByLabelText('Risk statement'), 'Updated risk statement');
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { riskStatement: 'Updated risk statement' } }));
  });

  it('exposes exactly the contextual ControlImplementation fields and add/update/remove actions', async () => {
    const view = render(<ControlImplementationEditor assessmentId="assessment/id" implementation={implementation} mode="edit" options={controlEditorOptions} riskId="risk-1" />);
    for (const label of controlLabels) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.queryByLabelText('Control number')).not.toBeInTheDocument();

    for (const label of controlLabels) {
      const field = screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (label === 'Control') {
        // The Control field is the record picker (D-28): choose another applicable control from it.
        expect(field).toHaveAttribute('role', 'combobox');
        fireEvent.click(field);
        fireEvent.click(screen.getByRole('option', { name: 'APP-11 · Security of personal information' }));
      } else if (label === 'Control owner') {
        // The control owner is chosen with the owner search over every active user (D-28).
        expect(field).toHaveAttribute('role', 'combobox');
        searchOwners.mockResolvedValueOnce({ ok: true, data: [zoe] });
        await searchAfterPause(field, 'Zoe');
        fireEvent.click(screen.getByRole('option', { name: 'Zoe Owner' }));
      } else if (field instanceof HTMLSelectElement) {
        const next = [...field.options].map((option) => option.value).find((value) => value !== field.value) ?? '';
        fireEvent.change(field, { target: { value: next } });
      } else if (field instanceof HTMLInputElement && field.type === 'date') fireEvent.change(field, { target: { value: '2026-11-11' } });
      else fireEvent.change(field, { target: { value: `Updated ${label}` } });
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.updateControlImplementationAction).toHaveBeenCalledTimes(1));
    expect(Object.keys(actionMocks.updateControlImplementationAction.mock.calls[0]?.[0].values).sort()).toEqual([...controlImplementationWritableFields].sort());

    await userEvent.click(screen.getByRole('button', { name: 'Remove mitigation control' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove mitigation control' }));
    await waitFor(() => expect(actionMocks.deleteControlImplementationAction).toHaveBeenCalledWith({
      assessmentId: 'assessment/id', implementationId: 'implementation-1',
    }));

    view.unmount();
    render(<ControlImplementationEditor assessmentId="assessment/id" mode="create" options={controlEditorOptions} riskId="risk-1" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Control' }));
    fireEvent.click(screen.getByRole('option', { name: 'AC-1 · Access control' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add mitigation control' }));
    await waitFor(() => expect(actionMocks.createControlImplementationAction).toHaveBeenCalledTimes(1));
    expect(actionMocks.createControlImplementationAction.mock.calls[0]?.[0].values.control).toBe('control-1');
  });

  it('keeps unchanged Risk and ControlImplementation edits local while submitting changed fields only', async () => {
    const riskView = render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    const saveRisk = screen.getByRole('button', { name: 'Save risk' });
    await userEvent.click(saveRisk);
    expect(actionMocks.updateRiskAction).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.');
    expect(saveRisk).toHaveFocus();

    await userEvent.clear(screen.getByLabelText('Risk statement'));
    await userEvent.type(screen.getByLabelText('Risk statement'), 'Updated risk statement');
    await userEvent.click(saveRisk);
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledTimes(1));
    expect(actionMocks.updateRiskAction).toHaveBeenLastCalledWith({
      assessmentId: 'assessment/id',
      riskId: 'risk-1',
      values: { riskStatement: 'Updated risk statement' },
    });

    riskView.unmount();
    render(<ControlImplementationEditor assessmentId="assessment/id" implementation={implementation} mode="edit" options={controlEditorOptions} riskId="risk-1" />);
    const saveControl = screen.getByRole('button', { name: 'Save mitigation control' });
    await userEvent.click(saveControl);
    expect(actionMocks.updateControlImplementationAction).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.');
    expect(saveControl).toHaveFocus();

    await userEvent.clear(screen.getByLabelText('Evidence'));
    await userEvent.type(screen.getByLabelText('Evidence'), 'Updated control evidence');
    await userEvent.click(saveControl);
    await waitFor(() => expect(actionMocks.updateControlImplementationAction).toHaveBeenCalledTimes(1));
    expect(actionMocks.updateControlImplementationAction).toHaveBeenLastCalledWith({
      assessmentId: 'assessment/id',
      implementationId: 'implementation-1',
      values: { evidence: 'Updated control evidence' },
    });
  });

  it('offers the Risk Type’s applicable controls first in a searchable Control picker, never a native select (D-28, D-31)', async () => {
    render(<AssessmentEditor {...editorProps} />);
    const region = screen.getByRole('region', { name: 'Mitigation controls for RSK-0042' });
    expect(within(region).queryByText('Reusable control')).not.toBeInTheDocument();
    expect(region.querySelector('select[name="control"]')).toBeNull();

    await userEvent.click(within(region).getByRole('button', { name: 'Add mitigation control' }));
    const pickers = within(region).getAllByRole('combobox', { name: 'Control' });
    const created = pickers.at(-1)!;
    // UI-SPEC §13.1: the new form opens with focus in its Control input.
    await waitFor(() => expect(created).toHaveFocus());
    expect(created).toHaveAccessibleDescription('Search by control number, name or framework. Controls that apply to the Risk Type come first.');

    fireEvent.click(created);
    const group = screen.getByRole('group', { name: 'Applicable to Internet Exposure' });
    expect(within(group).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([
      'AC-1 · Access control',
      'APP-11 · Security of personal information',
    ]);
  });

  it('shows the required control message under the picker, named by the input (UI-SPEC §13.1)', async () => {
    actionMocks.createControlImplementationAction.mockResolvedValueOnce({
      ok: false,
      fieldErrors: { control: ['Choose a control.'] },
      formError: 'Check the assessment details and try again.',
    });
    render(<ControlImplementationEditor assessmentId="assessment/id" mode="create" options={controlEditorOptions} riskId="risk-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Add mitigation control' }));

    const message = await screen.findByText('Choose a control.');
    const input = screen.getByRole('combobox', { name: 'Control' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(message.closest('[id]')!.id);
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Choose a control.'));
  });

  it('says removing a mitigation control keeps the control in the library (UI-SPEC §13.5)', async () => {
    render(<ControlImplementationEditor assessmentId="assessment/id" implementation={implementation} mode="edit" options={controlEditorOptions} riskId="risk-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove mitigation control' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This removes the control from this Risk. The control stays in the library.');
  });

  it('hands the page’s control search to each Control picker', async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => ({ ok: true as const, data: [{ documentId: 'control-9', name: '5.1 · ISO/IEC 27001' }] }));
    render(<AssessmentEditor {...editorProps} searchControls={search} />);
    const region = screen.getByRole('region', { name: 'Mitigation controls for RSK-0042' });
    fireEvent.change(within(region).getByRole('combobox', { name: 'Control' }), { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(search).toHaveBeenCalledWith({ search: '5.1' });
    expect(screen.getByRole('option', { name: '5.1 · ISO/IEC 27001' })).toBeInTheDocument();
  });

  it('reads an existing mitigation control’s choice from its served summary, or Control not found, never an id (D-30, D-36)', () => {
    const view = render(<ControlImplementationEditor assessmentId="assessment/id" implementation={implementation} mode="edit" options={controlEditorOptions} riskId="risk-1" />);
    expect(screen.getByText('Selected control: AC-1 · Access control')).toBeInTheDocument();
    view.unmount();

    render(<ControlImplementationEditor assessmentId="assessment/id" implementation={{ ...implementation, control: 'control-gone', controlSummary: null }} mode="edit" options={controlEditorOptions} riskId="risk-1" />);
    expect(screen.getByText('Selected control: Control not found')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('control-gone');
  });

  it('shows a released Risk through the shared read-only component with h3 groups (D-34, UI-SPEC §15.2)', () => {
    // No control library is loaded: the label comes from the served control summary (D-36).
    render(<AssessmentEditor {...editorProps} assessment={releasedAssessment} riskListItems={[riskListItem]} />);

    for (const group of ['Ratings', 'Ownership and treatment', 'Mitigation control implementations']) {
      expect(screen.getByRole('heading', { level: 3, name: group })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument();
    expect(definitionValue('Information system impacted')).toHaveTextContent(/^Customer portal$/);
    expect(definitionValue('Risk owner')).toHaveTextContent(/^Bob Doe$/);
    expect(definitionValue('Treatment status').querySelector('[data-slot="badge"]')).toHaveTextContent('In Progress');
    expect(definitionValue('Target date')).toHaveTextContent(/^30 October 2026$/);
    expect(definitionValue('Control')).toHaveTextContent(/^AC-1 · Access control$/);
    expect(screen.queryByText('Reusable control')).not.toBeInTheDocument();
    for (const internalId of ['control-1', 'system-1', 'asset-1', 'bob-id']) {
      expect(document.body.textContent).not.toContain(internalId);
    }
  });

  it('names a released Risk’s owners, system and asset from the loaded labels when no list item is served', () => {
    render(<AssessmentEditor {...editorProps} assessment={releasedAssessment} />);

    expect(definitionValue('Information system impacted')).toHaveTextContent(/^Customer portal$/);
    expect(definitionValue('Information asset impacted')).toHaveTextContent(/^Customer data$/);
    expect(definitionValue('Risk owner')).toHaveTextContent(/^Bob Doe$/);
    expect(definitionValue('Treatment owner')).toHaveTextContent(/^Bob Doe$/);
    expect(definitionValue('Control')).toHaveTextContent(/^AC-1 · Access control$/);
    expect(document.body.textContent).not.toContain('bob-id');
  });

  it('offers mutation only to an unreleased draft or in-review assessment, from the shared zod-free predicate', () => {
    expect(canMutateAssessment(assessment)).toBe(true);
    expect(canMutateAssessment({ ...assessment, assessmentStatus: 'draft' })).toBe(true);
    expect(canMutateAssessment(releasedAssessment)).toBe(false);
    expect(canMutateAssessment({ ...assessment, assessmentStatus: 'closed' })).toBe(false);
    expect(canMutateAssessment({ ...assessment, approvalDate: '2026-08-30T02:00:00.000Z' })).toBe(false);

    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/review/assessments/[documentId]/page.tsx'), 'utf8');
    expect(route).toContain('canMutateAssessment');
    expect(route).toContain('listAssessmentRisks');
    expect(route).toContain('riskListItems=');
    // D-28: the page no longer loads the whole control library.
    expect(route).not.toContain('listControls');
    expect(route).not.toContain('controls=');
  });

  it('renders deliberate safe states and never mutates released or partial release facts', () => {
    const { rerender } = render(<AssessmentEditor state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('permission');
    rerender(<AssessmentEditor state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');
    rerender(<AssessmentEditor state="empty" />);
    expect(screen.getByText('No assessment details are available')).toBeInTheDocument();

    rerender(<AssessmentEditor {...editorProps} assessment={{ ...assessment, assessmentStatus: 'approved', assessmentDate: '2026-08-30T02:00:00.000Z', approvalDate: '2026-08-30T02:00:00.000Z', approvedBy: analyst }} />);
    expect(screen.queryByRole('button', { name: /save|add|remove|release/i })).not.toBeInTheDocument();

    rerender(<AssessmentEditor {...editorProps} assessment={{ ...assessment, approvalDate: '2026-08-30T02:00:00.000Z' }} />);
    expect(screen.queryByRole('button', { name: /save|add|remove|release/i })).not.toBeInTheDocument();
  });

  it('shows a concrete skeleton before the deferred detail read resolves and a synchronous route shell', async () => {
    const result = deferred<typeof editorProps>();
    await act(async () => { render(<Suspense fallback={<AssessmentEditorSkeleton />}><DeferredView promise={result.promise}>{(props) => <AssessmentEditor {...props} />}</DeferredView></Suspense>); });
    expect(screen.getByRole('status', { name: 'Loading risk assessment editor' })).toBeInTheDocument();

    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/review/assessments/[documentId]/page.tsx'), 'utf8');
    expect(route).toContain('<Suspense fallback={<AssessmentEditorSkeleton />}>');
    expect(route).toContain('getAnalystAssessment');
    expect(route).toContain('searchActiveUsersAction');
    expect(route).toContain('searchOwners={searchActiveUsersAction}');
    expect(route).toContain('searchControls={searchControlsAction}');
    expect(route).toContain('notFound()');
    expect(route).toMatch(/export default function/);
    expect(route).not.toMatch(/export default async function/);
  });

  it('reads the request and the served Risk list for the system and asset pickers, never an inventory page (D-28, D-30)', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/review/assessments/[documentId]/page.tsx'), 'utf8');
    expect(route).not.toMatch(/listInformationSystems|listInformationAssets/);
    expect(route).toContain('getRequest(');
    expect(route).toContain('listAssessmentRisks(');
    expect(route).toContain('requestSystems=');
    expect(route).toContain('requestAssets=');
    expect(route).toContain('relationLabels=');
    expect(route).toContain('searchSystems={searchInformationSystemsAction}');
    expect(route).toContain('searchAssets={searchInformationAssetsAction}');
  });
});

describe('the control owner and save confirmations (D-28, D-33, UI-SPEC §13.2 and §13.4)', () => {
  // 01:00:05 UTC is 11:00 am in Sydney, so each confirmation reads a known local time (D-19).
  const savedAt = new Date('2026-09-28T01:00:05.000Z');
  const inSydney = (node: ReactNode) => <TimeZoneProvider zone="Australia/Sydney">{node}</TimeZoneProvider>;
  /** The action row a Save button sits in, where its confirmation shows (X-1). */
  const actionRow = (button: HTMLElement) => {
    const row = button.closest<HTMLElement>('[data-slot="form-actions"]');
    expect(row, 'the Save button sits in a form action row').not.toBeNull();
    return row!;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(savedAt);
    searchOwners.mockResolvedValue({ ok: true, data: [zoe] });
    actionMocks.updateRiskAction.mockResolvedValue({ ok: true, data: risk });
    actionMocks.createRiskAction.mockResolvedValue({ ok: true, data: risk });
    actionMocks.updateControlImplementationAction.mockResolvedValue({ ok: true, data: implementation });
    actionMocks.createControlImplementationAction.mockResolvedValue({ ok: true, data: implementation });
    actionMocks.saveAssessmentAction.mockResolvedValue({ ok: true, data: assessment });
    // The refreshed assessment still holds its Risk, so a save's refresh keeps the Risk card on the page.
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [risk] } });
  });
  afterEach(() => vi.useRealTimers());

  it('seeds the control owner from the served owner and chooses any active user by search (D-28, UAT-034)', async () => {
    render(<ControlImplementationEditor assessmentId="assessment/id" implementation={implementation} mode="edit" options={controlEditorOptions} riskId="risk-1" />);
    const owner = screen.getByRole('combobox', { name: 'Control owner' });
    expect(owner.tagName).toBe('INPUT');
    expect(screen.getByText('Selected owner: Bob Doe')).toBeInTheDocument();
    expect(document.querySelector('select[name="controlOwner"]')).toBeNull();

    await searchAfterPause(owner, 'Zo');
    await userEvent.click(screen.getByRole('option', { name: 'Zoe Owner' }));
    expect(searchOwners).toHaveBeenLastCalledWith({ search: 'Zo' });
    expect(screen.getByText('Selected owner: Zoe Owner')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.updateControlImplementationAction).toHaveBeenCalledWith({
      assessmentId: 'assessment/id', implementationId: 'implementation-1', values: { controlOwner: 'zoe-id' },
    }));
  });

  it('hands the page’s owner search to every Control owner picker, never a list of names already on the Risk', async () => {
    render(<AssessmentEditor {...editorProps} />);
    const region = screen.getByRole('region', { name: 'Mitigation controls for RSK-0042' });
    const owner = within(region).getByRole('combobox', { name: 'Control owner' });
    expect(owner.tagName).toBe('INPUT');
    await searchAfterPause(owner, 'Zo');
    expect(screen.getByRole('option', { name: 'Zoe Owner' })).toBeInTheDocument();
    expect(searchOwners).toHaveBeenCalledWith({ search: 'Zo' });
  });

  it('confirms a saved Risk beside Save risk with the local time, and clears it on the next change', async () => {
    render(inSydney(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />));
    const save = screen.getByRole('button', { name: 'Save risk' });
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();

    await userEvent.type(screen.getByLabelText('Comments'), ' Reviewed.');
    await userEvent.click(save);
    const status = within(actionRow(save)).getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent(/^Risk saved at 11:00 am$/));
    expect(status.querySelector('svg')).toHaveClass('text-success');
    expect(status.querySelector('time')).toHaveAttribute('dateTime', savedAt.toISOString());

    await userEvent.type(screen.getByLabelText('Comments'), ' Again.');
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();
  });

  it('says No changes to save. in the same region, with no icon', async () => {
    render(inSydney(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />));
    const save = screen.getByRole('button', { name: 'Save risk' });
    await userEvent.click(save);
    const status = within(actionRow(save)).getByRole('status');
    expect(status).toHaveTextContent(/^No changes to save\.$/);
    expect(status.querySelector('svg')).toBeNull();
    expect(actionMocks.updateRiskAction).not.toHaveBeenCalled();
  });

  it('keeps the Risk not saved alert and shows no confirmation when a save fails', async () => {
    render(inSydney(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />));
    const save = screen.getByRole('button', { name: 'Save risk' });
    await userEvent.type(screen.getByLabelText('Comments'), ' Reviewed.');
    await userEvent.click(save);
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent('Risk saved at'));

    // A real change: the saved comment is now the baseline, so an unchanged save would send nothing (CR-201).
    actionMocks.updateRiskAction.mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable. Please try again later.' });
    await userEvent.type(screen.getByLabelText('Comments'), ' Again.');
    await userEvent.click(save);
    expect(await screen.findByText('Risk not saved')).toBeInTheDocument();
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();
  });

  it('confirms a saved mitigation control beside its Save button, clears it on the next change, and clears it on failure', async () => {
    render(inSydney(<ControlImplementationEditor assessmentId="assessment/id" implementation={implementation} mode="edit" options={controlEditorOptions} riskId="risk-1" />));
    const save = screen.getByRole('button', { name: 'Save mitigation control' });
    await userEvent.type(screen.getByLabelText('Evidence'), ' Verified.');
    await userEvent.click(save);
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent(/^Mitigation control saved at 11:00 am$/));

    await userEvent.type(screen.getByLabelText('Evidence'), ' Again.');
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();

    actionMocks.updateControlImplementationAction.mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable. Please try again later.' });
    await userEvent.click(save);
    expect(await screen.findByText('Mitigation control not changed')).toBeInTheDocument();
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();
  });

  it('confirms saved assessment details beside Save assessment, and keeps Assessment not saved on failure', async () => {
    render(inSydney(<AssessmentEditor {...editorProps} />));
    const save = screen.getByRole('button', { name: 'Save assessment' });
    await userEvent.type(screen.getByLabelText('Summary'), ' Reviewed.');
    await userEvent.click(save);
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent(/^Assessment details saved at 11:00 am$/));

    await userEvent.type(screen.getByLabelText('Summary'), ' Again.');
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();

    actionMocks.saveAssessmentAction.mockResolvedValueOnce({ ok: false, formError: 'Check the assessment details and try again.' });
    await userEvent.click(save);
    expect(await screen.findByText('Assessment not saved')).toBeInTheDocument();
    expect(within(actionRow(save)).getByRole('status')).toBeEmptyDOMElement();
  });

  it('sends nothing for unchanged assessment details and says No changes to save. in the same region (UI-SPEC §13.4)', async () => {
    render(inSydney(<AssessmentEditor {...editorProps} />));
    const save = screen.getByRole('button', { name: 'Save assessment' });
    await userEvent.click(save);
    const status = within(actionRow(save)).getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent(/^No changes to save\.$/));
    expect(status.querySelector('svg')).toBeNull();
    expect(actionMocks.saveAssessmentAction).not.toHaveBeenCalled();
    expect(actionMocks.refreshAnalystAssessmentAction).not.toHaveBeenCalled();
    expect(save).toHaveFocus();

    // A change undone before saving is still no change; the next real change saves and confirms.
    await userEvent.type(screen.getByLabelText('Summary'), ' X');
    await userEvent.type(screen.getByLabelText('Summary'), '{Backspace}{Backspace}');
    await userEvent.click(save);
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent(/^No changes to save\.$/));
    expect(actionMocks.saveAssessmentAction).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Summary'), ' Reviewed.');
    await userEvent.click(save);
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent(/^Assessment details saved at 11:00 am$/));
    expect(actionMocks.saveAssessmentAction).toHaveBeenCalledTimes(1);
  });

  it('reads empty stored details as unchanged, so an untouched form with blank choices and no date sends nothing', async () => {
    const blank = { ...assessment, summary: null, overallRating: null, overallControlEffectiveness: null, recommendationsSummary: null, overallRiskRationale: null, nextReviewDate: null };
    render(inSydney(<AssessmentEditor {...editorProps} assessment={blank} />));
    const save = screen.getByRole('button', { name: 'Save assessment' });
    await userEvent.click(save);
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent(/^No changes to save\.$/));
    expect(actionMocks.saveAssessmentAction).not.toHaveBeenCalled();
  });

  it('still saves an unchanged drafted assessment, because that save records the analyst’s review (D-13)', async () => {
    render(inSydney(<AssessmentEditor {...editorProps} assessment={{ ...assessment, assessmentStatus: 'draft' }} />));
    const save = screen.getByRole('button', { name: 'Save assessment' });
    await userEvent.click(save);
    await waitFor(() => expect(actionMocks.saveAssessmentAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(actionRow(save)).getByRole('status')).toHaveTextContent(/^Assessment details saved at 11:00 am$/));
  });

  it('confirms an added Risk on its new card and returns focus to Add Risk (UI-SPEC §13.4)', async () => {
    const createdRisk = { ...risk, documentId: 'risk-created', riskNumber: 'RSK-0043' };
    actionMocks.createRiskAction.mockResolvedValue({ ok: true, data: createdRisk });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [risk, createdRisk] } });
    render(inSydney(<AssessmentEditor {...editorProps} />));

    await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    const create = screen.getByRole('button', { name: 'Add risk' });
    fireEvent.change(within(create.closest('form')!).getByLabelText('Risk statement'), { target: { value: 'New contextual Risk' } });
    await userEvent.click(create);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Risk' })).toHaveFocus());
    const card = await waitFor(() => {
      const element = document.getElementById('risk-risk-created');
      expect(element).not.toBeNull();
      return element!;
    });
    await waitFor(() => expect(within(card).getByRole('status')).toHaveTextContent(/^Risk added at 11:00 am$/));
    // The Risk that was already there shows no confirmation in its own save status (WR-405).
    const existingSave = within(document.getElementById('risk-risk-1')!).getByRole('button', { name: 'Save risk' });
    expect(within(actionRow(existingSave)).getByRole('status')).toBeEmptyDOMElement();
  });

  it('confirms an added mitigation control on its form and returns focus to that Risk’s Add mitigation control', async () => {
    const created: ControlImplementation = { ...implementation, documentId: 'implementation-2', control: 'control-2', controlSummary: applicableApp11 };
    actionMocks.createControlImplementationAction.mockResolvedValue({ ok: true, data: created });
    render(inSydney(<AssessmentEditor {...editorProps} />));
    const region = screen.getByRole('region', { name: 'Mitigation controls for RSK-0042' });

    await userEvent.click(within(region).getByRole('button', { name: 'Add mitigation control' }));
    fireEvent.click(within(region).getAllByRole('combobox', { name: 'Control' }).at(-1)!);
    fireEvent.click(screen.getByRole('option', { name: 'APP-11 · Security of personal information' }));
    await userEvent.click(within(region).getByRole('button', { name: 'Add mitigation control' }));

    // The create form gives way to the new control's own edit form before focus is checked: the create form's
    // submit button shares the add control's name.
    await waitFor(() => expect(within(region).getAllByRole('button', { name: 'Save mitigation control' })).toHaveLength(2));
    expect(within(region).getByRole('button', { name: 'Add mitigation control' })).toHaveFocus();
    const createdForm = within(region).getByText('Selected control: APP-11 · Security of personal information').closest('form')!;
    expect(within(createdForm).getByRole('button', { name: 'Save mitigation control' })).toBeInTheDocument();
    await waitFor(() => expect(within(createdForm).getByRole('status')).toHaveTextContent(/^Mitigation control added at 11:00 am$/));
    const existingForm = within(region).getByText('Selected control: AC-1 · Access control').closest('form')!;
    expect(within(existingForm).getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('readiness-gated release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** A Risk with nothing recorded yet, so its readiness rows are outstanding. */
  const incompleteRisk = {
    ...risk,
    riskStatement: null,
    inherentLikelihood: null,
    highestInherentConsequence: null,
    inherentRating: null,
    residualLikelihood: null,
    highestResidualConsequence: null,
    residualRating: null,
    riskOwner: null,
    treatmentAction: null,
    targetDate: null,
  };
  const mixedRequirements = [
    { scope: 'assessment' as const, key: 'reviewedBy', label: 'Reviewer', state: 'outstanding' as const },
    { scope: 'assessment' as const, key: 'summary', label: 'Summary', state: 'met' as const },
    { scope: 'risk' as const, key: 'riskStatement', label: 'Risk statement', state: 'outstanding' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
    { scope: 'risk' as const, key: 'riskOwner', label: 'Risk owner', state: 'met' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
    { scope: 'risk' as const, key: 'targetDate', label: 'Target date', state: 'outstanding' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
  ];
  const renderMixed = () => render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, releaseReadiness: { ready: false, requirements: mixedRequirements } }} controlImplementations={{ 'risk-1': [] }} risks={[incompleteRisk]} />);
  const readinessCard = () => screen.getByRole('heading', { level: 2, name: 'Release readiness' }).closest<HTMLElement>('[data-slot="card"]')!;
  const controlName = (control: HTMLElement) => control.getAttribute('aria-label') ?? control.textContent ?? '';

  it('lists outstanding assessment items first, then one row per Risk saying what is missing (D-35, UI-SPEC §14.1)', () => {
    renderMixed();

    expect(within(readinessCard()).getByText('Every requirement must be met before release. We check them all again when you release.')).toBeInTheDocument();
    expect(screen.getByText('2 of 5 release requirements met')).toBeInTheDocument();
    const outstanding = screen.getByRole('list', { name: 'Release requirements' });
    expect(within(outstanding).getAllByRole('link').map(controlName)).toEqual(['Reviewer', 'RSK-0042: 2 outstanding']);
    expect(within(outstanding).getByRole('link', { name: 'Reviewer' })).toHaveAttribute('href', '#assessment-details');
    expect(within(outstanding).getAllByText('Outstanding')).toHaveLength(1);

    const riskRow = within(outstanding).getByRole('link', { name: 'RSK-0042: 2 outstanding' });
    expect(riskRow).toHaveAttribute('href', '#risk-risk-1');
    expect(riskRow).toHaveTextContent('2 outstanding');
    expect(riskRow).toHaveAccessibleDescription('Missing: Risk statement and Target date');
    expect(within(outstanding).getByText('Missing: Risk statement and Target date')).toBeInTheDocument();
    // One row per Risk, never one per requirement.
    expect(within(outstanding).queryByText(/Risk RSK-0042 — /)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release assessment' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /approve|submit for approval/i })).not.toBeInTheDocument();
  });

  /*
   * Label in Name (WCAG 2.5.3; 10-23 walkthrough fix 8, found by the open-picker axe scan): the row's visible
   * words are the words of its name, `{risk number}: {n} outstanding`. The number and the count were adjacent
   * elements with no space between them, so the visible text ran together as `RSK-00422 outstanding`.
   */
  it('keeps a Risk row’s visible words the words of its name (Label in Name)', () => {
    renderMixed();

    const riskRow = within(screen.getByRole('list', { name: 'Release requirements' })).getByRole('link', { name: 'RSK-0042: 2 outstanding' });
    expect(riskRow.textContent).toBe('RSK-0042 2 outstanding');
  });

  it('shows met items only when the analyst asks, and hides them again (D-35)', async () => {
    const user = userEvent.setup();
    renderMixed();

    expect(screen.queryByRole('list', { name: 'Met release requirements' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show met requirements (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('data-print', 'hidden');
    const controlled = document.getElementById(toggle.getAttribute('aria-controls')!);
    expect(controlled).toBeInTheDocument();

    await user.click(toggle);
    const met = screen.getByRole('list', { name: 'Met release requirements' });
    expect(met).toBe(controlled);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Hide met requirements');
    expect(within(met).getByRole('link', { name: 'Summary' })).toHaveAttribute('href', '#assessment-details');
    expect(within(met).getByText('Met')).toBeInTheDocument();
    expect(within(met).getByRole('link', { name: 'RSK-0042: 1 met' })).toHaveAttribute('href', '#risk-risk-1');

    await user.click(toggle);
    expect(screen.queryByRole('list', { name: 'Met release requirements' })).not.toBeInTheDocument();
    expect(toggle).toHaveAccessibleName('Show met requirements (2)');
  });

  it('drops the outstanding list when all are met, and the met toggle when nothing is met', () => {
    const view = render(<AssessmentEditor {...editorProps} />);
    expect(screen.getByText('All release requirements are met')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Release requirements' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show met requirements (2)' })).toBeInTheDocument();
    view.unmount();

    const allOutstanding = mixedRequirements.map((item) => ({ ...item, state: 'outstanding' as const }));
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, releaseReadiness: { ready: false, requirements: allOutstanding } }} risks={[incompleteRisk]} />);
    expect(screen.getByText('0 of 5 release requirements met')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /met requirements/ })).not.toBeInTheDocument();
  });

  it('makes every readiness destination focusable, so following a link moves focus there (UI-D27)', () => {
    const requirements = [
      ...mixedRequirements,
      { scope: 'assessment' as const, key: 'risks', label: 'At least one Risk', state: 'outstanding' as const },
    ];
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, releaseReadiness: { ready: false, requirements } }} controlImplementations={{ 'risk-1': [] }} risks={[incompleteRisk]} />);

    const hrefs = within(screen.getByRole('list', { name: 'Release requirements' })).getAllByRole('link').map((link) => link.getAttribute('href')!);
    expect(new Set(hrefs)).toEqual(new Set(['#assessment-details', '#identified-risks', '#risk-risk-1']));
    for (const href of hrefs) {
      const destination = document.getElementById(decodeURIComponent(href.slice(1)))!;
      expect(destination, href).toHaveAttribute('tabindex', '-1');
      destination.focus();
      expect(destination, href).toHaveFocus();
    }
  });

  it('names no readiness control with save, add, edit, remove or release but Release assessment (UI-D19)', async () => {
    const user = userEvent.setup();
    renderMixed();
    await user.click(screen.getByRole('button', { name: 'Show met requirements (2)' }));

    const card = readinessCard();
    const names = [...within(card).getAllByRole('button'), ...within(card).getAllByRole('link')].map(controlName);
    expect(names.length).toBeGreaterThan(4);
    expect(names.filter((name) => /save|add|edit|remove|release/i.test(name))).toEqual(['Release assessment']);
  });

  it('keeps a ten-Risk all-outstanding assessment to fifteen readiness links (UAT-011)', () => {
    const tenRisks = Array.from({ length: 10 }, (_, index) => ['riskStatement', 'riskOwner', 'targetDate', 'treatmentAction'].map((key) => ({
      scope: 'risk' as const, key, label: key, state: 'outstanding' as const, riskNumber: `RSK-00${index + 10}`, destination: `risk-r${index}`,
    }))).flat();
    const fiveItems = ['summary', 'overallRating', 'overallControlEffectiveness', 'reviewedBy', 'risks']
      .map((key) => ({ scope: 'assessment' as const, key, label: key, state: 'outstanding' as const }));
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, releaseReadiness: { ready: false, requirements: [...fiveItems, ...tenRisks] } }} />);

    expect(within(screen.getByRole('list', { name: 'Release requirements' })).getAllByRole('link')).toHaveLength(15);
  });

  /*
   * Walk D13(a) (12-UI-SPEC §10.2): Strapi still projects release readiness for a record that can no longer change, with
   * its assessment status outstanding because it is no longer in review. A released or closed record presents no
   * release requirement at all: release is behind it, and the alert above says why the record is read-only.
   */
  it('presents no release requirement once the assessment can no longer change', () => {
    const servedAfterRelease = {
      ready: false,
      requirements: [
        { scope: 'assessment' as const, key: 'assessmentStatus', label: 'Assessment status', state: 'outstanding' as const },
        { scope: 'assessment' as const, key: 'summary', label: 'Assessment summary', state: 'met' as const },
        { scope: 'risk' as const, key: 'riskStatement', label: 'Risk statement', state: 'met' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
      ],
    };
    for (const [status, notice] of [['approved', 'Assessment released'], ['closed', 'Assessment is read-only']] as const) {
      const view = render(<AssessmentEditor {...editorProps} assessment={{ ...releasedAssessment, assessmentStatus: status, releaseReadiness: servedAfterRelease }} riskListItems={[riskListItem]} />);
      expect(screen.getByText(notice), status).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Release readiness' }), status).not.toBeInTheDocument();
      expect(screen.queryByText(/release requirements (are )?met/), status).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: /release requirements/i }), status).not.toBeInTheDocument();
      expect(screen.queryByText('Outstanding'), status).not.toBeInTheDocument();
      expect(screen.queryByText('Assessment status'), status).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('offers release only for the in-review analyst presentation', () => {
    const view = render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, assessmentStatus: 'draft' }} />);
    expect(screen.queryByRole('button', { name: 'Release assessment' })).not.toBeInTheDocument();
    view.unmount();
    render(<AssessmentEditor {...editorProps} />);
    expect(screen.getByRole('button', { name: 'Release assessment' })).toBeEnabled();
  });

  it('states the withdrawn review in words for a drafted assessment that still has a reviewer', () => {
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, assessmentStatus: 'draft', reviewedBy: analyst }} />);

    const notice = screen.getByText('Completed review withdrawn').closest('[data-slot="alert"]');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(/superseded the review completed by Bob Doe/);
    expect(notice).toHaveTextContent(/returned to drafted/);
    expect(notice).toHaveTextContent(/Save the assessment again to record a fresh review/);
    // Meaning is carried by text and an icon, never by colour alone.
    expect(notice?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // No affordance may release or re-review without a real save.
    expect(screen.queryByRole('button', { name: 'Release assessment' })).not.toBeInTheDocument();
    // Phase 16's `Withdraw risk {n}` withdraws a Risk, not the review, so only a control naming the review counts here.
    expect(screen.queryByRole('button', { name: /re-?review|record review|withdraw (the )?(completed )?review/i })).not.toBeInTheDocument();
  });

  it('shows no withdrawn-review notice for a drafted assessment that was never reviewed', () => {
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, assessmentStatus: 'draft', reviewedBy: null }} />);

    expect(screen.queryByText('Completed review withdrawn')).not.toBeInTheDocument();
    expect(screen.queryByText(/superseded/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release assessment' })).not.toBeInTheDocument();
  });

  it('preserves metadata values and field errors after a rejected save', async () => {
    actionMocks.saveAssessmentAction.mockResolvedValue({
      ok: false,
      fieldErrors: { summary: ['Summary needs more detail.'] },
      formError: 'Check the assessment details and try again.',
    });
    render(<AssessmentEditor {...editorProps} />);
    await userEvent.clear(screen.getByLabelText('Summary'));
    await userEvent.type(screen.getByLabelText('Summary'), 'Retained analyst draft');
    await userEvent.click(screen.getByRole('button', { name: 'Save assessment' }));

    expect(await screen.findByText('Summary needs more detail.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Summary/ })).toHaveValue('Retained analyst draft');
  });

  it('uses refreshed server readiness after mutations for both completion and regression', async () => {
    const user = userEvent.setup();
    actionMocks.saveAssessmentAction.mockResolvedValue({ ok: true, data: assessment });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValueOnce({ ok: true, data: { ...assessment, releaseReadiness: { ready: false, requirements: [{ scope: 'risk', key: 'controlImplementations', label: 'At least one mitigation control', state: 'outstanding', riskNumber: 'RSK-0042', destination: 'risk-risk-1' }] } } });
    render(<AssessmentEditor {...editorProps} />);
    await user.clear(screen.getByLabelText('Summary'));
    await user.type(screen.getByLabelText('Summary'), 'Changed on the server');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));
    expect(await screen.findByRole('link', { name: 'RSK-0042: 1 outstanding' })).toHaveAccessibleDescription('Missing: At least one mitigation control');
    expect(screen.getByRole('button', { name: 'Release assessment' })).toBeDisabled();

    actionMocks.refreshAnalystAssessmentAction.mockResolvedValueOnce({ ok: true, data: assessment });
    await user.clear(screen.getByLabelText('Summary'));
    await user.type(screen.getByLabelText('Summary'), 'Now complete on the server');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));
    await waitFor(() => expect(screen.getByText('All release requirements are met')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Release assessment' })).toBeEnabled();
    expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledTimes(2);
  });

  it('locks duplicate confirmation, retains normalized failure, and permits a focused retry', async () => {
    const pending = deferred<never>();
    actionMocks.releaseAssessmentAction.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ok: false, formError: 'This assessment changed or is not ready for release. Reload and try again.' });
    render(<AssessmentEditor {...editorProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Release assessment' }));
    const confirm = screen.getByRole('button', { name: 'Confirm release' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(actionMocks.releaseAssessmentAction).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();

    await act(async () => pending.resolve(undefined as never));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Confirm release' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not ready for release');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm release' })).toHaveFocus();
  });

  it('says plainly what release means before the analyst confirms it (D-38, UI-SPEC §17.1)', async () => {
    render(<AssessmentEditor {...editorProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Release assessment' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Release this risk assessment?' });
    expect(dialog).toHaveTextContent('Release can’t be undone. The Requestor will receive this assessment read-only, and no one can change it afterwards.');
    expect(dialog).not.toHaveTextContent(/mutation control|irreversible/i);
    expect(within(dialog).getByRole('button', { name: 'Confirm release' })).toBeInTheDocument();
  });

  it('describes the released, closed and otherwise read-only assessment without internal terms (D-38)', () => {
    const view = render(<AssessmentEditor {...editorProps} assessment={releasedAssessment} />);
    let notice = screen.getByText('Assessment released').closest<HTMLElement>('[data-slot="alert"]')!;
    expect(notice).toHaveTextContent('The Requestor can now read this assessment. It can no longer be changed.');
    view.unmount();

    const closed = render(<AssessmentEditor {...editorProps} assessment={{ ...releasedAssessment, assessmentStatus: 'closed' }} />);
    notice = screen.getByText('Assessment is read-only').closest<HTMLElement>('[data-slot="alert"]')!;
    expect(notice).toHaveTextContent('This assessment is closed, so it can no longer be changed.');
    closed.unmount();

    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, approvalDate: '2026-08-30T02:00:00.000Z' }} />);
    notice = screen.getByText('Assessment is read-only').closest<HTMLElement>('[data-slot="alert"]')!;
    expect(notice).toHaveTextContent('This assessment can no longer be changed in its current state.');
    expect(document.body).not.toHaveTextContent(/release fact|mutation control|Strapi/i);
  });

  it('describes the assessment details and Identified Risks sections in plain words (D-38, UI-SPEC §17.1)', () => {
    render(<AssessmentEditor {...editorProps} />);

    expect(screen.getByRole('region', { name: 'Assessment details' })).toHaveAccessibleDescription('Record the assessment’s summary, overall rating and recommendations.');
    expect(screen.getByRole('region', { name: 'Identified Risks' })).toHaveAccessibleDescription('Risks identified in this assessment, with their ratings, treatment and mitigation controls.');
    expect(document.body).not.toHaveTextContent(/contextual|non-editable|server-owned|release facts/i);
  });

  it('announces successful release and removes every mutation affordance', async () => {
    actionMocks.releaseAssessmentAction.mockResolvedValue({
      ok: true,
      data: { ...assessment, assessmentStatus: 'approved', assessmentDate: '2026-08-30T02:00:00.000Z', approvalDate: '2026-08-30T02:00:00.000Z', approvedBy: analyst },
    });
    render(<AssessmentEditor {...editorProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Release assessment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm release' }));

    await waitFor(() => expect(actionMocks.releaseAssessmentAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Assessment released')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save|add|remove|release/i })).not.toBeInTheDocument();
  });
});

/*
 * CR-201: each form compares a save with the values last saved, not the values the page loaded. The server's
 * answer to a save (or the refreshed assessment) becomes the next baseline, so a field set back to its page-load
 * value is a change and is sent. A failed refresh after a save leaves no stale baseline and hides no new Risk.
 */
describe('each save compares with the latest saved values (CR-201)', () => {
  /** The Risk update as Strapi serves it: the Risk summary, not the whole Risk (riskSchema). */
  const servedRiskSummary = { documentId: 'risk-1', riskNumber: 'RSK-0042', riskStatement: risk.riskStatement, inherentRating: risk.inherentRating, residualRating: risk.residualRating };
  const refreshFailed = { ok: false, formError: 'The assessment service is unavailable. Please try again later.' };

  beforeEach(() => {
    vi.clearAllMocks();
    searchOwners.mockResolvedValue({ ok: true, data: [analyst] });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [risk] } });
  });

  it('sends a mitigation control status set back to its page-load value (Planned, Implemented, Planned)', async () => {
    let stored: ControlImplementation = { ...implementation, controlStatus: 'Planned' };
    actionMocks.updateControlImplementationAction.mockImplementation(async ({ values }: { values: Partial<ControlImplementation> }) => {
      stored = { ...stored, ...values };
      return { ok: true, data: stored };
    });
    render(<AssessmentEditor {...editorProps} controlImplementations={{ 'risk-1': [stored] }} />);
    const region = screen.getByRole('region', { name: 'Mitigation controls for RSK-0042' });
    const save = within(region).getByRole('button', { name: 'Save mitigation control' });
    const form = save.closest('form')!;

    await userEvent.selectOptions(within(form).getByLabelText('Control status'), 'Implemented');
    await userEvent.click(save);
    await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent(/^Mitigation control saved at/));
    expect(actionMocks.updateControlImplementationAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment/id', implementationId: 'implementation-1', values: { controlStatus: 'Implemented' } });

    await userEvent.selectOptions(within(form).getByLabelText('Control status'), 'Planned');
    await userEvent.click(save);
    await waitFor(() => expect(actionMocks.updateControlImplementationAction).toHaveBeenCalledTimes(2));
    expect(actionMocks.updateControlImplementationAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment/id', implementationId: 'implementation-1', values: { controlStatus: 'Planned' } });
    await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent(/^Mitigation control saved at/));
    expect(stored.controlStatus).toBe('Planned');

    // The unchanged-save rule still holds, against the value just saved.
    await userEvent.click(save);
    await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent(/^No changes to save\.$/));
    expect(actionMocks.updateControlImplementationAction).toHaveBeenCalledTimes(2);
  });

  it('sends a Risk field set back to its page-load value when the refresh after the first save fails', async () => {
    actionMocks.updateRiskAction.mockResolvedValue({ ok: true, data: servedRiskSummary });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue(refreshFailed);
    render(<AssessmentEditor {...editorProps} />);
    const card = document.getElementById('risk-risk-1')!;
    const comments = within(card).getByLabelText('Comments');
    const save = within(card).getByRole('button', { name: 'Save risk' });

    await userEvent.type(comments, ' Again.');
    await userEvent.click(save);
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledTimes(1));
    expect(actionMocks.updateRiskAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { comments: 'Reviewed with the owner. Again.' } });
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalled());

    await userEvent.clear(comments);
    await userEvent.type(comments, 'Reviewed with the owner.');
    await userEvent.click(save);
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledTimes(2));
    expect(actionMocks.updateRiskAction).toHaveBeenLastCalledWith({ assessmentId: 'assessment/id', riskId: 'risk-1', values: { comments: 'Reviewed with the owner.' } });
  });

  it('sends assessment details set back to their page-load value when the refresh after the first save fails', async () => {
    actionMocks.saveAssessmentAction.mockImplementation(async ({ values }: { values: { summary?: string } }) => ({ ok: true, data: { ...assessment, summary: values.summary ?? assessment.summary } }));
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue(refreshFailed);
    render(<AssessmentEditor {...editorProps} />);
    const summary = screen.getByLabelText('Summary');
    const save = screen.getByRole('button', { name: 'Save assessment' });

    await userEvent.type(summary, ' Updated.');
    await userEvent.click(save);
    await waitFor(() => expect(actionMocks.saveAssessmentAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalled());

    await userEvent.clear(summary);
    await userEvent.type(summary, 'Customer portal assessment.');
    await userEvent.click(save);
    await waitFor(() => expect(actionMocks.saveAssessmentAction).toHaveBeenCalledTimes(2));
    expect(actionMocks.saveAssessmentAction.mock.lastCall?.[0]).toMatchObject({ values: { summary: 'Customer portal assessment.' } });
  });

  it('shows a newly added Risk when the refresh after the create fails', async () => {
    actionMocks.createRiskAction.mockResolvedValue({ ok: true, data: { documentId: 'risk-created', riskNumber: 'RSK-0043', riskStatement: 'New contextual Risk', inherentRating: null, residualRating: null } });
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue(refreshFailed);
    render(<AssessmentEditor {...editorProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    const create = screen.getByRole('button', { name: 'Add risk' });
    fireEvent.change(within(create.closest('form')!).getByLabelText('Risk statement'), { target: { value: 'New contextual Risk' } });
    await userEvent.click(create);

    const card = await waitFor(() => {
      const element = document.getElementById('risk-risk-created');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(within(card).getByText('RSK-0043')).toBeInTheDocument();
  });

  it('names a control re-pointed in this session in the read-only view after release', async () => {
    const repointed: ControlImplementation = { ...implementation, control: 'control-2', controlSummary: applicableApp11 };
    actionMocks.updateControlImplementationAction.mockResolvedValue({ ok: true, data: repointed });
    actionMocks.releaseAssessmentAction.mockResolvedValue({
      ok: true,
      data: { ...assessment, assessmentStatus: 'approved', assessmentDate: '2026-08-30T02:00:00.000Z', approvalDate: '2026-08-30T02:00:00.000Z', approvedBy: analyst },
    });
    render(<AssessmentEditor {...editorProps} />);
    const region = screen.getByRole('region', { name: 'Mitigation controls for RSK-0042' });

    fireEvent.click(within(region).getByRole('combobox', { name: 'Control' }));
    fireEvent.click(screen.getByRole('option', { name: 'APP-11 · Security of personal information' }));
    await userEvent.click(within(region).getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.updateControlImplementationAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'Release assessment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm release' }));
    expect(await screen.findByText('Assessment released')).toBeInTheDocument();
    expect(screen.getByText('APP-11 · Security of personal information')).toBeInTheDocument();
    expect(screen.queryByText('AC-1 · Access control')).not.toBeInTheDocument();
  });
});

/* IN-206: the analyst's read-only details format the next review date as the Requestor's released view does (D-34). */
describe('the read-only assessment details', () => {
  it('shows the next review date as a calendar date, never the raw ISO value', () => {
    render(<AssessmentEditor {...editorProps} assessment={releasedAssessment} />);

    expect(definitionValue('Next review date')).toHaveTextContent(/^1 December 2026$/);
  });

  it('says Not provided when no next review date is stored', () => {
    render(<AssessmentEditor {...editorProps} assessment={{ ...releasedAssessment, nextReviewDate: null }} />);

    expect(definitionValue('Next review date')).toHaveTextContent(/^Not provided$/);
  });
});

describe('proposal review in the Risk form', () => {
  // Each test queues its own decision answers; one a failed test left unused never reaches the next.
  beforeEach(() => { decisionMock.mockReset(); });

  /*
   * WR-404 (D-36, no lost input): in the editor a decision's re-read hands the form a new Risk, so the test delivers
   * one. A form that reset, remounted or rebased its values on that Risk would lose the unsaved revision.
   */
  it('keeps an unsaved value while another field is confirmed and the refreshed Risk arrives', async () => {
    const fields: AiFieldReview[] = [
      { field: 'issueStatement', state: 'proposed', by: null, at: null, sources: [] },
      { field: 'riskCause', state: 'proposed', by: null, at: null, sources: [] },
    ];
    const proposedRisk = {
      ...risk,
      aiProvenance: { runId: 'run-1', proposalKey: 'proposal-1', uncitedClaims: [], suggestions: [], adjustments: [], outstanding: 2, fields },
    };
    decisionMock.mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    const editor = (current: typeof proposedRisk) => <RiskEditor assessmentId="assessment/id" mode="edit" onDecision={async () => {}} options={editorProps} risk={current} searchOwners={searchOwners} />;
    const { rerender } = render(editor(proposedRisk));
    const cause = screen.getByRole('textbox', { name: 'Risk cause' });
    fireEvent.change(cause, { target: { value: 'Unsaved analyst revision' } });
    expect(screen.getByText('Edited, not saved')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Risk cause' })).toHaveAccessibleDescription('Edited, not saved');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Issue statement' }));
    await waitFor(() => expect(decisionMock).toHaveBeenCalledWith({ assessmentId: 'assessment/id', decisions: [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'accept', fields: ['issueStatement'] }] }));
    await act(async () => {});

    // The re-read's Risk: a new object, with the confirmed field accepted and the other still proposed.
    rerender(editor({ ...proposedRisk, aiProvenance: { ...proposedRisk.aiProvenance, outstanding: 1, fields: [{ ...fields[0], state: 'accepted' }, fields[1]] } }));
    expect(screen.getByRole('textbox', { name: 'Risk cause' })).toHaveValue('Unsaved analyst revision');
    expect(screen.getByRole('textbox', { name: 'Risk cause' })).toHaveAccessibleDescription('Edited, not saved');
    expect(screen.getByRole('textbox', { name: 'Issue statement' })).toHaveAccessibleDescription('Confirmed');
  });

  /* 12-UI-SPEC §4 (12-17): where each statement came from, and the claims the AI could not support. */
  it('cites each statement’s sources under its field and flags uncited ones and unsupported claims', () => {
    const citedRisk = {
      ...risk,
      aiProvenance: {
        runId: 'run-1', proposalKey: 'proposal-1', suggestions: [], adjustments: [], outstanding: 2,
        uncitedClaims: ['Recovery time objectives are not documented.'],
        fields: [
          { field: 'issueStatement', state: 'proposed' as const, by: null, at: null, sources: [] },
          { field: 'riskStatement', state: 'proposed' as const, by: null, at: null, sources: [
            { key: 'answer.payment-files', kind: 'answer' as const, label: 'Are payment files signed before upload?', section: 'Payment processing', classification: null },
            { key: 'system-1', kind: 'system' as const, label: 'HR and payroll platform', section: null, classification: null },
          ] },
          { field: 'riskType', state: 'proposed' as const, by: null, at: null, sources: null },
        ],
      },
    };
    render(<RiskEditor assessmentId="assessment/id" mode="edit" onDecision={async () => {}} options={editorProps} requestId="request-1" risk={citedRisk} searchOwners={searchOwners} />);
    const sources = screen.getByRole('list', { name: 'Sources for Risk statement' });
    expect(screen.getByRole('textbox', { name: 'Risk statement' }).compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(sources).getByRole('button', { name: 'Answer: Are payment files signed before upload?' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(sources).getByText('System: HR and payroll platform')).toBeInTheDocument();
    expect(screen.getAllByText('No source cited')).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Sources for Risk type' })).not.toBeInTheDocument();
    // Named by its Risk, so each Risk's claims are their own landmark (axe landmark-unique).
    expect(screen.getByRole('region', { name: 'Claims to check for RSK-0042' })).toHaveTextContent('“Recovery time objectives are not documented.”');
  });

  const proposed = (...fields: string[]) => fields.map((field) => ({ field, state: 'proposed' as const, by: null, at: null, sources: [] }));
  const reviewRisk = (documentId: string, riskNumber: string, ...fields: string[]) => ({
    ...risk, documentId, riskNumber,
    aiProvenance: { runId: 'run-1', proposalKey: `proposal-${documentId}`, uncitedClaims: [], suggestions: [], adjustments: [], outstanding: fields.length, fields: proposed(...fields) },
  });

  /*
   * Walk D13(c) (12-UI-SPEC §3.4, §3.5, UI-D3): a pre-filled value's note and the treatment action's note are part of
   * their field's description, after the marker, while the field is proposed; once it is reviewed, both go.
   */
  it('names the pre-fill and treatment action notes in their fields’ descriptions while the field is proposed', async () => {
    const noted = {
      ...risk,
      riskType: null,
      treatmentAction: 'Accept' as const,
      residualRating: 'Moderate' as const,
      aiProvenance: { runId: 'run-1', proposalKey: 'proposal-1', uncitedClaims: [], suggestions: [], adjustments: [], outstanding: 3, fields: proposed('riskType', 'dataClassification', 'treatmentAction') },
    };
    decisionMock.mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    render(<RiskEditor assessmentId="assessment/id" mode="edit" onDecision={async () => {}} options={editorProps} risk={noted} searchOwners={searchOwners} />);
    expect(screen.getByRole('combobox', { name: 'Risk type' })).toHaveAccessibleDescription('AI proposed The AI found no Risk Type that fits this Risk. Choose one, or confirm to leave it unset.');
    expect(screen.getByRole('combobox', { name: 'Data classification' })).toHaveAccessibleDescription('AI proposed Taken from Customer data.');
    expect(screen.getByRole('combobox', { name: 'Treatment action' })).toHaveAccessibleDescription('AI proposed Proposed because the residual rating is Moderate. The treatment plan holds the AI’s reason.');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Treatment action' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Treatment action' })).toHaveAccessibleDescription('Confirmed'));
    expect(screen.queryByText(/^Proposed because the residual rating/)).not.toBeInTheDocument();
  });

  /*
   * D-11 (stage B WR-203): an AI-proposed Accept with no rationale reaches the editor as Treat with the adjustment
   * `accept-without-rationale`, and its Treatment action says why, in its description, while proposed (12-UI-SPEC §3.5).
   */
  it('names why Treat is proposed when the AI gave its Accept no reason', () => {
    const noReason = 'The AI proposed Accept without giving a reason, so Treat is proposed instead. Accept needs its reason in the treatment plan.';
    const treated = {
      ...risk,
      treatmentAction: 'Treat' as const,
      residualRating: 'Moderate' as const,
      treatmentPlan: 'The AI proposed Accept without giving a reason, so Treat is proposed instead. Replace this with the plan to treat this risk.',
      aiProvenance: { runId: 'run-1', proposalKey: 'proposal-1', uncitedClaims: [], suggestions: [], adjustments: ['accept-without-rationale'], outstanding: 2, fields: proposed('treatmentAction', 'treatmentPlan') },
    };
    render(<RiskEditor assessmentId="assessment/id" mode="edit" onDecision={async () => {}} options={editorProps} risk={treated} searchOwners={searchOwners} />);
    expect(screen.getByRole('combobox', { name: 'Treatment action' })).toHaveAccessibleDescription(`AI proposed ${noReason}`);
    expect(screen.getByText(noReason)).toBeVisible();
  });

  /* IN-304: a decision Strapi has not answered yet dims only the markers it decides (12-UI-SPEC §6.1). */
  it('dims only the marker being decided while the decision is pending', async () => {
    const answer = deferred<unknown>();
    decisionMock.mockReturnValueOnce(answer.promise);
    const { container } = render(<RiskEditor assessmentId="assessment/id" mode="edit" onDecision={async () => {}} options={editorProps} risk={reviewRisk('risk-1', 'RSK-0042', 'issueStatement', 'riskStatement', 'riskCause')} searchOwners={searchOwners} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Issue statement' }));
    const marker = (field: string) => container.querySelector(`#risk-risk-1-${field}-ai-marker`)?.parentElement;
    expect(marker('issueStatement')).toHaveAttribute('data-pending', 'true');
    expect(marker('riskStatement')).toHaveAttribute('data-pending', 'false');
    expect(marker('riskCause')).toHaveAttribute('data-pending', 'false');
    await act(async () => answer.resolve({ ok: true, data: { applied: 1, unchanged: 0 } }));
    expect(marker('issueStatement')).toHaveAttribute('data-pending', 'false');
  });

  it('dims only the assessment details marker being decided while the decision is pending', async () => {
    const answer = deferred<unknown>();
    decisionMock.mockReturnValueOnce(answer.promise);
    const details = { ...assessment, aiProvenance: { runId: 'run-1', adjustments: [], outstanding: 2, fields: proposed('summary', 'overallRiskRationale') } };
    const { container } = render(<AssessmentEditor {...editorProps} assessment={details} risks={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Summary' }));
    expect(container.querySelector('#assessment-summary-ai-marker')?.parentElement).toHaveAttribute('data-pending', 'true');
    expect(container.querySelector('#assessment-overallRiskRationale-ai-marker')?.parentElement).toHaveAttribute('data-pending', 'false');
    await act(async () => answer.resolve({ ok: true, data: { applied: 1, unchanged: 0 } }));
  });

  /* WR-303: Refresh page re-reads the assessment in place, so an unsaved edit in another Risk survives the toast action. */
  it('keeps an unsaved edit in another Risk when Refresh page answers a refused decision', async () => {
    const first = reviewRisk('risk-1', 'RSK-0042', 'issueStatement', 'riskStatement');
    const second = reviewRisk('risk-2', 'RSK-0043', 'issueStatement', 'riskStatement');
    actionMocks.refreshAnalystAssessmentAction.mockClear().mockResolvedValue({ ok: true, data: { ...assessment, risks: [{ ...first }, { ...second }] } });
    decisionMock.mockResolvedValueOnce({ ok: false, status: 409, reason: 'AI_PROPOSAL_ALREADY_DECIDED', kind: 'blocked', formError: 'This proposal is no longer open. Refresh the page to see where it stands.' });
    const refused = vi.spyOn(toast, 'error').mockImplementation(() => 'refused');
    try {
      render(<AssessmentEditor {...editorProps} controlImplementations={{}} risks={[first, second]} />);
      fireEvent.change(screen.getAllByRole('textbox', { name: 'Risk statement' })[1], { target: { value: 'An unsaved revision of the second Risk.' } });
      fireEvent.click(screen.getAllByRole('button', { name: 'Confirm Issue statement' })[0]);
      await waitFor(() => expect(refused).toHaveBeenCalledWith('Proposal not confirmed', expect.anything()));
      const refresh = (refused.mock.calls[0][1] as { action?: { label: string; onClick: (event: never) => void } } | undefined)?.action;
      expect(refresh?.label).toBe('Refresh page');
      expect(actionMocks.refreshAnalystAssessmentAction).not.toHaveBeenCalled();
      act(() => refresh?.onClick({} as never));
      await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id' }));
      await act(async () => {});
      expect(screen.getAllByRole('textbox', { name: 'Risk statement' })[1]).toHaveValue('An unsaved revision of the second Risk.');
      expect(screen.getAllByRole('button', { name: 'Confirm Issue statement' })).toHaveLength(2);
    } finally {
      refused.mockRestore();
    }
  });
});

/*
 * WR-302 (D-21, D-24): Strapi marks an AI field `edited` in the same transaction as an accepted save that changes it, and
 * records a decision before it answers. The editor shows both as soon as Strapi answers, keeps them when the read that
 * follows fails, and says that read failed instead of passing over it.
 */
describe('the review state after a save or a decision, when the read that follows fails (WR-302)', () => {
  const refreshFailed = { ok: false, formError: 'The assessment service is unavailable. Please try again later.' };
  const facts = (...fields: string[]) => fields.map((field) => ({ field, state: 'proposed' as const, by: null, at: null, sources: [] }));
  const suggested = {
    key: 'UATA-001', control: { documentId: 'control-9', controlNumber: 'UATA-001', name: 'File integrity verification', description: null },
    rationale: 'Applicable to Internet Exposure risks.', state: 'proposed' as const, by: null, at: null, implementation: null,
  };
  const proposedRisk = {
    ...risk,
    aiProvenance: { runId: 'run-1', proposalKey: 'proposal-risk-1', uncitedClaims: [], suggestions: [suggested], adjustments: [], outstanding: 2, fields: facts('issueStatement', 'treatmentPlan') },
  };
  // Save assessment answers with the assessment details only (assessmentDetailSchema), never the analyst's AI facts.
  const { actor: _actor, risks: _risks, ownerLabels: _owners, releaseReadiness: _readiness, generation: _generation, aiProvenance: _facts, ...servedDetails } = assessment;
  const notRefreshed = ['Assessment not refreshed', expect.objectContaining({
    description: 'We couldn’t load this assessment’s latest review state and release readiness, so the page may be out of date. Try again.',
    duration: Infinity,
    action: expect.objectContaining({ label: 'Try again' }),
  })] as const;
  let warning: MockInstance<typeof toast.warning>;
  let success: MockInstance<typeof toast.success>;

  beforeEach(() => {
    vi.clearAllMocks();
    decisionMock.mockReset();
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue(refreshFailed);
    warning = vi.spyOn(toast, 'warning').mockImplementation(() => 'refresh-failed');
    success = vi.spyOn(toast, 'success').mockImplementation(() => 'decided');
  });
  afterEach(() => {
    warning.mockRestore();
    success.mockRestore();
  });

  it('marks a saved AI-proposed Risk field Edited, with no Confirm, and says the assessment was not refreshed', async () => {
    actionMocks.updateRiskAction.mockResolvedValueOnce({ ok: true, data: { documentId: 'risk-1', riskNumber: 'RSK-0042', riskStatement: risk.riskStatement, inherentRating: risk.inherentRating, residualRating: risk.residualRating } });
    render(<AssessmentEditor {...editorProps} controlImplementations={{}} risks={[proposedRisk]} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Treatment plan' }), { target: { value: 'Rotate the signing keys every quarter.' } });
    expect(screen.getByRole('textbox', { name: 'Treatment plan' })).toHaveAccessibleDescription('Edited, not saved');
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id' }));
    await act(async () => {});

    expect(screen.getByRole('textbox', { name: 'Treatment plan' })).toHaveAccessibleDescription('Edited');
    expect(screen.queryByRole('button', { name: 'Confirm Treatment plan' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'AI review for RSK-0042' })).toHaveTextContent('1 AI-proposed field to review');
    expect(screen.getByRole('button', { name: 'Confirm remaining (1) on RSK-0042' })).toBeInTheDocument();
    expect(warning).toHaveBeenCalledWith(...notRefreshed);
  });

  it('marks a saved AI-proposed assessment detail Edited, with no Confirm, when the read after the save fails', async () => {
    const details = { ...assessment, aiProvenance: { runId: 'run-1', adjustments: [], outstanding: 2, fields: facts('summary', 'overallRiskRationale') } };
    actionMocks.saveAssessmentAction.mockImplementationOnce(async ({ values }: { values: { summary?: string } }) => ({ ok: true, data: { ...servedDetails, summary: values.summary ?? null } }));
    render(<AssessmentEditor {...editorProps} assessment={details} risks={[]} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Summary' }), { target: { value: 'An analyst’s own summary.' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save assessment' }));
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id' }));
    await act(async () => {});

    expect(screen.getByRole('textbox', { name: 'Summary' })).toHaveAccessibleDescription('Edited');
    expect(screen.queryByRole('button', { name: 'Confirm Summary' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'AI review for the assessment details' })).toHaveTextContent('1 AI-proposed field to review');
    expect(screen.getByRole('textbox', { name: 'Overall risk rationale' })).toHaveAccessibleDescription('AI proposed');
    expect(warning).toHaveBeenCalledWith(...notRefreshed);
  });

  it('keeps a confirmed field Confirmed, with no Confirm, once the decision is recorded and the read after it fails', async () => {
    decisionMock.mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    render(<AssessmentEditor {...editorProps} controlImplementations={{}} risks={[proposedRisk]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Issue statement' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Issue statement confirmed on RSK-0042.', expect.anything()));
    await act(async () => {});

    expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id' });
    expect(screen.getByRole('textbox', { name: 'Issue statement' })).toHaveAccessibleDescription('Confirmed');
    expect(screen.queryByRole('button', { name: 'Confirm Issue statement' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'AI review for RSK-0042' })).toHaveTextContent('1 AI-proposed field to review');
    expect(warning).toHaveBeenCalledWith(...notRefreshed);
  });

  it('keeps a dismissed suggestion dismissed once the dismissal is recorded and the read after it fails', async () => {
    decisionMock.mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    render(<AssessmentEditor {...editorProps} controlImplementations={{}} risks={[proposedRisk]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion: UATA-001 · File integrity verification' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Suggestion dismissed: UATA-001 · File integrity verification.', expect.anything()));
    await act(async () => {});

    expect(screen.queryByRole('button', { name: 'Add as planned control: UATA-001 · File integrity verification' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show dismissed suggestions (1)' })).toBeInTheDocument();
    expect(warning).toHaveBeenCalledWith(...notRefreshed);
  });

  it('reads the assessment again from Try again, and shows what that read returns', async () => {
    decisionMock.mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    render(<AssessmentEditor {...editorProps} controlImplementations={{}} risks={[proposedRisk]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Issue statement' }));
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    const served = { ...proposedRisk, aiProvenance: { ...proposedRisk.aiProvenance, outstanding: 0, fields: proposedRisk.aiProvenance.fields.map((fact) => ({ ...fact, state: 'accepted' as const })) } };
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValueOnce({ ok: true, data: { ...assessment, risks: [served] } });
    const tryAgain = (warning.mock.calls[0][1] as { action?: { label: string; onClick: (event: never) => void } } | undefined)?.action;
    await act(async () => { tryAgain?.onClick({} as never); });

    expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole('group', { name: 'AI review for RSK-0042' })).toHaveTextContent('All AI proposals reviewed'));
    expect(warning).toHaveBeenCalledTimes(1);
  });
});

/* WR-404: the AI review UI as the editor renders it, from the served facts, while unreleased and after release. */
describe('the AI review UI in the assessment editor (WR-404)', () => {
  const fact = (field: string, state: 'proposed' | 'accepted' | 'edited' = 'proposed', sources: { key: string; kind: 'answer' | 'system'; label: string; section: string | null; classification: string | null }[] = []) => ({ field, state, by: null, at: null, sources });
  const answerSource = { key: 'answer.payment-files', kind: 'answer' as const, label: 'Are payment files signed before upload?', section: 'Payment processing', classification: null };
  const suggestedControl = {
    key: 'UATA-001', control: { documentId: 'control-9', controlNumber: 'UATA-001', name: 'File integrity verification', description: null },
    rationale: 'Applicable to Internet Exposure risks.', state: 'proposed' as const, by: null, at: null, implementation: null,
  };
  const reviewedRisk = {
    ...risk,
    aiProvenance: {
      runId: 'run-1', proposalKey: 'proposal-risk-1', uncitedClaims: ['Recovery time objectives are not documented.'], suggestions: [suggestedControl], adjustments: [], outstanding: 2,
      fields: [fact('issueStatement'), fact('riskStatement', 'proposed', [answerSource]), fact('riskCause', 'accepted')],
    },
  };
  const detailFacts = { runId: 'run-1', adjustments: [], outstanding: 2, fields: [fact('summary', 'proposed', [answerSource]), fact('overallRating'), fact('recommendationsSummary', 'accepted')] };

  beforeEach(() => {
    vi.clearAllMocks();
    decisionMock.mockReset();
  });

  /*
   * WR-305, walk D5 (12-UI-SPEC §3.3): the badge's name is extended by visually hidden text after its label, not by an
   * `aria-label` on a generic span, which assistive technology ignores; and one field is one field.
   */
  it('extends the Risk card’s AI proposed badge with its count in visually hidden text, in the singular for one field', async () => {
    const oneProposed = { ...risk, documentId: 'risk-2', riskNumber: 'RSK-0043', aiProvenance: { ...reviewedRisk.aiProvenance, proposalKey: 'proposal-risk-2', suggestions: [], outstanding: 1, fields: [fact('issueStatement'), fact('riskCause', 'edited')] } };
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: false, formError: 'The assessment service is unavailable. Please try again later.' });
    decisionMock.mockResolvedValueOnce({ ok: true, data: { applied: 1, unchanged: 0 } });
    const warning = vi.spyOn(toast, 'warning').mockImplementation(() => 'refresh-failed');
    const success = vi.spyOn(toast, 'success').mockImplementation(() => 'decided');
    try {
      render(<AssessmentEditor {...editorProps} controlImplementations={{}} risks={[reviewedRisk, oneProposed]} />);
      const badgeCount = (riskId: string) => {
        const header = document.getElementById(`risk-${riskId}`)!.querySelector<HTMLElement>('[data-slot="card-header"]')!;
        const badge = within(header).getByText('AI proposed');
        expect(badge).toHaveAttribute('data-slot', 'badge');
        const group = badge.parentElement!;
        expect(group).not.toHaveAttribute('aria-label');
        expect(within(group).getByText(/^: \d+ fields? to review$/)).toHaveClass('sr-only');
        return group.textContent;
      };
      expect(badgeCount('risk-1')).toBe('AI proposed: 2 fields to review');
      expect(badgeCount('risk-2')).toBe('AI proposed: 1 field to review');

      // A recorded Confirm counts at once, and stays counted when the read after it fails (WR-302).
      fireEvent.click(within(document.getElementById('risk-risk-1')!).getByRole('button', { name: 'Confirm Issue statement' }));
      await waitFor(() => expect(success).toHaveBeenCalled());
      await act(async () => {});
      expect(badgeCount('risk-1')).toBe('AI proposed: 1 field to review');
    } finally {
      warning.mockRestore();
      success.mockRestore();
    }
  });

  it('marks the AI-written assessment details, names each marker in its field’s description, and shows their review bar', () => {
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, aiProvenance: detailFacts }} risks={[]} />);
    const details = screen.getByRole('region', { name: 'Assessment details' });
    expect(within(details).getByRole('textbox', { name: 'Summary' })).toHaveAccessibleDescription('AI proposed');
    expect(within(details).getByRole('combobox', { name: 'Overall rating' })).toHaveAccessibleDescription('AI proposed');
    expect(within(details).getByRole('textbox', { name: 'Recommendations' })).toHaveAccessibleDescription('Confirmed');
    expect(within(details).getByRole('combobox', { name: 'Overall control effectiveness' })).not.toHaveAccessibleDescription();
    expect(within(details).getByRole('button', { name: 'Confirm Summary' })).toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'Confirm Overall rating' })).toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Confirm Recommendations' })).not.toBeInTheDocument();
    const bar = within(details).getByRole('group', { name: 'AI review for the assessment details' });
    expect(bar).toHaveTextContent('2 AI-proposed fields to review');
    expect(within(bar).getByRole('button', { name: 'Confirm remaining (2) in the assessment details' })).toBeInTheDocument();
    expect(within(details).getByRole('list', { name: 'Sources for Summary' })).toBeInTheDocument();
  });

  it('shows no marker, review bar, source, claim or suggestion once the assessment is released (12-UI-SPEC §10.2)', () => {
    render(<AssessmentEditor {...editorProps} assessment={{ ...releasedAssessment, aiProvenance: detailFacts }} controlImplementations={{ 'risk-1': [implementation] }} riskListItems={[riskListItem]} risks={[reviewedRisk]} />);
    expect(screen.getByText('Assessment released')).toBeInTheDocument();
    expect(screen.queryByText('AI proposed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirm remaining/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^AI review for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Sources for / })).not.toBeInTheDocument();
    expect(screen.queryByText('No source cited')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Claims (to check|the AI couldn’t support)/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Suggested by AI')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Suggested by AI/ })).not.toBeInTheDocument();
  });
});

/*
 * Phase 16 (16-UI-SPEC §1, §6.3, §6.4, §9.1, §10.1, §16 U1 and E2; D-08, D-12, D-42, D-45, UI-D2, UI-D9): the editor places
 * the AI proposals section before Identified Risks, splits the Risks with the Show filter, and lists the new readiness item.
 */
describe('risk curation and AI proposals in the assessment editor (16-14)', () => {
  const allowed = { allowed: true, reason: null } as const;
  const withdrawalFacts = { at: '2026-10-14T01:00:00.000Z', by: analyst, reason: 'Duplicate of RSK-0042' };
  const secondRisk = { ...risk, documentId: 'risk-2', riskNumber: 'RSK-0043', riskStatement: 'Payment files may be altered.' };
  const withdrawnRisk = { ...risk, documentId: 'risk-3', riskNumber: 'RSK-0044', riskStatement: 'An old duplicate of the portal risk.', withdrawal: withdrawalFacts };
  const proposalsRead = (overrides: Partial<RiskAiProposals> = {}): RiskAiProposals => ({
    assessmentId: 'assessment/id',
    editable: true,
    openCount: 0,
    openByRisk: [],
    lastAskedAt: null,
    actions: { suggest: allowed, rewrite: allowed, decide: allowed },
    runs: [],
    items: [],
    jobs: [],
    ...overrides,
  });
  const curatedEditor = (extra: Partial<Parameters<typeof AssessmentEditor>[0]> = {}) => (
    <AssessmentEditor {...editorProps} controlImplementations={{}} ownerKey="owner-a" proposals={proposalsRead()} risks={[risk, secondRisk, withdrawnRisk]} {...extra} />
  );
  const rewriteJob = (riskId: string, status: RiskProposalJob['status'], jobId = 'job-1'): RiskProposalJob => ({
    jobId, operation: 'risk-rewrite', assessmentId: 'assessment/id', riskId, status, attempt: 1, queuedAt: '2026-10-15T01:00:00.000Z',
    startedAt: null, completedAt: null, runId: null, failureCode: null, failureMessage: null, initiatedBy: analyst, initiatedByViewer: true, canRetry: false,
  });
  const noChangeRun: RiskAiRunFacts = {
    runId: 'run-w', operation: 'risk-rewrite', initiatedBy: analyst, startedAt: '2026-10-15T01:00:00.000Z', completedAt: '2026-10-15T01:01:00.000Z',
    providerName: null, providerVersion: null, instruction: null, focus: null, riskId: 'risk-1', outcome: 'no-change', counts: { items: 0, open: 0 }, adjustments: [],
  };
  const card = (riskId: string) => document.getElementById(`risk-${riskId}`)!;
  const shownCards = () => [...document.querySelectorAll<HTMLElement>('[data-risk-list]:not([hidden]) [data-risk-card]')];

  /*
   * A card's AI rewrite section and the Risk history sheet are code-split (D-48), and a first load transforms the module:
   * under a full parallel suite that alone can outlast a find query's timeout. Loading them once here leaves each test
   * waiting only on the editor.
   */
  beforeAll(async () => {
    await Promise.all([import('@/features/risk-curation/risk-rewrite'), import('@/features/risk-curation/risk-history-sheet')]);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/app/review/assessments/assessment%2Fid');
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [risk, secondRisk, withdrawnRisk] } });
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });

  it('places AI proposals before Identified Risks and splits the Risks with the Show filter, kept in the address', async () => {
    render(curatedEditor());

    const proposalsHeading = screen.getByRole('heading', { level: 2, name: 'AI proposals' });
    const risksHeading = screen.getByRole('heading', { level: 2, name: 'Identified Risks' });
    expect(proposalsHeading.compareDocumentPosition(risksHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.getElementById('ai-proposals')).toHaveAttribute('tabindex', '-1');

    const show = screen.getByRole('radiogroup', { name: 'Show' });
    const active = within(show).getByRole('radio', { name: 'Active (2)' });
    const withdrawn = within(show).getByRole('radio', { name: 'Withdrawn (1)' });
    expect(active).toBeChecked();
    expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-1', 'risk-risk-2']);
    expect(screen.getByRole('button', { name: 'Add Risk' })).toBeInTheDocument();

    await userEvent.click(withdrawn);
    expect(withdrawn).toBeChecked();
    expect(window.location.search).toBe('?risks=withdrawn');
    // Through the router, with no scroll, so its tree follows the address and a later refresh keeps the page in place.
    expect(routerReplace).toHaveBeenLastCalledWith('/app/review/assessments/assessment%2Fid?risks=withdrawn', { scroll: false });
    // Choosing an option moves no focus (§6.3): it stays on the option chosen.
    expect(withdrawn).toHaveFocus();
    expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-3']);
    expect(card('risk-3')).toHaveAttribute('data-withdrawn');
    expect(within(card('risk-3')).getByText('Reason: “Duplicate of RSK-0042”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Risk' })).not.toBeInTheDocument();

    await userEvent.click(within(show).getByRole('radio', { name: 'Active (2)' }));
    expect(window.location.search).toBe('');
    expect(routerReplace).toHaveBeenLastCalledWith('/app/review/assessments/assessment%2Fid', { scroll: false });
    expect(shownCards()).toHaveLength(2);
  });

  it('keeps unsaved Risk and new-Risk input across a Show change (FE3-01)', async () => {
    render(curatedEditor());
    const statement = within(card('risk-1')).getByRole('textbox', { name: 'Risk statement' });
    fireEvent.change(statement, { target: { value: 'An unsaved statement' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add Risk' }));
    const create = screen.getByRole('button', { name: 'Add risk' }).closest('form')!;
    fireEvent.change(within(create).getByLabelText('Risk statement'), { target: { value: 'A new risk in progress' } });

    const show = screen.getByRole('radiogroup', { name: 'Show' });
    await userEvent.click(within(show).getByRole('radio', { name: 'Withdrawn (1)' }));
    expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-3']);
    expect(screen.queryByRole('button', { name: 'Add risk' })).not.toBeInTheDocument();
    await userEvent.click(within(show).getByRole('radio', { name: 'Active (2)' }));

    expect(within(card('risk-1')).getByRole('textbox', { name: 'Risk statement' })).toHaveValue('An unsaved statement');
    const reopened = screen.getByRole('button', { name: 'Add risk' }).closest('form')!;
    expect(within(reopened).getByLabelText('Risk statement')).toHaveValue('A new risk in progress');
  });

  it('keeps the lists and their unsaved input when a later read of the page fails, offering Try again (Note 1)', async () => {
    const warning = vi.spyOn(toast, 'warning').mockImplementation(() => 'not-refreshed');
    try {
      const { rerender } = render(curatedEditor());
      fireEvent.change(within(card('risk-1')).getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'An unsaved statement' } });
      await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Show' })).getByRole('radio', { name: 'Withdrawn (1)' }));

      // The page's read for the new address fails.
      rerender(<AssessmentEditor state="error" />);

      expect(screen.queryByText('We couldn’t load this assessment')).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Withdrawn (1)' })).toBeChecked();
      expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-3']);
      // The Active list is hidden while Withdrawn is chosen, and keeps its form.
      expect(within(card('risk-1')).getByRole('textbox', { name: 'Risk statement', hidden: true })).toHaveValue('An unsaved statement');
      await waitFor(() => expect(warning).toHaveBeenCalledWith('Assessment not refreshed', expect.objectContaining({
        description: 'We couldn’t load this assessment’s latest review state and release readiness, so the page may be out of date. Try again.',
        action: expect.objectContaining({ label: 'Try again' }),
      })));
      const retry = (warning.mock.calls.at(-1)![1] as { action: { onClick: (event: unknown) => void } }).action;
      act(() => retry.onClick({}));
      expect(routerRefresh).toHaveBeenCalled();

      // A refusal still replaces the editor: navigation visibility is not authorisation.
      rerender(<AssessmentEditor state="permission" />);
      expect(screen.getByText('You don’t have permission to review this assessment')).toBeInTheDocument();
    } finally {
      warning.mockRestore();
    }
  });

  it('chooses the list a Risk card link names, then lands on the card (FE3-06)', async () => {
    const requirements = [{ scope: 'risk' as const, key: 'riskStatement', label: 'Risk statement', state: 'outstanding' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' }];
    render(curatedEditor({ assessment: { ...assessment, releaseReadiness: { ready: false, requirements } }, riskFilter: 'withdrawn' }));
    expect(screen.getByRole('radio', { name: 'Withdrawn (1)' })).toBeChecked();

    await userEvent.click(screen.getByRole('link', { name: 'RSK-0042: 1 outstanding' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Active (2)' })).toBeChecked());
    expect(routerReplace).toHaveBeenLastCalledWith(expect.not.stringContaining('risks=withdrawn'), { scroll: false });
    await waitFor(() => expect(card('risk-1')).toHaveFocus());
  });

  it('closes the history sheet and lands on AI proposals when Show in AI proposals is followed (FE3-07)', async () => {
    const added = {
      id: 'event-5', kind: 'created' as const, occurredAt: '2026-10-14T03:00:00.000Z', actor: analyst, sourceKind: 'ai-run' as const,
      aiRunId: null, proposalItem: 's-1', reason: null, undo: false, changes: { schemaVersion: 1 as const, fields: [] },
    };
    curationActions.readRiskHistoryAction.mockResolvedValue({ ok: true, data: { events: [added], pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 }, recordedFrom: '2026-10-01T00:00:00.000Z' } });
    render(curatedEditor());
    await userEvent.click(within(card('risk-1')).getByRole('button', { name: 'History of RSK-0042' }));
    const sheet = await screen.findByRole('dialog', { name: 'History of RSK-0042' });

    await userEvent.click(await within(sheet).findByRole('link', { name: 'Show in AI proposals' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'History of RSK-0042' })).not.toBeInTheDocument());
    await waitFor(() => expect(document.getElementById('ai-proposals')).toHaveFocus());
  });

  it('closes the history sheet of a released Risk the same way (FE3-07)', async () => {
    const added = {
      id: 'event-5', kind: 'created' as const, occurredAt: '2026-10-14T03:00:00.000Z', actor: analyst, sourceKind: 'ai-run' as const,
      aiRunId: null, proposalItem: 's-1', reason: null, undo: false, changes: { schemaVersion: 1 as const, fields: [] },
    };
    curationActions.readRiskHistoryAction.mockResolvedValue({ ok: true, data: { events: [added], pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 }, recordedFrom: '2026-10-01T00:00:00.000Z' } });
    render(curatedEditor({ assessment: releasedAssessment, proposals: proposalsRead({ editable: false }), riskListItems: [riskListItem], risks: [risk] }));
    await userEvent.click(within(card('risk-1')).getByRole('button', { name: 'History of RSK-0042' }));
    const sheet = await screen.findByRole('dialog', { name: 'History of RSK-0042' });

    await userEvent.click(await within(sheet).findByRole('link', { name: 'Show in AI proposals' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'History of RSK-0042' })).not.toBeInTheDocument());
    await waitFor(() => expect(document.getElementById('ai-proposals')).toHaveFocus());
  });

  it('offers no Confirm for a residual change that would leave a High rating under an AI-confirmed Accept (FE4-07)', async () => {
    const accepted = {
      ...risk,
      treatmentAction: 'Accept',
      aiProvenance: { runId: 'run-1', proposalKey: 'proposal-1', uncitedClaims: [], suggestions: [], adjustments: [], outstanding: 0, fields: [{ field: 'treatmentAction', state: 'accepted' as const, by: analyst, at: '2026-10-14T01:00:00.000Z', sources: null }] },
    } as AnalystRisk;
    const raised = {
      runId: 'run-w', itemKey: 'u-residual-rating', kind: 'change' as const, state: 'open' as const, stale: false, riskId: 'risk-1', unitKey: 'u-residual-rating',
      fields: ['residualLikelihood', 'highestResidualConsequence', 'residualRating'],
      current: { residualLikelihood: 'Possible', highestResidualConsequence: 'Moderate', residualRating: 'Moderate' },
      proposed: { residualLikelihood: 'Likely', highestResidualConsequence: 'Major', residualRating: 'High' },
      similarTo: null, aiAccept: false, acceptBlocked: null, sources: [], uncited: [], suggestedControls: [], decision: null, addedRisk: null, canUndo: false,
    };
    render(curatedEditor({ risks: [accepted, secondRisk], proposals: proposalsRead({ openCount: 1, openByRisk: [{ riskId: 'risk-1', count: 1 }], runs: [{ ...noChangeRun, outcome: 'items' as const, counts: { items: 1, open: 1 } }], items: [raised] }) }));
    expect(await within(card('risk-1')).findAllByRole('button', { name: 'Reject: Residual rating on RSK-0042' })).not.toHaveLength(0);
    expect(within(card('risk-1')).queryAllByRole('button', { name: 'Confirm: Residual rating on RSK-0042' })).toHaveLength(0);
  });

  it('ids each Risk card by its documentId and links to it encoded, as the hash landing decodes it (FE3-12)', () => {
    const slashed = { ...risk, documentId: 'risk/1' } as AnalystRisk;
    render(curatedEditor({ risks: [slashed, secondRisk, withdrawnRisk], proposals: proposalsRead({ openCount: 1, openByRisk: [{ riskId: 'risk/1', count: 1 }] }) }));
    const slashedCard = document.getElementById('risk-risk/1');
    expect(slashedCard).toHaveAttribute('data-risk-card');
    expect(within(slashedCard!).getByRole('link', { name: '1 AI change to review' })).toHaveAttribute('href', '#risk-risk%2F1-rewrite');
    expect(document.getElementById('risk-risk-3')).toHaveAttribute('data-withdrawn');
  });

  it('offers no Rewrite this risk while that Risk’s rewrite is queued or running (FE4-04)', () => {
    curationActions.readRiskProposalJobAction.mockReturnValue(new Promise(() => undefined));
    render(curatedEditor({ proposals: proposalsRead({ jobs: [rewriteJob('risk-1', 'queued'), rewriteJob('risk-2', 'running', 'job-2')] }) }));
    expect(within(card('risk-1')).queryByRole('button', { name: 'Rewrite this risk: RSK-0042' })).not.toBeInTheDocument();
    expect(within(card('risk-2')).queryByRole('button', { name: 'Rewrite this risk: RSK-0043' })).not.toBeInTheDocument();
  });

  it('offers Rewrite this risk again once that Risk’s rewrite failed (FE4-04)', () => {
    render(curatedEditor({ proposals: proposalsRead({ jobs: [{ ...rewriteJob('risk-1', 'failed'), failureCode: 'PROVIDER_ERROR' }] }) }));
    expect(within(card('risk-1')).getByRole('button', { name: 'Rewrite this risk: RSK-0042' })).toBeInTheDocument();
    expect(within(card('risk-2')).getByRole('button', { name: 'Rewrite this risk: RSK-0043' })).toBeInTheDocument();
  });

  it('stops following a started rewrite once it completes, and offers Rewrite this risk again (FE4-05)', async () => {
    const started = rewriteJob('risk-1', 'queued', 'job-w');
    curationActions.startRiskRewriteAction.mockResolvedValue({ ok: true, data: started });
    curationActions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...started, status: 'completed', runId: 'run-w' } });
    const { rerender } = render(curatedEditor());
    fireEvent.click(within(card('risk-1')).getByRole('button', { name: 'Rewrite this risk: RSK-0042' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rewrite RSK-0042' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Rewrite risk' }));
    expect(await within(card('risk-1')).findByText('The AI is rewriting RSK-0042')).toBeInTheDocument();
    await waitFor(() => expect(curationActions.readRiskProposalJobAction).toHaveBeenCalledTimes(1), { timeout: 5_000 });

    // The page's next read: the job is done and serves no job for the Risk.
    rerender(curatedEditor({ proposals: proposalsRead({ runs: [{ ...noChangeRun, outcome: 'items' as const }] }) }));
    expect(await within(card('risk-1')).findByRole('button', { name: 'Rewrite this risk: RSK-0042' })).toBeInTheDocument();
    expect(within(card('risk-1')).queryByText('The AI is rewriting RSK-0042')).not.toBeInTheDocument();
    expect(curationActions.readRiskProposalJobAction).toHaveBeenCalledTimes(1);
  });

  for (const width of ['wide', 'phone'] as const) {
    it(`moves focus to the started rewrite’s status line once the AI is asked, ${width} (FE4-03)`, async () => {
      if (width === 'phone') {
        vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 767px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
        installTestResizeObserver();
      }
      try {
        const started = rewriteJob('risk-1', 'queued', 'job-w');
        curationActions.startRiskRewriteAction.mockResolvedValue({ ok: true, data: started });
        curationActions.readRiskProposalJobAction.mockReturnValue(new Promise(() => undefined));
        render(curatedEditor());
        fireEvent.click(within(card('risk-1')).getByRole('button', { name: 'Rewrite this risk: RSK-0042' }));
        const dialog = await screen.findByRole('dialog', { name: 'Rewrite RSK-0042' });
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Rewrite risk' }));
        const status = await within(card('risk-1')).findByText('The AI is rewriting RSK-0042');
        await waitFor(() => expect(status).toHaveFocus());
      } finally {
        vi.unstubAllGlobals();
      }
    });
  }

  it('keeps a served rewrite’s no-change outcome after the page reads it again (FE4-05)', async () => {
    const running = { ...rewriteJob('risk-1', 'running', 'job-w'), initiatedBy: { documentId: 'ada-id', displayName: 'Ada Analyst' }, initiatedByViewer: false };
    curationActions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...running, status: 'completed', runId: 'run-w' } });
    const { rerender } = render(curatedEditor({ proposals: proposalsRead({ jobs: [running] }) }));
    expect(await within(card('risk-1')).findByText('The AI is rewriting RSK-0042')).toBeInTheDocument();
    await waitFor(() => expect(curationActions.readRiskProposalJobAction).toHaveBeenCalledTimes(1), { timeout: 5_000 });

    rerender(curatedEditor({ proposals: proposalsRead({ runs: [noChangeRun] }) }));
    expect(await within(card('risk-1')).findByText('The AI proposed no changes to RSK-0042.')).toBeInTheDocument();
  });

  it('opens the list the address names', () => {
    render(curatedEditor({ riskFilter: 'withdrawn' }));
    expect(screen.getByRole('radio', { name: 'Withdrawn (1)' })).toBeChecked();
    expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-3']);
  });

  it('withdraws a Risk from its card: it moves to Withdrawn, the counts follow and the toast offers Undo', async () => {
    curationActions.withdrawRisksAction.mockResolvedValue({ ok: true, data: { applied: ['risk-2'], unchanged: [] } });
    const nowWithdrawn = { ...secondRisk, withdrawal: { at: '2026-10-15T01:00:00.000Z', by: analyst, reason: 'Out of scope' } };
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [risk, nowWithdrawn, withdrawnRisk] } });
    const success = vi.spyOn(toast, 'success').mockImplementation(() => 'withdrawn');
    try {
      render(curatedEditor());
      await userEvent.click(within(card('risk-2')).getByRole('button', { name: 'Withdraw risk RSK-0043' }));
      await userEvent.type(within(card('risk-2')).getByRole('textbox', { name: 'Reason for withdrawing' }), 'Out of scope');
      await userEvent.click(within(card('risk-2')).getByRole('button', { name: 'Withdraw risk' }));

      await waitFor(() => expect(curationActions.withdrawRisksAction).toHaveBeenCalledWith({ assessmentId: 'assessment/id', riskIds: ['risk-2'], reason: 'Out of scope' }));
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Active (1)' })).toBeInTheDocument());
      expect(screen.getByRole('radio', { name: 'Withdrawn (2)' })).toBeInTheDocument();
      expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-1']);
      await waitFor(() => expect(success).toHaveBeenCalledWith('RSK-0043 withdrawn.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
    } finally {
      success.mockRestore();
    }
  });

  it('returns focus to Withdraw risk when the form a refusal reopened is kept (FE3-03)', async () => {
    curationActions.withdrawRisksAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE', message: 'This assessment can no longer be changed, so the risk wasn’t withdrawn. Refresh the page to see its current state.' });
    render(curatedEditor());
    await userEvent.click(within(card('risk-2')).getByRole('button', { name: 'Withdraw risk RSK-0043' }));
    await userEvent.type(within(card('risk-2')).getByRole('textbox', { name: 'Reason for withdrawing' }), 'Out of scope{Enter}');

    const reopened = await waitFor(() => within(card('risk-2')).getByRole('textbox', { name: 'Reason for withdrawing' }));
    await waitFor(() => expect(reopened).toHaveFocus());
    expect(within(card('risk-2')).getByRole('alert')).toHaveTextContent('This assessment can no longer be changed');
    await userEvent.keyboard('{Escape}');

    expect(within(card('risk-2')).queryByRole('textbox', { name: 'Reason for withdrawing' })).not.toBeInTheDocument();
    await waitFor(() => expect(within(card('risk-2')).getByRole('button', { name: 'Withdraw risk RSK-0043' })).toHaveFocus());
  });

  it('reads the Risks again when a mitigation control change is refused because the Risk was withdrawn meanwhile (FE3-05)', async () => {
    const formError = 'This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.';
    actionMocks.updateRiskAction.mockResolvedValue({ ok: false, formError, reason: 'RISK_WITHDRAWN' });
    actionMocks.updateControlImplementationAction.mockResolvedValue({ ok: false, formError, reason: 'RISK_WITHDRAWN' });
    const elsewhere = { at: '2026-10-15T01:00:00.000Z', by: analyst, reason: 'Withdrawn in another tab' };
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [{ ...risk, withdrawal: elsewhere }, secondRisk, withdrawnRisk] } });
    render(curatedEditor({ controlImplementations: { 'risk-1': [implementation] } }));

    const evidence = within(card('risk-1')).getByRole('textbox', { name: 'Evidence' });
    fireEvent.change(evidence, { target: { value: 'Newer report' } });
    await userEvent.click(within(card('risk-1')).getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Withdrawn (2)' })).toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Active (1)' })).toBeInTheDocument();
  });

  it('reads the Risks again when a Risk edit is refused because the Risk was withdrawn meanwhile (FE3-05)', async () => {
    const formError = 'This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.';
    actionMocks.updateRiskAction.mockResolvedValue({ ok: false, formError, reason: 'RISK_WITHDRAWN' });
    const elsewhere = { at: '2026-10-15T01:00:00.000Z', by: analyst, reason: 'Withdrawn in another tab' };
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: { ...assessment, risks: [risk, { ...secondRisk, withdrawal: elsewhere }, withdrawnRisk] } });
    render(curatedEditor());

    fireEvent.change(within(card('risk-2')).getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'A stale edit' } });
    await userEvent.click(within(card('risk-2')).getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.refreshAnalystAssessmentAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Withdrawn (2)' })).toBeInTheDocument());
    expect(shownCards().map((element) => element.id)).toEqual(['risk-risk-1']);
  });

  it('reads §6.3’s empty lists: every Risk withdrawn, none withdrawn while editable, and none withdrawn once released', () => {
    const allWithdrawn = render(curatedEditor({ risks: [{ ...risk, withdrawal: withdrawalFacts }] }));
    expect(screen.getByRole('radio', { name: 'Active (0)' })).toBeChecked();
    expect(screen.getByText('No active risks')).toBeInTheDocument();
    expect(screen.getByText('Every risk in this assessment has been withdrawn. Add a risk, ask the AI for more risks, or reinstate one under Withdrawn.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Risk' })).toBeInTheDocument();
    allWithdrawn.unmount();

    const noneWithdrawn = render(curatedEditor({ riskFilter: 'withdrawn', risks: [risk] }));
    expect(screen.getByText('No withdrawn risks')).toBeInTheDocument();
    expect(screen.getByText('Risks you withdraw are kept here with their reasons, and can be reinstated while the assessment is being edited.')).toBeInTheDocument();
    noneWithdrawn.unmount();

    render(curatedEditor({ assessment: releasedAssessment, controlImplementations: { 'risk-1': [implementation] }, riskFilter: 'withdrawn', riskListItems: [riskListItem], risks: [risk] }));
    expect(screen.getByText('No withdrawn risks')).toBeInTheDocument();
    expect(screen.getByText('No risk was withdrawn from this assessment.')).toBeInTheDocument();
  });

  it('lists Decisions on AI proposals outstanding with its open count, linked to the section, and no row for a withdrawn Risk', () => {
    const requirements = [
      { scope: 'assessment' as const, key: 'aiProposalsDecided', label: 'Decisions on AI proposals', state: 'outstanding' as const, destination: 'ai-proposals' },
      { scope: 'risk' as const, key: 'riskStatement', label: 'Risk statement', state: 'met' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
    ];
    render(curatedEditor({ assessment: { ...assessment, releaseReadiness: { ready: false, requirements } }, proposals: proposalsRead({ openCount: 2 }) }));

    const outstanding = screen.getByRole('list', { name: 'Release requirements' });
    const item = within(outstanding).getByRole('link', { name: 'Decisions on AI proposals' });
    expect(item).toHaveAttribute('href', '#ai-proposals');
    const row = item.closest('li')!;
    expect(within(row).getByText('Outstanding')).toBeInTheDocument();
    expect(within(row).getByText('2 open')).toHaveClass('tabular-nums');
    expect(screen.queryByRole('link', { name: /RSK-0044/ })).not.toBeInTheDocument();
  });

  it('links the header’s open AI proposals to the section and adds no form to Identified Risks at rest', () => {
    const provenance: AiProvenanceHeaderProps = {
      kind: 'assessment',
      generation: { generatedAt: '2026-10-14T00:00:00.000Z', generatedBy: analyst, providerName: null, providerVersion: null, runId: 'run-1' },
      released: false,
      review: { kind: 'counts', outstanding: 0, firstDestination: null },
    };
    render(curatedEditor({ controlImplementations: { 'risk-1': [implementation] }, proposals: proposalsRead({ openCount: 2 }), provenance }));

    expect(screen.getByRole('link', { name: '2 open AI proposals' })).toHaveAttribute('href', '#ai-proposals');
    // One form per active Risk and one per mitigation control, as before Phase 16: no withdraw, reinstate, reject or rewrite form.
    const region = screen.getByRole('region', { name: 'Identified Risks' });
    expect(region.querySelectorAll('form')).toHaveLength(3);
  });
});

/*
 * Phase 16 (16-UI-SPEC §9.1, §9.2, §12.1, §12.3; D-15, D-29, UI-D25, UI-D30): the overall-rating hint, what stays after
 * release, and the requesting analyst's readiness caption.
 */
describe('the overall-rating hint and the locked states (16-14)', () => {
  const allowed = { allowed: true, reason: null } as const;
  const proposalsRead: RiskAiProposals = {
    assessmentId: 'assessment/id', editable: true, openCount: 0, openByRisk: [], lastAskedAt: null,
    actions: { suggest: allowed, rewrite: allowed, decide: allowed }, runs: [], items: [], jobs: [],
  };
  const highRisk = { ...risk, residualRating: 'High' as const };
  const withdrawnCritical = { ...risk, documentId: 'risk-3', riskNumber: 'RSK-0044', residualRating: 'Critical' as const, withdrawal: { at: '2026-10-14T01:00:00.000Z', by: analyst, reason: 'Duplicate' } };
  const hintLine = 'The highest residual rating among the active risks is High. The overall rating is Moderate.';

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/app/review/assessments/assessment%2Fid');
    actionMocks.refreshAnalystAssessmentAction.mockResolvedValue({ ok: true, data: assessment });
  });
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('hints the highest active residual rating under Overall rating, and Use High sets the field without saving', async () => {
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, overallRating: 'Moderate' }} controlImplementations={{}} proposals={proposalsRead} risks={[highRisk, withdrawnCritical]} />);

    const details = screen.getByRole('region', { name: 'Assessment details' });
    const overall = within(details).getByRole('combobox', { name: 'Overall rating' });
    expect(within(details).getByText(hintLine)).toBeInTheDocument();
    expect(overall).toHaveAccessibleDescription(hintLine);
    await userEvent.click(within(details).getByRole('button', { name: 'Use High' }));

    expect(overall).toHaveValue('High');
    expect(overall).toHaveFocus();
    expect(within(details).queryByText(hintLine)).not.toBeInTheDocument();
    expect(actionMocks.saveAssessmentAction).not.toHaveBeenCalled();
  });

  it('shows no hint when the ratings match, when no active Risk is rated, or once released', () => {
    const matching = render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, overallRating: 'High' }} controlImplementations={{}} risks={[highRisk]} />);
    expect(screen.queryByText(/^The highest residual rating among the active risks/)).not.toBeInTheDocument();
    matching.unmount();

    const unrated = render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, overallRating: 'Moderate' }} controlImplementations={{}} risks={[{ ...risk, residualRating: null }, withdrawnCritical]} />);
    expect(screen.queryByText(/^The highest residual rating among the active risks/)).not.toBeInTheDocument();
    unrated.unmount();

    render(<AssessmentEditor {...editorProps} assessment={{ ...releasedAssessment, overallRating: 'Moderate' }} riskListItems={[riskListItem]} risks={[highRisk]} />);
    expect(screen.queryByText(/^The highest residual rating among the active risks/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument();
  });

  it('offers no curation, AI or discard control once released, and keeps Show, withdrawn cards and History', async () => {
    render(<AssessmentEditor {...editorProps} assessment={releasedAssessment} controlImplementations={{ 'risk-1': [implementation] }} proposals={{ ...proposalsRead, editable: false }} riskListItems={[riskListItem]} risks={[risk, withdrawnCritical]} />);

    for (const name of [/^Withdraw risk/, /^Reinstate risk/, /^Rewrite this risk/, /^Suggest more risks/, /^Confirm/, /^Reject/, /^Discard new risk/, /^Add Risk$/, /^Actions for/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'History of RSK-0042' })).toBeInTheDocument();
    expect(screen.getByText('This assessment has been released, so the AI can no longer propose changes and its risks can’t be withdrawn or reinstated.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Withdrawn (1)' }));
    const withdrawnCard = document.getElementById('risk-risk-3')!;
    expect(within(withdrawnCard).getByText('Reason: “Duplicate”')).toBeInTheDocument();
    expect(within(withdrawnCard).getByRole('button', { name: 'History of RSK-0044' })).toBeInTheDocument();
    expect(within(withdrawnCard).queryByRole('button', { name: /^Reinstate risk/ })).not.toBeInTheDocument();
  });

  it('gives the requesting analyst the readiness caption with no link and no count', () => {
    const requirements = [{ scope: 'assessment' as const, key: 'aiProposalsDecided', label: 'Decisions on AI proposals', state: 'outstanding' as const, destination: 'ai-proposals' }];
    render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, releaseReadiness: { ready: false, requirements } }} controlImplementations={{}} proposals={null} risks={[risk]} viewerRaisedRequest />);

    const outstanding = screen.getByRole('list', { name: 'Release requirements' });
    expect(within(outstanding).queryByRole('link', { name: 'Decisions on AI proposals' })).not.toBeInTheDocument();
    const row = within(outstanding).getByText('Decisions on AI proposals').closest('li')!;
    expect(within(row).getByText('This assessment has open AI proposals. Another Security Analyst decides them before release.')).toBeInTheDocument();
    expect(within(row).queryByText(/\d+ open/)).not.toBeInTheDocument();
  });
});
