import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestDraftInput, RequestMutationResult } from './request-schema';
import type { CsrmAssessmentRequest } from './request-domain';

vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const createRequestAction = vi.hoisted(() => vi.fn());
const updateRequestAction = vi.hoisted(() => vi.fn());
const submitRequestAction = vi.hoisted(() => vi.fn());
// Widened deliberately: a test that returns a record the initial page never
// contained is the point of the retained-selection case below.
type RelationSearchStub = Promise<{ ok: true; data: readonly { documentId: string; name: string }[] }>;
const searchInformationSystemsAction = vi.hoisted(() => vi.fn((): RelationSearchStub => Promise.resolve({ ok: true, data: systems })));
const searchInformationAssetsAction = vi.hoisted(() => vi.fn((): RelationSearchStub => Promise.resolve({ ok: true, data: assets })));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, refresh: vi.fn() }) }));
vi.mock('./request-actions', () => ({ createRequestAction, updateRequestAction, submitRequestAction, searchInformationSystemsAction, searchInformationAssetsAction }));

type InventoryOption = { documentId: string; name: string };
type RequestFormProps = {
  assets: readonly InventoryOption[];
  defaultValues?: Partial<RequestDraftInput>;
  documentId?: string;
  mode: 'create' | 'edit';
  systems: readonly InventoryOption[];
};

type RequestFormModule = {
  RequestForm?: ComponentType<RequestFormProps>;
  RequestWorkflowActions?: ComponentType<{ request: CsrmAssessmentRequest }>;
};

const formPath = resolve(process.cwd(), 'src/features/requests/request-form.tsx');
const workflowPath = resolve(process.cwd(), 'app/(app)/app/requests/[documentId]/page.tsx');
const sentinel = 'PHASE2_RED_W0_03B_FORM_WORKFLOW_UI_ABSENT';

const systems = [
  { documentId: 'system-1', name: 'Customer portal' },
  { documentId: 'system-2', name: 'Identity platform' },
] as const;
const assets = [
  { documentId: 'asset-1', name: 'Customer records' },
  { documentId: 'asset-2', name: 'Audit logs' },
] as const;

const persistedDraft: RequestDraftInput = {
  title: 'Customer portal review',
  description: 'Review the customer portal.',
  assessmentType: 'Project',
  division: 'Digital',
  businessUnit: 'Customer platforms',
  businessPurpose: 'Serve customers online',
  businessCriticality: 'High',
  thirdPartyInvolvement: true,
  thirdPartyDetails: 'Hosted by an approved provider',
  regulatoryRequirements: 'Privacy Act',
  dueDate: '2026-09-12',
  informationSystems: ['system-1'],
  informationAssets: ['asset-1'],
};

const submitted: RequestMutationResult = {
  ...persistedDraft,
  documentId: 'request-1',
  requestNumber: 'RAR-2026-X7K4Q2',
  requestStatus: 'submitted',
  submittedDate: '2026-08-29T00:00:00.000Z',
};

async function loadRequestForm(): Promise<ComponentType<RequestFormProps>> {
  if (!existsSync(formPath) || !existsSync(workflowPath)) throw new Error(sentinel);
  const moduleName = './request-' + 'form';
  const module = await import(/* @vite-ignore */ moduleName) as RequestFormModule;
  if (!module.RequestForm) throw new Error(sentinel);
  return module.RequestForm;
}

async function loadRequestWorkflowActions(): Promise<ComponentType<{ request: CsrmAssessmentRequest }> > {
  const moduleName = './request-' + 'workflow-actions';
  const module = await import(/* @vite-ignore */ moduleName) as RequestFormModule;
  if (!module.RequestWorkflowActions) throw new Error(sentinel);
  return module.RequestWorkflowActions;
}

beforeEach(() => {
  createRequestAction.mockReset();
  updateRequestAction.mockReset();
  submitRequestAction.mockReset();
});

describe('RequestForm', () => {
  it('offers the primary return-to-draft trigger first only in the eligible submitted state', async () => {
    const RequestWorkflowActions = await loadRequestWorkflowActions();
    const request = {
      documentId: 'request-1',
      requestNumber: 'RAR-2026-X7K4Q2',
      title: persistedDraft.title,
      requestStatus: 'submitted' as const,
      submittedDate: '2026-08-29T00:00:00.000Z',
      questionnaire: null,
      assessment: null,
      relationships: { questionnaire: { availability: 'absent' }, assessment: { availability: 'absent' } },
    } as CsrmAssessmentRequest;
    const view = render(<RequestWorkflowActions request={request} />);
    const trigger = screen.getByRole('button', { name: 'Return to draft' });
    expect(trigger).toHaveAttribute('data-variant', 'default');
    expect(trigger.parentElement?.parentElement?.firstElementChild).toContainElement(trigger);

    view.rerender(<RequestWorkflowActions request={{ ...request, requestStatus: 'draft' }} />);
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
  });

  it('maps every authoritative editable field and documents the sponsor contract gap', async () => {
    const RequestForm = await loadRequestForm();
    render(<RequestForm assets={assets} mode="create" systems={systems} />);

    for (const label of [
      'Request title', 'Description', 'Assessment type', 'Division', 'Business unit',
      'Business purpose', 'Business criticality', 'Third-party involvement',
      'Third-party details', 'Regulatory requirements', 'Due date',
      'Information systems', 'Information assets',
    ]) {
      if (label === 'Due date') {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
        continue;
      }
      expect(screen.getByRole(label === 'Third-party involvement' ? 'checkbox' : /Information/.test(label) ? 'group' : /Description|purpose|details|requirements/.test(label) ? 'textbox' : /type|criticality/.test(label) ? 'combobox' : 'textbox', { name: label })).toBeInTheDocument();
    }

    expect(screen.queryByLabelText(/sponsor/i)).not.toBeInTheDocument();
    expect(screen.getByText('Sponsor selection is not available in CSRM.')).toBeInTheDocument();
  });

  it('validates the authoritative title on blur and preserves values after a draft error', async () => {
    const RequestForm = await loadRequestForm();
    const user = userEvent.setup();
    createRequestAction.mockResolvedValueOnce({ ok: false, formError: 'The request service is unavailable. Please try again later.' });
    render(<RequestForm assets={assets} mode="create" systems={systems} />);

    const title = screen.getByRole('textbox', { name: 'Request title' });
    await user.click(title);
    await user.tab();
    const titleError = await screen.findByText('Enter a request title.');
    expect(titleError.closest('[data-slot="form-message"]')).toHaveClass('text-xs');
    expect(titleError.closest('[data-slot="form-message"]')?.querySelector('svg')).not.toBeNull();

    await user.type(title, 'Customer portal review');
    await user.type(screen.getByRole('textbox', { name: 'Division' }), 'Digital');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('request service is unavailable');
    expect(title).toHaveValue('Customer portal review');
    expect(screen.getByRole('textbox', { name: 'Division' })).toHaveValue('Digital');
    expect(createRequestAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Customer portal review', division: 'Digital' }));
  });

  it('keeps confirm-time validation visible and associates relation errors', async () => {
    const RequestForm = await loadRequestForm();
    const user = userEvent.setup();
    updateRequestAction.mockResolvedValueOnce({
      ok: false,
      fieldErrors: { informationSystems: ['Choose an authorised information system.'] },
    });
    render(<RequestForm assets={assets} defaultValues={{ ...persistedDraft, title: '' }} documentId="request-1" mode="edit" systems={systems} />);

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Check the highlighted fields before submitting this request.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Request title' })).toHaveFocus());

    await user.type(screen.getByRole('textbox', { name: 'Request title' }), persistedDraft.title);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    const systemsGroup = await screen.findByRole('group', { name: 'Information systems' });
    expect(systemsGroup).toHaveAttribute('aria-invalid', 'true');
    expect(systemsGroup.getAttribute('aria-describedby')).toMatch(/description.*message/);
    const relationError = screen.getByText('Choose an authorised information system.').closest('[data-slot="form-message"]');
    expect(relationError?.querySelector('svg')).not.toBeNull();
  });

  it('keeps a system chosen from search that was never in the initially rendered page', async () => {
    // The selector only renders one bounded page, so anything the user finds by
    // searching is absent from it. Deriving the chosen summaries from that page
    // dropped such an item from the display while still submitting its id.
    const offPage = { documentId: 'system-9', name: 'Payments gateway' };
    searchInformationSystemsAction.mockResolvedValueOnce({ ok: true, data: [offPage] });
    const user = userEvent.setup();
    const RequestForm = await loadRequestForm();
    render(<RequestForm assets={assets} mode="create" systems={systems} />);

    await user.type(screen.getByRole('combobox', { name: 'Search information systems' }), 'payments');
    const option = await screen.findByRole('option', { name: offPage.name }, { timeout: 5_000 });
    await user.click(option);

    const chosen = await screen.findByRole('list', { name: 'Selected Information systems' });
    expect(chosen).toHaveTextContent(offPage.name);
    expect(screen.getByRole('button', { name: `Remove ${offPage.name}` })).toBeInTheDocument();
  });

  it('preserves draft values and confirms submission, saying how to return to draft', async () => {
    const RequestForm = await loadRequestForm();
    const user = userEvent.setup();
    let resolveSubmission!: (value: { ok: true; data: RequestMutationResult }) => void;
    submitRequestAction.mockImplementationOnce(() => new Promise((resolve) => { resolveSubmission = resolve; }));

    render(
      <RequestForm
        assets={assets}
        defaultValues={persistedDraft}
        documentId="request-1"
        mode="edit"
        systems={systems}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Request title' })).toHaveValue(persistedDraft.title);
    expect(screen.getByRole('list', { name: 'Selected Information systems' })).toHaveTextContent('Customer portal');
    expect(screen.getByRole('list', { name: 'Selected Information assets' })).toHaveTextContent('Customer records');

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('A Security Analyst will review your request and send you a questionnaire to answer. Until they start work on it, you can return the request to draft to make changes.');
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(/irreversible|cannot be edited/i);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(submitRequestAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    const confirm = screen.getByRole('button', { name: 'Submit request' });
    await user.click(confirm);
    await user.click(confirm);
    expect(submitRequestAction).toHaveBeenCalledTimes(1);
    expect(submitRequestAction).toHaveBeenCalledWith({ documentId: 'request-1', ...persistedDraft });

    resolveSubmission({ ok: true, data: submitted });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText(/29 Aug 2026/)).toBeInTheDocument();
    const notice = screen.getByText(/You can return it to draft from the request page/).closest('[data-slot="alert-description"]');
    expect(notice?.textContent).toBe('Submitted 29 Aug 2026. You can return it to draft from the request page until a Security Analyst starts work on it.');
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Selected Information systems' })).toHaveTextContent('Customer portal');
    expect(screen.getByRole('list', { name: 'Selected Information assets' })).toHaveTextContent('Customer records');
  });

  it('keeps edit values available for retry after conflict and permission failures', async () => {
    const RequestForm = await loadRequestForm();
    const user = userEvent.setup();
    updateRequestAction.mockResolvedValueOnce({
      ok: false,
      formError: 'This request changed while you were editing it. Reload and try again.',
    });
    submitRequestAction.mockResolvedValueOnce({
      ok: false,
      formError: 'You do not have permission to save this request.',
    });

    render(<RequestForm assets={assets} defaultValues={persistedDraft} documentId="request-1" mode="edit" systems={systems} />);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('changed while you were editing');
    expect(screen.getByRole('textbox', { name: 'Request title' })).toHaveValue(persistedDraft.title);
    expect(updateRequestAction).toHaveBeenCalledWith({ documentId: 'request-1', ...persistedDraft });

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('list', { name: 'Selected Information systems' })).toHaveTextContent('Customer portal');
    expect(screen.getByRole('list', { name: 'Selected Information assets' })).toHaveTextContent('Customer records');
  });
});
