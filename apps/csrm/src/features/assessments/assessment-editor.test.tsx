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

import { TimeZoneProvider } from '@/components/csrm/local-time';
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
        fireEvent.change(field, { target: { value: 'Zoe' } });
        fireEvent.click(await screen.findByRole('option', { name: 'Zoe Owner' }));
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

    await userEvent.type(owner, 'Zo');
    await userEvent.click(await screen.findByRole('option', { name: 'Zoe Owner' }));
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
    await userEvent.type(owner, 'Zo');
    expect(await screen.findByRole('option', { name: 'Zoe Owner' })).toBeInTheDocument();
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
    // The Risk that was already there shows no confirmation.
    expect(within(document.getElementById('risk-risk-1')!).getAllByRole('status').every((region) => region.textContent === '')).toBe(true);
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
