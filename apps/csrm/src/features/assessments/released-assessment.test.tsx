import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/app/assessments', useRouter: () => ({ replace: vi.fn() }) }));

import type {
  ControlImplementation,
  ReleasedAssessmentDetailForActor,
  ReleasedAssessmentSummary,
  Risk,
} from './assessment-schema';
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

const risk: Risk = {
  documentId: 'risk-1',
  riskNumber: 'RSK-0042',
  riskStatement: 'An attacker could misuse privileged access.',
  inherentRating: 'Critical',
  residualRating: 'Moderate',
};

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
    expect(within(view).getByRole('heading', { level: 3, name: 'Mitigation control implementations' })).toHaveClass('text-heading-sm');
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
    expect(within(view).getByRole('link', { name: 'RAR-2026-0042: Customer portal security assessment' })).toHaveAttribute('href', '/app/requests/request-42');
    expect(within(view).getByRole('heading', { name: 'Current lifecycle state: Released' })).toBeInTheDocument();
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
