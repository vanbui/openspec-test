import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Suspense, use, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AnalystAssessmentDetail,
  AssessmentRiskListItem,
  ControlImplementation,
  AnalystRisk,
  RiskType,
  RiskUpdateInput,
} from './assessment-schema';
import { controlImplementationWritableFields, riskWritableFields } from './assessment-schema';
import { canMutateAssessment } from './assessment-domain';

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
vi.mock('./assessment-actions', () => actionMocks);

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);
Element.prototype.scrollIntoView ??= () => {};

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

/** The control editor's options: the owners, the Risk Type's applicable controls first, and the control search. */
const controlEditorOptions = {
  users: [analyst],
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

  it('renders the analyst request link and shared read-only lifecycle context', () => {
    const { container } = render(<AssessmentEditor {...editorProps} />);

    expect(screen.getByRole('link', { name: 'RAR-2026-0042: Customer portal security assessment' })).toHaveAttribute('href', '/app/review/requests/request-42');
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
      else if (label === 'Exemption review date') fireEvent.change(field, { target: { value: '2026-11-11T00:00:00Z' } });
      else fireEvent.change(field, { target: { value: `Updated ${label}` } });
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskAction).toHaveBeenCalledTimes(1));
    const update = actionMocks.updateRiskAction.mock.calls[0]?.[0];
    expect(update).toMatchObject({ assessmentId: 'assessment/id', riskId: 'risk-1' });
    expect(Object.keys(update.values).sort()).toEqual([...riskWritableFields].filter((field) => field !== 'riskOwner' && field !== 'treatmentOwner').sort());

    view.unmount();
    render(<RiskEditor assessmentId="assessment/id" mode="create" options={editorProps} searchOwners={searchOwners} />);
    fireEvent.change(screen.getByLabelText('Risk statement'), { target: { value: 'New contextual Risk' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    await waitFor(() => expect(actionMocks.createRiskAction).toHaveBeenCalledTimes(1));
  });

  it('hydrates every persisted Risk field after an editor remount', () => {
    const view = render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    view.unmount();
    render(<RiskEditor assessmentId="assessment/id" mode="edit" options={editorProps} risk={risk} searchOwners={searchOwners} />);
    for (const label of selectRiskLabels) {
      if (pickerChoices[label]) continue;
      const field = screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (field instanceof HTMLInputElement && field.type === 'checkbox') expect(field.checked).toBe(Boolean(risk.isExempted));
      else if (label === 'Exemption review date') expect(field).toHaveValue(risk.exemptionReviewDate ?? '');
      else expect(field).toHaveValue(String(risk[riskWritableFields[riskLabels.indexOf(label)]!] ?? ''));
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
    expect(systemPicker).toHaveAccessibleDescription('Search by name. Systems selected on the request come first.');
    expect(screen.getByRole('combobox', { name: 'Information asset impacted' })).toHaveAccessibleDescription('Search by name. Assets selected on the request come first.');
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

describe('readiness-gated release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retains every server requirement with explicit state and exact Risk anchors', () => {
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
    const requirements = [
      { scope: 'assessment' as const, key: 'reviewedBy', label: 'Reviewer', state: 'outstanding' as const },
      { scope: 'assessment' as const, key: 'summary', label: 'Summary', state: 'met' as const },
      { scope: 'risk' as const, key: 'riskStatement', label: 'Risk statement', state: 'outstanding' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
      { scope: 'risk' as const, key: 'riskOwner', label: 'Risk owner', state: 'met' as const, riskNumber: 'RSK-0042', destination: 'risk-risk-1' },
    ];
    const view = render(<AssessmentEditor {...editorProps} assessment={{ ...assessment, releaseReadiness: { ready: false, requirements } }} controlImplementations={{ 'risk-1': [] }} risks={[incompleteRisk]} />);

    for (const text of ['Reviewer', 'Summary', 'Risk RSK-0042 — Risk statement', 'Risk RSK-0042 — Risk owner']) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('link', { name: 'Summary' })).toHaveAttribute('href', '#assessment-details');
    expect(screen.getByRole('link', { name: 'Risk RSK-0042 — Risk statement' })).toHaveAttribute('href', '#risk-risk-1');
    expect(document.getElementById('risk-risk-1')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 release requirements met')).toBeInTheDocument();
    expect(screen.getAllByText('Met')).toHaveLength(2);
    expect(screen.getAllByText('Outstanding')).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'Release requirements' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release assessment' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /approve|submit for approval/i })).not.toBeInTheDocument();

    view.unmount();
    render(<AssessmentEditor {...editorProps} />);
    expect(screen.getByText('All release requirements are met')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Release requirements' })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /re-?review|record review|withdraw/i })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('link', { name: 'Risk RSK-0042 — At least one mitigation control' })).toBeInTheDocument();
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
