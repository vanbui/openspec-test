import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RiskDetail } from './risk-schema';
import { RiskDetails, type RiskDetailsOptions } from './risk-details';

const actionMocks = vi.hoisted(() => ({
  createMitigationControlAction: vi.fn(),
  deleteMitigationControlAction: vi.fn(),
  updateMitigationControlAction: vi.fn(),
  updateRiskDetailAction: vi.fn(),
}));

/* The Risk detail route's reads, so its request-first suggestions can be proved without Strapi. */
const pageMocks = vi.hoisted(() => ({
  current: vi.fn(),
  granted: vi.fn(),
  getRiskDetail: vi.fn(),
  getAnalystAssessment: vi.fn(),
  getRequest: vi.fn(),
  listRiskTypes: vi.fn(),
  searchActiveUsersAction: vi.fn(),
  searchControlsAction: vi.fn(),
  searchInformationSystemsAction: vi.fn(),
  searchInformationAssetsAction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./risk-actions', () => actionMocks);
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: pageMocks.current, capabilitiesFor: () => ({ granted: pageMocks.granted }) }),
}));
vi.mock('@/features/risks/risk-service', () => ({ getRiskDetail: pageMocks.getRiskDetail }));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: pageMocks.getAnalystAssessment,
  listRiskTypes: pageMocks.listRiskTypes,
}));
vi.mock('@/features/requests/request-service', () => ({ getRequest: pageMocks.getRequest }));
vi.mock('@/features/assessments/assessment-actions', () => ({
  searchActiveUsersAction: pageMocks.searchActiveUsersAction,
  searchControlsAction: pageMocks.searchControlsAction,
}));
vi.mock('@/features/requests/request-actions', () => ({
  searchInformationSystemsAction: pageMocks.searchInformationSystemsAction,
  searchInformationAssetsAction: pageMocks.searchInformationAssetsAction,
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver);
Element.prototype.scrollIntoView ??= () => {};

import { RiskDetailsContent } from '../../../app/(app)/app/risks/[documentId]/page';

const detail: RiskDetail = {
  documentId: 'risk-alpha',
  riskNumber: 'RSK-2026-001',
  parentLock: 'mutable',
  issueStatement: 'Privileged service credentials are not rotated.',
  riskStatement: 'Customer identity data may be disclosed through a compromised service account.',
  riskCategory: 'Cyber security',
  riskSubCategory: 'Identity and access',
  riskCause: 'Long-lived credentials',
  potentialImpact: 'Customer data disclosure',
  dataClassification: 'Restricted',
  inherentLikelihood: 'Likely',
  highestInherentConsequence: 'Severe',
  inherentRating: 'Critical',
  inherentRatingRationale: 'Public exposure and privileged access.',
  residualLikelihood: 'Possible',
  highestResidualConsequence: 'Major',
  residualRating: 'High',
  residualRatingRationale: 'Rotation reduces likelihood but not consequence.',
  controlEffectiveness: 'Partially Effective',
  riskVelocity: 'Very High',
  identifiedDate: '2026-08-01',
  targetDate: '2026-09-30',
  closureDate: null,
  isExempted: false,
  exemptionReviewDate: '2026-10-15T02:00:00.000Z',
  escalationDetails: 'Escalate missed milestones to the CISO.',
  comments: 'Tracked in the quarterly treatment review.',
  riskCommunicationDate: '2026-08-12',
  treatmentAction: 'Treat',
  treatmentPlan: 'Rotate service credentials and enforce workload identity.',
  treatmentResolveDate: '2026-10-31',
  treatmentStatus: 'In Progress',
  riskType: { documentId: 'risk-type-1', name: 'Credential compromise', description: 'Compromise of reusable credentials.' },
  riskOwner: { documentId: 'user-alice', displayName: 'Alice Analyst' },
  treatmentOwner: { documentId: 'user-bob', displayName: 'Bob Doe' },
  informationSystemImpacted: { documentId: 'system-portal', name: 'Customer portal' },
  informationAssetImpacted: { documentId: 'asset-identity', name: 'Identity records' },
  assessment: { documentId: 'assessment-alpha', assessmentNumber: 'RA-2026-001', title: 'Customer portal review' },
  controlImplementations: [{
    documentId: 'implementation-1',
    control: { documentId: 'control-1', controlNumber: 'AC-02', name: 'Account management' },
    controlOwner: { documentId: 'user-bob', displayName: 'Bob Doe' },
    controlStatus: 'Implemented',
    effectivenessRating: 'Partially Effective',
    evidence: 'Credential rotation runbook and latest execution log.',
    implementationDueDate: '2026-09-15',
    implementedDate: '2026-08-20',
    reviewDate: '2026-11-20',
  }],
};

type PickerRecord = { documentId: string; name: string; detail?: string };
type PickerSearchResult = { ok: true; data: readonly PickerRecord[] } | { ok: false; formError: string };
const pickerSearch = () => vi.fn(async (_input: { search: string }): Promise<PickerSearchResult> => ({ ok: true, data: [] }));
const searchControls = pickerSearch();
const searchSystems = pickerSearch();
const searchAssets = pickerSearch();

const nist = 'NIST SP 800-53';
const options: RiskDetailsOptions = {
  riskTypes: [{
    documentId: 'risk-type-1',
    name: 'Credential compromise',
    description: 'Compromise of reusable credentials.',
    applicableControls: [
      { documentId: 'control-1', controlNumber: 'AC-02', name: 'Account management', framework: nist },
      { documentId: 'control-7', controlNumber: 'IA-05', name: 'Authenticator management', framework: nist },
    ],
  }],
  users: [detail.riskOwner!, detail.treatmentOwner!],
  // The originating request's selections, read by the page for a mutable Risk (D-30).
  requestSystems: [{ documentId: 'system-portal', name: 'Customer portal' }, { documentId: 'system-billing', name: 'Billing service' }],
  requestAssets: [{ documentId: 'asset-identity', name: 'Identity records' }],
  searchControls,
  searchSystems,
  searchAssets,
};

const searchOwners = vi.fn(async () => ({ ok: true as const, data: options.users }));

/** A control implementation as the create and update actions return it: the control's id and its served summary. */
function implementationResponse(control: { documentId: string; controlNumber: string; name: string } | null, documentId = 'implementation-1') {
  return {
    documentId,
    control: control?.documentId ?? 'control-1',
    controlSummary: control ? { ...control, framework: nist } : null,
    controlOwner: null,
    controlStatus: null,
    effectivenessRating: null,
    evidence: null,
    implementationDueDate: null,
    implementedDate: null,
    reviewDate: null,
  };
}

function definitionValue(term: string): HTMLElement {
  const terms = screen.getAllByText(term, { selector: 'dt' });
  expect(terms, `exactly one ${term} row`).toHaveLength(1);
  return terms[0]!.nextElementSibling as HTMLElement;
}

function renderDetails(overrides: Partial<React.ComponentProps<typeof RiskDetails>> = {}) {
  return render(<RiskDetails detail={detail} options={options} searchOwners={searchOwners} {...overrides} />);
}

afterEach(() => vi.useRealTimers());
beforeEach(() => {
  vi.clearAllMocks();
  for (const search of [searchControls, searchSystems, searchAssets]) search.mockResolvedValue({ ok: true, data: [] });
  actionMocks.updateRiskDetailAction.mockResolvedValue({ ok: true, data: {} });
  actionMocks.createMitigationControlAction.mockResolvedValue({ ok: true, data: implementationResponse(detail.controlImplementations[0]!.control) });
  actionMocks.updateMitigationControlAction.mockResolvedValue({ ok: true, data: implementationResponse(detail.controlImplementations[0]!.control) });
  actionMocks.deleteMitigationControlAction.mockResolvedValue({ ok: true, data: undefined });
});

describe('RiskDetails', () => {
  it('renders one complete contextual Risk in the five exact ordered sections', () => {
    const { container } = renderDetails();
    // A mutable Risk carries no status badge: only a locked Risk states that its assessment is released.
    expect(container.querySelector('[data-slot="badge"][data-tone]')).toBeNull();

    expect(screen.getByRole('heading', { level: 1, name: 'RSK-2026-001' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // D-38, UI-SPEC §17.1: the header describes the Risk by its statement alone.
    expect(screen.getByRole('heading', { level: 1, name: 'RSK-2026-001' }).nextElementSibling).toHaveTextContent(/^Customer identity data may be disclosed through a compromised service account\.$/);
    expect(screen.queryByText(/contextual/i)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Severity: critical (4 of 4)')).not.toHaveLength(0);
    expect(screen.getAllByLabelText('Severity: high (3 of 4)')).not.toHaveLength(0);

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Risk statement and classification',
      'Ratings',
      'Ownership and treatment',
      'Mitigation controls',
      'Related records',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Ratings' })).toHaveClass('text-heading-md');
    expect(screen.getByRole('heading', { level: 2, name: 'Ownership and treatment' })).toHaveClass('text-heading-md');

    for (const value of [
      'Issue statement', 'Risk statement', 'Risk category', 'Risk sub-category', 'Risk cause', 'Potential impact',
      'Data classification', 'Risk velocity', 'Risk type', 'Credential compromise', 'Compromise of reusable credentials.',
      'Inherent likelihood', 'Highest inherent consequence', 'Inherent rating', 'Inherent rating rationale',
      'Residual likelihood', 'Highest residual consequence', 'Residual rating', 'Residual rating rationale', 'Control effectiveness',
      'Risk owner', 'Treatment owner', 'Treatment action', 'Treatment plan', 'Treatment status', 'Identified date', 'Target date',
      'Treatment resolve date', 'Closure date', 'Risk communication date', 'Exempted', 'Exemption review date', 'Escalation details', 'Comments',
      'Control', 'Control owner', 'Control status', 'Effectiveness rating', 'Evidence', 'Implementation due date', 'Implemented date', 'Review date',
      'Related assessment', 'Information system impacted', 'Information asset impacted',
    ]) expect(screen.getAllByText(value).length).toBeGreaterThan(0);

    expect(screen.queryByText('Reusable control')).not.toBeInTheDocument();
    // D-36: the card heading and Control row name the control by its label, never `{number} — {name}`.
    expect(screen.getByRole('heading', { level: 3, name: 'AC-02 · Account management' })).toBeInTheDocument();
    expect(screen.queryByText('AC-02 — Account management')).not.toBeInTheDocument();
    expect(screen.getByText('1 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('15 Oct 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /RA-2026-001/ })).toHaveAttribute('href', '/app/review/assessments/assessment-alpha');
    // X-4 and the label rule (walkthrough fix 5): the number joins the title with a spaced middle dot, and the
    // relation labels read as the editors' (UI-SPEC §13.1, §15.2).
    expect(screen.getByRole('link', { name: 'RA-2026-001 · Customer portal review' })).toBeInTheDocument();
    expect(screen.queryByText(/Impacted Information/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /RA-2026-001/ })).toHaveClass('record-link');
    expect(container.querySelector('dl')).toHaveClass('md:grid-cols-2');
  });

  it('says when a Risk has no statement recorded, in its header (UI-SPEC §17.1)', () => {
    renderDetails({ detail: { ...detail, riskStatement: null } });

    expect(screen.getByRole('heading', { level: 1, name: 'RSK-2026-001' }).nextElementSibling).toHaveTextContent(/^No risk statement recorded$/);
  });

  it('anchors the Mitigation controls section so Control Implementation alerts can deep-link to it', () => {
    renderDetails();

    const heading = screen.getByRole('heading', { level: 2, name: 'Mitigation controls' });
    expect(heading).toHaveAttribute('id', 'mitigation-controls');
    expect(document.querySelectorAll('#mitigation-controls')).toHaveLength(1);
    // The section is still one labelled region named by that heading.
    expect(screen.getByRole('region', { name: 'Mitigation controls' })).toHaveAttribute('aria-labelledby', 'mitigation-controls');
    expect(screen.getByRole('region', { name: 'Mitigation controls' })).toHaveAccessibleDescription('Controls that mitigate this Risk, from the control library.');
  });

  it('brings the linked section into view once the streamed Risk renders', () => {
    /*
     * The detail streams behind its loading boundary, so the router's own hash scroll runs against
     * the skeleton. Once the Risk renders, the section the URL names is scrolled into view.
     */
    const scrolled: Element[] = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
    try {
      window.history.replaceState(null, '', '/app/risks/risk-alpha#mitigation-controls');
      const view = renderDetails();
      expect(scrolled).toEqual([screen.getByRole('heading', { level: 2, name: 'Mitigation controls' })]);
      view.unmount();

      scrolled.length = 0;
      window.history.replaceState(null, '', '/app/risks/risk-alpha');
      renderDetails().unmount();
      window.history.replaceState(null, '', '/app/risks/risk-alpha#no-such-section');
      renderDetails().unmount();
      window.history.replaceState(null, '', '/app/risks/risk-alpha#%E0%A4%A');
      renderDetails().unmount();
      expect(scrolled).toEqual([]);

      // A safe state has no section to scroll to.
      window.history.replaceState(null, '', '/app/risks/risk-alpha#mitigation-controls');
      render(<RiskDetails state="permission" />);
      expect(scrolled).toEqual([]);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      window.history.replaceState(null, '', '/');
    }
  });

  it('edits in a single column, submits only changed fields, announces outcomes, and confirms dirty discard', async () => {
    const user = userEvent.setup();
    const view = renderDetails();
    const edit = screen.getByRole('button', { name: 'Edit risk' });
    await user.click(edit);

    const form = screen.getByRole('form', { name: 'Edit Risk' });
    expect(screen.getByRole('region', { name: 'Risk statement and classification' })).toHaveAccessibleDescription('Edit this Risk’s details.');
    expect(form).toHaveClass('max-w-[640px]');
    expect(form.querySelector('.md\\:grid-cols-2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.');
    expect(actionMocks.updateRiskDetailAction).not.toHaveBeenCalled();

    const statement = screen.getByRole('textbox', { name: 'Risk statement' });
    await user.clear(statement);
    await user.type(statement, 'Updated contextual Risk statement.');
    await user.tab();
    expect(statement).toHaveAttribute('aria-describedby');
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskDetailAction).toHaveBeenCalledWith({
      riskId: 'risk-alpha',
      values: { riskStatement: 'Updated contextual Risk statement.' },
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Risk changes saved.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit risk' })).toHaveFocus());

    view.rerender(<RiskDetails detail={{ ...detail, riskStatement: 'Updated contextual Risk statement.' }} options={options} searchOwners={searchOwners} />);
    expect(screen.getByRole('status')).toHaveTextContent('Risk changes saved.');
    expect(within(screen.getByRole('region', { name: 'Risk statement and classification' })).getByText('Updated contextual Risk statement.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit risk' }));
    await user.type(screen.getByRole('textbox', { name: 'Comments' }), ' Unsaved');
    await user.click(screen.getByRole('button', { name: 'Discard risk changes' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Discard unsaved risk changes?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Discard risk changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit risk' })).toHaveFocus());
  });

  it('adds, edits, and removes contextual mitigation controls with authoritative feedback', async () => {
    const user = userEvent.setup();
    const view = renderDetails({ detail: { ...detail, controlImplementations: [] } });
    expect(screen.getByText('No mitigation controls added')).toBeInTheDocument();
    expect(screen.getByText('Add a control from the library to record how this Risk is mitigated.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add mitigation control' }));
    // The picker searches; there is no separate search box and no native select (UI-SPEC §13.5).
    expect(screen.queryByRole('textbox', { name: 'Search reusable Controls' })).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Add mitigation control' }).querySelector('select[name="control"]')).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: 'Control' }));
    fireEvent.click(screen.getByRole('option', { name: 'AC-02 · Account management' }));
    await user.click(screen.getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.createMitigationControlAction).toHaveBeenCalledWith({ riskId: 'risk-alpha', values: expect.objectContaining({ control: 'control-1' }) }));
    expect(screen.getByRole('status')).toHaveTextContent('Mitigation control added.');

    view.rerender(<RiskDetails detail={detail} options={options} searchOwners={searchOwners} />);
    await user.click(screen.getByRole('button', { name: 'Edit mitigation control' }));
    const evidence = screen.getByRole('textbox', { name: 'Evidence' });
    await user.clear(evidence);
    await user.type(evidence, 'Updated evidence.');
    await user.click(screen.getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.updateMitigationControlAction).toHaveBeenCalledWith({
      riskId: 'risk-alpha', implementationId: 'implementation-1', values: { evidence: 'Updated evidence.' },
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Mitigation control changes saved.');

    await user.click(screen.getByRole('button', { name: 'Remove mitigation control' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This removes the control from this Risk. The control stays in the library.');
    actionMocks.deleteMitigationControlAction.mockResolvedValueOnce({ ok: false, formError: 'Removal failed safely.' });
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove mitigation control' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Removal failed safely.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    actionMocks.deleteMitigationControlAction.mockResolvedValueOnce({ ok: true, data: undefined });
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove mitigation control' }));
    await waitFor(() => expect(screen.queryByText('AC-02 · Account management')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Mitigation control removed.');
  });

  it('chooses any active user as the control owner and names the card from the response (D-28, UAT-034)', async () => {
    const user = userEvent.setup();
    const zoe = { documentId: 'user-zoe', displayName: 'Zoe Owner' };
    searchOwners.mockResolvedValue({ ok: true, data: [zoe] });
    actionMocks.updateMitigationControlAction.mockResolvedValue({ ok: true, data: { ...implementationResponse(detail.controlImplementations[0]!.control), controlOwner: zoe } });
    renderDetails();
    await user.click(screen.getByRole('button', { name: 'Edit mitigation control' }));

    const owner = screen.getByRole('combobox', { name: 'Control owner' });
    expect(owner.tagName).toBe('INPUT');
    expect(screen.getByText('Selected owner: Bob Doe')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Edit mitigation control' }).querySelector('select[name="controlOwner"]')).toBeNull();
    await user.type(owner, 'Zo');
    await user.click(await screen.findByRole('option', { name: 'Zoe Owner' }));
    expect(searchOwners).toHaveBeenLastCalledWith({ search: 'Zo' });
    expect(screen.getByText('Selected owner: Zoe Owner')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.updateMitigationControlAction).toHaveBeenCalledWith({
      riskId: 'risk-alpha', implementationId: 'implementation-1', values: { controlOwner: 'user-zoe' },
    }));
    // The card takes its owner from the saved control implementation, not from the names already on the Risk.
    expect(definitionValue('Control owner')).toHaveTextContent(/^Zoe Owner$/);
    expect(screen.getByRole('status')).toHaveTextContent('Mitigation control changes saved.');
  });

  it('opens the mitigation form on its Control picker with the Risk Type’s applicable controls first (D-31, UI-SPEC §13.1)', async () => {
    const user = userEvent.setup();
    renderDetails({ detail: { ...detail, controlImplementations: [] } });
    await user.click(screen.getByRole('button', { name: 'Add mitigation control' }));

    const picker = screen.getByRole('combobox', { name: 'Control' });
    await waitFor(() => expect(picker).toHaveFocus());
    expect(picker).toHaveAccessibleDescription('Search by control number, name or framework. Controls that apply to the Risk Type come first.');
    fireEvent.click(picker);
    const group = screen.getByRole('group', { name: 'Applicable to Credential compromise' });
    expect(within(group).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([
      'AC-02 · Account management',
      'IA-05 · Authenticator management',
    ]);
  });

  it('searches the whole control library and names the new card from the served summary (D-29, D-36)', async () => {
    vi.useFakeTimers();
    searchControls.mockResolvedValue({ ok: true, data: [{ documentId: 'control-90', name: 'SC-07 · Boundary protection', detail: nist }] });
    actionMocks.createMitigationControlAction.mockResolvedValue({ ok: true, data: implementationResponse({ documentId: 'control-90', controlNumber: 'SC-07', name: 'SC-07 — Boundary protection' }, 'implementation-90') });
    renderDetails({ detail: { ...detail, controlImplementations: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Add mitigation control' }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Control' }), { target: { value: 'SC-07' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchControls).toHaveBeenCalledWith({ search: 'SC-07' });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'SC-07 · Boundary protection' }));
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Save mitigation control' }));

    await waitFor(() => expect(actionMocks.createMitigationControlAction).toHaveBeenCalledWith({ riskId: 'risk-alpha', values: expect.objectContaining({ control: 'control-90' }) }));
    expect(await screen.findByRole('heading', { level: 3, name: 'SC-07 · Boundary protection' })).toBeInTheDocument();
    expect(definitionValue('Control')).toHaveTextContent(/^SC-07 · Boundary protection$/);
  });

  it('asks for a control before saving a mitigation control (UI-SPEC §13.1)', async () => {
    const user = userEvent.setup();
    renderDetails({ detail: { ...detail, controlImplementations: [] } });
    await user.click(screen.getByRole('button', { name: 'Add mitigation control' }));
    await user.click(screen.getByRole('button', { name: 'Save mitigation control' }));

    const message = await screen.findByText('Choose a control.');
    const input = screen.getByRole('combobox', { name: 'Control' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Choose a control.'));
    expect(message).toBeInTheDocument();
    expect(actionMocks.createMitigationControlAction).not.toHaveBeenCalled();
  });

  it('says when a saved control can no longer be named (UI-SPEC §13.5)', async () => {
    const user = userEvent.setup();
    actionMocks.createMitigationControlAction.mockResolvedValue({ ok: true, data: implementationResponse(null, 'implementation-unnamed') });
    renderDetails({ detail: { ...detail, controlImplementations: [] } });
    await user.click(screen.getByRole('button', { name: 'Add mitigation control' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Control' }));
    fireEvent.click(screen.getByRole('option', { name: 'IA-05 · Authenticator management' }));
    await user.click(screen.getByRole('button', { name: 'Save mitigation control' }));

    expect(await screen.findByText('The selected control is no longer available. Choose another control.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('implementation-unnamed');
  });

  it('picks the impacted system and asset from the request first, labelled by the Risk’s served relations (D-28, D-30)', async () => {
    const user = userEvent.setup();
    renderDetails();
    await user.click(screen.getByRole('button', { name: 'Edit risk' }));

    const systemPicker = screen.getByRole('combobox', { name: 'Information system impacted' });
    expect(systemPicker).toHaveAccessibleDescription('Search by name. Systems selected on the request come first.');
    expect(screen.getByText('Selected system: Customer portal')).toBeInTheDocument();
    expect(screen.getByText('Selected asset: Identity records')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Edit Risk' }).querySelector('select[name="informationSystemImpacted"], select[name="informationAssetImpacted"]')).toBeNull();

    fireEvent.click(systemPicker);
    expect(within(screen.getByRole('group', { name: 'On this request' })).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual(['Customer portal', 'Billing service']);
    fireEvent.click(screen.getByRole('option', { name: 'Billing service' }));
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskDetailAction).toHaveBeenCalledWith({ riskId: 'risk-alpha', values: { informationSystemImpacted: 'system-billing' } }));
    expect(screen.getByRole('status')).toHaveTextContent('Risk changes saved.');
    expect(screen.getByText('Billing service')).toBeInTheDocument();
  });

  it('enters the exemption review date as a date and keeps an untouched value as it was (D-32, UI-SPEC §13.3)', async () => {
    const user = userEvent.setup();
    renderDetails({ detail: { ...detail, exemptionReviewDate: '2026-10-15T13:45:00Z' } });
    await user.click(screen.getByRole('button', { name: 'Edit risk' }));

    const field = screen.getByLabelText('Exemption review date');
    expect(field).toHaveAttribute('type', 'date');
    expect(field).toHaveValue('2026-10-15');
    expect(field).not.toHaveAccessibleDescription();
    expect(screen.queryByText(/UTC format/)).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Comments' }), ' Reviewed.');
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskDetailAction).toHaveBeenCalledWith({
      riskId: 'risk-alpha',
      values: { comments: 'Tracked in the quarterly treatment review. Reviewed.' },
    }));
  });

  it('saves a chosen exemption review date at 00:00 UTC and a cleared one as no date (D-32)', async () => {
    const user = userEvent.setup();
    renderDetails({ detail: { ...detail, exemptionReviewDate: '2026-10-15T13:45:00Z' } });
    await user.click(screen.getByRole('button', { name: 'Edit risk' }));
    fireEvent.change(screen.getByLabelText('Exemption review date'), { target: { value: '2026-11-11' } });
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskDetailAction).toHaveBeenLastCalledWith({ riskId: 'risk-alpha', values: { exemptionReviewDate: '2026-11-11T00:00:00.000Z' } }));
    expect(await screen.findByText('11 Nov 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit risk' }));
    expect(screen.getByLabelText('Exemption review date')).toHaveValue('2026-11-11');
    fireEvent.change(screen.getByLabelText('Exemption review date'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    await waitFor(() => expect(actionMocks.updateRiskDetailAction).toHaveBeenLastCalledWith({ riskId: 'risk-alpha', values: { exemptionReviewDate: null } }));
  });

  it('searches only, with no group label, when the request’s selections could not be read (research Open Question 2)', async () => {
    vi.useFakeTimers();
    searchSystems.mockResolvedValue({ ok: true, data: [{ documentId: 'system-26', name: 'Picker proof 26' }] });
    renderDetails({ options: { ...options, requestSystems: [], requestAssets: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit risk' }));

    const systemPicker = screen.getByRole('combobox', { name: 'Information system impacted' });
    fireEvent.click(systemPicker);
    expect(screen.getByText('Type to search information systems.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'On this request' })).not.toBeInTheDocument();

    fireEvent.change(systemPicker, { target: { value: 'Picker proof 26' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchSystems).toHaveBeenCalledWith({ search: 'Picker proof 26' });
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Picker proof 26' }));
    expect(screen.getByText('Selected system: Picker proof 26')).toBeInTheDocument();
  });

  it('renders released detail semantically with no mutation or prefetch affordance', () => {
    const { container } = renderDetails({ detail: { ...detail, parentLock: 'released' }, options: undefined, searchOwners: undefined });
    // The header states the status with the shared assessment badge; the read-only consequence is the Alert's.
    const status = container.querySelector<HTMLElement>('.page-header [data-slot="badge"][data-tone]');
    expect(status).toHaveTextContent(/^Released$/);
    expect(status).toHaveAttribute('data-tone', 'success');
    expect(status).toHaveAttribute('data-variant', 'success');
    expect(status?.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.queryByText('Released — read only')).not.toBeInTheDocument();
    expect(screen.getByText('Released assessment - read only')).toBeInTheDocument();
    expect(screen.queryByText('Released assessment — read only')).not.toBeInTheDocument();
    // W-12: the notice keeps the section rhythm, one gap-8 step above the first section, instead of touching it.
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('Released assessment - read only');
    expect(notice.parentElement).toHaveClass('grid', 'gap-8');
    expect(notice.nextElementSibling).toHaveTextContent('Risk statement and classification');
    expect(screen.getByText('This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Risk statement and classification' })).getByText('Customer identity data may be disclosed through a compromised service account.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Save|Add|Remove|Close/i })).not.toBeInTheDocument();
    expect(container.querySelector('[disabled]')).not.toBeInTheDocument();
    expect(container.querySelector('link[rel="prefetch"]')).not.toBeInTheDocument();
  });

  it('keeps PageHeader orientation while safe states disclose no Risk facts', async () => {
    const view = render(<RiskDetails state="loading" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Risk details' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading Risk details' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="risk-detail-skeleton-section"]')).toHaveLength(0);
    await waitFor(() => expect(document.querySelectorAll('[data-slot="risk-detail-skeleton-section"]')).toHaveLength(5), { timeout: 600 });

    for (const state of ['not-available', 'permission'] as const) {
      view.rerender(<RiskDetails detail={detail} state={state} />);
      expect(screen.getByRole('heading', { level: 1, name: 'Risk details' })).toBeInTheDocument();
      // D-45: the safe-state header describes the page without internal terms.
      expect(screen.getByText('View a Risk and the controls that mitigate it.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(state === 'permission' ? 'You don’t have permission to view the Risk Register' : 'Risk not available');
      expect(screen.queryByText('RSK-2026-001')).not.toBeInTheDocument();
      expect(screen.queryByText(detail.riskStatement!)).not.toBeInTheDocument();
      expect(screen.queryByText('Customer portal')).not.toBeInTheDocument();
    }

    view.rerender(<RiskDetails state="error" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Risk details' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this Risk');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('replaces stale editors after a 409 with released authority or safe not-available state', async () => {
    const user = userEvent.setup();
    const released = { ...detail, parentLock: 'released' as const };
    actionMocks.updateRiskDetailAction.mockResolvedValueOnce({ ok: false, conflict: true, authoritativeDetail: released, formError: 'This Risk changed.' });
    const view = renderDetails();
    await user.click(screen.getByRole('button', { name: 'Edit risk' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'Stale edit' } });
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    expect(await screen.findByText('Released assessment - read only')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    view.unmount();
    renderDetails();
    actionMocks.updateRiskDetailAction.mockResolvedValueOnce({ ok: false, conflict: true, notAvailable: true, formError: 'This Risk is no longer available.' });
    await user.click(screen.getByRole('button', { name: 'Edit risk' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Risk statement' }), { target: { value: 'Another stale edit' } });
    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    expect(await screen.findByText('Risk not available')).toBeInTheDocument();
    expect(screen.queryByText('RSK-2026-001')).not.toBeInTheDocument();
  });

  it('keeps the route synchronous, capability-gated, typed, and safe before lookup', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(app)/app/risks/[documentId]/page.tsx'), 'utf8');
    expect(page).toContain("'risk:manage'");
    expect(page.indexOf("'risk:manage'")).toBeLessThan(page.indexOf('getRiskDetail'));
    expect(page).toContain('documentIdSchema');
    expect(page).toContain('getRiskDetail');
    expect(page).toContain('<Suspense');
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/\bfetch\s*\(/);
  });
});

describe('the Risk detail route’s pickers (D-28, D-30)', () => {
  const routeProps = () => ({ params: Promise.resolve({ documentId: 'risk-alpha' }) });
  const request = {
    informationSystems: [{ documentId: 'system-portal', name: 'Customer portal' }],
    informationAssets: [{ documentId: 'asset-identity', name: 'Identity records' }],
  };

  async function routeOptions(): Promise<RiskDetailsOptions | undefined> {
    const element = await RiskDetailsContent(routeProps()) as ReactElement<React.ComponentProps<typeof RiskDetails>>;
    expect(element.props.state ?? 'ready').toBe('ready');
    return element.props.options;
  }

  beforeEach(() => {
    pageMocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
    pageMocks.granted.mockResolvedValue(new Set(['risk:manage', 'assessment:review']));
    pageMocks.getRiskDetail.mockResolvedValue({ data: detail, error: null });
    pageMocks.listRiskTypes.mockResolvedValue({ data: options.riskTypes, error: null });
    pageMocks.getAnalystAssessment.mockResolvedValue({ data: { assessmentRequest: { documentId: 'request-alpha' } }, error: null });
    pageMocks.getRequest.mockResolvedValue({ data: request, error: null });
  });

  it('offers the originating request’s systems and assets first, read through the Risk’s assessment', async () => {
    const routeOptionsResult = await routeOptions();
    expect(pageMocks.getAnalystAssessment).toHaveBeenCalledWith('assessment-alpha');
    expect(pageMocks.getRequest).toHaveBeenCalledWith('request-alpha');
    expect(routeOptionsResult?.requestSystems).toEqual(request.informationSystems);
    expect(routeOptionsResult?.requestAssets).toEqual(request.informationAssets);
    expect(routeOptionsResult?.riskTypes).toEqual(options.riskTypes);
    expect(routeOptionsResult?.searchControls).toBe(pageMocks.searchControlsAction);
    expect(routeOptionsResult?.searchSystems).toBe(pageMocks.searchInformationSystemsAction);
    expect(routeOptionsResult?.searchAssets).toBe(pageMocks.searchInformationAssetsAction);
  });

  it('degrades to search alone when the assessment or the request cannot be read', async () => {
    pageMocks.getAnalystAssessment.mockResolvedValueOnce({ data: null, error: { status: 403 } });
    expect((await routeOptions())?.requestSystems).toEqual([]);
    expect(pageMocks.getRequest).not.toHaveBeenCalled();

    pageMocks.getRequest.mockResolvedValueOnce({ data: null, error: { status: 500 } });
    const afterRequestFailure = await routeOptions();
    expect(afterRequestFailure?.requestSystems).toEqual([]);
    expect(afterRequestFailure?.requestAssets).toEqual([]);

    pageMocks.getRequest.mockRejectedValueOnce(new Error('network'));
    expect((await routeOptions())?.requestAssets).toEqual([]);
  });

  it('reads no assessment or request for a released Risk', async () => {
    pageMocks.getRiskDetail.mockResolvedValue({ data: { ...detail, parentLock: 'released' }, error: null });
    await RiskDetailsContent(routeProps());
    expect(pageMocks.getAnalystAssessment).not.toHaveBeenCalled();
    expect(pageMocks.getRequest).not.toHaveBeenCalled();
  });

  it('never loads the control library or an inventory page as options', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(app)/app/risks/[documentId]/page.tsx'), 'utf8');
    expect(page).not.toMatch(/listControls|listInformationSystems|listInformationAssets/);
    expect(page).toContain('getRequest(');
    expect(page).toContain('searchControlsAction');
    expect(page).toContain('searchInformationSystemsAction');
    expect(page).toContain('searchInformationAssetsAction');
  });
});
