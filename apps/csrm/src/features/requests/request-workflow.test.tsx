import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canRevertRequestToDraft, type AssessmentRequestRelationships, type CsrmAssessmentRequest } from './request-domain';
import { RequestWorkflowActions } from './request-workflow-actions';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  revertRequestToDraftAction: vi.fn(),
  submitRequestAction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('./request-actions', () => ({
  createRequestAction: vi.fn(),
  updateRequestAction: vi.fn(),
  submitRequestAction: mocks.submitRequestAction,
  revertRequestToDraftAction: mocks.revertRequestToDraftAction,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});

const routeRoot = resolve(process.cwd(), 'app/(app)/app/requests');

describe('request route workflow', () => {
  it('keeps authorised loading in Server Components and exposes all route states', () => {
    const files = [
      'new/page.tsx',
      'new/loading.tsx',
      '[documentId]/page.tsx',
      '[documentId]/edit/page.tsx',
      '[documentId]/edit/loading.tsx',
      '[documentId]/loading.tsx',
      '[documentId]/error.tsx',
    ];
    for (const file of files) expect(existsSync(resolve(routeRoot, file))).toBe(true);

    const detail = readFileSync(resolve(routeRoot, '[documentId]/page.tsx'), 'utf8');
    const edit = readFileSync(resolve(routeRoot, '[documentId]/edit/page.tsx'), 'utf8');
    expect(detail).toContain('await params');
    expect(detail).toContain('getRequest');
    expect(detail).not.toContain("'use client'");
    expect(edit).toContain('await params');
    expect(edit).toContain('getRequest');
    expect(edit).not.toContain("'use client'");
    expect(detail).not.toMatch(/\bfetch\s*\(/);
    expect(edit).not.toMatch(/\bfetch\s*\(/);
    expect(readFileSync(resolve(routeRoot, 'new/loading.tsx'), 'utf8')).toContain('RequestFormLoading');
    expect(readFileSync(resolve(routeRoot, '[documentId]/edit/loading.tsx'), 'utf8')).toContain('RequestFormLoading');
  });

  it('derives Requestor editability only from the authoritative returned status', async () => {
    const domainModule = './request-' + 'domain';
    const domain = await import(/* @vite-ignore */ domainModule) as {
      canRequestorEdit?: (status: string) => boolean;
    };
    if (!domain.canRequestorEdit) throw new Error('PHASE2_RED_W0_03B_FORM_WORKFLOW_UI_ABSENT');

    expect(domain.canRequestorEdit('draft')).toBe(true);
    for (const status of ['submitted', 'questionnaire-in-progress', 'risk-assessment-drafted', 'under-review', 'approved', 'closed'] as const) {
      expect(domain.canRequestorEdit(status)).toBe(false);
    }
  });

  it('does not expose Requestor mutation controls for a submitted detail payload', async () => {
    const actionsModule = './request-' + 'workflow-actions';
    const module = await import(/* @vite-ignore */ actionsModule) as {
      RequestWorkflowActions?: ComponentType<{ request: CsrmAssessmentRequest }>;
    };
    if (!module.RequestWorkflowActions) throw new Error('PHASE2_RED_W0_03B_FORM_WORKFLOW_UI_ABSENT');
    const request: CsrmAssessmentRequest = {
      documentId: 'request-1', requestNumber: 'RAR-2026-X7K4Q2', title: 'Portal review',
      description: null, requestStatus: 'submitted', submittedDate: '2026-08-29T00:00:00.000Z',
      dueDate: null, updatedAt: null, dueDateLabel: null, updatedDateLabel: null,
      informationSystems: [], informationAssets: [], questionnaire: null, assessment: null,
    };
    render(<module.RequestWorkflowActions request={request} />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit request' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
  });
});

const absent: AssessmentRequestRelationships = { questionnaire: { availability: 'absent' }, assessment: { availability: 'absent' } };

function requestIn(overrides: Partial<CsrmAssessmentRequest> = {}): CsrmAssessmentRequest {
  return {
    documentId: 'request-1', requestNumber: 'RAR-2026-X7K4Q2', title: 'Portal review', description: 'Expand the portal.',
    assessmentType: 'Project', division: 'Digital', businessUnit: 'Customer platforms', businessPurpose: 'Serve customers.',
    businessCriticality: 'High', thirdPartyInvolvement: false, thirdPartyDetails: null, regulatoryRequirements: null,
    requestStatus: 'draft', submittedDate: null, dueDate: null, updatedAt: null, dueDateLabel: null, updatedDateLabel: null,
    informationSystems: [], informationAssets: [], questionnaire: null, assessment: null, relationships: absent,
    ...overrides,
  };
}

/*
 * D-22: Strapi refuses to return a request to draft once a questionnaire or an assessment exists for it, so
 * both actors offer the action only from the served relationships, and a request read without them fails
 * closed.
 */
describe('canRevertRequestToDraft', () => {
  const questionnaire = { availability: 'available', documentId: 'q-1', questionnaireNumber: null, title: null, state: 'draft' } as const;
  const assessment = { availability: 'available', documentId: 'a-1', assessmentNumber: null, assessmentStatus: 'draft', residualRiskCounts: { Low: 0, Moderate: 0, High: 0, Critical: 0, total: 0 } } as const;

  it.each([
    ['submitted with both relations absent', requestIn({ requestStatus: 'submitted', relationships: absent }), true],
    ['submitted with a questionnaire it cannot open', requestIn({ requestStatus: 'submitted', relationships: { ...absent, questionnaire: { availability: 'unavailable' } } }), false],
    ['submitted with a questionnaire', requestIn({ requestStatus: 'submitted', relationships: { ...absent, questionnaire } }), false],
    ['submitted with an assessment', requestIn({ requestStatus: 'submitted', relationships: { ...absent, assessment } }), false],
    ['submitted with an assessment it cannot open', requestIn({ requestStatus: 'submitted', relationships: { ...absent, assessment: { availability: 'unavailable' } } }), false],
    ['a draft', requestIn({ requestStatus: 'draft', relationships: absent }), false],
    ['questionnaire in progress', requestIn({ requestStatus: 'questionnaire-in-progress', relationships: absent }), false],
    ['submitted, read without relationships', requestIn({ requestStatus: 'submitted', relationships: undefined }), false],
  ] as const)('%s', (_case, request, expected) => {
    expect(canRevertRequestToDraft(request)).toBe(expected);
  });
});

/*
 * UAT-037 (D-21): the actions come only from the refreshed request. An in-page submit result used to win
 * over the refreshed prop, so a return to draft in the same page session left the submitted actions.
 */
describe('RequestWorkflowActions after a transition', () => {
  const submittedAt = '2026-08-29T00:00:00.000Z';

  it('shows the refreshed request’s actions after an in-page submit and a return to draft, and moves focus to them', async () => {
    const user = userEvent.setup();
    mocks.submitRequestAction.mockResolvedValue({ ok: true, data: { documentId: 'request-1', requestStatus: 'submitted', submittedDate: submittedAt } });
    mocks.revertRequestToDraftAction.mockResolvedValue({ ok: true, data: { documentId: 'request-1', requestStatus: 'draft' } });
    const view = render(<RequestWorkflowActions request={requestIn()} />);

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    const submitDialog = screen.getByRole('alertdialog', { name: 'Submit this assessment request?' });
    expect(submitDialog).toHaveTextContent('A Security Analyst will review your request and send you a questionnaire to answer. Until they start work on it, you can return the request to draft to make changes.');
    expect(submitDialog).not.toHaveTextContent(/irreversible|cannot be edited/i);
    await user.click(within(submitDialog).getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Request submitted.');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    // The route refresh delivers the submitted request.
    view.rerender(<RequestWorkflowActions request={requestIn({ requestStatus: 'submitted', submittedDate: submittedAt })} />);
    const revert = screen.getByRole('button', { name: 'Return to draft' });
    expect(screen.getByText('Submitted', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/^Submitted/, { selector: 'p' })).toHaveTextContent(/^Submitted 29 Aug 2026$/);
    expect(screen.getByText('You can return this request to draft to make changes until a Security Analyst starts work on it.')).toBeInTheDocument();
    await waitFor(() => expect(revert).toHaveFocus());

    await user.click(revert);
    const revertDialog = screen.getByRole('alertdialog', { name: 'Return this request to draft?' });
    await user.type(within(revertDialog).getByLabelText('Reason'), 'Correct the scope');
    await user.click(within(revertDialog).getByRole('button', { name: 'Return request to draft' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Request returned to draft.');
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    // The route refresh delivers the draft: its actions replace the submitted ones without a reload.
    view.rerender(<RequestWorkflowActions request={requestIn({ revertReason: 'Correct the scope' })} />);
    const edit = screen.getByRole('link', { name: 'Edit request' });
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    await waitFor(() => expect(edit).toHaveFocus());
  });

  /* IN-203: the refresh after a transition settles it even when it serves the same status, so focus never jumps later. */
  it('settles a transition on the refresh that follows it, so a later status change never moves focus', async () => {
    const user = userEvent.setup();
    mocks.submitRequestAction.mockResolvedValue({ ok: true, data: { documentId: 'request-1', requestStatus: 'submitted', submittedDate: submittedAt } });
    const view = render(<RequestWorkflowActions request={requestIn()} />);

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Submit this assessment request?' })).getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    // The refresh serves the request still in draft (another change reached it first).
    view.rerender(<RequestWorkflowActions request={requestIn()} />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Edit request' })).toHaveFocus());

    // Later, while the person works elsewhere, a refresh serves a status change this page did not start.
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    view.rerender(<RequestWorkflowActions request={requestIn({ requestStatus: 'submitted', submittedDate: submittedAt })} />);
    expect(screen.getByRole('button', { name: 'Return to draft' })).not.toHaveFocus();
    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it('never moves focus on first render', () => {
    render(<RequestWorkflowActions request={requestIn({ requestStatus: 'submitted', submittedDate: submittedAt })} />);
    expect(screen.getByRole('button', { name: 'Return to draft' })).not.toHaveFocus();
  });

  it('explains that a request can no longer return to draft once a Security Analyst has started work', () => {
    render(<RequestWorkflowActions request={requestIn({
      requestStatus: 'submitted', submittedDate: submittedAt,
      relationships: { ...absent, questionnaire: { availability: 'available', documentId: 'q-1', questionnaireNumber: null, title: null, state: 'draft' } },
    })} />);
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    expect(screen.getByText('A Security Analyst has started work on this request, so it can no longer return to draft.')).toBeInTheDocument();
    expect(screen.queryByText(/You can return this request to draft/)).not.toBeInTheDocument();
  });
});
