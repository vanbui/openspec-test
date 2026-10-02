import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireList } from './questionnaire-list';
import { QuestionnaireDetail } from './questionnaire-detail';
import { QuestionnaireRenderer } from './questionnaire-renderer';
import { QuestionnaireReview } from './questionnaire-review';
import { QuestionnaireReviewList } from './questionnaire-review-list';
import type { QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { availableAssessmentRequest } from './questionnaire-domain';

vi.mock('./questionnaire-renderer', () => ({
  QuestionnaireRenderer: vi.fn(
    ({ documentId, mode }: { definition: QuestionnaireDefinition; documentId: string; mode: 'edit' | 'read-only' }) => (
      <div data-document-id={documentId} data-mode={mode}>Shared questionnaire renderer</div>
    ),
  ),
}));

vi.mock('./questionnaire-actions', () => ({
  revertQuestionnaireToDraftAction: vi.fn(),
}));

const questionnaireRenderer = vi.mocked(QuestionnaireRenderer);

vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

const replace = vi.hoisted(() => vi.fn());
const currentPathname = vi.hoisted(() => ({ value: '/app/questionnaires' }));
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname.value,
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('view=cards&unsafe=discard'),
}));

const questionnaire: QuestionnaireSummary = {
  documentId: 'questionnaire/one',
  questionnaireNumber: 'QUES-DEV-001',
  title: 'Service security questionnaire',
  description: 'Tell us how the service is protected.',
  state: 'draft',
  progress: { answered: 3, total: 5, percent: 60 },
  assessmentRequest: { availability: 'available' as const,
    documentId: 'request-one',
    requestNumber: 'RAR-2026-X7K4Q2',
    title: 'Customer portal review',
    requestStatus: 'questionnaire-in-progress',
  },
  updatedAt: '2026-08-29T10:00:00.000Z',
};

const submittedQuestionnaire: QuestionnaireSummary = {
  ...questionnaire,
  state: 'submitted',
  progress: { answered: 5, total: 5, percent: 100 },
};

const draftQuestionnaire: QuestionnaireSummary = {
  ...questionnaire,
  documentId: 'questionnaire-two',
  questionnaireNumber: 'QUES-DEV-002',
  title: 'Infrastructure security questionnaire',
};

const submittedDefinition: QuestionnaireDefinition = [
  {
    schemaVersion: 1,
    documentId: 'question-one',
    questionKey: 'service_name',
    questionText: 'What is the service name?',
    answerType: 'Text',
    section: { key: 'overview', title: 'Overview', order: 1 },
    order: 1,
    required: true,
    support: { status: 'supported' },
    answer: {
      schemaVersion: 1,
      value: 'Atlas',
      state: 'submitted',
      updatedAt: '2026-08-29T10:00:00.000Z',
      submittedAt: '2026-08-29T10:00:00.000Z',
    },
  },
];

describe('My Questionnaires discovery', () => {
  it('renders only the requestor-authorised request backlink and keeps absent and unavailable states distinct', () => {
    const definition = submittedDefinition;
    const view = render(<QuestionnaireDetail assessmentRequestHref="/app/requests/request-one" definition={definition} questionnaire={questionnaire} state="ready" />);

    expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveAttribute('href', '/app/requests/request-one');
    expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveClass('record-link');
    expect(screen.queryByText('RAR-2026-X7K4Q2 ·')).not.toBeInTheDocument();

    view.rerender(<QuestionnaireDetail definition={definition} questionnaire={{ ...questionnaire, assessmentRequest: { availability: 'absent' } }} state="ready" />);
    expect(screen.getByText('No assessment request is linked to this questionnaire.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /assessment request/i })).not.toBeInTheDocument();

    view.rerender(<QuestionnaireDetail definition={definition} questionnaire={{ ...questionnaire, assessmentRequest: { availability: 'unavailable' } }} state="ready" />);
    expect(screen.queryByText('No assessment request is linked to this questionnaire.')).not.toBeInTheDocument();
    expect(screen.queryByText('RAR-2026-X7K4Q2')).not.toBeInTheDocument();
  });

  it('uses the native questionnaire status filter and clears all active filters from page one', () => {
    replace.mockClear();
    currentPathname.value = '/app/questionnaires';
    const view = render(
      <QuestionnaireList
        questionnaires={[questionnaire]}
        pagination={{ page: 2, pageSize: 25, pageCount: 2, total: 26 }}
        query={{ q: 'portal', page: 2, pageSize: 25, sort: 'updatedAt:desc' }}
      />,
    );

    const status = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('All statuses');
    expect(status).toHaveTextContent('Not started');
    expect(status).toHaveTextContent('Draft');
    expect(status).toHaveTextContent('Submitted');

    fireEvent.change(status, { target: { value: 'draft' } });
    expect(replace).toHaveBeenLastCalledWith(
      '/app/questionnaires?view=cards&q=portal&status=draft&sort=updatedAt%3Adesc&pageSize=25',
      { scroll: false },
    );

    view.rerender(
      <QuestionnaireList
        questionnaires={[]}
        pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }}
        query={{ q: 'portal', status: 'draft', page: 1, pageSize: 25, sort: 'updatedAt:desc' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No questionnaires match these filters' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    expect(replace).toHaveBeenLastCalledWith(
      '/app/questionnaires?view=cards&sort=updatedAt%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('shows the Requestor detail status from the served state through the shared badge', () => {
    const headerBadge = (root: HTMLElement) => root.querySelector<HTMLElement>('.page-header > [data-slot="badge"]');
    const view = render(<QuestionnaireDetail definition={submittedDefinition} questionnaire={questionnaire} state="ready" />);
    expect(headerBadge(view.container)).toHaveTextContent(/^Draft$/);
    expect(headerBadge(view.container)).toHaveAttribute('data-tone', 'info');

    view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={{ ...questionnaire, state: 'not-started', progress: { answered: 0, total: 5, percent: 0 } }} state="ready" />);
    expect(headerBadge(view.container)).toHaveTextContent(/^Not started$/);
    expect(headerBadge(view.container)).toHaveAttribute('data-tone', 'neutral');

    view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="submitted" />);
    expect(headerBadge(view.container)).toHaveTextContent(/^Submitted$/);
    expect(headerBadge(view.container)).toHaveAttribute('data-tone', 'success');
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('keeps a heading and recovery action in every safe requestor detail state', () => {
    const view = render(<QuestionnaireDetail state="permission" />);
    for (const state of ['permission', 'error', 'empty'] as const) {
      view.rerender(<QuestionnaireDetail state={state} />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('link')).toHaveAttribute('href', '/app/questionnaires');
    }
  });

  it('reaches page two with DataTable footer buttons and allowlisted URLs', () => {
    render(<QuestionnaireList
      questionnaires={[questionnaire]}
      pagination={{ page: 1, pageSize: 25, pageCount: 2, total: 26 }}
      query={{ page: 1, pageSize: 25, sort: 'updatedAt:desc' }}
    />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenCalledWith('/app/questionnaires?view=cards&sort=updatedAt%3Adesc&page=2&pageSize=25', { scroll: false });
    expect(JSON.stringify(replace.mock.calls)).not.toContain('unsafe');
  });

  it('keeps selected questionnaire status in server-backed pagination URLs only when active', () => {
    replace.mockClear();
    currentPathname.value = '/app/questionnaires';
    const view = render(
      <QuestionnaireList
        questionnaires={[questionnaire]}
        pagination={{ page: 2, pageSize: 25, pageCount: 3, total: 70 }}
        query={{ q: 'portal', status: 'draft', page: 2, pageSize: 25, sort: 'title:asc' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(replace).toHaveBeenLastCalledWith(
      '/app/questionnaires?view=cards&q=portal&status=draft&sort=title%3Aasc&pageSize=25',
      { scroll: false },
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '50' } });
    expect(replace).toHaveBeenLastCalledWith(
      '/app/questionnaires?view=cards&q=portal&status=draft&sort=title%3Aasc&pageSize=50',
      { scroll: false },
    );

    view.rerender(
      <QuestionnaireList
        questionnaires={[questionnaire]}
        pagination={{ page: 1, pageSize: 25, pageCount: 2, total: 26 }}
        query={{ page: 1, pageSize: 25, sort: 'updatedAt:desc' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenLastCalledWith(
      '/app/questionnaires?view=cards&sort=updatedAt%3Adesc&page=2&pageSize=25',
      { scroll: false },
    );
  });

  it('renders an authorised questionnaire with request context and a safe direct link', () => {
    const { container } = render(<QuestionnaireList questionnaires={[questionnaire]} />);

    expect(screen.getByRole('table', { name: 'My questionnaires' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Service security questionnaire' })[0]).toHaveAttribute(
      'href',
      '/app/questionnaires/questionnaire%2Fone',
    );
    expect(screen.getAllByText('Customer portal review')).toHaveLength(2);
    expect(screen.getAllByText('RAR-2026-X7K4Q2')).toHaveLength(2);
    // The shared questionnaire badge, in the table and the card: Draft is work waiting on the Requestor.
    const draftBadges = screen.getAllByText('Draft');
    expect(draftBadges).toHaveLength(2);
    for (const badge of draftBadges) {
      expect(badge).toHaveAttribute('data-tone', 'info');
      expect(badge.querySelectorAll('svg')).toHaveLength(1);
    }
    expect(screen.getAllByText('3 of 5 answered')).toHaveLength(2);
    expect(screen.getByText('2 unanswered')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Service security questionnaire progress' })).toHaveAttribute('aria-valuenow', '60');
    expect(container.querySelector('[data-slot="data-table-desktop"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="data-table-mobile"]')).toBeInTheDocument();
  });

  it('renders loading and empty states with purposeful accessible content', () => {
    const view = render(<QuestionnaireList questionnaires={[]} state="loading" />);

    expect(screen.getByRole('status', { name: 'Loading questionnaires' })).toBeInTheDocument();
    expect(screen.getAllByTestId('data-table-skeleton-row')).toHaveLength(25);

    view.rerender(<QuestionnaireList questionnaires={[]} state="empty" />);
    expect(screen.getByRole('heading', { name: 'No questionnaires yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View my requests' })).toHaveAttribute('href', '/app/requests');
  });

  it('renders recoverable error and content-safe permission states', () => {
    const view = render(<QuestionnaireList questionnaires={[]} state="error" />);

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load questionnaires');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    view.rerender(<QuestionnaireList questionnaires={[questionnaire]} state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('access to questionnaires');
    expect(screen.queryByText(questionnaire.title)).not.toBeInTheDocument();
    expect(screen.queryByText(availableAssessmentRequest(questionnaire.assessmentRequest)?.title ?? '')).not.toBeInTheDocument();
    expect(screen.queryByText('3 of 5 answered')).not.toBeInTheDocument();
  });

  it('keeps the route server-owned behind the typed owner-scoped service', () => {
    const pagePath = resolve(process.cwd(), 'app/(app)/app/questionnaires/page.tsx');
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('listMyQuestionnaires');
    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('shows direct questionnaire navigation only to a matching capability', async () => {
    const { CapabilityNavigation } = await import('@/components/shell/capability-navigation');
    const { rerender } = render(<CapabilityNavigation granted={new Set(['assessment-request:read'])} />);

    expect(screen.getByRole('link', { name: 'My Questionnaires' })).toHaveAttribute('href', '/app/questionnaires');
    rerender(<CapabilityNavigation granted={new Set()} />);
    expect(screen.queryByRole('link', { name: 'My Questionnaires' })).not.toBeInTheDocument();
  });
});

describe('Security Analyst questionnaire review', () => {
  it('uses the shared primary reversal trigger only for submitted questionnaire surfaces', () => {
    const view = render(<QuestionnaireDetail definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="submitted" />);
    expect(screen.getByRole('button', { name: 'Return to draft' })).toHaveAttribute('data-variant', 'default');

    view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={questionnaire} state="ready" />);
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();

    view.rerender(<QuestionnaireReview definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="submitted" />);
    expect(screen.getByRole('button', { name: 'Return to draft' })).toHaveAttribute('data-variant', 'default');
  });

  it('offers both actors Return to draft only while the request is questionnaire-in-progress (UI-SPEC §10.1)', () => {
    const withRequest = (requestStatus: string): QuestionnaireSummary => ({
      ...submittedQuestionnaire,
      assessmentRequest: { availability: 'available', documentId: 'request-one', requestNumber: 'RAR-2026-X7K4Q2', title: 'Customer portal review', requestStatus },
    });
    const view = render(<QuestionnaireReview definition={submittedDefinition} questionnaire={withRequest('questionnaire-in-progress')} state="submitted" />);
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();

    for (const questionnaireFacts of [
      withRequest('risk-assessment-drafted'),
      withRequest('under-review'),
      { ...submittedQuestionnaire, assessmentRequest: { availability: 'unavailable' as const } },
      { ...submittedQuestionnaire, assessmentRequest: { availability: 'absent' as const } },
    ]) {
      view.rerender(<QuestionnaireReview definition={submittedDefinition} questionnaire={questionnaireFacts} state="submitted" />);
      expect(screen.queryByRole('button', { name: 'Return to draft' }), JSON.stringify(questionnaireFacts.assessmentRequest)).not.toBeInTheDocument();
      view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={questionnaireFacts} state="submitted" />);
      expect(screen.queryByRole('button', { name: 'Return to draft' }), JSON.stringify(questionnaireFacts.assessmentRequest)).not.toBeInTheDocument();
    }
  });

  it('passes each page’s submitted notice to the shared renderer (UI-SPEC §8.2)', () => {
    questionnaireRenderer.mockClear();
    const view = render(<QuestionnaireDetail definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="submitted" />);
    expect(questionnaireRenderer).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'read-only', submittedNotice: 'requestor-revertible' }), undefined);

    const drafted: QuestionnaireSummary = { ...submittedQuestionnaire, assessmentRequest: { availability: 'available', documentId: 'request-one', requestNumber: 'RAR-2026-X7K4Q2', title: 'Customer portal review', requestStatus: 'risk-assessment-drafted' } };
    view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={drafted} state="submitted" />);
    expect(questionnaireRenderer).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'read-only', submittedNotice: 'requestor-locked' }), undefined);

    view.rerender(<QuestionnaireReview definition={submittedDefinition} questionnaire={drafted} state="submitted" />);
    expect(questionnaireRenderer).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'read-only', submittedNotice: 'analyst' }), undefined);
  });

  it('describes the Security Analyst’s return to draft in plain words', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireReview definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="submitted" />);
    await user.click(screen.getByRole('button', { name: 'Return to draft' }));
    expect(screen.getByRole('alertdialog', { name: 'Return this questionnaire to draft?' })).toHaveAccessibleDescription('The Requestor’s answers go back to draft so they can change them and submit again. Their answers are kept.');
  });

  it('renders only the analyst-authorised review request backlink', () => {
    render(
      <QuestionnaireReview
        assessmentRequestHref="/app/review/requests/request-one"
        definition={submittedDefinition}
        questionnaire={submittedQuestionnaire}
        state="submitted"
      />,
    );

    expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveAttribute(
      'href',
      '/app/review/requests/request-one',
    );
    expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveClass('record-link');
    const badge = document.querySelector<HTMLElement>('.page-header > [data-slot="badge"]');
    expect(badge).toHaveTextContent(/^Submitted$/);
    expect(badge).toHaveAttribute('data-tone', 'success');
  });

  it('retains the safe analyst backlink while a questionnaire awaits submission', () => {
    render(
      <QuestionnaireReview
        assessmentRequestHref="/app/review/requests/request-one"
        questionnaire={questionnaire}
        state="awaiting-submission"
      />,
    );

    expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveAttribute(
      'href',
      '/app/review/requests/request-one',
    );
    expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveClass('record-link');
    // The heading names the questionnaire's served state; its draft answers stay private.
    const badge = document.querySelector<HTMLElement>('.page-header > [data-slot="badge"]');
    expect(badge).toHaveTextContent(/^Draft$/);
    expect(badge).toHaveAttribute('data-tone', 'info');
  });

  it('lists each question once, grouped by section, with no renderer and no Submitted alert in analyst review', () => {
    const questionDefaults = {
      schemaVersion: 1 as const,
      support: { status: 'supported' as const },
      answer: null,
      required: true,
    };
    const definition: QuestionnaireDefinition = [
      { ...questionDefaults, documentId: 'question-hosting', questionKey: 'hosting', questionText: 'Where is the service hosted?', answerType: 'Single select', choices: [{ value: 'cloud', label: 'Cloud' }, { value: 'on-premises', label: 'On premises' }], section: { key: 'hosting', title: 'Hosting', order: 2 }, order: 1, required: false },
      { ...questionDefaults, documentId: 'question-name', questionKey: 'service_name', questionText: 'What is the service name?', answerType: 'Text', section: { key: 'overview', title: 'Overview', order: 1 }, order: 1 },
      { ...questionDefaults, documentId: 'question-data', questionKey: 'stores_data', questionText: 'Does the service store customer data?', answerType: 'Boolean', section: { key: 'overview', title: 'Overview', order: 1 }, order: 2 },
    ];
    const unreleased: QuestionnaireSummary = { ...questionnaire, state: 'not-started', progress: { answered: 0, total: 3, percent: 0 }, release: null };
    // If the read-only renderer were mounted it would list every question a second time.
    const original = questionnaireRenderer.getMockImplementation();
    questionnaireRenderer.mockClear();
    questionnaireRenderer.mockImplementation(({ definition: rendered }) => <div>{rendered.map((question) => <p key={question.questionKey}>{question.questionText}</p>)}</div>);
    try {
      const { container } = render(
        <QuestionnaireReview assessmentRequestHref="/app/review/requests/request-one" definition={definition} questionnaire={unreleased} state="analyst-review" />,
      );

      const badge = container.querySelector<HTMLElement>('.page-header > [data-slot="badge"]');
      expect(badge).toHaveTextContent(/^Analyst review$/);
      expect(badge).toHaveAttribute('data-tone', 'warning');

      for (const question of definition) expect(screen.getAllByText(question.questionText), question.questionText).toHaveLength(1);
      const governance = screen.getByRole('region', { name: 'Questionnaire governance' });
      expect([...governance.querySelectorAll('h4.micro-label')].map((heading) => heading.textContent)).toEqual(['Overview', 'Hosting']);
      expect(screen.getByText('Text · Required')).toBeInTheDocument();
      expect(screen.getByText('Boolean · Required')).toBeInTheDocument();
      expect(screen.getByText('Single select · Optional')).toBeInTheDocument();
      expect(screen.getByText('Choices: Cloud, On premises')).toBeInTheDocument();

      expect(questionnaireRenderer).not.toHaveBeenCalled();
      expect(screen.queryByText(/Questionnaire submitted\. This questionnaire is read-only/)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' })).toHaveAttribute('href', '/app/review/requests/request-one');
    } finally {
      if (original) questionnaireRenderer.mockImplementation(original);
    }
  });
  it('preserves questionnaire-native status filters on the review route and clears them from page one', () => {
    replace.mockClear();
    currentPathname.value = '/app/review/questionnaires';
    const view = render(
      <QuestionnaireReviewList
        questionnaires={[submittedQuestionnaire]}
        pagination={{ page: 2, pageSize: 25, pageCount: 2, total: 26 }}
        query={{ q: 'portal', page: 2, pageSize: 25, sort: 'updatedAt:desc' }}
      />,
    );

    const status = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(status).toBeInTheDocument();
    // The filter keeps the three served states; Analyst review is a derived label, not a filter value.
    expect([...status.querySelectorAll('option')].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'All statuses'], ['not-started', 'Not started'], ['draft', 'Draft'], ['submitted', 'Submitted'],
    ]);

    fireEvent.change(status, { target: { value: 'submitted' } });
    expect(replace).toHaveBeenLastCalledWith(
      '/app/review/questionnaires?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&pageSize=25',
      { scroll: false },
    );

    view.rerender(
      <QuestionnaireReviewList
        questionnaires={[]}
        pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }}
        query={{ status: 'submitted', page: 1, pageSize: 25, sort: 'updatedAt:desc' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No questionnaires to review match these filters' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    expect(replace).toHaveBeenLastCalledWith(
      '/app/review/questionnaires?view=cards&sort=updatedAt%3Adesc&pageSize=25',
      { scroll: false },
    );
  });

  it('lists questionnaire review work with safe direct links and one derived status per questionnaire', () => {
    const release = { releasedAt: '2026-08-29T09:00:00.000Z', releasedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' } };
    const unreleased: QuestionnaireSummary = {
      ...draftQuestionnaire,
      documentId: 'questionnaire-three',
      questionnaireNumber: 'QUES-DEV-003',
      title: 'Unreleased questionnaire',
      state: 'not-started',
      progress: { answered: 0, total: 5, percent: 0 },
      release: null,
    };
    const { container } = render(<QuestionnaireReviewList questionnaires={[{ ...submittedQuestionnaire, release }, { ...draftQuestionnaire, release }, unreleased]} />);

    expect(screen.getByRole('table', { name: 'Questionnaires for review' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Service security questionnaire' }).at(0)).toHaveAttribute('href', '/app/review/questionnaires/questionnaire%2Fone');
    // An unreleased questionnaire is in analyst review; a released one shows its served state.
    for (const [label, tone] of [['Submitted', 'success'], ['Draft', 'info'], ['Analyst review', 'warning']] as const) {
      const badges = screen.getAllByText(label, { exact: true });
      expect(badges, label).toHaveLength(2);
      for (const badge of badges) expect(badge, label).toHaveAttribute('data-tone', tone);
    }
    expect(screen.queryByText('Ready for review')).not.toBeInTheDocument();
    expect(screen.queryByText('Awaiting submission')).not.toBeInTheDocument();
    expect(screen.getAllByText('Customer portal review')).toHaveLength(6);
    expect(container.querySelector('[data-slot="data-table-mobile"]')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('Atlas');
    expect(container.querySelector('[data-slot="data-table-desktop"]')).toBeInTheDocument();
  });

  it('renders analyst loading, empty, recoverable error, and content-safe permission states', () => {
    const view = render(<QuestionnaireReviewList questionnaires={[]} state="loading" />);

    expect(screen.getByRole('status', { name: 'Loading questionnaire reviews' })).toBeInTheDocument();
    expect(screen.getAllByTestId('data-table-skeleton-row')).toHaveLength(25);

    view.rerender(<QuestionnaireReviewList questionnaires={[]} state="empty" />);
    expect(screen.getByRole('heading', { name: 'No questionnaires to review yet' })).toBeInTheDocument();

    view.rerender(<QuestionnaireReviewList questionnaires={[]} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load questionnaire reviews');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    view.rerender(<QuestionnaireReviewList questionnaires={[submittedQuestionnaire]} state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to questionnaire reviews');
    expect(screen.queryByText(submittedQuestionnaire.title)).not.toBeInTheDocument();
    // W-3: the refusal alone, as the Risk Register's is: no search, filter, total or pager around it.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ results?$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Previous page|Next page|Use (compact|default) density)$/ })).not.toBeInTheDocument();
    expect(screen.queryByText(availableAssessmentRequest(submittedQuestionnaire.assessmentRequest)?.title ?? '')).not.toBeInTheDocument();
  });

  it('composes submitted answers through the exact shared read-only renderer model', () => {
    questionnaireRenderer.mockClear();
    render(
      <QuestionnaireReview
        definition={submittedDefinition}
        questionnaire={submittedQuestionnaire}
        state="submitted"
      />,
    );

    expect(screen.getByRole('heading', { name: submittedQuestionnaire.title })).toBeInTheDocument();
    expect(screen.getByText('Shared questionnaire renderer')).toHaveAttribute('data-mode', 'read-only');
    expect(questionnaireRenderer).toHaveBeenCalledWith(
      { definition: submittedDefinition, documentId: submittedQuestionnaire.documentId, mode: 'read-only', submittedNotice: 'analyst' },
      undefined,
    );
    expect(screen.queryByRole('button', { name: /save|submit/i })).not.toBeInTheDocument();
  });

  it('never composes or reveals draft answers before an authoritative submitted batch', () => {
    questionnaireRenderer.mockClear();
    render(
      <QuestionnaireReview
        definition={submittedDefinition}
        questionnaire={questionnaire}
        state="awaiting-submission"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Awaiting questionnaire submission');
    expect(screen.queryByText('Atlas')).not.toBeInTheDocument();
    expect(questionnaireRenderer).not.toHaveBeenCalled();
  });

  it('discards supplied questionnaire and answer content in safe detail states', () => {
    questionnaireRenderer.mockClear();
    const view = render(
      <QuestionnaireReview
        definition={submittedDefinition}
        questionnaire={submittedQuestionnaire}
        state="permission"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have permission to review this questionnaire');
    expect(screen.getByRole('alert')).toHaveTextContent('You can’t review this questionnaire with your current access. Choose another from the questionnaire reviews.');
    expect(screen.getByRole('heading', { level: 1, name: 'Questionnaire review' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to questionnaire reviews' })).toHaveAttribute('href', '/app/review/questionnaires');
    expect(screen.queryByText(submittedQuestionnaire.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Atlas')).not.toBeInTheDocument();

    view.rerender(
      <QuestionnaireReview definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="error" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this questionnaire review');
    expect(screen.queryByText(submittedQuestionnaire.title)).not.toBeInTheDocument();

    view.rerender(
      <QuestionnaireReview definition={submittedDefinition} questionnaire={submittedQuestionnaire} state="empty" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No submitted answers are available');
    expect(screen.queryByText('Atlas')).not.toBeInTheDocument();
    expect(questionnaireRenderer).not.toHaveBeenCalled();
  });

  it('keeps both analyst routes server-owned behind explicit typed analyst services', () => {
    const listPage = resolve(process.cwd(), 'app/(app)/app/review/questionnaires/page.tsx');
    const detailPage = resolve(process.cwd(), 'app/(app)/app/review/questionnaires/[documentId]/page.tsx');
    const listSource = readFileSync(listPage, 'utf8');
    const detailSource = readFileSync(detailPage, 'utf8');

    expect(listSource).toContain('listQuestionnairesForReview');
    expect(detailSource).toContain('getQuestionnaire');
    expect(detailSource).toContain('getQuestionnaireQuestions');
    expect(`${listSource}\n${detailSource}`).not.toContain("'use client'");
    expect(`${listSource}\n${detailSource}`).not.toMatch(/\bfetch\s*\(/);
  });

  it('uses the exact actor capability and route pair for questionnaire request backlinks', () => {
    const requestorPage = readFileSync(resolve(process.cwd(), 'app/(app)/app/questionnaires/[documentId]/page.tsx'), 'utf8');
    const analystPage = readFileSync(resolve(process.cwd(), 'app/(app)/app/review/questionnaires/[documentId]/page.tsx'), 'utf8');

    expect(requestorPage).toContain("can('assessment-request:read', granted)");
    expect(requestorPage).toContain('`/app/requests/${encodeURIComponent(request.documentId)}`');
    // The analyst route reuses the route gate (D-23), so its request backlink needs no second capability read.
    expect(analystPage).toContain('canViewerReviewAssessments');
    expect(analystPage).toContain('`/app/review/requests/${encodeURIComponent(request.documentId)}`');
  });
});
