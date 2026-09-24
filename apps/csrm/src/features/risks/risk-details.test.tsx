import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RiskDetail } from './risk-schema';
import { RiskDetails, type RiskDetailsOptions } from './risk-details';

const actionMocks = vi.hoisted(() => ({
  createMitigationControlAction: vi.fn(),
  deleteMitigationControlAction: vi.fn(),
  updateMitigationControlAction: vi.fn(),
  updateRiskDetailAction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./risk-actions', () => actionMocks);

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

const options: RiskDetailsOptions = {
  assets: [{ documentId: 'asset-identity', name: 'Identity records' }],
  controls: [{ documentId: 'control-1', controlNumber: 'AC-02', name: 'Account management' }],
  riskTypes: [{ documentId: 'risk-type-1', name: 'Credential compromise' }],
  systems: [{ documentId: 'system-portal', name: 'Customer portal' }],
  users: [detail.riskOwner!, detail.treatmentOwner!],
};

const searchOwners = vi.fn(async () => ({ ok: true as const, data: options.users }));

function renderDetails(overrides: Partial<React.ComponentProps<typeof RiskDetails>> = {}) {
  return render(<RiskDetails detail={detail} options={options} searchOwners={searchOwners} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  actionMocks.updateRiskDetailAction.mockResolvedValue({ ok: true, data: {} });
  actionMocks.createMitigationControlAction.mockResolvedValue({ ok: true, data: detail.controlImplementations[0] });
  actionMocks.updateMitigationControlAction.mockResolvedValue({ ok: true, data: detail.controlImplementations[0] });
  actionMocks.deleteMitigationControlAction.mockResolvedValue({ ok: true, data: undefined });
});

describe('RiskDetails', () => {
  it('renders one complete contextual Risk in the five exact ordered sections', () => {
    const { container } = renderDetails();

    expect(screen.getByRole('heading', { level: 1, name: 'RSK-2026-001' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Contextual Risk/)).toBeInTheDocument();
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
      'Reusable control', 'Control owner', 'Control status', 'Effectiveness rating', 'Evidence', 'Implementation due date', 'Implemented date', 'Review date',
      'Related assessment', 'Impacted Information system', 'Impacted Information asset',
    ]) expect(screen.getAllByText(value).length).toBeGreaterThan(0);

    expect(screen.getByText('1 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('15 Oct 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /RA-2026-001/ })).toHaveAttribute('href', '/app/review/assessments/assessment-alpha');
    expect(screen.getByRole('link', { name: /RA-2026-001/ })).toHaveClass('record-link');
    expect(container.querySelector('dl')).toHaveClass('md:grid-cols-2');
  });

  it('edits in a single column, submits only changed fields, announces outcomes, and confirms dirty discard', async () => {
    const user = userEvent.setup();
    const view = renderDetails();
    const edit = screen.getByRole('button', { name: 'Edit risk' });
    await user.click(edit);

    const form = screen.getByRole('form', { name: 'Edit Risk' });
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
    expect(screen.getByText('Updated contextual Risk statement.')).toBeInTheDocument();

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
    expect(screen.getByText('Add a reusable Control implementation to record how this Risk is mitigated.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add mitigation control' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Reusable control' }), 'control-1');
    await user.click(screen.getByRole('button', { name: 'Save mitigation control' }));
    await waitFor(() => expect(actionMocks.createMitigationControlAction).toHaveBeenCalled());
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
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This removes the contextual implementation from this Risk. The reusable Control remains in the library.');
    actionMocks.deleteMitigationControlAction.mockResolvedValueOnce({ ok: false, formError: 'Removal failed safely.' });
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove mitigation control' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Removal failed safely.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    actionMocks.deleteMitigationControlAction.mockResolvedValueOnce({ ok: true, data: undefined });
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove mitigation control' }));
    await waitFor(() => expect(screen.queryByText('AC-02 — Account management')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Mitigation control removed.');
  });

  it('renders released detail semantically with no mutation or prefetch affordance', () => {
    const { container } = renderDetails({ detail: { ...detail, parentLock: 'released' }, options: undefined, searchOwners: undefined });
    expect(screen.getByText('Released assessment — read only')).toBeInTheDocument();
    expect(screen.getByText('This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed.')).toBeInTheDocument();
    expect(screen.getByText('Customer identity data may be disclosed through a compromised service account.')).toBeInTheDocument();
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
    expect(await screen.findByText('Released assessment — read only')).toBeInTheDocument();
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
