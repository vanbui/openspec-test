import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestNote, RequestNotesMeta, RequestNotesPage } from './notes-domain';

const mocks = vi.hoisted(() => ({ listRequestNotes: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./notes-service', () => ({ listRequestNotes: mocks.listRequestNotes }));
vi.mock('./notes-actions', () => ({ addRequestNoteAction: vi.fn(), listRequestNotesAction: vi.fn(), markRequestNotesReadAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/features/attachments/attachments-actions', () => ({ downloadAttachmentAction: vi.fn(), uploadAttachmentAction: vi.fn() }));

import { TimeZoneProvider } from '@/components/csrm/local-time';
import type { RequestAttachment } from '@/features/attachments/attachments-schema';
import type { RequestNotesSummary } from '@/features/requests/request-domain';
import { NotesSection, type NotesSectionProps } from './notes-section';

const RAR = 'RAR-2026-0001';

function note(sequence: number, overrides: Partial<RequestNote> = {}): RequestNote {
  return {
    documentId: `n${sequence}`, sequence, body: `Note ${sequence}`, authorPart: 'requestor',
    author: { documentId: 'u-jane', displayName: 'Jane Doe' }, postedAt: '2026-10-01T05:47:00.000Z', unread: false, ...overrides,
  };
}

function meta(overrides: Partial<RequestNotesMeta> = {}): RequestNotesMeta {
  return { total: 3, unread: 1, lastReadSequence: 2, hasEarlier: false, accepting: true, closedReason: null, viewerPart: 'requestor', canMarkAiInputs: false, ...overrides };
}

function page(notes: RequestNote[], overrides: Partial<RequestNotesMeta> = {}): RequestNotesPage {
  return { notes, meta: meta(overrides) };
}

const openSummary: RequestNotesSummary = { total: 3, unread: 1, accepting: true, closedReason: null };

async function section(props: Partial<NotesSectionProps> = {}) {
  const element = await NotesSection({ requestId: 'request-1', requestNumber: RAR, viewer: 'requestor', summary: openSummary, ...props });
  return render(<TimeZoneProvider zone="Australia/Sydney">{element}</TimeZoneProvider>);
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  mocks.listRequestNotes.mockResolvedValue({ data: page([note(1), note(2), note(3, { unread: true })]), error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('the Notes section (13-UI-SPEC §8.1)', () => {
  it('reads the newest 20 notes and heads the section Notes, at the region the hub links to', async () => {
    await section();
    expect(mocks.listRequestNotes).toHaveBeenCalledWith('request-1', { limit: 20 });
    expect(screen.getByRole('heading', { level: 2, name: 'Notes' })).toBeInTheDocument();
    expect(document.getElementById('notes')).toContainElement(screen.getByRole('heading', { level: 2, name: 'Notes' }));
  });

  it('tells the Requestor who reads notes and that a Security Analyst may include one in what CSRM sends to the AI (D-25)', async () => {
    await section();
    const region = screen.getByRole('region', { name: 'Notes' });
    expect(region).toHaveAccessibleDescription('Notes between you and the Security Analysts on this request. A Security Analyst may include a note in the information CSRM sends to the AI.');
  });

  it('describes the section to an analyst in their own words', async () => {
    mocks.listRequestNotes.mockResolvedValue({ data: page([note(1)], { total: 1, unread: 0, viewerPart: 'security-analyst' }), error: null });
    await section({ viewer: 'analyst' });
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveAccessibleDescription('Notes between the Requestor and the Security Analysts. Mark a note as changing the AI inputs to include it in AI generation.');
  });

  /*
   * IN-308 (§8.1 is by role, not route): the description follows the part Strapi gives the viewer. A requesting analyst on
   * the analyst page writes as the Requestor and may not mark, and an analyst on the Requestor's page is a Security Analyst.
   */
  it('describes the section by the part Strapi gives the viewer, not by the route (IN-308)', async () => {
    mocks.listRequestNotes.mockResolvedValue({ data: page([note(1)], { total: 1, unread: 0, viewerPart: 'requestor' }), error: null });
    const requesting = await section({ viewer: 'analyst' });
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveAccessibleDescription('Notes between you and the Security Analysts on this request. A Security Analyst may include a note in the information CSRM sends to the AI.');
    requesting.unmount();
    mocks.listRequestNotes.mockResolvedValue({ data: page([note(1)], { total: 1, unread: 0, viewerPart: 'security-analyst', canMarkAiInputs: true }), error: null });
    await section({ viewer: 'requestor' });
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveAccessibleDescription('Notes between the Requestor and the Security Analysts. Mark a note as changing the AI inputs to include it in AI generation.');
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveAccessibleDescription('The Requestor and every Security Analyst can read notes. A note can’t be changed or removed once added.');
  });

  it('counts the notes and the new ones, in tabular figures', async () => {
    await section();
    const count = document.querySelector('[data-notes-count]');
    expect(count?.textContent).toBe('3 notes · 1 new');
    expect(count).toHaveClass('tabular-nums');
  });

  it('renders the served thread and the composer with the viewer’s hint', async () => {
    await section();
    const list = screen.getByRole('list', { name: `Notes on ${RAR}` });
    expect(within(list).getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveAccessibleDescription('You and the Security Analysts on this request can read notes. A note can’t be changed or removed once added.');
  });

  it('gives a requesting analyst the hint that their note is added as the Requestor’s', async () => {
    mocks.listRequestNotes.mockResolvedValue({ data: page([], { total: 0, unread: 0, viewerPart: 'requestor' }), error: null });
    await section({ viewer: 'analyst', summary: { total: 0, unread: 0, accepting: true, closedReason: null } });
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveAccessibleDescription('You raised this request, so your note is added as its Requestor. A note can’t be changed or removed once added.');
  });
});

describe('the Notes section’s other states (13-UI-SPEC §8.4 to §8.6)', () => {
  it('shows We couldn’t load the notes and keeps the composer when the read fails and the request takes notes', async () => {
    mocks.listRequestNotes.mockResolvedValue({ data: null, error: { status: 500, message: 'Internal Server Error' } });
    await section();
    expect(screen.getByRole('heading', { level: 2, name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('We couldn’t load the notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toBeInTheDocument();
    expect(document.querySelector('[data-notes-count]')?.textContent).toBe('3 notes · 1 new');
  });

  it('shows the closed line from the request read when the read fails on a closed request', async () => {
    mocks.listRequestNotes.mockResolvedValue({ data: null, error: { status: 500, message: 'Internal Server Error' } });
    await section({ summary: { total: 0, unread: 0, accepting: false, closedReason: 'not-submitted' } });
    expect(screen.getByText('You can add notes once you submit this request.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a note' })).toBeNull();
  });

  it('renders nothing and reads no notes for a viewer the request read gave no notes summary (D-23)', async () => {
    const element = await NotesSection({ requestId: 'request-1', requestNumber: RAR, viewer: 'requestor', summary: null });
    expect(element).toBeNull();
    expect(mocks.listRequestNotes).not.toHaveBeenCalled();
  });

  it('adds the notes skeleton to both request pages’ loading states (§8.6)', async () => {
    const requestor = await import('../../../app/(app)/app/requests/[documentId]/loading');
    const analyst = await import('../../../app/(app)/app/review/requests/[documentId]/loading');
    for (const Loading of [requestor.default, analyst.default]) {
      const { container, unmount } = render(<Loading />);
      const skeleton = container.querySelector('[data-notes-skeleton]');
      expect(skeleton).not.toBeNull();
      /* A heading line, two note blocks of a header line and two body lines, and a textarea block. */
      expect(skeleton!.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1 + 2 * 3 + 1);
      unmount();
    }
  });
});

describe('the kept note text on both request pages (13-UI-SPEC §9.3; UI-D17)', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('hands the thread the person’s draft key, so the composer restores their kept text', async () => {
    window.sessionStorage.setItem('csrm-draft:note:owner-a:request-1', 'Kept from before');
    mocks.listRequestNotes.mockResolvedValue({ data: page([note(1)]), error: null });
    await section({ draftOwnerKey: 'owner-a' });
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue('Kept from before');
    expect(screen.getByText('Restored from earlier in this session.')).toBeInTheDocument();
  });

  /* IN-604: that both request pages hand it the session's key is rendered in request-pages-note-files.test.tsx. */
});

/* D1 (the 13-19 walk): the hub's Notes row and every unread line link to `#notes`, so its heading is a focusable link destination (Phase 10 UI-D27). */
describe('the Notes section as a link destination (D1)', () => {
  it('heads the #notes region with a heading that can take focus', async () => {
    await section();
    const heading = screen.getByRole('heading', { level: 2, name: 'Notes' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.getElementById('notes')).toContainElement(heading);
  });
});

/*
 * 14-UI-SPEC §4.2 (D-17, D-27): both request pages group the request's files by the note they came with and hand each
 * note its own, so a note lists its files as chips that lead to their rows.
 */
describe('each note’s files on both request pages (14-UI-SPEC §4.2)', () => {
  const deck: RequestAttachment = {
    documentId: 'att-9', fileName: 'architecture-deck.pptx', fileType: 'pptx', byteSize: 3_727, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: { documentId: 'n2', postedAt: '2026-10-01T05:47:00.000Z' }, removedBy: null, removedAt: null, detection: null,
    actions: { download: true, remove: true, restore: false },
  };

  it('gives each note the files that came with it, and no other note any', async () => {
    mocks.listRequestNotes.mockResolvedValue({ data: page([note(1), note(2)]), error: null });
    await section({ filesByNote: { n2: [deck] } });
    const [first, second] = within(screen.getByRole('list', { name: `Notes on ${RAR}` })).getAllByRole('article');
    expect(within(second!).getByRole('list', { name: 'Files with this note' })).toHaveTextContent('architecture-deck.pptx');
    expect(within(first!).queryByRole('list', { name: 'Files with this note' })).toBeNull();
  });

  /* IN-604: that both request pages group their files by note and hand them here is rendered in request-pages-note-files.test.tsx. */
});
