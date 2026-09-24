import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { QuestionnaireDetail } from './questionnaire-detail';
import { QuestionnaireRenderer } from './questionnaire-renderer';

const saveQuestionnaireDraftAction = vi.hoisted(() => vi.fn());
const submitQuestionnaireAction = vi.hoisted(() => vi.fn());
const revertQuestionnaireToDraftAction = vi.hoisted(() => vi.fn());

vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

vi.mock('./questionnaire-actions', () => ({
  saveQuestionnaireDraftAction,
  submitQuestionnaireAction,
  revertQuestionnaireToDraftAction,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
  updatedAt: '2026-08-30T01:00:00.000Z',
};

beforeEach(() => {
  saveQuestionnaireDraftAction.mockReset();
  submitQuestionnaireAction.mockReset();
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
    expect(screen.getByRole('region', { name: 'Questionnaire validation guidance' })).not.toHaveAttribute('role', 'alert');
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
    expect((await screen.findByText(/service is unavailable/i)).closest('[role="alert"]')).toHaveTextContent(/service is unavailable/i);
    expect(serviceName).toHaveValue('Customer portal');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Draft saved/i);
    expect(screen.queryByText(/^Submitted$/)).not.toBeInTheDocument();
  });

  it('keeps irreversible confirmation open on server failure and prevents duplicate submits', async () => {
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
    expect(dialog).toHaveTextContent(/cannot be edited after submission/i);
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
    expect(route).not.toMatch(/\bfetch\s*\(/);
    expect(testSource).not.toContain(['PHASE3', 'RED', 'W0_04', 'RENDERER_ABSENT'].join('_'));
    expect(testSource).not.toContain(['exists', 'Sync'].join(''));
  });
});
