import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AssessmentDraftJob as AssessmentDraftJobRecord, QuestionnaireGenerationJob as QuestionnaireGenerationJobRecord } from '@/features/assessments/assessment-schema';

vi.mock('@/features/questionnaire-ai/questionnaire-ai-actions', () => ({ getQuestionnaireProposalJobAction: vi.fn(), retryQuestionnaireProposalJobAction: vi.fn(), startQuestionnaireAiProposalsAction: vi.fn() }));
vi.mock('@/features/assessments/assessment-actions', () => ({
  getAssessmentDraftJobAction: vi.fn(),
  getQuestionnaireGenerationJobAction: vi.fn(),
  getRequestGenerationJobsAction: vi.fn(),
  retryAssessmentDraftJobAction: vi.fn(),
  retryQuestionnaireGenerationJobAction: vi.fn(),
  startAssessmentDraftAction: vi.fn(),
  startQuestionnaireGenerationAction: vi.fn(),
}));

import { AssessmentDraftJob } from '@/features/assessments/assessment-draft-job';
import { QuestionnaireGenerationJob } from '@/features/assessments/questionnaire-generation-job';
import { ContextTooLargeFailure, ContextTooLargeFiles, contextTooLargeNamesMarkedNotes } from './context-too-large-files';

const sentence = 'The files included in the AI inputs hold more text than CSRM can send at once, so nothing was sent. Exclude a file, then try again.';
const phase12Copy = 'This request holds more information than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.';

const files = [
  { documentId: 'att-pack', fileName: 'vendor-security-pack.pdf' },
  { documentId: 'att-flow', fileName: 'data-flow.docx' },
];

afterEach(() => {
  vi.clearAllMocks();
});

/*
 * 14-UI-SPEC §7.2 (D-33): a generation refused as too large because of the files included in the AI inputs says so and
 * names the files, each a record link to its row, so the analyst can exclude one and try again.
 */
describe('ContextTooLargeFiles (§7.2)', () => {
  it('says the included files hold too much text and links each to its row', () => {
    render(<ContextTooLargeFiles files={files} requestId="request-1" />);
    expect(screen.getByText(sentence, { exact: true })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Files included in the AI inputs' });
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['vendor-security-pack.pdf', '/app/review/requests/request-1#file-att-pack'],
      ['data-flow.docx', '/app/review/requests/request-1#file-att-flow'],
    ]);
    for (const link of links) expect(link).toHaveClass('record-link');
  });

  it('names a file whose record is gone plainly, with no link', () => {
    render(<ContextTooLargeFiles files={[{ documentId: 'att-gone', fileName: null }]} requestId="request-1" />);
    const list = screen.getByRole('list', { name: 'Files included in the AI inputs' });
    expect(within(list).queryByRole('link')).toBeNull();
    expect(within(list).getByRole('listitem')).toHaveTextContent('A file no longer on this request');
  });

  /* IN-604: that it is server-safe (no directive) and reaches no zod is the boundary guard's (zod-client-boundary.test.ts). */
});

const failedQuestionnaireJob: QuestionnaireGenerationJobRecord = {
  jobId: 'job-one', requestId: 'request-1', providerName: 'Context provider', providerVersion: '1.0', attempt: 1,
  queuedAt: '2026-10-10T00:00:00.000Z', status: 'failed', startedAt: '2026-10-10T00:00:01.000Z', completedAt: '2026-10-10T00:00:02.000Z',
  failureCode: 'CONTEXT_TOO_LARGE', failureMessage: 'The AI context is too large.', canRetry: true,
  initiatedBy: { documentId: 'analyst-id', displayName: 'Bob Analyst' }, initiatedByViewer: true,
};

const failedDraftJob: AssessmentDraftJobRecord = {
  jobId: 'job-two', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: '2026-10-10T00:00:00.000Z', status: 'failed',
  startedAt: '2026-10-10T00:00:01.000Z', completedAt: '2026-10-10T00:00:02.000Z', failureCode: 'CONTEXT_TOO_LARGE',
  failureMessage: 'The AI context is too large.', canRetry: true, initiatedBy: { documentId: 'analyst-id', displayName: 'Bob Analyst' }, initiatedByViewer: true,
};

describe('the job cards’ CONTEXT_TOO_LARGE with files (§7.2; 12 §11.2)', () => {
  function questionnaireCard(job: QuestionnaireGenerationJobRecord) {
    return render(<QuestionnaireGenerationJob action="generate" requestId="request-1" seededJob={{ job, canRetry: true }} />);
  }

  function draftCard(job: AssessmentDraftJobRecord) {
    return render(<AssessmentDraftJob questionnaireId="questionnaire-1" questionnaireSubmitted requestId="request-1" seededJob={{ job, canRetry: true }} />);
  }

  it('the questionnaire card names the files the failure counted', () => {
    questionnaireCard({ ...failedQuestionnaireJob, failureAttachments: files });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(sentence);
    expect(alert).not.toHaveTextContent(phase12Copy);
    expect(within(alert).getByRole('link', { name: 'vendor-security-pack.pdf' })).toHaveAttribute('href', '/app/review/requests/request-1#file-att-pack');
    expect(within(alert).getByRole('link', { name: 'data-flow.docx' })).toBeInTheDocument();
  });

  it('the draft card names the files the failure counted', () => {
    draftCard({ ...failedDraftJob, failureAttachments: files });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(sentence);
    expect(within(alert).getByRole('link', { name: 'vendor-security-pack.pdf' })).toHaveAttribute('href', '/app/review/requests/request-1#file-att-pack');
  });

  it.each([
    ['without failureAttachments', undefined],
    ['with none', []],
  ] as const)('both cards keep Phase 12’s copy %s', (_label, failureAttachments) => {
    const extra = failureAttachments === undefined ? {} : { failureAttachments: [...failureAttachments] };
    const { unmount } = questionnaireCard({ ...failedQuestionnaireJob, ...extra });
    expect(screen.getByRole('alert')).toHaveTextContent(phase12Copy);
    expect(screen.getByRole('alert')).not.toHaveTextContent(sentence);
    unmount();
    draftCard({ ...failedDraftJob, ...extra });
    expect(screen.getByRole('alert')).toHaveTextContent(phase12Copy);
    expect(screen.queryByRole('list', { name: 'Files included in the AI inputs' })).toBeNull();
  });
});

/*
 * 15-UI-SPEC §13, the amendment of 2026-10-11 (D-29; S-3): one rule reads every job surface's CONTEXT_TOO_LARGE. The
 * messages are Strapi's served forms of contextTooLargeMessage, which 15-04 pins: only the notes forms carry the phrase.
 */
describe('the CONTEXT_TOO_LARGE rule on job surfaces (D-29)', () => {
  const oneNote = 'The AI context is too large. 1 note is marked as changing the AI inputs (note 7); unmark some and try again.';
  const notesAndFile = 'The AI context is too large. 2 notes are marked as changing the AI inputs (notes 2 and 5) and 1 file is included in them; unmark or exclude some and try again.';
  const plain = 'The request is too large for this operation.';
  const filesOnly = 'The AI context is too large. The 2 files included in the AI inputs hold more text than can be sent; exclude some and try again.';
  const fallback = 'This questionnaire and its request hold more than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.';
  const failure = (failureMessage: string | null, failureAttachments?: typeof files) => ({
    failureCode: 'CONTEXT_TOO_LARGE', failureMessage, ...(failureAttachments === undefined ? {} : { failureAttachments }),
  });

  it('recognises a notes-caused refusal by the served phrase alone', () => {
    expect(contextTooLargeNamesMarkedNotes(oneNote)).toBe(true);
    expect(contextTooLargeNamesMarkedNotes(notesAndFile)).toBe(true);
    expect(contextTooLargeNamesMarkedNotes(plain)).toBe(false);
    expect(contextTooLargeNamesMarkedNotes(filesOnly)).toBe(false);
    expect(contextTooLargeNamesMarkedNotes(null)).toBe(false);
  });

  it('(a) shows the served notes sentence, then the files list without 14-16’s sentence', () => {
    const { container } = render(<ContextTooLargeFailure failure={failure(notesAndFile, [files[0]!])} requestId="request-1" fallback={fallback} />);
    expect(screen.getByText(notesAndFile, { exact: true })).toBeInTheDocument();
    expect(container).not.toHaveTextContent(sentence);
    expect(container).not.toHaveTextContent(fallback);
    const list = screen.getByRole('list', { name: 'Files included in the AI inputs' });
    expect(within(list).getByRole('link', { name: 'vendor-security-pack.pdf' })).toHaveAttribute('href', '/app/review/requests/request-1#file-att-pack');
  });

  it('(a) shows a notes-only sentence with no list', () => {
    render(<ContextTooLargeFailure failure={failure(oneNote)} requestId="request-1" fallback={fallback} />);
    expect(screen.getByText(oneNote, { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('(b) shows a files-only failure exactly as ContextTooLargeFiles does', () => {
    const { container } = render(<ContextTooLargeFailure failure={failure(filesOnly, files)} requestId="request-1" fallback={fallback} />);
    const { container: expected } = render(<ContextTooLargeFiles files={files} requestId="request-1" />);
    expect(container.innerHTML).toBe(expected.innerHTML);
    expect(container).not.toHaveTextContent(filesOnly);
  });

  it('(c) shows the surface’s fallback when neither notes nor files are named, and never an unnamed served message', () => {
    for (const message of [plain, filesOnly, null]) {
      const { container, unmount } = render(<ContextTooLargeFailure failure={failure(message, [])} requestId="request-1" fallback={fallback} />);
      expect(container).toHaveTextContent(fallback);
      if (message) expect(container).not.toHaveTextContent(message);
      unmount();
    }
  });

  it('renders the served message as text, so markup in it stays literal', () => {
    const marked = 'The AI context is too large. <b>1 note</b> is marked as changing the AI inputs (note 7); unmark some and try again.';
    const { container } = render(<ContextTooLargeFailure failure={failure(marked)} requestId="request-1" fallback={fallback} />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(marked, { exact: true })).toBeInTheDocument();
  });

  it('keeps ContextTooLargeFiles’ own output for its existing callers, and renders its list alone on request', () => {
    const { container } = render(<ContextTooLargeFiles files={files} requestId="request-1" withSentence={false} />);
    expect(container).not.toHaveTextContent(sentence);
    expect(screen.getByRole('list', { name: 'Files included in the AI inputs' })).toBeInTheDocument();
  });
});
