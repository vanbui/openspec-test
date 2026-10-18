import { render, screen, within } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestAttachment, RequestAttachmentsPage } from '@/features/attachments/attachments-schema';
import type { RequestAttachmentSummary, RequestNotesSummary } from '@/features/requests/request-domain';
import type { RequestNote, RequestNotesPage } from './notes-domain';

/*
 * IN-604 (14-UI-SPEC §4.2; D-17, D-27; 13-UI-SPEC §9.3): both request pages, rendered with a fixture request, its files
 * and its notes, hand the Notes section each note's files and the person's draft key. This replaces the source greps
 * that looked for `filesByNote={` and `draftOwnerKey={` on `<NotesSection`, which `filesByNote={{}}` or a key computed
 * wrongly would have passed: here a note shows its file's chip, linked to the file's row, and the composer restores the
 * text kept under the signed-in person's key. Only the sections beside Files and Notes are stubbed; the pages, the
 * Files section, the Notes section and its thread render as they ship.
 */

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  listRequestAttachments: vi.fn(),
  listRequestNotes: vi.fn(),
  current: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/requests/request-1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/requests/request-service', () => ({ getRequest: mocks.getRequest }));
vi.mock('@/features/attachments/attachments-service', () => ({ listRequestAttachments: mocks.listRequestAttachments }));
vi.mock('@/features/attachments/attachments-actions', () => ({
  downloadAttachmentAction: vi.fn(),
  getAttachmentAiTextAction: vi.fn(),
  setAttachmentAiInputAction: vi.fn(),
  setAttachmentRemovalAction: vi.fn(),
  uploadAttachmentAction: vi.fn(),
}));
vi.mock('./notes-service', () => ({ listRequestNotes: mocks.listRequestNotes }));
vi.mock('./notes-actions', () => ({ addRequestNoteAction: vi.fn(), listRequestNotesAction: vi.fn(), markRequestNotesReadAction: vi.fn() }));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: async () => new Set(['assessment-request:read']) }) }),
}));
vi.mock('@/lib/capabilities/analyst-review-gate', () => ({ canViewerReviewAssessments: async () => true }));
/* The sections beside Files and Notes, which this test does not read. */
vi.mock('@/features/requests/request-lifecycle-stepper', () => ({ RequestLifecycleStepper: () => null }));
vi.mock('@/features/requests/request-hub', () => ({ RequestHub: () => null }));
vi.mock('@/features/requests/request-context-details', () => ({ RequestContextDetails: () => null }));
vi.mock('@/features/requests/request-workflow-actions', () => ({ RequestWorkflowActions: () => null }));
vi.mock('@/features/assessments/assessment-detail', () => ({ AssessmentDetail: () => null, AssessmentDetailSkeleton: () => null }));
vi.mock('@/features/assessments/assessment-service', () => ({ getRequestGenerationJobs: async () => ({ data: null, error: null }) }));
vi.mock('@/features/questionnaires/questionnaire-service', () => ({ getQuestionnaire: vi.fn() }));
vi.mock('@/features/ai-assistance/ai-inputs-changed', () => ({ aiInputsChangedSlot: () => null }));

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { AttachmentFileStoreProvider } from '@/features/attachments/file-store';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';
import RequestDetailPage from '../../../app/(app)/app/requests/[documentId]/page';
import { AssessmentRequestDetailContent } from '../../../app/(app)/app/review/requests/[documentId]/page';

const RAR = 'RAR-2026-0001';
const DECK = 'architecture-deck.pptx';
const session = { displayName: 'Jane Doe', email: 'jane.doe@idambox.com' };

function note(sequence: number): RequestNote {
  return {
    documentId: `n${sequence}`, sequence, body: `Note ${sequence}`, authorPart: 'requestor',
    author: { documentId: 'u-jane', displayName: 'Jane Doe' }, postedAt: '2026-10-01T05:47:00.000Z', unread: false,
  };
}

const notesPage: RequestNotesPage = {
  notes: [note(1), note(2)],
  meta: { total: 2, unread: 0, lastReadSequence: 2, hasEarlier: false, accepting: true, closedReason: null, viewerPart: 'requestor', canMarkAiInputs: false },
};

function attachment(overrides: Partial<RequestAttachment>): RequestAttachment {
  return {
    documentId: 'att-1', fileName: 'vendor-security-pack.pdf', fileType: 'pdf', byteSize: 1_457, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-01T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false }, ...overrides,
  };
}

/* After submission: files arrive with a note, so the composer takes files (§4.1). */
const summary: RequestAttachmentSummary = {
  count: 2, canAdd: true, refusal: null, window: 'after-submission', needsNote: true, remaining: 18, activeCount: 2, storedCount: 2,
  limits: { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 }, allowedTypes: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'],
};

const files: RequestAttachmentsPage = {
  attachments: [
    attachment({ documentId: 'att-9', fileName: DECK, fileType: 'pptx', byteSize: 3_727, note: { documentId: 'n2', postedAt: '2026-10-01T05:47:00.000Z' } }),
    attachment({}),
  ],
  meta: { total: 2, removed: 0, add: { canAdd: true, refusal: null, window: 'after-submission', needsNote: true, remaining: 18, activeCount: 2, storedCount: 2, limits: summary.limits, allowedTypes: [...summary.allowedTypes] } },
};

const notesSummary: RequestNotesSummary = { total: 2, unread: 0, accepting: true, closedReason: null };

const request = {
  documentId: 'request-1', requestNumber: RAR, title: 'Payroll SaaS', requestStatus: 'submitted', requestorName: 'Jane Doe',
  assignment: null, relationships: null, attachments: summary, notes: notesSummary,
};

/** Renders a page's server tree: each async component is awaited in place, as the server would before streaming it. */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child) => resolveServerTree(child)));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') {
    return resolveServerTree(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  if (element.props.children === undefined) return element;
  const children = await resolveServerTree(element.props.children);
  return cloneElement(element, undefined, ...(Array.isArray(children) ? children : [children]));
}

async function renderPage(page: ReactNode) {
  const tree = await resolveServerTree(page);
  return render(<TimeZoneProvider zone="Australia/Sydney"><AttachmentFileStoreProvider>{tree}</AttachmentFileStoreProvider></TimeZoneProvider>);
}

const params = { params: Promise.resolve({ documentId: 'request-1' }) };

const pages = [
  ['the Requestor’s request page', () => RequestDetailPage(params)],
  ['the analyst’s request page', () => AssessmentRequestDetailContent(params)],
] as const;

beforeEach(() => {
  mocks.getRequest.mockResolvedValue({ data: request, error: null });
  mocks.listRequestAttachments.mockResolvedValue({ data: files, error: null });
  mocks.listRequestNotes.mockResolvedValue({ data: notesPage, error: null });
  mocks.current.mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('each note’s files on both request pages (14-UI-SPEC §4.2; IN-604)', () => {
  it.each(pages)('%s shows a note’s file as a chip that leads to its row, and no chip on a note without files', async (_page, page) => {
    await renderPage(await page());
    expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();
    const [first, second] = within(screen.getByRole('list', { name: `Notes on ${RAR}` })).getAllByRole('article');
    const chips = within(second!).getByRole('list', { name: 'Files with this note' });
    expect(within(chips).getByRole('link', { name: DECK })).toHaveAttribute('href', '#file-att-9');
    expect(within(chips).getAllByRole('listitem')).toHaveLength(1);
    expect(within(first!).queryByRole('list', { name: 'Files with this note' })).toBeNull();
    expect(mocks.listRequestAttachments).toHaveBeenCalledWith('request-1');
  });

  it.each(pages)('%s hands the composer the signed-in person’s draft key, so it restores their kept text (13-UI-SPEC §9.3)', async (_page, page) => {
    window.sessionStorage.setItem(`csrm-draft:note:${draftOwnerKey(session)}:request-1`, 'Kept from before');
    await renderPage(await page());
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue('Kept from before');
    expect(screen.getByText('Restored from earlier in this session.')).toBeInTheDocument();
  });
});
