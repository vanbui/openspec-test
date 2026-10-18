import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Phase 13 D-16, D-25 (13-UI-SPEC §11): under the originating request link on the analyst's questionnaire and assessment
 * pages, who holds the request and its notes figure. Rendered on the server by those two pages and handed to the client
 * views as a slot, so the editor's first load gains nothing (D-34's route budget).
 */

const mocks = vi.hoisted(() => ({
  canViewerReviewAssessments: vi.fn(),
  getQuestionnaire: vi.fn(),
  getQuestionnaireGovernanceQuestions: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/lib/capabilities/analyst-review-gate', () => ({ canViewerReviewAssessments: mocks.canViewerReviewAssessments }));
vi.mock('@/lib/metadata/record-route-metadata', () => ({ recordRouteMetadata: vi.fn() }));
vi.mock('@/features/questionnaires/questionnaire-service', () => ({
  getQuestionnaire: mocks.getQuestionnaire,
  getQuestionnaireGovernanceQuestions: mocks.getQuestionnaireGovernanceQuestions,
}));
// The page hands its slots to the client view; the view is stood in for, so each case reads the props the page passes.
vi.mock('@/features/questionnaires/questionnaire-review', () => ({ QuestionnaireReview: () => null }));

import { AssessmentRequestLink } from './assessment-request-link';
import { RequestContextLines } from './request-context-lines';
import QuestionnaireReviewPage from '../../../app/(app)/app/review/questionnaires/[documentId]/page';

const bob = { documentId: 'bob-id', displayName: 'Bob Doe' };

describe('RequestContextLines (13-UI-SPEC §11)', () => {
  it('names the assignee and links the notes figure with its new notes', () => {
    render(<RequestContextLines assignment={{ assignee: bob, pickUp: 'not-offered' }} notes={{ total: 2, unread: 1 }} requestId="request-1" />);
    expect(screen.getByText('Assigned to Bob Doe')).toBeInTheDocument();
    const figure = screen.getByRole('link', { name: '2 notes, 1 new' });
    expect(figure).toHaveAttribute('href', '/app/review/requests/request-1#notes');
    expect(figure).toHaveTextContent('2 notes1 new');
    expect(within(figure).getByText('1 new').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link', { name: 'Pick up on the request page' })).not.toBeInTheDocument();
  });

  it('says the request is not picked up and links the pick-up when the viewer may', () => {
    render(<RequestContextLines assignment={{ assignee: null, pickUp: 'allowed' }} notes={{ total: 1, unread: 0 }} requestId="request/1" />);
    expect(screen.getByText('Not picked up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pick up on the request page' })).toHaveAttribute('href', '/app/review/requests/request%2F1#assignment');
    expect(screen.getByText('Not picked up').closest('p')).toHaveTextContent('Not picked up · Pick up on the request page');
    expect(screen.getByRole('link', { name: '1 note' })).toHaveAttribute('href', '/app/review/requests/request%2F1#notes');
  });

  it.each(['own-request', 'not-offered'] as const)('offers no pick-up link when the pick-up is %s', (pickUp) => {
    render(<RequestContextLines assignment={{ assignee: null, pickUp }} notes={{ total: 0, unread: 0 }} requestId="request-1" />);
    expect(screen.getByText('Not picked up').closest('p')).toHaveTextContent(/^Not picked up$/);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('No notes')).toBeInTheDocument();
  });

  it('renders nothing for a read that serves neither, as a Requestor’s does', () => {
    const { container } = render(<RequestContextLines assignment={null} notes={null} requestId="request-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sets both lines as captions, wrapping at 375 with the pick-up on its own line', () => {
    const { container } = render(<RequestContextLines assignment={{ assignee: null, pickUp: 'allowed' }} notes={{ total: 2, unread: 0 }} requestId="request-1" />);
    expect(container.firstElementChild).toHaveClass('text-xs', 'text-foreground-secondary');
    const assignee = screen.getByText('Not picked up').closest('p')!;
    expect(assignee).toHaveClass('flex', 'flex-col', 'md:flex-row');
    expect(assignee.querySelector('[aria-hidden="true"]')).toHaveClass('hidden', 'md:inline');
    expect(screen.getByRole('link', { name: 'Pick up on the request page' })).toHaveClass('[overflow-wrap:anywhere]');
  });

  /* Phase 14 D-27 (14-UI-SPEC §6.1): the files line, after the notes line. */
  it('links the files figure to the Files section and says how many are in the AI inputs', () => {
    render(<RequestContextLines assignment={{ assignee: bob, pickUp: 'not-offered' }} files={{ count: 2, included: 1 }} notes={{ total: 2, unread: 0 }} requestId="request/1" />);
    const figure = screen.getByRole('link', { name: '2 files' });
    expect(figure).toHaveAttribute('href', '/app/review/requests/request%2F1#files');
    const line = figure.closest('p')!;
    expect(line).toHaveTextContent(/^2 files · 1 included in the AI inputs$/);
    expect(screen.getByRole('link', { name: '2 notes' }).closest('p')!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names one file and leaves the AI part out when none is included', () => {
    render(<RequestContextLines files={{ count: 1, included: 0 }} notes={{ total: 0, unread: 0 }} requestId="request-1" />);
    expect(screen.getByRole('link', { name: '1 file' }).closest('p')).toHaveTextContent(/^1 file$/);
    expect(screen.queryByText(/included in the AI inputs/)).not.toBeInTheDocument();
  });

  it('says No files, as plain text, when the request holds none', () => {
    render(<RequestContextLines files={{ count: 0, included: 0 }} requestId="request-1" />);
    expect(screen.getByText('No files').tagName).toBe('P');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('writes large figures out and renders no files line for a read that serves none', () => {
    const { rerender } = render(<RequestContextLines files={{ count: 1200, included: 1000 }} requestId="request-1" />);
    expect(screen.getByRole('link', { name: '1,200 files' }).closest('p')).toHaveTextContent('1,200 files · 1,000 included in the AI inputs');
    rerender(<RequestContextLines files={null} notes={{ total: 1, unread: 0 }} requestId="request-1" />);
    expect(screen.queryByText(/\bfiles?\b/)).not.toBeInTheDocument();
  });

  /*
   * WCAG 2.2 SC 2.5.8 (14-UI-SPEC Accessibility contract): the lines sit 4px apart, so an undersized link in one is within
   * 24px of the link in the next and the spacing exception does not hold. Each link is a 24px-tall flex box, in every
   * combination of the three lines. jsdom cannot measure layout; the 14-17 journey's axe scan is the browser proof.
   */
  const assignments = [{ assignee: null, pickUp: 'allowed' as const }, { assignee: bob, pickUp: 'not-offered' as const }];
  const noteFigures = [{ total: 2, unread: 0 }, { total: 2, unread: 1 }, { total: 0, unread: 0 }];
  const fileFigures = [{ count: 2, included: 0 }, { count: 2, included: 1 }, { count: 0, included: 0 }];
  const combinations = assignments.flatMap((assignment) => noteFigures.flatMap((notes) => fileFigures.map((files) => ({ assignment, files, notes }))));

  it.each(combinations)('gives every link a 24px target (%o)', (lines) => {
    const { container } = render(<RequestContextLines {...lines} requestId="request-1" />);
    const links = within(container).queryAllByRole('link');
    expect(links.length).toBe([lines.assignment.pickUp === 'allowed', lines.notes.total > 0, lines.files.count > 0].filter(Boolean).length);
    for (const link of links) expect(link).toHaveClass('inline-flex', 'min-h-6', 'items-center');
  });

  it('is a Server Component that only the two record pages import', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/assessments/request-context-lines.tsx'), 'utf8');
    expect(source).not.toMatch(/^'use client'/m);
    expect(source).not.toMatch(/\buse(State|Effect|Id|Ref|Context|Memo|Callback)\b/);
    expect(source).toContain('Pick up on the request page');
    expect(source).toContain('included in the AI inputs');
    expect(source).toContain('No files');
    expect(importersOf('request-context-lines')).toEqual([
      'app/(app)/app/review/assessments/[documentId]/page.tsx',
      'app/(app)/app/review/questionnaires/[documentId]/page.tsx',
    ]);
  });
});

describe('AssessmentRequestLink’s request context slot (§11)', () => {
  const request = { documentId: 'request-1', requestNumber: 'RAR-0001', title: 'Portal review', requestStatus: 'submitted' as const };

  it('sets the slot under the request link', () => {
    render(<AssessmentRequestLink actor="analyst" request={request} requestContext={<p data-testid="request-context">Assigned to Bob Doe</p>} />);
    const block = screen.getByRole('region', { name: 'Originating assessment request' });
    const link = within(block).getByRole('link', { name: 'RAR-0001 · Portal review' });
    expect(link.compareDocumentPosition(within(block).getByTestId('request-context')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is unchanged without one, as on the Requestor’s released view', () => {
    render(<AssessmentRequestLink actor="requestor" request={request} />);
    expect(screen.queryByText(/Assigned to|Not picked up/)).not.toBeInTheDocument();
  });
});

/* A page's view element, whose props are what the page hands the client view. */
function viewProps(element: unknown): Record<string, unknown> {
  expect(isValidElement(element)).toBe(true);
  return (element as ReactElement<Record<string, unknown>>).props;
}

describe('the questionnaire review page renders the lines on the server and hands them to the view (§11)', () => {
  const questionnaire = (assessmentRequest: Record<string, unknown>) => ({
    documentId: 'questionnaire-1',
    questionnaireNumber: 'QNR-0001',
    title: 'Portal questionnaire',
    state: 'analyst-review',
    release: null,
    generation: null,
    assessmentRequest,
  });
  const params = { params: Promise.resolve({ documentId: 'questionnaire-1' }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.getQuestionnaireGovernanceQuestions.mockResolvedValue({ data: { definition: [{ aiOrigin: null }], placements: [] }, error: null });
  });

  it('passes the assignee, notes and files lines for the originating request', async () => {
    mocks.getQuestionnaire.mockResolvedValue({ data: questionnaire({ availability: 'available', documentId: 'request-1', requestNumber: 'RAR-0001', title: 'Portal review', requestStatus: 'submitted', assignment: { assignee: bob, pickUp: 'not-offered' }, notes: { total: 3, unread: 0 }, files: { count: 2, included: 1 } }), error: null });
    const props = viewProps(await QuestionnaireReviewPage(params));
    render(<>{props.requestContext as ReactNode}</>);
    expect(screen.getByText('Assigned to Bob Doe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '3 notes' })).toHaveAttribute('href', '/app/review/requests/request-1#notes');
    expect(screen.getByRole('link', { name: '2 files' }).closest('p')).toHaveTextContent('2 files · 1 included in the AI inputs');
  });

  it('passes nothing when the request is not open to the viewer', async () => {
    mocks.getQuestionnaire.mockResolvedValue({ data: questionnaire({ availability: 'unavailable' }), error: null });
    const props = viewProps(await QuestionnaireReviewPage(params));
    const { container } = render(<>{props.requestContext as ReactNode}</>);
    expect(container).toBeEmptyDOMElement();
  });
});

/*
 * WR-504: the shipped modules under app/ and src/ (tests excluded) that import `moduleName` by any path, statically or
 * lazily. A client module importing it would ship it in that route's first load, which neither the hook check nor the
 * zod walk would notice, because the module holds neither.
 */
function importersOf(moduleName: string): string[] {
  const root = process.cwd();
  const named = new RegExp(`(['"])(?:[^'"]*/)?${moduleName}\\1`);
  return ['app', 'src']
    .flatMap((directory) => readdirSync(resolve(root, directory), { recursive: true, encoding: 'utf8' })
      .map((name) => `${directory}/${name.split('\\').join('/')}`))
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file) && !file.endsWith(`/${moduleName}.tsx`))
    .filter((file) => named.test(readFileSync(resolve(root, file), 'utf8')))
    .sort();
}
