import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ releaseQuestionnaireAction: vi.fn(), returnQuestionnaireToAnalystReviewAction: vi.fn(), addQuestionnaireQuestionAction: vi.fn(), editQuestionnaireQuestionAction: vi.fn(), deleteQuestionnaireQuestionAction: vi.fn() }));
vi.mock('./questionnaire-actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { QuestionnaireGovernance } from './questionnaire-governance';

const questionnaire = { documentId: 'questionnaire-1', questionnaireNumber: 'QUES-1', title: 'Questionnaire', state: 'draft' as const, progress: { answered: 0, total: 1, percent: 0 }, assessmentRequest: { availability: 'available' as const, documentId: 'request-1', requestNumber: 'RAR-1', title: 'Request', requestStatus: 'questionnaire-in-progress' as const }, updatedAt: '2026-09-20T00:00:00.000Z', release: null };
const definition = [{ documentId: 'question-1', questionText: 'Is it protected?', answerType: 'Boolean' as const, schemaVersion: 1 as const, questionKey: 'protected', section: { key: 'general', title: 'General', order: 0 }, order: 0, required: true, answer: null, support: { status: 'supported' as const } }];

describe('QuestionnaireGovernance', () => {
  it('renders the analyst-only control matrix with text state labels', () => {
    render(<QuestionnaireGovernance definition={definition} questionnaire={questionnaire} />);
    expect(screen.getByRole('heading', { name: 'Analyst review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release questionnaire' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to analyst review' })).not.toBeInTheDocument();
  });

  it('keeps its workflow actions off paper (X-4, W-14)', () => {
    const monitored = { ...definition[0], documentId: 'question-2', questionKey: 'monitored', questionText: 'Is it monitored?', order: 1 };
    render(<QuestionnaireGovernance definition={[...definition, monitored]} questionnaire={questionnaire} />);
    expect(screen.getByRole('button', { name: 'Release questionnaire' })).toHaveAttribute('data-print', 'hidden');
    expect(screen.getByRole('button', { name: 'Add question' })).toHaveAttribute('data-print', 'hidden');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // The question text and its captions print; the row's Edit and Delete do not.
      expect(within(row).getByText(/^Is it (protected|monitored)\?$/).closest('[data-print="hidden"]')).toBeNull();
      for (const button of within(row).getAllByRole('button')) expect(button.closest('[data-print="hidden"]')).not.toBeNull();
    }
  });

  it('keeps the return control off paper after release (W-14)', () => {
    render(<QuestionnaireGovernance definition={definition} questionnaire={{ ...questionnaire, release: { releasedAt: '2026-09-20T00:00:00.000Z', releasedBy: null } }} />);
    expect(screen.getByRole('button', { name: 'Return to analyst review' })).toHaveAttribute('data-print', 'hidden');
  });

  it('renders only the return control after release and requires a trimmed reason', async () => {
    render(<QuestionnaireGovernance definition={definition} questionnaire={{ ...questionnaire, release: { releasedAt: '2026-09-20T00:00:00.000Z', releasedBy: null } }} />);
    expect(screen.getByRole('heading', { name: 'Released to Requestor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to analyst review' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Question editor' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to analyst review' }));
    expect(screen.getByRole('button', { name: 'Return to analyst review' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: '  Needs corrections  ' } });
    actions.returnQuestionnaireToAnalystReviewAction.mockResolvedValueOnce({ ok: true, data: { ...questionnaire } });
    fireEvent.click(screen.getByRole('button', { name: 'Return to analyst review' }));
    await vi.waitFor(() => expect(actions.returnQuestionnaireToAnalystReviewAction).toHaveBeenCalledWith({ documentId: 'questionnaire-1', reason: 'Needs corrections' }));
  });

  it('disables deleting the last active question', () => {
    render(<QuestionnaireGovernance definition={definition} questionnaire={questionnaire} />);
    expect(screen.getByRole('button', { name: 'Delete question: Is it protected?' })).toBeDisabled();
  });

  it('lists each question once under its section heading with its answer type, required flag and choices', () => {
    const general = { key: 'general', title: 'General', order: 0 };
    const hosting = { key: 'hosting', title: 'Hosting', order: 1 };
    const monitored = { ...definition[0], documentId: 'question-2', questionKey: 'monitored', questionText: 'Is it monitored?', section: general, order: 1, required: false };
    const hosted = { ...definition[0], documentId: 'question-3', questionKey: 'hosted', questionText: 'Where is it hosted?', answerType: 'Single select' as const, choices: [{ value: 'cloud', label: 'Cloud' }, { value: 'on-premises', label: 'On premises' }], section: hosting, order: 0, required: false };
    const regions = { ...definition[0], documentId: 'question-4', questionKey: 'regions', questionText: 'Which regions hold data?', answerType: 'Multi select' as const, choices: [{ value: 'au', label: 'Australia' }, { value: 'nz', label: 'New Zealand' }], section: hosting, order: 1 };
    // Supplied out of order: the list follows section order, then question order.
    const grouped = [regions, monitored, hosted, definition[0]];
    render(<QuestionnaireGovernance definition={grouped} questionnaire={questionnaire} />);

    // Each section caption sits inside the h3 Question editor group, so it is an h4 (verdict 3).
    const sectionHeadings = screen.getAllByRole('heading', { level: 4 }).filter((heading) => heading.classList.contains('micro-label'));
    expect(sectionHeadings.map((heading) => heading.textContent)).toEqual(['General', 'Hosting']);
    const rows = (section: string) => within(screen.getByRole('list', { name: section })).getAllByRole('listitem');
    expect(rows('General').map((row) => row.querySelector('p')?.textContent)).toEqual(['Is it protected?', 'Is it monitored?']);
    expect(rows('Hosting').map((row) => row.querySelector('p')?.textContent)).toEqual(['Where is it hosted?', 'Which regions hold data?']);

    for (const [question, caption] of [
      ['Is it protected?', 'Boolean · Required'],
      ['Is it monitored?', 'Boolean · Optional'],
      ['Where is it hosted?', 'Single select · Optional'],
      ['Which regions hold data?', 'Multi select · Required'],
    ] as const) {
      expect(screen.getAllByText(question), question).toHaveLength(1);
      const row = screen.getByText(question).closest('li') as HTMLElement;
      expect(within(row).getByText(caption)).toHaveClass('text-xs', 'text-foreground-secondary');
      // Every row keeps its own Edit and Delete actions, each named for its question after its visible word (W-9).
      expect(within(row).getByRole('button', { name: `Edit question: ${question}` })).toHaveTextContent(/^Edit/);
      expect(within(row).getByRole('button', { name: `Delete question: ${question}` })).toHaveTextContent(/^Delete/);
    }
    expect(screen.getByText('Is it protected?')).toHaveClass('text-sm', 'font-medium');
    expect(within(screen.getByText('Where is it hosted?').closest('li') as HTMLElement).getByText('Choices: Cloud, On premises')).toBeInTheDocument();
    expect(within(screen.getByText('Which regions hold data?').closest('li') as HTMLElement).getByText('Choices: Australia, New Zealand')).toBeInTheDocument();
    expect(within(screen.getByText('Is it protected?').closest('li') as HTMLElement).queryByText(/^Choices:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release questionnaire' })).toBeInTheDocument();
  });

  it('enables deleting a question once a second active question exists', () => {
    const secondQuestion = { ...definition[0], documentId: 'question-2', questionKey: 'protected-2', questionText: 'Is it monitored?' };
    render(<QuestionnaireGovernance definition={[...definition, secondQuestion]} questionnaire={questionnaire} />);
    for (const button of screen.getAllByRole('button', { name: /^Delete question: / })) expect(button).toBeEnabled();
    // A screen reader's button list tells the questions apart (W-9).
    const names = (pattern: RegExp) => screen.getAllByRole('button', { name: pattern }).map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(new Set(names(/^Edit question: /)).size).toBe(2);
    expect(new Set(names(/^Delete question: /)).size).toBe(2);
  });
});
