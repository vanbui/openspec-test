import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { questionnaireDefinitionSchema, type QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { QuestionnaireDetail } from './questionnaire-detail';
import { QuestionnaireRenderer } from './questionnaire-renderer';
import { NavigationGuardProvider } from '@/components/csrm/navigation-guard';
import { rememberSavedQuestionnaire, savedQuestionnaireAfter } from './use-answer-autosave';

const saveQuestionnaireDraftAction = vi.hoisted(() => vi.fn());
const autosaveQuestionnaireDraftAction = vi.hoisted(() => vi.fn());
const submitQuestionnaireAction = vi.hoisted(() => vi.fn());
const revertQuestionnaireToDraftAction = vi.hoisted(() => vi.fn());
const routerRefresh = vi.hoisted(() => vi.fn());

vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

vi.mock('./questionnaire-actions', () => ({
  saveQuestionnaireDraftAction,
  autosaveQuestionnaireDraftAction,
  submitQuestionnaireAction,
  revertQuestionnaireToDraftAction,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh }) }));

function question(
  questionKey: string,
  questionText: string,
  answerType: QuestionnaireDefinition[number]['answerType'],
  options: Partial<QuestionnaireDefinition[number]> = {},
): QuestionnaireDefinition[number] {
  return {
    questionText,
    answerType,
    schemaVersion: 1,
    questionKey,
    section: { key: 'context', title: 'Service context', description: 'Describe the service.', order: 1 },
    order: 1,
    required: false,
    answer: null,
    support: answerType === 'File upload'
      ? { status: 'unsupported', reason: 'file-upload-deferred' }
      : { status: 'supported' },
    ...options,
  } as QuestionnaireDefinition[number];
}

const definition: QuestionnaireDefinition = [
  question('details', 'Additional details', 'Long text', { order: 2 }),
  question('service_name', 'Service name', 'Text', { order: 1, required: true }),
  question('public_service', 'Is the service public?', 'Boolean', {
    section: { key: 'access', title: 'Hosting and access', order: 2 },
    order: 1,
    required: true,
  }),
  question('regions', 'Hosting regions', 'Multi select', {
    section: { key: 'access', title: 'Hosting and access', order: 2 },
    order: 3,
    choices: [{ value: 'au', label: 'Australia' }, { value: 'eu', label: 'Europe' }],
  }),
  question('audience', 'Primary audience', 'Single select', {
    section: { key: 'access', title: 'Hosting and access', order: 2 },
    order: 2,
    choices: [{ value: 'staff', label: 'Staff' }, { value: 'customers', label: 'Customers' }],
  }),
  question('launch_date', 'Expected launch date', 'Date', {
    section: { key: 'access', title: 'Hosting and access', order: 2 },
    order: 4,
  }),
  question('public_url', 'Public URL', 'Text', {
    section: { key: 'access', title: 'Hosting and access', order: 2 },
    order: 5,
    required: true,
    visibility: { questionKey: 'public_service', operator: 'equals', value: true },
  }),
  question('evidence', 'Supporting evidence', 'File upload', {
    section: { key: 'evidence', title: 'Evidence', order: 3 },
    order: 1,
    required: true,
  }),
];

const submittedDefinition: QuestionnaireDefinition = definition.map((item) => ({
  ...item,
  answer: {
    schemaVersion: 1,
    value: item.questionKey === 'service_name'
      ? 'Customer portal'
      : item.questionKey === 'public_service'
        ? false
        : item.answerType === 'Multi select'
          ? []
          : null,
    state: 'submitted',
    updatedAt: '2026-08-30T01:00:00.000Z',
    submittedAt: '2026-08-30T01:00:00.000Z',
  },
}));

const questionnaire: QuestionnaireSummary = {
  documentId: 'questionnaire-1',
  questionnaireNumber: 'QUES-DEV-001',
  title: 'Service security questionnaire',
  description: 'Describe the service security context.',
  state: 'draft',
  progress: { answered: 0, total: 7, percent: 0 },
  assessmentRequest: { availability: 'available' as const,
    documentId: 'request-1',
    requestNumber: 'RAR-2026-X7K4Q2',
    title: 'Customer portal review',
    requestStatus: 'questionnaire-in-progress',
  },
  aiAssisted: false,
  updatedAt: '2026-08-30T01:00:00.000Z',
};

/** A successful save as the Server Actions return it. */
function savedResponse(answers: QuestionnaireDefinition, updatedAt = '2026-09-28T01:00:05.000Z') {
  return { ok: true, data: { questionnaireId: 'questionnaire-1', state: 'draft', progress: { answered: 1, total: answers.length, percent: 14 }, answers, updatedAt } };
}

beforeEach(() => {
  saveQuestionnaireDraftAction.mockReset();
  submitQuestionnaireAction.mockReset();
  autosaveQuestionnaireDraftAction.mockReset().mockResolvedValue(savedResponse(definition));
  routerRefresh.mockReset();
});

describe('QuestionnaireRenderer', () => {
  it('renders normalized sections and accessible controls for every answer type', async () => {
    render(<QuestionnaireRenderer definition={definition} documentId="questionnaire-1" mode="edit" />);

    const headings = screen.getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
      .filter((heading) => heading !== 'Questions requiring attention');
    expect(headings).toEqual(['Service context', 'Hosting and access', 'Evidence']);
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-labelledby'))).not.toContain(null);
    expect(screen.getByRole('textbox', { name: /Service name/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Additional details/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Is the service public/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Australia' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected launch date/)).toHaveAttribute('type', 'date');
    expect(screen.getByText('File upload is unavailable').closest('[role="alert"]')).toHaveTextContent(/file upload is unavailable/i);
    expect(screen.queryByLabelText(/Supporting evidence/)).not.toBeInTheDocument();
    expect(screen.getByText('0 of 7 answered')).toBeInTheDocument();
    expect(screen.getByText(/2 required questions unanswered/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('0 of 7 questionnaire questions answered');
    // UI-SPEC §5.3: nothing needs attention until the Requestor tries to submit.
    expect(screen.queryByRole('region', { name: 'Questionnaire validation guidance' })).not.toBeInTheDocument();
  });

  /*
   * The server sorts questions by question order alone, so two sections interleave in what it serves
   * (D-13). Section A (order 1) holds a0 and a1; section B (order 2) holds b0 and b1.
   */
  const sectionA = { key: 'service', title: 'Service', order: 1 };
  const sectionB = { key: 'hosting', title: 'Hosting', order: 2 };
  const interleaved: QuestionnaireDefinition = [
    question('b0', 'Where is the service hosted?', 'Text', { section: sectionB, order: 0, required: true }),
    question('a0', 'What is the service called?', 'Text', { section: sectionA, order: 0, required: true }),
    question('b1', 'Hosting evidence', 'File upload', { section: sectionB, order: 1, required: true }),
    question('a1', 'Who owns the service?', 'Text', { section: sectionA, order: 1, required: true }),
  ];

  it('lists the questions requiring attention only after a submit attempt, in form order, and focuses the first', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRenderer definition={interleaved} documentId="questionnaire-1" mode="edit" />);
    expect(screen.queryByRole('region', { name: 'Questionnaire validation guidance' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const region = await screen.findByRole('region', { name: 'Questionnaire validation guidance' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Questions requiring attention' })).toBeInTheDocument();
    expect(within(region).getByText('Answer or correct these questions, then submit again.')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'What is the service called?',
      'Who owns the service?',
      'Where is the service hosted?',
      'Hosting evidence - required but unavailable',
    ]);
    const first = screen.getByRole('textbox', { name: /What is the service called/ });
    await waitFor(() => expect(first).toHaveFocus());

    await user.type(first, 'Customer portal');
    expect(within(region).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Who owns the service?',
      'Where is the service hosted?',
      'Hosting evidence - required but unavailable',
    ]);
  });

  it('keeps the attention list as the one list of questions: the form-level alert repeats none of them', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRenderer definition={interleaved} documentId="questionnaire-1" mode="edit" />);
    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    await screen.findByRole('region', { name: 'Questionnaire validation guidance' });
    expect(screen.queryByText('Questionnaire not saved')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Who owns the service?' })).toHaveLength(1);
  });

  it('removes the attention list once nothing remains outstanding', async () => {
    const user = userEvent.setup();
    const supported = interleaved.filter((item) => item.questionKey !== 'b1');
    render(<QuestionnaireRenderer definition={supported} documentId="questionnaire-1" mode="edit" />);
    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    await screen.findByRole('region', { name: 'Questionnaire validation guidance' });
    await user.type(screen.getByRole('textbox', { name: /What is the service called/ }), 'Customer portal');
    await user.type(screen.getByRole('textbox', { name: /Who owns the service/ }), 'Service owner');
    await user.type(screen.getByRole('textbox', { name: /Where is the service hosted/ }), 'Sydney');
    expect(screen.queryByRole('region', { name: 'Questionnaire validation guidance' })).not.toBeInTheDocument();
  });

  it('lists a question the server returns a field error for, after the submit is refused', async () => {
    const user = userEvent.setup();
    const optional = interleaved.filter((item) => item.questionKey !== 'b1').map((item) => ({ ...item, required: false }));
    saveQuestionnaireDraftAction.mockResolvedValue({ ok: true, data: { questionnaireId: 'questionnaire-1', state: 'draft', progress: { answered: 1, total: 3, percent: 33 }, answers: optional, updatedAt: '2026-08-30T01:00:00.000Z' } });
    submitQuestionnaireAction.mockResolvedValue({ ok: false, formError: 'Check the highlighted answers and try again.', fieldErrors: { 'answers.a1': ['Enter a shorter answer for Who owns the service?.'] } });
    render(<QuestionnaireRenderer definition={optional} documentId="questionnaire-1" mode="edit" />);
    expect(screen.queryByRole('region', { name: 'Questionnaire validation guidance' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /Who owns the service/ }), 'x');
    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Submit questionnaire' }));
    // The refused submit keeps its dialog open (UI-SPEC §5.4), so the page behind it is hidden from the accessibility tree.
    const region = await screen.findByRole('region', { name: 'Questionnaire validation guidance', hidden: true });
    expect(within(region).getAllByRole('listitem', { hidden: true }).map((item) => item.textContent)).toEqual(['Who owns the service?']);
  });

  it('shows and clears conditional answers while updating textual progress', async () => {
    const user = userEvent.setup();
    saveQuestionnaireDraftAction.mockResolvedValue({ ok: false, formError: 'Draft save failed.' });
    render(<QuestionnaireRenderer definition={definition} documentId="questionnaire-1" mode="edit" />);

    expect(screen.queryByRole('textbox', { name: /Public URL/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    const publicUrl = screen.getByRole('textbox', { name: /Public URL/ });
    await user.type(publicUrl, 'https://example.test');
    expect(screen.getByText('2 of 8 answered')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(screen.queryByRole('textbox', { name: /Public URL/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 7 answered')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(saveQuestionnaireDraftAction).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 'questionnaire-1',
      answers: expect.not.arrayContaining([expect.objectContaining({ questionKey: 'public_url' })]),
    }));
  });

  it('validates on blur and links the required summary to the first active invalid field', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRenderer definition={definition} documentId="questionnaire-1" mode="edit" />);

    const serviceName = screen.getByRole('textbox', { name: /Service name/ });
    await user.click(serviceName);
    await user.tab();
    expect(await screen.findByText(/Enter an answer for Service name/i)).toHaveAttribute('role', 'alert');
    expect(serviceName.getAttribute('aria-describedby')).toMatch(/service_name.*error/);

    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(serviceName).toHaveFocus());
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('radio', { name: 'Yes' }).getAttribute('aria-describedby')).toMatch(/public_service.*error/);
    expect(within(screen.getByRole('region', { name: 'Questionnaire validation guidance' })).getByRole('link', { name: /Service name/ })).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Questionnaire validation guidance' });
    expect(within(summary).getByRole('link', { name: /Service name/ })).toHaveAttribute('href', expect.stringMatching(/service_name/));
    expect(within(summary).getByText(/Supporting evidence.*unavailable/i)).toBeInTheDocument();
  });

  it('saves partial drafts and submits optional blank choice and date values as null', async () => {
    const editable = definition.filter((item) => item.questionKey !== 'evidence').map((item) => ({ ...item, required: false }));
    const user = userEvent.setup();
    saveQuestionnaireDraftAction.mockResolvedValue({ ok: true, data: { questionnaireId: 'questionnaire-1', state: 'draft', progress: { answered: 0, total: 7, percent: 0 }, answers: editable, updatedAt: '2026-08-30T01:00:00.000Z' } });
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(saveQuestionnaireDraftAction).toHaveBeenCalledWith(expect.objectContaining({
      answers: expect.arrayContaining([
        { questionKey: 'audience', value: null },
        { questionKey: 'launch_date', value: null },
      ]),
    }));
  });

  it('preserves values after draft failure and announces draft success distinctly', async () => {
    const user = userEvent.setup();
    saveQuestionnaireDraftAction
      .mockResolvedValueOnce({ ok: false, formError: 'The questionnaire service is unavailable.' })
      .mockResolvedValueOnce({ ok: true, data: { questionnaireId: 'questionnaire-1', state: 'draft', progress: { answered: 1, total: 7, percent: 14 }, answers: definition, updatedAt: '2026-08-30T01:00:00.000Z' } });
    render(<QuestionnaireRenderer definition={definition} documentId="questionnaire-1" mode="edit" />);

    const serviceName = screen.getByRole('textbox', { name: /Service name/ });
    await user.type(serviceName, 'Customer portal');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    // UI-SPEC §5.4 and §6.1: a failed save shows in the save status, never in a form-level alert.
    const completion = screen.getByRole('region', { name: 'Questionnaire completion' });
    expect(await within(completion).findByRole('alert')).toHaveTextContent('Your latest answers weren’t saved.');
    expect(screen.queryByText('Questionnaire not saved')).not.toBeInTheDocument();
    expect(serviceName).toHaveValue('Customer portal');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(within(completion).getByRole('status')).toHaveTextContent(/Saved at/));
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Submitted$/)).not.toBeInTheDocument();
  });

  it('keeps the submit confirmation open on server failure and prevents duplicate submits', async () => {
    const editable = definition.filter((item) => item.questionKey !== 'evidence');
    const user = userEvent.setup();
    let resolveSave!: (value: unknown) => void;
    saveQuestionnaireDraftAction.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    submitQuestionnaireAction.mockResolvedValue({ ok: false, formError: 'This questionnaire changed. Reload and try again.' });
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    const dialog = screen.getByRole('alertdialog');
    // UI-SPEC §8.2: the dialog says what happens next and how the answers can still change; nothing calls it irreversible.
    expect(dialog).toHaveAccessibleDescription('The Security Analyst will review your answers and use them to assess the request’s risk. Until they start the assessment, you can return the questionnaire to draft to change your answers.');
    expect(dialog).not.toHaveTextContent(/irreversible|cannot be undone|cannot be edited/i);
    const confirm = within(dialog).getByRole('button', { name: 'Submit questionnaire' });
    await user.dblClick(confirm);
    expect(saveQuestionnaireDraftAction).toHaveBeenCalledTimes(1);
    resolveSave({ ok: true, data: { questionnaireId: 'questionnaire-1', state: 'draft', progress: { answered: 2, total: 6, percent: 33 }, answers: editable, updatedAt: '2026-08-30T01:00:00.000Z' } });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/changed/i);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('switches immediately to the shared read-only tree after authoritative submission', async () => {
    const editable = definition.filter((item) => item.questionKey !== 'evidence');
    const authoritative = submittedDefinition.filter((item) => item.questionKey !== 'evidence');
    const user = userEvent.setup();
    saveQuestionnaireDraftAction.mockResolvedValue({ ok: true, data: { questionnaireId: 'questionnaire-1', state: 'draft', progress: { answered: 2, total: 6, percent: 33 }, answers: editable, updatedAt: '2026-08-30T01:00:00.000Z' } });
    submitQuestionnaireAction.mockResolvedValue({ ok: true, data: { questionnaireId: 'questionnaire-1', state: 'submitted', progress: { answered: 2, total: 6, percent: 33 }, answers: authoritative, updatedAt: '2026-08-30T01:00:00.000Z', submittedAt: '2026-08-30T01:00:00.000Z' } });
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Submit questionnaire' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText(/Questionnaire submitted\./)).toBeInTheDocument();
    expect(screen.getByText('Customer portal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save draft|Submit questionnaire/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Service name/ })).not.toBeInTheDocument();
  });

  it.each([
    [undefined, 'Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.'],
    ['requestor-revertible', 'Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.'],
    ['requestor-locked', 'Questionnaire submitted. The Security Analyst has started the assessment, so your answers can no longer change.'],
    ['analyst', 'Questionnaire submitted. These are the Requestor’s submitted answers.'],
  ] as const)('shows the %s submitted notice under the unchanged Submitted title', (variant, notice) => {
    render(<QuestionnaireRenderer definition={submittedDefinition} documentId="questionnaire-1" mode="read-only" submittedNotice={variant} />);
    const alert = screen.getByText('Submitted', { exact: true }).closest('[role="alert"]');
    expect(alert).toHaveTextContent(notice);
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByText(/read-only and can no longer be edited/)).not.toBeInTheDocument();
  });

  it('offers the Requestor Return to draft and says so only while the request is questionnaire-in-progress', async () => {
    const submitted = { ...questionnaire, state: 'submitted' as const };
    const view = render(<QuestionnaireDetail definition={submittedDefinition} questionnaire={submitted} state="submitted" />);
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();
    expect(screen.getByText('Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.')).toBeInTheDocument();

    for (const requestStatus of ['risk-assessment-drafted', 'under-review']) {
      view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={{ ...submitted, assessmentRequest: { ...questionnaire.assessmentRequest, requestStatus } as QuestionnaireSummary['assessmentRequest'] }} state="submitted" />);
      expect(screen.queryByRole('button', { name: 'Return to draft' }), requestStatus).not.toBeInTheDocument();
      expect(screen.getByText('Questionnaire submitted. The Security Analyst has started the assessment, so your answers can no longer change.')).toBeInTheDocument();
    }
  });

  it('describes the Requestor’s return to draft in plain words', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireDetail definition={submittedDefinition} questionnaire={{ ...questionnaire, state: 'submitted' }} state="submitted" />);
    await user.click(screen.getByRole('button', { name: 'Return to draft' }));
    expect(screen.getByRole('alertdialog', { name: 'Return this questionnaire to draft?' })).toHaveAccessibleDescription('Your answers go back to draft so you can change them. Submit the questionnaire again when you’re ready.');
  });

  it('renders the same ordered content in read-only mode without edit controls', async () => {
    render(<QuestionnaireRenderer definition={submittedDefinition} documentId="questionnaire-1" mode="read-only" />);

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Service context', 'Hosting and access', 'Evidence',
    ]);
    expect(screen.getByText('Customer portal')).toBeInTheDocument();
    expect(screen.getByText(/File upload is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save draft|Submit questionnaire/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('maps ready, empty, error, permission, and submitted detail states without leaking protected content', () => {
    const readyDefinition = definition.filter((item) => item.questionKey !== 'evidence');
    const view = render(<QuestionnaireDetail definition={readyDefinition} questionnaire={questionnaire} state="ready" />);
    expect(screen.getByRole('heading', { level: 1, name: questionnaire.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();

    view.rerender(<QuestionnaireDetail questionnaire={questionnaire} state="empty" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/No questionnaire questions are available/i);

    view.rerender(<QuestionnaireDetail state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t load/i);

    view.rerender(<QuestionnaireDetail questionnaire={questionnaire} state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/don’t have permission/i);
    expect(screen.queryByText(questionnaire.title)).not.toBeInTheDocument();

    view.rerender(<QuestionnaireDetail definition={submittedDefinition} questionnaire={{ ...questionnaire, state: 'submitted' }} state="submitted" />);
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Save draft|Submit questionnaire/ })).not.toBeInTheDocument();
  });

  it('keeps the route server-owned and removes the RED loading escape hatch', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/(app)/app/questionnaires/[documentId]/page.tsx'), 'utf8');
    const testSource = readFileSync(resolve(process.cwd(), 'src/features/questionnaires/questionnaire-renderer.test.tsx'), 'utf8');
    expect(route).toContain('getQuestionnaireQuestions');
    expect(route).not.toContain("'use client'");
    expect(testSource).not.toContain(['PHASE3', 'RED', 'W0_04', 'RENDERER_ABSENT'].join('_'));
    expect(testSource).not.toContain(['exists', 'Sync'].join(''));
  });
});

describe('QuestionnaireRenderer autosave and save status (D-11, UI-SPEC §6.1 and §6.2)', () => {
  const editable = definition.filter((item) => item.questionKey !== 'evidence');

  it('saves typed answers on its own after a pause, showing Saving… then Saved at in the completion card', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);
    const completion = screen.getByRole('region', { name: 'Questionnaire completion' });

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    expect(within(completion).getByText('Saving…')).toBeInTheDocument();
    await waitFor(() => expect(within(completion).getByRole('status').textContent?.replace(/\s+/g, ' ')).toMatch(/^Saved at \d{1,2}:\d{2} [ap]m UTC$/), { timeout: 4_000 });

    expect(autosaveQuestionnaireDraftAction).toHaveBeenCalledTimes(1);
    expect(autosaveQuestionnaireDraftAction).toHaveBeenCalledWith({
      documentId: 'questionnaire-1',
      answers: expect.arrayContaining([{ questionKey: 'service_name', value: 'Customer portal' }]),
    });
    expect(saveQuestionnaireDraftAction).not.toHaveBeenCalled();
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  });

  it('saves at once when an answer loses focus', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.tab();
    await waitFor(() => expect(autosaveQuestionnaireDraftAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Saved at/));
  });

  it('a blocked save states its reason with Refresh page, and no form-level alert remains', async () => {
    const user = userEvent.setup();
    const message = 'A Security Analyst has taken this questionnaire back to update it, so your latest answers weren’t saved. They’re kept on this page, and you can carry on when it’s sent back to you.';
    autosaveQuestionnaireDraftAction.mockResolvedValue({ ok: false, formError: message, failure: 'blocked', reason: 'QUESTIONNAIRE_NOT_ANSWERABLE' });
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.tab();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(screen.queryByText('Questionnaire not saved')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /Additional details/ }), 'More');
    await user.tab();
    expect(autosaveQuestionnaireDraftAction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Refresh page' }));
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it('a retryable save failure offers Retry save, which saves again', async () => {
    const user = userEvent.setup();
    autosaveQuestionnaireDraftAction
      .mockResolvedValueOnce({ ok: false, formError: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable' })
      .mockResolvedValueOnce(savedResponse(editable));
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your latest answers weren’t saved.');

    await user.click(screen.getByRole('button', { name: 'Retry save' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Saved at/));
    expect(autosaveQuestionnaireDraftAction).toHaveBeenCalledTimes(2);
  });

  it('Save draft saves at once through the explicit action and echoes the status beside the button, unannounced', async () => {
    const user = userEvent.setup();
    saveQuestionnaireDraftAction.mockResolvedValue(savedResponse(editable));
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" />);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Saved at/));
    expect(saveQuestionnaireDraftAction).toHaveBeenCalledTimes(1);
    expect(autosaveQuestionnaireDraftAction).not.toHaveBeenCalled();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    const echo = screen.getByRole('button', { name: 'Save draft' }).parentElement?.querySelector('[aria-hidden="true"]');
    expect(echo).toHaveTextContent(/Saved at/);
  });

  it('remembers each successful save for this questionnaire in the tab', async () => {
    const user = userEvent.setup();
    const served = editable.map((item) => item.questionKey === 'service_name' ? { ...item, answer: { schemaVersion: 1, value: 'Customer portal', state: 'draft', updatedAt: '2026-09-28T01:00:05.000Z' } } : item) as QuestionnaireDefinition;
    autosaveQuestionnaireDraftAction.mockResolvedValue(savedResponse(served));
    render(<QuestionnaireRenderer definition={editable} documentId="q-remembered-after-save" mode="edit" serverUpdatedAt="2026-09-28T00:00:00.000Z" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.tab();
    await waitFor(() => expect(savedQuestionnaireAfter('q-remembered-after-save', '2026-09-28T00:00:00.000Z')).toEqual({ updatedAt: '2026-09-28T01:00:05.000Z', answers: served }));
  });

  /* Back and Forward reuse the page as it was last rendered, so a remembered newer save wins at mount. */
  const pageAnswers = editable.map((item) => item.questionKey === 'service_name' ? { ...item, answer: { schemaVersion: 1, value: 'Page portal', state: 'draft', updatedAt: '2026-09-28T01:00:00.000Z' } } : item) as QuestionnaireDefinition;
  const rememberedAnswers = editable.map((item) => item.questionKey === 'service_name' ? { ...item, answer: { schemaVersion: 1, value: 'Remembered portal', state: 'draft', updatedAt: '2026-09-28T01:00:05.000Z' } } : item) as QuestionnaireDefinition;

  it('mounts with the remembered answers when they are newer than the page', () => {
    rememberSavedQuestionnaire('q-back', { updatedAt: '2026-09-28T01:00:05.000Z', answers: rememberedAnswers });
    render(<QuestionnaireRenderer definition={pageAnswers} documentId="q-back" mode="edit" serverUpdatedAt="2026-09-28T01:00:00.000Z" />);

    expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveValue('Remembered portal');
  });

  it.each(['2026-09-28T01:00:05.000Z', '2026-09-28T01:00:09.000Z'])('mounts with the page answers when the page is as new or newer (%s)', (serverUpdatedAt) => {
    rememberSavedQuestionnaire(`q-fresh-${serverUpdatedAt}`, { updatedAt: '2026-09-28T01:00:05.000Z', answers: rememberedAnswers });
    render(<QuestionnaireRenderer definition={pageAnswers} documentId={`q-fresh-${serverUpdatedAt}`} mode="edit" serverUpdatedAt={serverUpdatedAt} />);

    expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveValue('Page portal');
  });
});

/* 12-UI-SPEC §9 (D-16, D-17, D-23): help text as the field hint, Not sure, and the AI disclosure. */
describe('help text, Not sure and the AI disclosure', () => {
  const helped = (key: string, type: QuestionnaireDefinition[number]['answerType'], extra: Partial<QuestionnaireDefinition[number]> = {}) =>
    question(key, `Question ${key}`, type, { helpText: `Help for ${key}.`, ...extra });
  const choices = [{ value: 'yes', label: 'Yes' }, { value: 'not-sure', label: 'Not sure' }, { value: 'no', label: 'No' }];

  it('puts the help text under the label, before the control, and first in its description', () => {
    render(<QuestionnaireRenderer definition={[
      helped('text', 'Text', { order: 1 }), helped('long', 'Long text', { order: 2 }), helped('date', 'Date', { order: 3 }),
      helped('single', 'Single select', { order: 4, choices }), helped('multi', 'Multi select', { order: 5, choices }), helped('flag', 'Boolean', { order: 6 }),
      question('plain', 'Plain question', 'Text', { order: 7 }),
    ]} documentId="questionnaire-1" mode="edit" />);
    for (const key of ['text', 'long', 'date']) {
      const hint = screen.getByText(`Help for ${key}.`);
      expect(hint).toHaveAttribute('id', `question-${key}-hint`);
      expect(hint).toHaveClass('text-xs', 'text-foreground-secondary', 'whitespace-pre-wrap');
      expect(screen.getByLabelText(`Question ${key}`)).toHaveAttribute('aria-describedby', `question-${key}-hint`);
    }
    for (const key of ['single', 'multi', 'flag']) {
      const group = screen.getByRole('group', { name: `Question ${key}` });
      expect(group).toHaveAttribute('aria-describedby', `question-${key}-hint`);
      expect(within(group).getByText(`Help for ${key}.`)).toBeInTheDocument();
    }
    const single = screen.getByRole('group', { name: 'Question single' });
    expect(within(single).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual(['Yes', 'Not sure', 'No']);
    expect(screen.getByLabelText('Plain question')).not.toHaveAttribute('aria-describedby');
  });

  it('renders help text as text, never markup', () => {
    const { container } = render(<QuestionnaireRenderer definition={[question('x', 'Question x', 'Text', { helpText: '<b>bold</b> help' })]} documentId="questionnaire-1" mode="edit" />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>bold</b> help')).toBeInTheDocument();
  });

  it('tells the Requestor that AI helped, and how to answer Not sure, only when that is true', () => {
    /*
     * CR-401 (D-23, 12-UI-SPEC §9.3): the input carries every AI fact an analyst's read serves (the generation
     * block and a question's AI origin), so the negative below fails if the view ever renders one of them.
     */
    const generation = {
      generatedAt: '2026-08-29T09:00:00.000Z',
      generatedBy: { documentId: 'analyst-1', displayName: 'Bob Analyst' },
      providerName: 'deterministic-questionnaire-generation',
      providerVersion: '2',
      runId: 'run-1',
      aiInputsChanged: null,
    };
    const notSure = [question('single', 'Question single', 'Single select', { choices, aiOrigin: 'generated' })];
    const { rerender } = render(<QuestionnaireDetail definition={notSure} questionnaire={{ ...questionnaire, aiAssisted: true, generation }} state="ready" />);
    expect(screen.getByText('A Security Analyst used AI to help write these questions and reviewed them before sending them to you.')).toBeInTheDocument();
    expect(screen.getByText(/^Not sure of an answer\? Choose “Not sure” where it’s offered\./)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/AI proposed|Provider:|Model:|deterministic-questionnaire-generation|Bob Analyst|Show what the AI used|Generated with AI|run-1/);
    expect(screen.queryByRole('region', { name: 'AI generation' })).not.toBeInTheDocument();
    rerender(<QuestionnaireDetail definition={definition} questionnaire={questionnaire} state="ready" />);
    expect(screen.queryByText(/used AI to help write/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Not sure of an answer\? Give your best answer/)).toBeInTheDocument();
  });

  /*
   * WR-02 (D-16, 12-UI-SPEC §9.3): a hosted model that offered its own "Unsure" has it stored and served to the
   * Requestor as the canonical Not sure choice (Strapi's questionnaire-generation.integration "stores and serves a
   * model's own Not sure"). These are the question rows her read serves for it, parsed as her page parses them, and the
   * introduction then tells her to choose it.
   */
  it('tells the Requestor to choose Not sure for the questions Strapi serves from a model that offered its own', () => {
    const section = { key: 'section-1', title: 'Access', order: 0 };
    const served = [
      { documentId: 'question-q-2', questionText: 'Does a provider host the service?', helpText: 'Include any company that runs it for you.', answerType: 'Single select',
        options: { schemaVersion: 1, questionKey: 'q-2', section, order: 0, required: true, choices: [{ value: 'Yes', label: 'Yes' }, { value: 'not-sure', label: 'Not sure' }, { value: 'No', label: 'No' }] }, answer: null },
      { documentId: 'question-q-8', questionText: 'Describe the recovery steps.', helpText: 'Explain who restores the service and how.', answerType: 'Long text',
        options: { schemaVersion: 1, questionKey: 'q-8', section, order: 1, required: false }, answer: null },
    ];
    render(<QuestionnaireDetail definition={questionnaireDefinitionSchema.parse(served)} questionnaire={{ ...questionnaire, documentId: 'questionnaire-not-sure', aiAssisted: true }} state="ready" />);
    expect(screen.getByText(/^Not sure of an answer\? Choose “Not sure” where it’s offered\./)).toBeInTheDocument();
    const group = screen.getByRole('group', { name: /Does a provider host the service\?/ });
    expect(within(group).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual(['Yes', 'Not sure', 'No']);
  });
});

/*
 * Phase 15 (15-UI-SPEC §11.2; D-25, UI-D25, SD-1; U4): a Security Analyst takes the questionnaire back while the Requestor
 * answers. The refused save keeps every typed value on the page and in the session store; the submit dialog says why it
 * can't submit; the next released load restores what still fits, with a caption, and clears the store.
 */
describe('a Requestor’s answers when the analyst takes the questionnaire back', () => {
  const editable = definition.filter((item) => item.questionKey !== 'evidence').map((item) => ({ ...item, required: false }));
  const saveSentence = 'A Security Analyst has taken this questionnaire back to update it, so your latest answers weren’t saved. They’re kept on this page, and you can carry on when it’s sent back to you.';
  const submitSentence = 'A Security Analyst has taken this questionnaire back to update it, so it can’t be submitted now. Your answers are kept, and you can submit when it’s sent back to you.';
  const storeKey = 'csrm-draft:unsaved-answers:owner-a:questionnaire-1';
  const notAnswerable = { ok: false, formError: saveSentence, failure: 'blocked', reason: 'QUESTIONNAIRE_NOT_ANSWERABLE' };

  beforeEach(() => { window.sessionStorage.clear(); });

  it('keeps restored text through a retryable save failure and reload, clearing it only after acknowledgement', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(storeKey, JSON.stringify([
      { questionKey: 'service_name', answerType: 'Text', choicesSignature: '', value: 'Kept portal' },
    ]));
    autosaveQuestionnaireDraftAction.mockResolvedValue({ ok: false, failure: 'retryable' });
    const first = render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);
    await user.click(screen.getByRole('textbox', { name: /Service name/ }));
    await user.tab();
    expect(await screen.findByText(/Your latest answers weren’t saved/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(storeKey)).toContain('Kept portal');
    first.unmount();
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);
    expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveValue('Kept portal');
    autosaveQuestionnaireDraftAction.mockResolvedValue({ ok: true, data: { updatedAt: '2026-10-13T01:00:00.000Z', answers: editable } });
    await user.click(screen.getByRole('textbox', { name: /Service name/ }));
    await user.tab();
    await waitFor(() => expect(window.sessionStorage.getItem(storeKey)).toBeNull());
  });

  it('restores a take-back refusal on a soft refreshed editable seed before saving again', async () => {
    const user = userEvent.setup();
    autosaveQuestionnaireDraftAction.mockResolvedValue(notAnswerable);
    const page = render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);
    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Soft refresh portal');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent(saveSentence);
    await user.click(screen.getByRole('button', { name: 'Refresh page' }));
    autosaveQuestionnaireDraftAction.mockResolvedValue({ ok: false, failure: 'retryable' });
    page.rerender(<QuestionnaireRenderer definition={editable.map((item) => ({ ...item }))} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);
    expect(await screen.findByText('1 unsaved answer was restored from earlier in this session. Check it before you carry on.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveValue('Soft refresh portal');
    expect(window.sessionStorage.getItem(storeKey)).toContain('Soft refresh portal');
  });

  it('keeps the typed answers on the page and in the session store as JSON, and warns before unload', async () => {
    const user = userEvent.setup();
    autosaveQuestionnaireDraftAction.mockResolvedValue(notAnswerable);
    render(<NavigationGuardProvider><QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" /></NavigationGuardProvider>);

    const serviceName = screen.getByRole('textbox', { name: /Service name/ });
    await user.type(serviceName, 'Customer portal');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent(saveSentence);
    expect(serviceName).toHaveValue('Customer portal');
    const kept = JSON.parse(window.sessionStorage.getItem(storeKey) ?? 'null') as unknown[];
    expect(kept).toEqual(expect.arrayContaining([{ questionKey: 'service_name', answerType: 'Text', choicesSignature: '', value: 'Customer portal' }]));

    await user.type(screen.getByRole('textbox', { name: /Additional details/ }), 'More');
    await user.tab();
    expect(autosaveQuestionnaireDraftAction).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.sessionStorage.getItem(storeKey) ?? '[]')).toEqual(expect.arrayContaining([expect.objectContaining({ questionKey: 'details', value: 'More' })]));

    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('shows the submit sentence in the dialog when the save before submitting is refused for the same reason', async () => {
    const user = userEvent.setup();
    saveQuestionnaireDraftAction.mockResolvedValue(notAnswerable);
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);

    await user.type(screen.getByRole('textbox', { name: /Service name/ }), 'Customer portal');
    await user.click(screen.getByRole('button', { name: 'Submit questionnaire' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Submit questionnaire' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(submitSentence);
    expect(submitQuestionnaireAction).not.toHaveBeenCalled();
  });

  it('restores the answers that still fit on the next released load, says so, and clears the store', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(storeKey, JSON.stringify([
      { questionKey: 'service_name', answerType: 'Text', choicesSignature: '', value: 'Customer portal' },
      { questionKey: 'audience', answerType: 'Single select', choicesSignature: JSON.stringify(['staff', 'customers']), value: 'customers' },
      { questionKey: 'regions', answerType: 'Multi select', choicesSignature: JSON.stringify(['au', 'us']), value: ['au'] },
      { questionKey: 'details', answerType: 'Text', choicesSignature: '', value: 'Changed type' },
      { questionKey: 'removed_question', answerType: 'Text', choicesSignature: '', value: 'Gone' },
    ]));
    render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);

    expect(await screen.findByText('2 unsaved answers were restored from earlier in this session. Check them before you carry on.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveValue('Customer portal');
    expect(screen.getByRole('radio', { name: 'Customers' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Australia' })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: /Additional details/ })).toHaveValue('');
    await user.click(screen.getByRole('textbox', { name: /Service name/ }));
    await user.tab();
    await waitFor(() => expect(window.sessionStorage.getItem(storeKey)).toBeNull());
  });

  it('restores nothing from a kept value that does not parse, or holds entries of another shape, and clears it', async () => {
    for (const kept of ['{not json', JSON.stringify([{ questionKey: 'service_name', value: 42 }]), JSON.stringify({ questionKey: 'service_name' })]) {
      window.sessionStorage.setItem(storeKey, kept);
      const { unmount } = render(<QuestionnaireRenderer definition={editable} documentId="questionnaire-1" mode="edit" ownerKey="owner-a" />);
      await waitFor(() => expect(window.sessionStorage.getItem(storeKey)).toBeNull());
      expect(screen.queryByText(/unsaved answers? (was|were) restored/)).toBeNull();
      expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveValue('');
      unmount();
    }
  });
});
