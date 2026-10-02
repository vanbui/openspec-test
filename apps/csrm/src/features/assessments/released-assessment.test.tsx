import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/app/assessments', useRouter: () => ({ replace: vi.fn() }) }));

import { TimeZoneProvider } from '@/components/csrm/local-time';

import type {
  AssessmentRiskListItem,
  ControlImplementation,
  ReleasedAssessmentDetailForActor,
  ReleasedAssessmentSummary,
} from './assessment-schema';
import { ReleasedRiskDetails } from './released-risk-details';
import {
  ReleasedAssessmentDetailView,
  ReleasedAssessmentDetailSkeleton,
  ReleasedAssessmentList,
  ReleasedAssessmentListSkeleton,
} from './released-assessment';

const releasedSummary: ReleasedAssessmentSummary = {
  documentId: 'assessment/id with spaces',
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'approved',
  summary: 'Released customer portal assessment.',
  overallRating: 'High',
  generatedDate: '2026-08-29T23:00:00.000Z',
  generatedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' },
  approvalDate: '2026-08-30T01:00:00.000Z',
};

const releasedDetail: ReleasedAssessmentDetailForActor = {
  actor: 'requestor',
  documentId: 'assessment/id with spaces',
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'approved',
  assessmentDate: '2026-08-30T01:00:00.000Z',
  generatedDate: '2026-08-29T23:00:00.000Z',
  nextReviewDate: '2027-02-28',
  approvalDate: '2026-08-30T01:00:00.000Z',
  summary: 'Released customer portal assessment.',
  overallRating: 'High',
  overallControlEffectiveness: 'Partially Effective',
  recommendationsSummary: 'Prioritise the planned access control.',
  overallRiskRationale: 'Internet exposure and privileged access drive the rating.',
  assessmentRequest: { documentId: 'request-42', requestNumber: 'RAR-2026-0042', title: 'Customer portal security assessment', requestStatus: 'approved' },
  generatedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' },
  reviewedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' },
  approvedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' },
};

const risk: AssessmentRiskListItem = {
  documentId: 'risk-1',
  riskNumber: 'RSK-0042',
  riskStatement: 'An attacker could misuse privileged access.',
  informationSystemImpacted: { documentId: 'system-1', name: 'Customer portal' },
  informationAssetImpacted: { documentId: 'asset-1', name: 'Customer records' },
  inherentLikelihood: 'Likely',
  highestInherentConsequence: 'Major',
  inherentRating: 'Critical',
  residualLikelihood: 'Possible',
  highestResidualConsequence: 'Moderate',
  residualRating: 'Moderate',
  treatmentAction: 'Treat',
  treatmentPlan: 'Enforce phishing-resistant MFA for administrators.',
  treatmentStatus: 'In Progress',
  riskOwner: { documentId: 'owner-2', displayName: 'Priya Nair' },
  treatmentOwner: { documentId: 'owner-3', displayName: 'Sam Lee' },
  targetDate: '2027-03-31',
};

const sparseRisk: AssessmentRiskListItem = {
  documentId: 'risk-2',
  riskNumber: 'RSK-0043',
  riskStatement: null,
  informationSystemImpacted: null,
  informationAssetImpacted: null,
  inherentLikelihood: null,
  highestInherentConsequence: null,
  inherentRating: null,
  residualLikelihood: null,
  highestResidualConsequence: null,
  residualRating: null,
  treatmentAction: null,
  treatmentPlan: null,
  treatmentStatus: null,
  riskOwner: null,
  treatmentOwner: null,
  targetDate: null,
};

/** The value beside a definition term, by the term's text. */
function definition(scope: HTMLElement, term: string): HTMLElement {
  const terms = within(scope).getAllByText(term, { selector: 'dt' });
  expect(terms, `exactly one ${term} row`).toHaveLength(1);
  const value = terms[0]!.nextElementSibling;
  expect(value?.tagName).toBe('DD');
  return value as HTMLElement;
}

const implementation: ControlImplementation = {
  documentId: 'implementation-1',
  control: 'control-1',
  controlSummary: {
    documentId: 'control-1',
    controlNumber: 'ACCESS-1a',
    name: 'ACCESS-1a — Establish Identities and Manage Authentication',
    framework: 'Essential Eight',
  },
  controlOwner: { documentId: 'owner-1', displayName: 'Jane Doe' },
  controlStatus: 'Planned',
  effectivenessRating: 'Partially Effective',
  evidence: 'Implementation plan approved.',
  implementationDueDate: '2026-11-30',
  implementedDate: null,
  reviewDate: '2027-01-31',
};

describe('owner-released assessment inventory', () => {
  it('renders encoded identifier RecordLinks and responsive DataTable variants', () => {
    const { container } = render(<ReleasedAssessmentList assessments={[releasedSummary]} />);

    expect(container.querySelector('[data-slot="data-table-mobile"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="data-table-desktop"]')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'ASM-0042' })).toHaveLength(2);
    for (const link of screen.getAllByRole('link', { name: 'ASM-0042' })) {
      expect(link).toHaveAttribute('href', '/app/assessments/assessment%2Fid%20with%20spaces');
      expect(link).toHaveClass('record-link');
    }
    const ratings = screen.getAllByText('High').map((rating) => rating.closest('[data-slot="badge"]'));
    expect(ratings).toHaveLength(2);
    for (const rating of ratings) {
      expect(rating).toBeInTheDocument();
      expect(rating?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    for (const summary of screen.getAllByText('Released customer portal assessment.')) {
      expect(summary.closest('a')).toBeNull();
    }
    expect(container.querySelector('tr[tabindex], article[tabindex]')).toBeNull();
  });

  it('labels the released status filter from the shared mapping while its value stays approved', () => {
    render(<ReleasedAssessmentList assessments={[releasedSummary]} />);

    const options = [...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')];
    expect(options.map((option) => [option.value, option.textContent])).toEqual([['', 'All statuses'], ['approved', 'Released']]);
  });

  it('labels the status filter chip from the shared mapping, never with the stored value', () => {
    render(<ReleasedAssessmentList assessments={[releasedSummary]} query={{ q: '', status: 'approved', sort: 'generatedDate:desc', page: 1, pageSize: 25 }} />);

    // The chip agrees with the option beside it: the stored approved reads Released (CONTEXT.md).
    const chip = screen.getByRole('button', { name: 'Remove Status filter' }).parentElement;
    expect(chip).toHaveTextContent('Status: Released');
    expect(chip).not.toHaveTextContent(/approved/i);
  });

  it('renders deliberate loading, empty, error, and permission states', () => {
    const { rerender } = render(<ReleasedAssessmentListSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading released risk assessments' })).toBeInTheDocument();

    rerender(<ReleasedAssessmentList assessments={[]} />);
    expect(screen.getByText('No released risk assessments yet')).toBeInTheDocument();

    rerender(<ReleasedAssessmentList assessments={[]} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');

    rerender(<ReleasedAssessmentList assessments={[]} state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('access to released risk assessments');
  });

  it('has no mutation affordance and routes only through the Requestor released inventory service', () => {
    const { container } = render(<ReleasedAssessmentList assessments={[releasedSummary]} />);

    // The inventory gained read-only search and filter controls, so a blanket
    // "no controls" assertion no longer expresses the rule. What must stay true
    // is that none of them can mutate an assessment: a Next.js server action
    // surfaces as an action/formaction attribute, and navigation-only search
    // never has one.
    for (const control of container.querySelectorAll('form, button, input')) {
      expect(control.hasAttribute('action')).toBe(false);
      expect(control.hasAttribute('formaction')).toBe(false);
    }
    const controlNames = [...container.querySelectorAll('input, textarea, select, button')]
      .map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '');
    expect(controlNames).toEqual([
      'Search risk assessments',
      'Search',
      'Filter by status',
      'Use compact density',
      'Sort by Assessment',
      'Sort by Released',
      'Rows per page',
      'Previous page',
      'Next page',
    ]);

    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/assessments/page.tsx'), 'utf8');
    expect(route).toContain('listMyReleasedAssessments');
    expect(route).not.toContain('listAnalystAssessments');
    expect(route).not.toContain('assessmentStatus ===');
  });
});

describe('immutable released assessment detail', () => {
  it('renders all fields available from the strict released assessment projection', () => {
    render(
      <ReleasedAssessmentDetailView
        assessment={releasedDetail}
        controlsByRisk={{ [risk.documentId]: [implementation] }}
        risks={[risk]}
        state="populated"
      />,
    );

    const view = screen.getByRole('article', { name: 'Released risk assessment ASM-0042' });
    expect(within(view).getByRole('heading', { level: 2, name: 'Assessment overview' })).toHaveClass('text-heading-md');
    expect(within(view).getByRole('heading', { level: 2, name: 'Identified risks' })).toHaveClass('text-heading-md');
    // UI-SPEC §15.2: h2 Identified risks, h3 per Risk, h4 per group, so no level is skipped.
    expect(within(view).getByRole('heading', { level: 3, name: 'RSK-0042' })).toBeInTheDocument();
    for (const group of ['Ratings', 'Ownership and treatment', 'Mitigation control implementations']) {
      expect(within(view).getByRole('heading', { level: 4, name: group })).toHaveClass('text-heading-sm');
    }
    expect(within(view).getByRole('region', { name: 'Mitigation control implementations' })).toBeInTheDocument();
    for (const value of [
      'Released customer portal assessment.',
      'Internet exposure and privileged access drive the rating.',
      'Prioritise the planned access control.',
      'Partially Effective',
      'Bob Doe',
      'An attacker could misuse privileged access.',
      'Critical',
      'Moderate',
      'Jane Doe',
      'Planned',
      'Implementation plan approved.',
    ]) {
      expect(within(view).getAllByText(value).length).toBeGreaterThan(0);
    }
    expect(within(view).getByText('28 February 2027')).toBeInTheDocument();
    expect(within(view).getByText('30 November 2026')).toBeInTheDocument();
    expect(within(view).getByText('31 January 2027')).toBeInTheDocument();
    expect(within(view).getByRole('link', { name: 'RAR-2026-0042 · Customer portal security assessment' })).toHaveAttribute('href', '/app/requests/request-42');
    expect(within(view).getByRole('heading', { name: 'Current lifecycle state: Released' })).toBeInTheDocument();
    // UI-SPEC §15.1 and §15.3: the release is named as a release, and the description says what the list holds.
    expect(definition(view, 'Release date')).toBeInTheDocument();
    expect(definition(view, 'Released by')).toHaveTextContent(/^Bob Doe$/);
    expect(within(view).queryByText('Approval date')).not.toBeInTheDocument();
    expect(within(view).queryByText('Approved by')).not.toBeInTheDocument();
    expect(within(view).getByText('Each Risk with its ratings, treatment and the controls that mitigate it.')).toBeInTheDocument();
    expect(view.textContent).not.toMatch(/authoritative/i);
  });

  it('shows the assessment and release dates in the viewer’s local time and keeps calendar dates as stored (D-19)', () => {
    // 15:30 UTC on 30 August is 01:30 on 31 August in Brisbane: only a zone-aware render shows the 31st.
    const lateUtc: ReleasedAssessmentDetailForActor = {
      ...releasedDetail,
      assessmentDate: '2026-08-30T15:30:00.000Z',
      approvalDate: '2026-08-30T15:30:00.000Z',
    };
    const { unmount } = render(
      <TimeZoneProvider zone="Australia/Brisbane">
        <ReleasedAssessmentDetailView assessment={lateUtc} controlsByRisk={{}} risks={[risk]} state="populated" />
      </TimeZoneProvider>,
    );

    let view = screen.getByRole('article', { name: 'Released risk assessment ASM-0042' });
    for (const term of ['Assessment date', 'Release date']) {
      const value = definition(view, term);
      expect(value, term).toHaveTextContent(/^31 August 2026$/);
      expect(value.querySelector('time'), term).toHaveAttribute('dateTime', '2026-08-30T15:30:00.000Z');
    }
    expect(definition(view, 'Next review date')).toHaveTextContent(/^28 February 2027$/);
    expect(definition(view, 'Target date')).toHaveTextContent(/^31 March 2027$/);
    unmount();

    // Before the zone is known the instant renders in UTC, and a date-only render carries no label.
    render(<ReleasedAssessmentDetailView assessment={lateUtc} controlsByRisk={{}} risks={[risk]} state="populated" />);
    view = screen.getByRole('article', { name: 'Released risk assessment ASM-0042' });
    expect(definition(view, 'Release date')).toHaveTextContent(/^30 August 2026$/);
  });

  it('renders a contract mismatch as the ordinary error state and never names the operation on the page (UI-SPEC §15.3)', () => {
    render(<ReleasedAssessmentDetailView state="contract-mismatch" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load this risk assessment');
    expect(alert).toHaveTextContent('Try again. If the problem continues, contact your administrator.');
    expect(document.body.textContent).not.toMatch(/contract|GET \/v1/i);

    const view = readFileSync(resolve(process.cwd(), 'src/features/assessments/released-assessment.tsx'), 'utf8');
    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/assessments/[documentId]/page.tsx'), 'utf8');
    expect(view).not.toContain('Response contract mismatch');
    expect(view).not.toContain('diagnosticOperation');
    expect(route).not.toContain('diagnosticOperation');
  });

  it('names each mitigation control by its number and title, never by its internal id (D-34, D-36)', () => {
    const untitled: ControlImplementation = {
      ...implementation,
      documentId: 'implementation-2',
      control: 'control-2',
      controlSummary: { documentId: 'control-2', controlNumber: '5.1', name: '5.1', framework: 'ISO/IEC 27001 Information security management systems — Annex A' },
    };
    const unnamed: ControlImplementation = { ...implementation, documentId: 'implementation-3', control: 'control-3', controlSummary: null };
    render(
      <ReleasedAssessmentDetailView
        assessment={releasedDetail}
        controlsByRisk={{ [risk.documentId]: [implementation, untitled, unnamed] }}
        risks={[risk]}
        state="populated"
      />,
    );

    const view = screen.getByRole('article', { name: 'Released risk assessment ASM-0042' });
    const controls = within(view).getAllByText('Control', { selector: 'dt' }).map((term) => term.nextElementSibling?.textContent);
    expect(controls).toEqual([
      'ACCESS-1a · Establish Identities and Manage Authentication',
      '5.1 · ISO/IEC 27001 Information security management systems — Annex A',
      'Not recorded',
    ]);
    expect(within(view).queryByText('Control reference')).not.toBeInTheDocument();
    for (const internalId of ['control-1', 'control-2', 'control-3', 'implementation-1']) {
      expect(view.textContent).not.toContain(internalId);
    }
  });

  it('shows each Risk’s system, asset, ratings, treatment and owners, never an internal id (D-34, UI-SPEC §15.2)', () => {
    render(
      <ReleasedAssessmentDetailView
        assessment={releasedDetail}
        controlsByRisk={{ [risk.documentId]: [implementation] }}
        risks={[risk]}
        state="populated"
      />,
    );

    const view = screen.getByRole('article', { name: 'Released risk assessment ASM-0042' });
    expect(definition(view, 'Information system impacted')).toHaveTextContent(/^Customer portal$/);
    expect(definition(view, 'Information asset impacted')).toHaveTextContent(/^Customer records$/);
    expect(definition(view, 'Inherent likelihood')).toHaveTextContent(/^Likely$/);
    expect(definition(view, 'Highest inherent consequence')).toHaveTextContent(/^Major$/);
    expect(definition(view, 'Inherent risk rating').querySelector('[data-slot="badge"]')).toHaveTextContent('Critical');
    expect(definition(view, 'Residual likelihood')).toHaveTextContent(/^Possible$/);
    expect(definition(view, 'Highest residual consequence')).toHaveTextContent(/^Moderate$/);
    expect(definition(view, 'Residual risk rating').querySelector('[data-slot="badge"]')).toHaveTextContent('Moderate');
    expect(definition(view, 'Risk owner')).toHaveTextContent(/^Priya Nair$/);
    expect(definition(view, 'Treatment owner')).toHaveTextContent(/^Sam Lee$/);
    expect(definition(view, 'Treatment action')).toHaveTextContent(/^Treat$/);
    expect(definition(view, 'Treatment status').querySelector('[data-slot="badge"]')).toHaveTextContent('In Progress');
    // A calendar date stays a calendar date (D-19).
    expect(definition(view, 'Target date')).toHaveTextContent(/^31 March 2027$/);
    expect(definition(view, 'Treatment plan')).toHaveTextContent(/^Enforce phishing-resistant MFA for administrators\.$/);
    for (const internalId of ['risk-1', 'system-1', 'asset-1', 'owner-2', 'owner-3', 'control-1', 'implementation-1']) {
      expect(view.textContent).not.toContain(internalId);
    }
  });

  it('reads an absent fact as plain Not recorded, never as a badge', () => {
    render(<ReleasedAssessmentDetailView assessment={releasedDetail} controlsByRisk={{}} risks={[sparseRisk]} state="populated" />);

    const view = screen.getByRole('article', { name: 'Released risk assessment ASM-0042' });
    for (const term of [
      'Information system impacted', 'Information asset impacted', 'Inherent likelihood', 'Highest inherent consequence',
      'Inherent risk rating', 'Residual likelihood', 'Highest residual consequence', 'Residual risk rating', 'Risk owner',
      'Treatment owner', 'Treatment action', 'Treatment status', 'Target date', 'Treatment plan',
    ]) {
      const value = definition(view, term);
      expect(value, term).toHaveTextContent(/^Not recorded$/);
      expect(value.querySelector('[data-slot="badge"]'), term).toBeNull();
    }
    expect(within(view).getByText('No mitigation control implementations are recorded.')).toBeInTheDocument();
  });

  it('lays a Risk out in one column, two from 640px and three from 1024px, with micro-labels and wide plan rows', () => {
    const { container } = render(<ReleasedRiskDetails groupHeadingLevel={4} implementations={[implementation]} risk={risk} />);

    const lists = [...container.querySelectorAll('dl')];
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    }
    for (const term of container.querySelectorAll('dt')) expect(term).toHaveClass('micro-label');
    for (const value of container.querySelectorAll('dd')) expect(value).toHaveClass('text-sm');
    for (const wide of ['Treatment plan', 'Evidence']) {
      expect(screen.getByText(wide, { selector: 'dt' }).parentElement).toHaveClass('sm:col-span-2', 'lg:col-span-3');
    }
  });

  it('takes its group heading level from its page, so the analyst’s read-only editor uses h3', () => {
    render(<ReleasedRiskDetails groupHeadingLevel={3} implementations={[]} risk={risk} />);

    for (const group of ['Ratings', 'Ownership and treatment', 'Mitigation control implementations']) {
      expect(screen.getByRole('heading', { level: 3, name: group })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument();
  });

  it('shows the header status as the shared Released assessment badge', () => {
    const { container } = render(
      <ReleasedAssessmentDetailView assessment={releasedDetail} controlsByRisk={{}} risks={[risk]} state="populated" />,
    );

    const badge = container.querySelector<HTMLElement>('.page-header > [data-slot="badge"]');
    expect(badge).toHaveTextContent(/^Released$/);
    expect(badge).toHaveAttribute('data-tone', 'success');
    expect(badge).toHaveAttribute('data-variant', 'success');
    expect(badge?.querySelectorAll('svg')).toHaveLength(1);
  });

  it('contains no editor, mutation, release, or disabled-control affordance', () => {
    const { container } = render(
      <ReleasedAssessmentDetailView
        assessment={releasedDetail}
        controlsByRisk={{ [risk.documentId]: [implementation] }}
        risks={[risk]}
        state="populated"
      />,
    );

    expect(container.querySelector('form, input, textarea, select, button')).not.toBeInTheDocument();
    expect(container.querySelector('[disabled]')).not.toBeInTheDocument();
    expect(screen.queryByText(/edit|delete|release assessment/i)).not.toBeInTheDocument();
  });

  it('discards sensitive data for permission, prerelease, and cross-owner failures', () => {
    for (const state of ['permission', 'unavailable'] as const) {
      const { unmount } = render(
        <ReleasedAssessmentDetailView
          assessment={releasedDetail}
          controlsByRisk={{ [risk.documentId]: [implementation] }}
          risks={[risk]}
          state={state}
        />,
      );
      expect(screen.queryByText('An attacker could misuse privileged access.')).not.toBeInTheDocument();
      expect(screen.queryByText('Implementation plan approved.')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('renders deliberate loading, empty, error, and permission detail states', () => {
    const { rerender } = render(<ReleasedAssessmentDetailSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading released risk assessment' })).toBeInTheDocument();

    rerender(<ReleasedAssessmentDetailView state="empty" />);
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');

    rerender(<ReleasedAssessmentDetailView state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load');

    rerender(<ReleasedAssessmentDetailView state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('permission');
  });

  it('uses only released detail descendants and maps missing records through notFound', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/assessments/[documentId]/page.tsx'), 'utf8');
    expect(route).toContain('getReleasedAssessment');
    expect(route).toContain('listReleasedAssessmentRisks');
    expect(route).toContain('listReleasedControlImplementations');
    expect(route).toContain('notFound()');
    expect(route).not.toContain('getAnalystAssessment');
    expect(route).not.toContain('listAssessmentRisks');
    expect(route).not.toContain('AssessmentEditor');
    expect(route).not.toContain('assessmentStatus ===');
  });

  it('provides concrete route loading and recoverable error boundaries', () => {
    const loading = readFileSync(resolve(process.cwd(), 'app/(app)/app/assessments/[documentId]/loading.tsx'), 'utf8');
    const error = readFileSync(resolve(process.cwd(), 'app/(app)/app/assessments/[documentId]/error.tsx'), 'utf8');
    expect(loading).toContain('ReleasedAssessmentDetailSkeleton');
    expect(error).toContain("'use client'");
    expect(error).toContain('reset');
  });
});
