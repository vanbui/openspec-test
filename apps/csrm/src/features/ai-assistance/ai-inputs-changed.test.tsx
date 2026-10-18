import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiInputsChanged } from './ai-assistance-domain';

/*
 * Phase 13 D-29 (13-UI-SPEC §10.2, X-18): which notes changed a record's AI inputs since it was generated. The block is a
 * Server Component that only the three record pages render; every module between them and where it shows is a client
 * module, so it travels as a slot and no route gains client JavaScript for it (D-34's route budget).
 */

const mocks = vi.hoisted(() => ({
  canViewerReviewAssessments: vi.fn(),
  getQuestionnaire: vi.fn(),
  getQuestionnaireGovernanceQuestions: vi.fn(),
  getAnalystAssessment: vi.fn(),
  listAssessmentRisks: vi.fn(),
  listControlImplementations: vi.fn(),
  listRiskTypes: vi.fn(),
  getRequestGenerationJobs: vi.fn(),
  getRequest: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
// Phase 19 (19-12): the released header's Export is bound to this Server Action; its module reads services this file mocks.
vi.mock('@/features/exports/export-actions', () => ({ exportReleasedAssessmentAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/capabilities/analyst-review-gate', () => ({ canViewerReviewAssessments: mocks.canViewerReviewAssessments }));
vi.mock('@/lib/metadata/record-route-metadata', () => ({ recordRouteMetadata: vi.fn() }));
vi.mock('@/features/questionnaires/questionnaire-service', () => ({
  getQuestionnaire: mocks.getQuestionnaire,
  getQuestionnaireGovernanceQuestions: mocks.getQuestionnaireGovernanceQuestions,
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: mocks.getAnalystAssessment,
  getRequestGenerationJobs: mocks.getRequestGenerationJobs,
  listAssessmentRisks: mocks.listAssessmentRisks,
  listControlImplementations: mocks.listControlImplementations,
  listRiskTypes: mocks.listRiskTypes,
}));
vi.mock('@/features/requests/request-service', () => ({ getRequest: mocks.getRequest }));
vi.mock('@/features/assessments/assessment-actions', () => ({ searchActiveUsersAction: vi.fn(), searchControlsAction: vi.fn() }));
vi.mock('@/features/requests/request-actions', () => ({ searchInformationAssetsAction: vi.fn(), searchInformationSystemsAction: vi.fn() }));
vi.mock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({ current: async () => null }) }));
vi.mock('@/lib/session-drafts/draft-owner-key', () => ({ draftOwnerKey: () => 'owner-key' }));
const proposals = vi.hoisted(() => ({ listQuestionnaireAiProposals: vi.fn() }));
vi.mock('@/features/questionnaire-ai/questionnaire-ai-service', () => proposals);
const startProposals = vi.hoisted(() => vi.fn());
vi.mock('@/features/questionnaire-ai/questionnaire-ai-actions', () => ({ startQuestionnaireAiProposalsAction: startProposals }));
// The pages hand their slots to client views; the views are stood in for, so each case reads the props a page passes.
vi.mock('@/features/questionnaires/questionnaire-review', () => ({ QuestionnaireReview: () => null }));
vi.mock('@/features/assessments/assessment-editor', () => ({ AssessmentEditor: () => null, AssessmentEditorSkeleton: () => null }));
vi.mock('@/features/assessments/assessment-detail', () => ({ AssessmentDetail: () => null, AssessmentDetailSkeleton: () => null }));
vi.mock('@/features/request-notes/notes-section', () => ({ NotesSection: () => null, notesAuthorNames: () => ({}) }));

import { AiInputsChangedBlock, aiInputsChangedCaption, aiInputsChangedHeading, aiInputsChangedItem, aiInputsChangedSlot } from './ai-inputs-changed';
import QuestionnaireReviewPage from '../../../app/(app)/app/review/questionnaires/[documentId]/page';
import { AssessmentEditorContent } from '../../../app/(app)/app/review/assessments/[documentId]/page';
import { AssessmentRequestDetailContent } from '../../../app/(app)/app/review/requests/[documentId]/page';

const janesNote = { documentId: 'note-7', part: 'requestor', sequence: 1, postedAt: '2026-10-05T03:47:00.000Z', change: 'marked' } as const;
const signal: AiInputsChanged = { count: 1, notes: [janesNote], files: [] };
const many: AiInputsChanged = {
  count: 2,
  notes: [janesNote, { documentId: 'note 9', part: 'security-analyst', sequence: 2, postedAt: '2026-10-06T01:15:00.000Z', change: 'unmarked' }],
  files: [],
};
/* Phase 14 D-36: the register included since, and the vendor pack excluded since, with no note changed. */
const csvIncluded = { documentId: 'file-csv', fileName: 'register.csv', change: 'included' } as const;
const packExcluded = { documentId: 'file pdf', fileName: 'vendor-security-pack.pdf', change: 'excluded' } as const;
const filesOnly: AiInputsChanged = { count: 2, notes: [], files: [csvIncluded, packExcluded] };

describe('AiInputsChangedBlock (13-UI-SPEC §10.2, X-18)', () => {
  it('renders nothing without a served signal (no baseline, D-29)', () => {
    const { container } = render(<AiInputsChangedBlock requestId="request-1" signal={null} target="questionnaire" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names one marked Requestor note as a link to it in the thread, then says the AI has not seen it', () => {
    render(<AiInputsChangedBlock requestId="request-1" signal={signal} target="questionnaire" />);
    const heading = screen.getByText('AI inputs changed since this questionnaire was generated');
    expect(heading.closest('p')).toHaveClass('text-sm', 'font-medium');
    expect(heading.closest('p')?.querySelector('svg.lucide-sparkles')).toHaveAttribute('aria-hidden', 'true');
    const list = screen.getByRole('list', { name: 'AI inputs changed since this questionnaire was generated' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    const link = within(items[0]!).getByRole('link', { name: /^Requestor note · 5 Oct 2026, 3:47/ });
    expect(link).toHaveAttribute('href', '/app/review/requests/request-1#note-note-7');
    expect(link.querySelector('time')).toHaveAttribute('dateTime', janesNote.postedAt);
    expect(within(items[0]!).getByText('Marked since')).toHaveClass('text-xs');
    expect(screen.getByText('The AI hasn’t seen these changes.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads the draft target, and lists one or many notes alike, an unmarked one as Unmarked since', () => {
    render(<AiInputsChangedBlock requestId="request/1" signal={many} target="draft" />);
    const list = screen.getByRole('list', { name: 'AI inputs changed since this draft was generated' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('link').textContent?.split(' · ')[0])).toEqual(['Requestor note', 'Security Analyst note']);
    expect(within(items[1]!).getByRole('link')).toHaveAttribute('href', '/app/review/requests/request%2F1#note-note%209');
    expect(within(items[1]!).getByText('Unmarked since')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('stacks each item at 375 and sets it on one line, its caption after a middle dot, from 768px', () => {
    render(<AiInputsChangedBlock requestId="request-1" signal={signal} target="questionnaire" />);
    const item = screen.getByRole('listitem');
    expect(item).toHaveClass('flex', 'flex-col', 'md:flex-row');
    expect(within(item).getByRole('link')).toHaveClass('[overflow-wrap:anywhere]');
    expect(item.querySelector('[aria-hidden="true"]')).toHaveClass('hidden', 'md:inline');
  });

  it('words its copy verbatim from §10.2', () => {
    expect(aiInputsChangedHeading('questionnaire')).toBe('AI inputs changed since this questionnaire was generated');
    expect(aiInputsChangedHeading('draft')).toBe('AI inputs changed since this draft was generated');
    expect(aiInputsChangedItem(janesNote)).toEqual({ label: 'Requestor note', change: 'Marked since' });
    expect(aiInputsChangedItem({ part: 'security-analyst', change: 'unmarked' })).toEqual({ label: 'Security Analyst note', change: 'Unmarked since' });
    expect(aiInputsChangedCaption).toBe('The AI hasn’t seen these changes.');
  });

  /* Phase 14 D-36 (14-UI-SPEC §6.2, X-18, X-22): files share the one list with the notes, after them. */
  it('lists a files-only change with no note item: each file a link to its row, captioned with its change', () => {
    render(<AiInputsChangedBlock requestId="request-1" signal={filesOnly} target="questionnaire" />);
    const list = screen.getByRole('list', { name: 'AI inputs changed since this questionnaire was generated' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(list).queryByRole('link', { name: /note/ })).not.toBeInTheDocument();
    expect(within(items[0]!).getByRole('link', { name: 'register.csv' })).toHaveAttribute('href', '/app/review/requests/request-1#file-file-csv');
    expect(within(items[0]!).getByText('Included since')).toHaveClass('text-xs');
    expect(within(items[1]!).getByRole('link', { name: 'vendor-security-pack.pdf' })).toHaveAttribute('href', '/app/review/requests/request-1#file-file%20pdf');
    expect(within(items[1]!).getByText('Excluded since')).toBeInTheDocument();
    expect(screen.getByText('The AI hasn’t seen these changes.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(aiInputsChangedSlot({ requestId: 'request-1', signal: filesOnly, target: 'questionnaire' })).toBeDefined();
  });

  it('lists the notes first, then the files, and says Removed since for a removed file', () => {
    const both: AiInputsChanged = { count: 3, notes: [janesNote], files: [csvIncluded, { documentId: 'file-docx', fileName: 'data-flow.docx', change: 'removed' }] };
    render(<AiInputsChangedBlock requestId="request-1" signal={both} target="draft" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent?.split(' · ')[0])).toEqual(['Requestor note', 'register.csv', 'data-flow.docx']);
    expect(within(items[2]!).getByText('Removed since')).toBeInTheDocument();
  });

  /*
   * WR-506 (§12, "every figure opens its records"): a removed file has no row in the main list, so its name is plain text,
   * as note-item.tsx renders a removed file's chip; a file still listed links to its row.
   */
  it('names a removed file as text with no link, and links a file still listed to its row (WR-506)', () => {
    const both: AiInputsChanged = { count: 2, notes: [], files: [csvIncluded, { documentId: 'file-docx', fileName: 'data-flow.docx', change: 'removed' }] };
    render(<AiInputsChangedBlock requestId="request-1" signal={both} target="draft" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(within(items[0]!).getByRole('link', { name: 'register.csv' })).toHaveAttribute('href', '/app/review/requests/request-1#file-file-csv');
    expect(within(items[1]!).queryByRole('link')).toBeNull();
    expect(within(items[1]!).getByText('data-flow.docx', { exact: true })).toHaveClass('text-sm', '[overflow-wrap:anywhere]');
    expect(within(items[1]!).getByText('Removed since')).toBeInTheDocument();
    expect(document.querySelector('a[href*="#file-file-docx"]')).toBeNull();
  });

  it('renders a notes-only change exactly as before, with no file item', () => {
    render(<AiInputsChangedBlock requestId="request-1" signal={signal} target="questionnaire" />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText(/^(Included|Excluded|Removed) since$/)).not.toBeInTheDocument();
  });

  it('renders the action it is handed after its caption, and the slot passes it on (15-UI-SPEC §9.1)', () => {
    render(<>{aiInputsChangedSlot({ requestId: 'request-1', signal, target: 'questionnaire', action: <button type="button">Suggest follow-up questions</button> })}</>);
    expect(screen.getByRole('button', { name: 'Suggest follow-up questions' })).toBeInTheDocument();
    expect(aiInputsChangedSlot({ requestId: 'request-1', signal: { count: 0, notes: [], files: [] }, target: 'questionnaire', action: <button type="button">x</button> })).toBeUndefined();
  });

  it('shows nothing, and passes no slot, when both lists are empty', () => {
    const empty: AiInputsChanged = { count: 0, notes: [], files: [] };
    const { container } = render(<AiInputsChangedBlock requestId="request-1" signal={empty} target="questionnaire" />);
    expect(container).toBeEmptyDOMElement();
    expect(aiInputsChangedSlot({ requestId: 'request-1', signal: empty, target: 'questionnaire' })).toBeUndefined();
  });

  it('renders a hostile file name as text, never as markup (T-14-42)', () => {
    const hostile: AiInputsChanged = { count: 1, notes: [], files: [{ documentId: 'file-x', fileName: '<img src=x onerror=alert(1)>.pdf', change: 'included' }] };
    const { container } = render(<AiInputsChangedBlock requestId="request-1" signal={hostile} target="questionnaire" />);
    expect(screen.getByRole('link', { name: '<img src=x onerror=alert(1)>.pdf' })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('is a Server Component that only the three record pages import: no client directive and no hook', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/ai-assistance/ai-inputs-changed.tsx'), 'utf8');
    expect(source).not.toMatch(/^'use client'/m);
    expect(source).not.toMatch(/\buse(State|Effect|Id|Ref|Context|Memo|Callback)\b/);
    expect(source).toContain('The AI hasn’t seen these changes.');
    for (const caption of ['Included since', 'Excluded since', 'Removed since']) expect(source).toContain(caption);
    expect(importersOf('ai-inputs-changed')).toEqual([
      'app/(app)/app/review/assessments/[documentId]/page.tsx',
      'app/(app)/app/review/questionnaires/[documentId]/page.tsx',
      'app/(app)/app/review/requests/[documentId]/page.tsx',
    ]);
  });
});

/* A page's view element, whose props are what the page hands the client view. */
function viewProps(element: unknown): Record<string, unknown> {
  expect(isValidElement(element)).toBe(true);
  return (element as ReactElement<Record<string, unknown>>).props;
}

function renderSlot(slot: unknown) {
  return render(<>{slot as ReactNode}</>);
}

const params = (documentId: string) => ({ params: Promise.resolve({ documentId }) });
const ok = <T,>(data: T) => ({ data, error: null });
const generation = (aiInputsChanged: AiInputsChanged | null) => ({
  generatedAt: '2026-10-05T01:00:00.000Z',
  generatedBy: { documentId: 'bob-id', displayName: 'Bob Doe' },
  providerName: 'deterministic',
  providerVersion: 'v1',
  runId: 'run-1',
  aiInputsChanged,
});

describe('the questionnaire review page renders the signal on the server and hands it to the header (§10.2)', () => {
  const questionnaire = (aiInputsChanged: AiInputsChanged | null) => ({
    documentId: 'questionnaire-1',
    questionnaireNumber: 'QNR-0001',
    title: 'Portal questionnaire',
    state: 'analyst-review',
    release: null,
    generation: generation(aiInputsChanged),
    assessmentRequest: { availability: 'available', documentId: 'request-1', requestNumber: 'RAR-0001', title: 'Portal review', requestStatus: 'submitted', assignment: null, notes: null },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.getQuestionnaireGovernanceQuestions.mockResolvedValue(ok({ definition: [{ aiOrigin: 'generated' }], placements: [] }));
    proposals.listQuestionnaireAiProposals.mockResolvedValue({ data: null, error: { message: 'unavailable', status: 503 } });
  });

  it('passes the block for the questionnaire target, linking each note on the originating request', async () => {
    mocks.getQuestionnaire.mockResolvedValue(ok(questionnaire(signal)));
    const props = viewProps(await QuestionnaireReviewPage(params('questionnaire-1')));
    renderSlot(props.aiInputsChanged);
    expect(screen.getByRole('list', { name: 'AI inputs changed since this questionnaire was generated' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Requestor note · / })).toHaveAttribute('href', '/app/review/requests/request-1#note-note-7');
  });

  /*
   * The header draws a bordered block around any slot it is handed, so "nothing" must be no slot at all, not a block that
   * renders nothing: an element is truthy whatever it renders.
   */
  it('passes the block for a files-only signal, linking each file on the originating request', async () => {
    mocks.getQuestionnaire.mockResolvedValue(ok(questionnaire(filesOnly)));
    const props = viewProps(await QuestionnaireReviewPage(params('questionnaire-1')));
    renderSlot(props.aiInputsChanged);
    expect(screen.getByRole('link', { name: 'register.csv' })).toHaveAttribute('href', '/app/review/requests/request-1#file-file-csv');
  });

  /* Phase 15 (15-UI-SPEC §9.1; D-29, UI-D20; W-11): the signal's action, passed through the slot where a start is allowed. */
  it('passes Suggest follow-up questions as the signal’s action when the proposals read allows a start, and none otherwise', async () => {
    mocks.getQuestionnaire.mockResolvedValue(ok(questionnaire(signal)));
    const actions = (allowed: boolean) => ({ start: { allowed, reason: allowed ? null : 'QUESTIONNAIRE_NOT_SUBMITTED' }, rewrite: { allowed, reason: null }, confirm: { allowed, reason: null }, reject: { allowed, reason: null }, replace: { allowed: false, reason: null } });
    const view = (allowed: boolean) => ({ questionnaireId: 'questionnaire-1', state: 'analyst-review', openCount: 0, actions: actions(allowed), runs: [], items: [], jobs: [], fixedQuestions: [] });
    proposals.listQuestionnaireAiProposals.mockResolvedValueOnce(ok(view(true)));
    const allowed = renderSlot(viewProps(await QuestionnaireReviewPage(params('questionnaire-1'))).aiInputsChanged);
    expect(screen.getByRole('button', { name: 'Suggest follow-up questions' })).toBeInTheDocument();
    allowed.unmount();
    proposals.listQuestionnaireAiProposals.mockResolvedValueOnce(ok(view(false)));
    renderSlot(viewProps(await QuestionnaireReviewPage(params('questionnaire-1'))).aiInputsChanged);
    expect(screen.queryByRole('button', { name: 'Suggest follow-up questions' })).toBeNull();
    expect(screen.getByRole('list', { name: 'AI inputs changed since this questionnaire was generated' })).toBeInTheDocument();
  });

  it('passes no slot when the read serves no signal, or one that lists no note', async () => {
    for (const served of [null, { count: 0, notes: [], files: [] }]) {
      mocks.getQuestionnaire.mockResolvedValue(ok(questionnaire(served)));
      const props = viewProps(await QuestionnaireReviewPage(params('questionnaire-1')));
      expect(props.aiInputsChanged).toBeUndefined();
    }
  });
});

describe('the assessment page renders the signal on the server and hands it to the editor (§10.2)', () => {
  const assessment = (aiInputsChanged: AiInputsChanged | null) => ({
    actor: 'analyst',
    documentId: 'assessment-1',
    assessmentNumber: 'ASM-0001',
    assessmentStatus: 'in-review',
    assessmentRequest: { documentId: 'request-1', requestNumber: 'RAR-0001', title: 'Portal review', requestStatus: 'under-review', assignment: null, notes: null },
    risks: [],
    generation: generation(aiInputsChanged),
    aiProvenance: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.listRiskTypes.mockResolvedValue(ok([]));
    mocks.listAssessmentRisks.mockResolvedValue(ok([]));
    mocks.getRequest.mockResolvedValue(ok({ informationSystems: [], informationAssets: [] }));
  });

  it('passes the block for the draft target', async () => {
    mocks.getAnalystAssessment.mockResolvedValue(ok(assessment(many)));
    const props = viewProps(await AssessmentEditorContent(params('assessment-1')));
    renderSlot(props.aiInputsChanged);
    const list = screen.getByRole('list', { name: 'AI inputs changed since this draft was generated' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', '/app/review/requests/request-1#note-note-7');
  });

  it('passes no slot when the read serves no signal, or one that lists no note', async () => {
    for (const served of [null, { count: 0, notes: [], files: [] }]) {
      mocks.getAnalystAssessment.mockResolvedValue(ok(assessment(served)));
      const props = viewProps(await AssessmentEditorContent(params('assessment-1')));
      expect(props.aiInputsChanged).toBeUndefined();
    }
  });
});

describe('the request hub page renders both cards’ signals on the server (§10.2)', () => {
  const request = (aiInputs: { questionnaire: AiInputsChanged | null; assessment: AiInputsChanged | null } | null) => ({
    documentId: 'request-1',
    requestNumber: 'RAR-0001',
    title: 'Portal review',
    requestStatus: 'submitted',
    relationships: { questionnaire: { availability: 'absent' }, assessment: { availability: 'absent' } },
    notes: null,
    aiInputs,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.getRequestGenerationJobs.mockResolvedValue(ok(null));
  });

  /* The detail view is the first element of the page's fragment; the notes section follows it. */
  async function detailProps(): Promise<Record<string, unknown>> {
    const page = viewProps(await AssessmentRequestDetailContent(params('request-1')));
    const [detail] = ([] as unknown[]).concat(page.children);
    return viewProps(detail);
  }

  it('passes the questionnaire card the questionnaire target and the draft card the draft target', async () => {
    mocks.getRequest.mockResolvedValue(ok(request({ questionnaire: signal, assessment: many })));
    const props = await detailProps();
    const questionnaireSlot = renderSlot(props.questionnaireAiInputs);
    expect(within(questionnaireSlot.container).getByRole('list', { name: 'AI inputs changed since this questionnaire was generated' })).toBeInTheDocument();
    questionnaireSlot.unmount();
    renderSlot(props.draftAiInputs);
    expect(screen.getByRole('list', { name: 'AI inputs changed since this draft was generated' })).toBeInTheDocument();
  });

  /* A card keeps itself for a slot (the draft card once the assessment exists; WR-306), so "nothing" is no slot at all. */
  it('passes no slot to either card when the read serves no signal, as for a Requestor, or one that lists no note', async () => {
    for (const aiInputs of [null, { questionnaire: null, assessment: null }, { questionnaire: { count: 0, notes: [], files: [] }, assessment: { count: 0, notes: [], files: [] } }]) {
      mocks.getRequest.mockResolvedValue(ok(request(aiInputs)));
      const props = await detailProps();
      expect(props.questionnaireAiInputs).toBeUndefined();
      expect(props.draftAiInputs).toBeUndefined();
    }
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
