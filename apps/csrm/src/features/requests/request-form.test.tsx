import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLayoutEffect, type AnchorHTMLAttributes, type ComponentType, type MouseEvent, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestDraftInput, RequestMutationResult } from './request-schema';
import type { CsrmAssessmentRequest, RequestAttachmentSummary } from './request-domain';
import type { RequestAttachment, RequestAttachmentsPage } from '../attachments/attachments-schema';

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
const routerReplace = vi.hoisted(() => vi.fn());
const files = vi.hoisted(() => ({ uploadAttachmentAction: vi.fn(), downloadAttachmentAction: vi.fn(), setAttachmentRemovalAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, refresh: vi.fn(), replace: routerReplace }) }));
vi.mock('./request-actions', () => ({ createRequestAction, updateRequestAction, submitRequestAction, searchInformationSystemsAction, searchInformationAssetsAction }));
vi.mock('@/features/attachments/attachments-actions', () => files);
/* next/link as it calls onClick, then onNavigate with preventDefault only (navigation-guard.test.tsx). */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: (event: { preventDefault: () => void }) => void }) => (
    <a {...props} href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => { onClick?.(event); event.preventDefault(); onNavigate?.({ preventDefault: () => undefined }); }}>{children}</a>
  ),
}));

import { GuardedLink, NavigationGuardProvider, useNavigationGuard } from '@/components/csrm/navigation-guard';
import { TimeZoneProvider } from '@/components/csrm/local-time';
import { AttachmentFileStoreProvider } from '@/features/attachments/file-store';

type InventoryOption = { documentId: string; name: string };
type RequestFormFiles = {
  requestId: string;
  viewer: 'requestor';
  summary: RequestAttachmentSummary;
  attachments: RequestAttachmentsPage | null;
  draftOwnerKey: string | null;
};
type RequestFormProps = {
  assets: readonly InventoryOption[];
  defaultValues?: Partial<RequestDraftInput>;
  documentId?: string;
  draftOwnerKey?: string | null;
  files?: RequestFormFiles | null;
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
  routerReplace.mockReset();
  for (const action of Object.values(files)) action.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
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

/* ---------------------------------------------------------------------------------------------------------------------
 * Phase 14 (D-26, D-27; 14-UI-SPEC §2; UI-D3, UI-D4): files with the request, on the new-request form and the draft's
 * edit form.
 * ------------------------------------------------------------------------------------------------------------------- */

const OWNER = 'owner-key-jane';
const PAYROLL = 'Payroll SaaS for the people team';
const pdf = (name: string) => new File(['%PDF-1.7'], name, { type: 'application/pdf', lastModified: 1 });
const docx = (name: string) => new File(['PK'], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', lastModified: 1 });
const xlsx = (name: string) => new File(['PK'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', lastModified: 1 });
const JANES_FILES = () => [pdf('vendor-security-pack.pdf'), docx('data-flow.docx'), xlsx('vendor-questionnaire.xlsx')];

function attachment(name: string, overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: `att-${name}`, fileName: name, fileType: 'pdf', byteSize: 1_457, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false }, ...overrides,
  };
}

const draftSummary: RequestAttachmentSummary = {
  count: 1, canAdd: true, refusal: null, window: 'intake', needsNote: false, remaining: 19, activeCount: 1, storedCount: 1,
  limits: { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 }, allowedTypes: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'],
};

function draftFiles(attachments: RequestAttachment[]): RequestFormFiles {
  const { count: _count, ...add } = draftSummary;
  return {
    requestId: 'request-1', viewer: 'requestor', summary: draftSummary, draftOwnerKey: OWNER,
    attachments: { attachments, meta: { total: attachments.length, removed: 0, add: { ...add, allowedTypes: [...add.allowedTypes] } } },
  };
}

function draftResult(documentId: string): { ok: true; data: RequestMutationResult } {
  return { ok: true, data: { ...persistedDraft, title: PAYROLL, documentId, requestNumber: 'RAR-2026-PAY001', requestStatus: 'draft', submittedDate: null } };
}

function GuardProbe() {
  return <span data-testid="guard">{useNavigationGuard().blocking ? 'blocking' : 'clear'}</span>;
}

/** The shell around the form: the leave guard and the tab's file store, with a guarded in-app link. */
function inShell(children: ReactNode) {
  return (
    <TimeZoneProvider zone="Australia/Sydney">
      <NavigationGuardProvider>
        <AttachmentFileStoreProvider>
          {children}
          <GuardProbe />
          <GuardedLink href="/app/requests">My requests</GuardedLink>
        </AttachmentFileStoreProvider>
      </NavigationGuardProvider>
    </TimeZoneProvider>
  );
}

async function renderNewForm() {
  const RequestForm = await loadRequestForm();
  return render(inShell(<RequestForm assets={assets} draftOwnerKey={OWNER} mode="create" systems={systems} />));
}

type Settle = (value: unknown) => void;

/** Each upload waits until the test settles it, in order. */
function deferredUploads(): Settle[] {
  const settles: Settle[] = [];
  files.uploadAttachmentAction.mockImplementation(() => new Promise((resolve) => settles.push(resolve)));
  return settles;
}

async function chooseFiles(user: ReturnType<typeof userEvent.setup>, chosen: File[]) {
  await user.upload(screen.getByLabelText('Add files'), chosen);
}

const queueRows = () => within(screen.getByRole('list', { name: 'Files being added' })).getAllByRole('listitem');
const uploadedName = (call: number) => ((files.uploadAttachmentAction.mock.calls[call]![0] as FormData).get('file') as File).name;
const uploadedTo = (call: number) => (files.uploadAttachmentAction.mock.calls[call]![0] as FormData).get('requestId');

describe('Supporting files on the new-request form (§2.1)', () => {
  it('adds a Supporting files section after Scope and timing, saying files are added when the draft is saved', async () => {
    await renderNewForm();
    const section = screen.getByRole('group', { name: 'Supporting files' });
    expect(section).toHaveAccessibleDescription('Add documents that help a Security Analyst understand this request, such as a vendor’s security pack, a data-flow diagram or a completed security questionnaire. Files are added when you save the draft.');
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Request overview', 'Business context', 'Scope and timing', 'Supporting files']);
    expect(within(section).getByRole('button', { name: 'Choose files' })).toBeInTheDocument();
    expect(section).toHaveTextContent('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 20 more can be added to this request');
  });

  it('lists the chosen files and sends none of them before the draft is saved', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderNewForm();
    await chooseFiles(user, JANES_FILES());
    expect(queueRows()).toHaveLength(3);
    expect(files.uploadAttachmentAction).not.toHaveBeenCalled();
    expect(createRequestAction).not.toHaveBeenCalled();
  });
});

describe('saving the draft with files (§2.2; D-26; UI-D3)', () => {
  it('creates the draft once, replaces the address with its edit route and adds the files in order before moving to the draft', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const settles = deferredUploads();
    createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    const replaceState = vi.spyOn(window.history, 'replaceState');
    await renderNewForm();

    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, JANES_FILES());
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(createRequestAction).toHaveBeenCalledTimes(1));
    expect(createRequestAction).toHaveBeenCalledWith(expect.objectContaining({ title: PAYROLL }), { stayOnPage: true });
    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(null, '', '/app/requests/request-9/edit'));
    expect(await screen.findByText(/^Draft saved at/)).toBeInTheDocument();
    const saving = screen.getByRole('button', { name: 'Adding files…' });
    expect(saving).toBeDisabled();
    await user.click(saving);

    const names = ['vendor-security-pack.pdf', 'data-flow.docx', 'vendor-questionnaire.xlsx'];
    for (const [index, name] of names.entries()) {
      await waitFor(() => expect(settles).toHaveLength(index + 1));
      expect(uploadedName(index)).toBe(name);
      expect(uploadedTo(index)).toBe('request-9');
      expect(routerReplace).not.toHaveBeenCalled();
      await act(async () => settles[index]!({ ok: true, data: attachment(name) }));
    }

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/app/requests/request-9'));
    expect(createRequestAction).toHaveBeenCalledTimes(1);
    expect(updateRequestAction).not.toHaveBeenCalled();
  });

  it('moves to the draft when a file is waiting for the malware check', async () => {
    const user = userEvent.setup({ applyAccept: false });
    files.uploadAttachmentAction.mockResolvedValue({ ok: true, data: attachment('vendor-security-pack.pdf', { state: 'pending' }) });
    createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, [pdf('vendor-security-pack.pdf')]);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/app/requests/request-9'));
  });

  it('saves as before when no file is chosen', async () => {
    const user = userEvent.setup();
    createRequestAction.mockResolvedValueOnce(undefined);
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(createRequestAction).toHaveBeenCalledTimes(1));
    expect(createRequestAction.mock.calls[0]).toHaveLength(1);
    expect(files.uploadAttachmentAction).not.toHaveBeenCalled();
  });

  it('keeps the chosen files listed, and sends none, when the form has errors', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderNewForm();
    await chooseFiles(user, JANES_FILES());
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Enter a request title.')).toBeInTheDocument();
    expect(queueRows()).toHaveLength(3);
    expect(createRequestAction).not.toHaveBeenCalled();
    expect(files.uploadAttachmentAction).not.toHaveBeenCalled();
  });

  it('keeps the chosen files listed, and sends none, when the draft can’t be created', async () => {
    const user = userEvent.setup({ applyAccept: false });
    createRequestAction.mockResolvedValueOnce({ ok: false, formError: 'The request service is unavailable. Please try again later.' });
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, JANES_FILES());
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('The request service is unavailable. Please try again later.')).toBeInTheDocument();
    expect(queueRows()).toHaveLength(3);
    expect(files.uploadAttachmentAction).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });
});

describe('Supporting files on the draft’s edit form (§2.3; UI-D4)', () => {
  async function renderEditForm(attachments: RequestAttachment[]) {
    const RequestForm = await loadRequestForm();
    render(inShell(<RequestForm assets={assets} defaultValues={persistedDraft} documentId="request-1" draftOwnerKey={OWNER} files={draftFiles(attachments)} mode="edit" systems={systems} />));
  }

  it('lists the draft’s files with Download and Remove, and says chosen files are added at once', async () => {
    await renderEditForm([attachment('vendor-security-pack.pdf')]);
    const section = screen.getByRole('group', { name: 'Supporting files' });
    expect(section).toHaveAccessibleDescription('Files are added as soon as you choose them, and stay with the draft whether or not you save your other changes.');
    const table = within(section).getByRole('table', { name: 'Files' });
    expect(within(table).getByText('vendor-security-pack.pdf')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Download vendor-security-pack.pdf' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Remove vendor-security-pack.pdf' })).toBeInTheDocument();
  });

  it('adds a chosen file to the draft at once', async () => {
    const user = userEvent.setup({ applyAccept: false });
    deferredUploads();
    await renderEditForm([]);
    await chooseFiles(user, [docx('data-flow.docx')]);
    await waitFor(() => expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(1));
    expect(uploadedName(0)).toBe('data-flow.docx');
    expect(uploadedTo(0)).toBe('request-1');
    expect(updateRequestAction).not.toHaveBeenCalled();
  });
});

/*
 * RESEARCH Pitfall 17: after the address is replaced, the queue's Server Action posts to the edit route. Every page that
 * hosts the queue renders it from the one module that imports the upload action, so the action is in that route's bundle
 * and Next never forwards a 25 MB body to another worker.
 */
describe('the upload action is in every route that hosts the queue (Pitfall 17)', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

  it('imports the queue in the request form and the Files section, and the queue imports the upload action', () => {
    expect(source('src/features/attachments/upload-queue.tsx')).toMatch(/import \{[^}]*\buploadAttachmentAction\b[^}]*\} from '\.\/attachments-actions'/);
    expect(source('src/features/requests/request-form.tsx')).toMatch(/from '@\/features\/attachments\/upload-queue'/);
    expect(source('src/features/attachments/files-section.tsx')).toMatch(/from '\.\/upload-queue'/);
  });
});

/* ---------------------------------------------------------------------------------------------------------------------
 * Phase 14 (D-26; UI-D29, UI-D35; 14-UI-SPEC §1.5, §2.2, §2.4, §10): no chosen file is lost when saving, leaving or
 * submitting.
 * ------------------------------------------------------------------------------------------------------------------- */

const EMPTY_FILE = 'This file is empty. Check it’s the file you meant and choose it again.';
const refusedUpload = { ok: false, kind: 'refused', reason: 'ATTACHMENT_EMPTY', offerNewNote: false, message: EMPTY_FILE };
const failedUpload = { ok: false, kind: 'retryable', offerNewNote: false, message: 'We couldn’t add this file. Try again.' };

/** Jane's three files with the second one refused by Strapi, saved from the new-request form. */
async function saveWithOneRefused(second: unknown = refusedUpload) {
  const user = userEvent.setup({ applyAccept: false });
  files.uploadAttachmentAction
    .mockResolvedValueOnce({ ok: true, data: attachment('vendor-security-pack.pdf') })
    .mockResolvedValueOnce(second)
    .mockResolvedValueOnce({ ok: true, data: attachment('vendor-questionnaire.xlsx') });
  createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
  const view = await renderNewForm();
  await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
  const chosen = JANES_FILES();
  await chooseFiles(user, chosen);
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  /* The save creates the draft and then adds the three files in turn; the notice follows the last of them. */
  await waitFor(() => expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(3));
  const title = await screen.findByText('1 file wasn’t added');
  /* The §2.2 notice, found by its slot: IN-503 decides its role, which its own test pins. */
  return { user, chosen, view, alert: title.closest<HTMLElement>('[data-slot="alert"]')! };
}

describe('when the draft is saved but a file is not added (§2.2; UI-D29)', () => {
  it('stays on the replaced address with the alert focused, offering Go to draft', async () => {
    const { alert } = await saveWithOneRefused();
    expect(window.location.pathname).toBe('/app/requests/request-9/edit');
    expect(alert).toHaveTextContent('Your draft is saved. Retry, remove or replace it, then save again, or go to the draft, where it stays listed for you to retry.');
    expect(within(alert).getByRole('link', { name: 'Go to draft' })).toHaveAttribute('href', '/app/requests/request-9');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveAttribute('tabindex', '-1');
    expect(routerReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(screen.getByText('2 of 3 files added · 1 not added')).toBeInTheDocument();
  });

  /* The pilot's walk, O8 (direction §4 Buttons: "touch targets ≥44px below 768px"): Go to draft was 95x32 at 375. */
  it('gives Go to draft the full width at the touch-target height below 768px', async () => {
    const { alert } = await saveWithOneRefused();
    expect(within(alert).getByRole('link', { name: 'Go to draft' })).toHaveClass('h-8', 'max-md:min-h-11', 'max-md:w-full');
  });

  /*
   * IN-503 (§2.2 "announced once"; 4.1.3): the notice is a group named by its title and described by its description, and
   * the focus move announces it. It is not a live region, so a recount as rows are retried or removed is not announced
   * again.
   */
  it('is a group named by its title and described by its description, announced by the focus move, never a live alert (IN-503)', async () => {
    const { alert, user } = await saveWithOneRefused();
    const notice = screen.getByRole('group', { name: '1 file wasn’t added' });
    expect(notice).toBe(alert);
    expect(notice).toHaveAccessibleDescription('Your draft is saved. Retry, remove or replace it, then save again, or go to the draft, where it stays listed for you to retry.');
    await waitFor(() => expect(notice).toHaveFocus());
    expect(notice).not.toHaveAttribute('role', 'alert');
    expect(notice).not.toHaveAttribute('aria-live');
    expect(screen.queryAllByRole('alert')).toEqual([]);
    /* A recount (the refused row taken off the list) is no announcement: the notice is still no live region. */
    await user.click(screen.getByRole('button', { name: 'Remove from list: data-flow.docx' }));
    expect(screen.queryAllByRole('alert')).toEqual([]);
  });

  it('names the files not added, written out, when more than one is not added', async () => {
    const user = userEvent.setup({ applyAccept: false });
    files.uploadAttachmentAction.mockResolvedValue(refusedUpload);
    createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, JANES_FILES());
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    const title = await screen.findByText('3 files weren’t added');
    expect(title.closest('[data-slot="alert"]')).toHaveTextContent('Retry, remove or replace them, then save again, or go to the draft, where they stay listed for you to retry.');
  });

  it('replaces a refused file in place and adds it to the draft at once', async () => {
    const { user } = await saveWithOneRefused();
    files.uploadAttachmentAction.mockResolvedValueOnce({ ok: true, data: attachment('data-flow-v2.docx') });
    const replacement = docx('data-flow-v2.docx');
    await user.click(screen.getByRole('button', { name: 'Choose another file to replace data-flow.docx' }));
    const hidden = document.querySelectorAll<HTMLInputElement>('input[type="file"][aria-hidden="true"]');
    await user.upload(hidden[hidden.length - 1]!, replacement);
    await waitFor(() => expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(4));
    expect(uploadedName(3)).toBe('data-flow-v2.docx');
    expect(uploadedTo(3)).toBe('request-9');
    await waitFor(() => expect(screen.queryByText('1 file wasn’t added')).toBeNull());
  });

  it('saves again by updating the same draft, never creating a second, and retries the file still listed', async () => {
    const { user, chosen } = await saveWithOneRefused(failedUpload);
    updateRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    files.uploadAttachmentAction.mockResolvedValueOnce({ ok: true, data: attachment('data-flow.docx') });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(updateRequestAction).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'request-9', title: PAYROLL }), { stayOnPage: true }));
    expect(createRequestAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(4));
    expect((files.uploadAttachmentAction.mock.calls[3]![0] as FormData).get('file')).toBe(chosen[1]);
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/app/requests/request-9'));
  });

  it('keeps a file not added through Go to draft, and the draft’s request page offers Retry with the same file', async () => {
    const { user, chosen, view } = await saveWithOneRefused(failedUpload);
    const goToDraft = screen.getByRole('link', { name: 'Go to draft' });
    await user.click(goToDraft);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    /* The draft's request page renders the one queue for the draft (§1.5, §2.3). */
    const { UploadQueue } = await import('@/features/attachments/upload-queue');
    view.rerender(inShell(<UploadQueue label="Add files" ownerKey={OWNER} remaining={18} requestId="request-9" scope="draft" />));
    expect(await screen.findByText('Restored from earlier in this session.')).toBeInTheDocument();
    files.uploadAttachmentAction.mockResolvedValueOnce({ ok: true, data: attachment('data-flow.docx') });
    await user.click(screen.getByRole('button', { name: 'Retry data-flow.docx' }));
    await waitFor(() => expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(4));
    expect((files.uploadAttachmentAction.mock.calls[3]![0] as FormData).get('file')).toBe(chosen[1]);
    expect(uploadedTo(3)).toBe('request-9');
  });
});

/*
 * WR-402 (14-UI-SPEC §2.2 step 5, §10): before the draft exists, a file the browser refused lives only in the form's queue,
 * so it is work for the first save like any other row: the save stays on the page, the refused row joins the draft's
 * kept files and the alert says what to do. Leaving by an in-app link before the draft exists asks first, because it
 * would lose the row.
 */
describe('a save with only refused files before the draft exists (§2.2, §10; WR-402)', () => {
  const docm = () => new File(['PK'], 'macro.docm', { lastModified: 1 });
  const TYPE_REFUSED = 'Not added. This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.';

  it('stays on the page with the alert, and keeps the refused file listed for the new draft', async () => {
    const user = userEvent.setup({ applyAccept: false });
    createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, [docm()]);
    expect(queueRows()[0]).toHaveTextContent(TYPE_REFUSED);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(createRequestAction).toHaveBeenCalledTimes(1));
    expect(createRequestAction).toHaveBeenCalledWith(expect.objectContaining({ title: PAYROLL }), { stayOnPage: true });
    const title = await screen.findByText('1 file wasn’t added');
    const alert = title.closest<HTMLElement>('[data-slot="alert"]')!;
    await waitFor(() => expect(alert).toHaveFocus());
    expect(window.location.pathname).toBe('/app/requests/request-9/edit');
    expect(routerReplace).not.toHaveBeenCalled();
    expect(files.uploadAttachmentAction).not.toHaveBeenCalled();
    expect(queueRows()).toHaveLength(1);
    expect(queueRows()[0]).toHaveTextContent('macro.docm');
    expect(queueRows()[0]).toHaveTextContent(TYPE_REFUSED);
    expect(within(queueRows()[0]!).getByRole('button', { name: 'Remove from list: macro.docm' })).toBeInTheDocument();
  });

  it('asks before an in-app link while only a refused file is listed before the draft exists', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderNewForm();
    await chooseFiles(user, [docm()]);
    await waitFor(() => expect(screen.getByTestId('guard')).toHaveTextContent('blocking'));
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Leave this request?' })).toBeInTheDocument();
  });
});

describe('leaving the new-request form (§10)', () => {
  async function leaveByLink(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    return screen.findByRole('alertdialog');
  }

  it('asks before an in-app link while the form holds unsaved fields', async () => {
    const user = userEvent.setup();
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    const dialog = await leaveByLink(user);
    expect(within(dialog).getByRole('heading', { name: 'Leave this request?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Your request and its files haven’t been saved. If you leave now, they’ll be lost.');
    expect(within(dialog).getByRole('button', { name: 'Leave page' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
  });

  it('asks before an in-app link, and warns before unloading, while files are chosen before the draft exists', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderNewForm();
    await chooseFiles(user, [pdf('vendor-security-pack.pdf')]);
    await waitFor(() => expect(screen.getByTestId('guard')).toHaveTextContent('blocking'));
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    const dialog = await leaveByLink(user);
    expect(within(dialog).getByRole('heading', { name: 'Leave this request?' })).toBeInTheDocument();
  });

  it('asks in the files’ words while a file is being added', async () => {
    const user = userEvent.setup({ applyAccept: false });
    deferredUploads();
    createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, JANES_FILES());
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByRole('button', { name: 'Adding files…' });
    const dialog = await leaveByLink(user);
    expect(within(dialog).getByRole('heading', { name: 'Leave while files are being added?' })).toBeInTheDocument();
  });

  /*
   * IN-502 (§10): once the first save has created the draft, the request is saved and its files not added are kept for
   * the tab, so leaving loses only the changes made since: the dialog says so, in the words of a saved request.
   */
  it('asks in a saved request’s words once the first save has created the draft (IN-502)', async () => {
    const { user } = await saveWithOneRefused();
    await user.type(screen.getByRole('textbox', { name: 'Division' }), ' and Finance');
    await waitFor(() => expect(screen.getByTestId('guard')).toHaveTextContent('blocking'));
    const dialog = await leaveByLink(user);
    expect(within(dialog).getByRole('heading', { name: 'Leave this request?' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription('Your changes to this request haven’t been saved. If you leave now, they’ll be lost.');
    expect(dialog).not.toHaveTextContent('its files');
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Leave page' })).toBeInTheDocument();
  });

  it('lets in-app links leave with only files not added, which stay kept, and warns only before unloading', async () => {
    const { user } = await saveWithOneRefused();
    expect(screen.getByTestId('guard')).toHaveTextContent('clear');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('the edit form’s submit dialog while files are being added (§2.4; UI-D5)', () => {
  it('says to wait and disables Submit request until the files are added', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const settles = deferredUploads();
    const RequestForm = await loadRequestForm();
    render(inShell(<RequestForm assets={assets} defaultValues={persistedDraft} documentId="request-1" draftOwnerKey={OWNER} files={draftFiles([])} mode="edit" systems={systems} />));
    await chooseFiles(user, [docx('data-flow.docx')]);
    await waitFor(() => expect(settles).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Wait until your files are added, then submit.');
    expect(within(dialog).getByRole('button', { name: 'Submit request' })).toBeDisabled();
    await act(async () => settles[0]!({ ok: true, data: attachment('data-flow.docx') }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Submit request' })).toBeEnabled());
    expect(dialog).not.toHaveTextContent('Wait until your files are added');
  });
});

/*
 * WR-504 (14-UI-SPEC §1.5, §2.2; D-26): Save draft reads the queue as it is once the save has answered, never as it was
 * when the save began, and the queue takes no change while the form saves. A file refused while the save is in flight
 * leaves the save free to end, kept with its reason; on the new-request form no file can be chosen or taken off the list
 * while the draft is being created, so exactly the files listed are sent.
 */
describe('Save draft while the files change under it (§1.5, §2.2; WR-504)', () => {
  function later() {
    let resolve!: (value: unknown) => void;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
  }

  it('on the draft’s edit form, a file refused while the save is in flight ends the save on Save draft, and keeps the refused row', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const settles = deferredUploads();
    const saved = later();
    updateRequestAction.mockImplementationOnce(() => saved.promise);
    const RequestForm = await loadRequestForm();
    render(inShell(<RequestForm assets={assets} defaultValues={persistedDraft} documentId="request-1" draftOwnerKey={OWNER} files={draftFiles([])} mode="edit" systems={systems} />));
    await chooseFiles(user, [docx('data-flow.docx')]);
    await waitFor(() => expect(settles).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(updateRequestAction).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'request-1' }), { stayOnPage: true }));
    /* Next runs Server Actions one at a time, so the file answers first: Strapi refuses it while the save waits. */
    await act(async () => settles[0]!(refusedUpload));
    await act(async () => saved.resolve(draftResult('request-1')));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Adding files…' })).toBeNull();
    expect(await screen.findByText('1 file wasn’t added')).toBeInTheDocument();
    expect(queueRows()).toHaveLength(1);
    expect(queueRows()[0]).toHaveTextContent('data-flow.docx');
    expect(queueRows()[0]).toHaveTextContent(`Not added. ${EMPTY_FILE}`);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(1);
  });

  it('on the new-request form, takes no file and lets none be taken off the list while the draft is created, then sends exactly the files listed', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const created = later();
    createRequestAction.mockImplementationOnce(() => created.promise);
    files.uploadAttachmentAction.mockImplementation(async (form: FormData) => ({ ok: true, data: attachment((form.get('file') as File).name) }));
    await renderNewForm();
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, [pdf('vendor-security-pack.pdf'), docx('data-flow.docx')]);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(createRequestAction).toHaveBeenCalledTimes(1));
    const section = screen.getByRole('group', { name: 'Supporting files' });
    expect(within(section).getByRole('button', { name: 'Choose files' })).toBeDisabled();
    expect(screen.getByLabelText('Add files')).toBeDisabled();
    for (const name of ['vendor-security-pack.pdf', 'data-flow.docx']) {
      expect(within(section).getByRole('button', { name: `Remove ${name} from the list` })).toBeDisabled();
    }
    await user.upload(screen.getByLabelText('Add files'), xlsx('vendor-questionnaire.xlsx'));
    expect(queueRows()).toHaveLength(2);

    await act(async () => created.resolve(draftResult('request-9')));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/app/requests/request-9'));
    expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(2);
    expect([uploadedName(0), uploadedName(1)]).toEqual(['vendor-security-pack.pdf', 'data-flow.docx']);
  });

  /*
   * §10 row 1: from the moment Save draft hands the chosen files to the new draft, in-app links ask in the files' words.
   * The form's and the queue's "before the draft" guards stand down in the same render that hands the rows over, so the
   * queue's guard must stand up in that render too, not one render later when the rows reach the tab's store: in between,
   * a link pressed would leave with no dialog and the rows on their way would be lost. The probe logs every guard state
   * the shell commits, with Save draft's label at that moment.
   */
  it('keeps in-app links asking, in the files’ words, with no moment between the save and the files being added', async () => {
    const user = userEvent.setup({ applyAccept: false });
    deferredUploads();
    createRequestAction.mockResolvedValueOnce(draftResult('request-9'));
    const log: string[] = [];
    function LoggingProbe() {
      const { blocking } = useNavigationGuard();
      useLayoutEffect(() => {
        log.push(`${blocking ? 'blocking' : 'clear'} | ${document.querySelector('form button[type="submit"]')?.textContent ?? ''}`);
      }, [blocking]);
      return null;
    }
    const RequestForm = await loadRequestForm();
    render(
      <TimeZoneProvider zone="Australia/Sydney">
        <NavigationGuardProvider>
          <AttachmentFileStoreProvider>
            <RequestForm assets={assets} draftOwnerKey={OWNER} mode="create" systems={systems} />
            <LoggingProbe />
            <GuardedLink href="/app/requests">My requests</GuardedLink>
          </AttachmentFileStoreProvider>
        </NavigationGuardProvider>
      </TimeZoneProvider>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Request title' }), PAYROLL);
    await chooseFiles(user, JANES_FILES());
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByRole('button', { name: 'Adding files…' });
    await waitFor(() => expect(files.uploadAttachmentAction).toHaveBeenCalledTimes(1));

    expect(log.filter((entry) => entry.startsWith('clear') && !entry.endsWith('| Save draft'))).toEqual([]);
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Leave while files are being added?' })).toBeInTheDocument();
  });
});
