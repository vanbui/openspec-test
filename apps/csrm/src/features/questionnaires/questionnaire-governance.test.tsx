import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ releaseQuestionnaireAction: vi.fn(), returnQuestionnaireToAnalystReviewAction: vi.fn(), addQuestionnaireQuestionAction: vi.fn(), editQuestionnaireQuestionAction: vi.fn(), deleteQuestionnaireQuestionAction: vi.fn() }));
vi.mock('./questionnaire-actions', () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// The question form's Required checkbox measures itself; jsdom has no ResizeObserver.
vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});
import { QuestionnaireGovernance } from './questionnaire-governance';
import type { QuestionPlacement } from './questionnaire-placement';
import type { QuestionnaireDefinition } from './questionnaire-schema';

/** The placement set the analyst read serves for these active questions (no removed ones). */
function placementsOf(questions: QuestionnaireDefinition): QuestionPlacement[] {
  return questions.map((question) => ({ documentId: question.documentId ?? question.questionKey, questionKey: question.questionKey, questionText: question.questionText, section: question.section, order: question.order, removed: false }));
}

const questionnaire = { documentId: 'questionnaire-1', questionnaireNumber: 'QUES-1', title: 'Questionnaire', state: 'draft' as const, progress: { answered: 0, total: 1, percent: 0 }, assessmentRequest: { availability: 'available' as const, documentId: 'request-1', requestNumber: 'RAR-1', title: 'Request', requestStatus: 'questionnaire-in-progress' as const }, updatedAt: '2026-09-20T00:00:00.000Z', release: null };
const definition = [{ documentId: 'question-1', questionText: 'Is it protected?', answerType: 'Boolean' as const, schemaVersion: 1 as const, questionKey: 'protected', section: { key: 'general', title: 'General', order: 0 }, order: 0, required: true, answer: null, support: { status: 'supported' as const } }];

describe('QuestionnaireGovernance', () => {
  it('renders the analyst-only control matrix with text state labels', () => {
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={questionnaire} />);
    expect(screen.getByRole('heading', { name: 'Analyst review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release questionnaire' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to analyst review' })).not.toBeInTheDocument();
  });

  it('keeps its workflow actions off paper (X-4, W-14)', () => {
    const monitored = { ...definition[0], documentId: 'question-2', questionKey: 'monitored', questionText: 'Is it monitored?', order: 1 };
    render(<QuestionnaireGovernance definition={[...definition, monitored]} placements={placementsOf([...definition, monitored])} questionnaire={questionnaire} />);
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
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={{ ...questionnaire, release: { releasedAt: '2026-09-20T00:00:00.000Z', releasedBy: null } }} />);
    expect(screen.getByRole('button', { name: 'Return to analyst review' })).toHaveAttribute('data-print', 'hidden');
  });

  it('renders only the return control after release and requires a trimmed reason', async () => {
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={{ ...questionnaire, release: { releasedAt: '2026-09-20T00:00:00.000Z', releasedBy: null } }} />);
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

  /*
   * WR-308: a refused release or return shows its error once, inside its dialog (D-06), and the error does not
   * outlive the attempt: dismissing, reopening or a later success leaves no old refusal on the page.
   */
  const refusal = 'This questionnaire can’t be released yet. Answer types must be supported.';

  it('announces a refused release once, inside its dialog, and clears it on dismiss so a reopened dialog starts clean (WR-308)', async () => {
    const user = userEvent.setup();
    actions.releaseQuestionnaireAction.mockReset();
    actions.releaseQuestionnaireAction.mockResolvedValueOnce({ ok: false, formError: refusal });
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={questionnaire} />);

    await user.click(screen.getByRole('button', { name: 'Release questionnaire' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Release this questionnaire?' });
    await user.click(within(dialog).getByRole('button', { name: 'Release questionnaire' }));
    await vi.waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(refusal));
    expect(screen.getAllByText(refusal)).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(refusal)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Release questionnaire' }));
    expect(within(screen.getByRole('alertdialog', { name: 'Release this questionnaire?' })).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears a refused release once a retry succeeds (WR-308)', async () => {
    const user = userEvent.setup();
    actions.releaseQuestionnaireAction.mockReset();
    actions.releaseQuestionnaireAction
      .mockResolvedValueOnce({ ok: false, formError: refusal })
      .mockResolvedValueOnce({ ok: true, data: { ...questionnaire } });
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={questionnaire} />);

    await user.click(screen.getByRole('button', { name: 'Release questionnaire' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Release this questionnaire?' });
    await user.click(within(dialog).getByRole('button', { name: 'Release questionnaire' }));
    await vi.waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(refusal));
    await user.click(within(dialog).getByRole('button', { name: 'Release questionnaire' }));

    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByText(refusal)).not.toBeInTheDocument();
  });

  it('announces a refused return once and clears it on dismiss (WR-308)', async () => {
    const user = userEvent.setup();
    const returnRefusal = 'An assessment has been drafted from these answers, so the questionnaire can’t return to analyst review.';
    actions.returnQuestionnaireToAnalystReviewAction.mockReset();
    actions.returnQuestionnaireToAnalystReviewAction.mockResolvedValueOnce({ ok: false, formError: returnRefusal });
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={{ ...questionnaire, release: { releasedAt: '2026-09-20T00:00:00.000Z', releasedBy: null } }} />);

    await user.click(screen.getByRole('button', { name: 'Return to analyst review' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Return questionnaire to analyst review?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Needs corrections');
    await user.click(within(dialog).getByRole('button', { name: 'Return to analyst review' }));
    await vi.waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(returnRefusal));
    expect(screen.getAllByText(returnRefusal)).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(returnRefusal)).not.toBeInTheDocument();
  });

  it('disables deleting the last active question', () => {
    render(<QuestionnaireGovernance definition={definition} placements={placementsOf(definition)} questionnaire={questionnaire} />);
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
    render(<QuestionnaireGovernance definition={grouped} placements={placementsOf(grouped)} questionnaire={questionnaire} />);

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
    render(<QuestionnaireGovernance definition={[...definition, secondQuestion]} placements={placementsOf([...definition, secondQuestion])} questionnaire={questionnaire} />);
    for (const button of screen.getAllByRole('button', { name: /^Delete question: / })) expect(button).toBeEnabled();
    // A screen reader's button list tells the questions apart (W-9).
    const names = (pattern: RegExp) => screen.getAllByRole('button', { name: pattern }).map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(new Set(names(/^Edit question: /)).size).toBe(2);
    expect(new Set(names(/^Delete question: /)).size).toBe(2);
  });
});


/*
 * UI-SPEC §1.1 to §1.6 (D-04, D-05, D-06, D-17): every question form opens where it was invoked, takes focus in
 * Question text, explains a refusal beside Save question, and is the only form open; focus returns where the
 * analyst expects after a save, a discard or a delete, and each change is announced politely.
 */
describe('QuestionnaireGovernance question forms (UI-SPEC §1)', () => {
  const general = { key: 'general', title: 'General', order: 0 };
  const hosting = { key: 'hosting', title: 'Hosting', order: 1 };
  const protectedQuestion = definition[0]!;
  const monitored = { ...protectedQuestion, documentId: 'question-2', questionKey: 'monitored', questionText: 'Is it monitored?', section: general, order: 1, required: false };
  const hosted = { ...protectedQuestion, documentId: 'question-3', questionKey: 'hosted', questionText: 'Where is it hosted?', answerType: 'Single select' as const, choices: [{ value: 'cloud', label: 'Cloud' }], section: hosting, order: 0, required: false };
  const questions = [protectedQuestion, monitored, hosted];
  // A removed Hosting question still holds order 1, so the next Hosting question goes at order 2 (D-05).
  const removedHosting: QuestionPlacement = { documentId: 'question-removed', questionKey: 'region', questionText: 'Which region holds the data?', section: hosting, order: 1, removed: true };
  const placements = [...placementsOf(questions), removedHosting];
  const ok = { ok: true, data: { ...questionnaire, events: [], clearedAnswers: [] } };
  const conflict = 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.';

  function renderEditor(current: QuestionnaireDefinition = questions, currentPlacements: readonly QuestionPlacement[] = placements) {
    return render(<QuestionnaireGovernance definition={current} placements={currentPlacements} questionnaire={questionnaire} />);
  }
  const governance = () => screen.getByRole('region', { name: 'Questionnaire governance' });
  const rowOf = (text: string) => screen.getByText(text, { selector: 'p' }).closest('li') as HTMLElement;
  const follows = (earlier: Element, later: Element) => Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

  beforeEach(() => {
    for (const action of Object.values(actions)) action.mockReset();
    router.refresh.mockReset();
  });

  it('opens Edit in place of its question, with focus in Question text', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Edit question: Where is it hosted?' }));
    const form = screen.getByRole('form', { name: 'Edit question' });
    expect(form.closest('li')).toBe(within(screen.getByRole('list', { name: 'Hosting' })).getAllByRole('listitem')[0]);
    expect(within(form).getByRole('heading', { level: 5, name: 'Edit question' })).toBeInTheDocument();
    expect(within(form).getByLabelText('Question text')).toHaveFocus();
    expect(within(form).getByLabelText('Question text')).toHaveValue('Where is it hosted?');
    expect(within(form).getByLabelText('Section', { selector: 'select' })).toHaveValue('hosting');
    expect(within(form).queryByLabelText(/rename/i)).not.toBeInTheDocument();
  });

  it('gives each section its own add control after its questions, opening that section’s form there', async () => {
    const user = userEvent.setup();
    renderEditor();
    const addToHosting = screen.getByRole('button', { name: 'Add question to Hosting' });
    expect(addToHosting).toHaveTextContent(/^Add question/);
    expect(screen.getByRole('button', { name: 'Add question to General' })).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /^Add question to / })) expect(button).toHaveAttribute('data-print', 'hidden');
    await user.click(addToHosting);
    const form = screen.getByRole('form', { name: 'Add question to Hosting' });
    expect(within(form).getByRole('heading', { level: 5, name: 'Add question to Hosting' })).toBeInTheDocument();
    expect(follows(screen.getByRole('list', { name: 'Hosting' }), form)).toBe(true);
    expect(form).toHaveAttribute('data-print', 'hidden');
    expect(within(form).getByLabelText('Question text')).toHaveFocus();
    expect(within(form).getByLabelText('Section', { selector: 'select' })).toHaveValue('hosting');
  });

  it('opens the editor-level add at the top with the last section preselected', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    const form = screen.getByRole('form', { name: 'Add question' });
    expect(within(form).getByRole('heading', { level: 4, name: 'Add question' })).toBeInTheDocument();
    expect(follows(screen.getByRole('heading', { name: 'Question editor' }), form)).toBe(true);
    expect(follows(form, screen.getByRole('heading', { level: 4, name: 'General' }))).toBe(true);
    expect(within(form).getByLabelText('Question text')).toHaveFocus();
    const section = within(form).getByLabelText('Section', { selector: 'select' });
    expect(section).toHaveValue('hosting');
    expect(within(section).getAllByRole('option').map((option) => option.textContent)).toEqual(['General', 'Hosting', 'New section']);
    expect(within(form).getByText('A question you add or move goes at the end of its section.')).toBeInTheDocument();
  });

  it('keeps one form open at a time and says why release waits', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question to General' }));
    expect(screen.getByRole('button', { name: 'Release questionnaire' })).toBeDisabled();
    expect(screen.getByText('Save or discard the open question before you release the questionnaire.')).toBeInTheDocument();
    for (const name of [/^Add question$/, /^Add question to /, /^Edit question: /, /^Delete question: /]) {
      for (const button of screen.getAllByRole('button', { name })) expect(button, button.textContent ?? '').toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Save question' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('button', { name: 'Release questionnaire' })).toBeEnabled();
    expect(screen.queryByText('Save or discard the open question before you release the questionnaire.')).not.toBeInTheDocument();
  });

  it('checks the fields when Save question is pressed and moves focus to the first one to fix', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    const form = screen.getByRole('form', { name: 'Add question' });
    const save = within(form).getByRole('button', { name: 'Save question' });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(within(form).getByText('Enter the question text.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Question text')).toHaveFocus();
    expect(within(form).getByLabelText('Question text')).toHaveAttribute('aria-invalid', 'true');

    await user.type(within(form).getByLabelText('Question text'), 'Which teams support it?');
    await user.selectOptions(within(form).getByLabelText('Answer type'), 'Multi select');
    await user.selectOptions(within(form).getByLabelText('Section', { selector: 'select' }), 'New section');
    await user.click(save);
    expect(within(form).queryByText('Enter the question text.')).not.toBeInTheDocument();
    expect(within(form).getByText('Add at least one choice, one per line.')).toBeInTheDocument();
    expect(within(form).getByText('Enter a title for the new section.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Choices')).toHaveFocus();
    expect(within(form).getByText('Shown to the Requestor as a heading.')).toBeInTheDocument();
    expect(actions.addQuestionnaireQuestionAction).not.toHaveBeenCalled();
  });

  it('places a section add from every question and an edit only when its section changes', async () => {
    const user = userEvent.setup();
    actions.addQuestionnaireQuestionAction.mockResolvedValue(ok);
    actions.editQuestionnaireQuestionAction.mockResolvedValue(ok);
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question to Hosting' }));
    await user.type(screen.getByLabelText('Question text'), 'Who runs it?');
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => expect(actions.addQuestionnaireQuestionAction).toHaveBeenCalledWith({ documentId: 'questionnaire-1', input: { questionText: 'Who runs it?', answerType: 'Text', required: false, section: hosting, order: 2 } }));

    await user.click(screen.getByRole('button', { name: 'Edit question: Is it monitored?' }));
    await user.click(screen.getByLabelText('Required'));
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => expect(actions.editQuestionnaireQuestionAction).toHaveBeenCalledWith({ documentId: 'questionnaire-1', questionId: 'question-2', input: { questionText: 'Is it monitored?', answerType: 'Boolean', required: true } }));
  });

  it('shows a placement clash beside Save question with Reload questions, keeping focus on Save', async () => {
    const user = userEvent.setup();
    actions.addQuestionnaireQuestionAction.mockResolvedValue({ ok: false, formError: conflict, reason: 'DEFINITION_CONFLICT' });
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question to General' }));
    await user.type(screen.getByLabelText('Question text'), 'Who runs it?');
    const save = screen.getByRole('button', { name: 'Save question' });
    await user.click(save);
    const form = screen.getByRole('form', { name: 'Add question to General' });
    await vi.waitFor(() => expect(within(form).getByRole('alert')).toHaveTextContent(conflict));
    // The editor-level line stays for release and return (D-06).
    expect(within(governance()).getAllByRole('alert')).toHaveLength(1);
    expect(save).toHaveFocus();
    const reload = within(form).getByRole('button', { name: 'Reload questions' });
    expect(reload).toHaveAttribute('data-print', 'hidden');
    await user.click(reload);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(within(form).getByLabelText('Question text')).toHaveValue('Who runs it?');
  });

  it('offers Reload questions for a removed question, and no reload for other refusals', async () => {
    const user = userEvent.setup();
    actions.editQuestionnaireQuestionAction.mockResolvedValueOnce({ ok: false, formError: 'This question has been removed. Reload the questions to see the current list.', reason: 'QUESTION_REMOVED' });
    actions.editQuestionnaireQuestionAction.mockResolvedValueOnce({ ok: false, formError: 'This questionnaire has been released. Return it to analyst review before changing its questions.', reason: 'QUESTIONNAIRE_RELEASED' });
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Edit question: Is it monitored?' }));
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    const form = screen.getByRole('form', { name: 'Edit question' });
    await vi.waitFor(() => expect(within(form).getByRole('alert')).toHaveTextContent('This question has been removed.'));
    expect(within(form).getByRole('button', { name: 'Reload questions' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => expect(within(form).getByRole('alert')).toHaveTextContent('This questionnaire has been released.'));
    expect(within(form).queryByRole('button', { name: 'Reload questions' })).not.toBeInTheDocument();
  });

  it('returns focus to the control that opened the form when changes are discarded', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add question' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Edit question: Is it monitored?' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('button', { name: 'Edit question: Is it monitored?' })).toHaveFocus();
  });

  it('moves focus to Add question once when the edited question is gone after a reload, never on a later render (WR-307)', async () => {
    const user = userEvent.setup();
    const view = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Edit question: Is it monitored?' }));

    // The reloaded questions no longer hold the question being edited.
    const reloaded = [protectedQuestion, hosted];
    await act(async () => {
      view.rerender(<QuestionnaireGovernance definition={reloaded} placements={placements} questionnaire={questionnaire} />);
    });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add question' })).toHaveFocus();

    // The analyst presses blank page space, then the page renders again (a refresh, an announcement).
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    await act(async () => {
      view.rerender(<QuestionnaireGovernance definition={reloaded} placements={placementsOf(reloaded)} questionnaire={questionnaire} />);
    });
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses and announces a question added to a section once the questions reload', async () => {
    const user = userEvent.setup();
    actions.addQuestionnaireQuestionAction.mockResolvedValue(ok);
    const view = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add question to Hosting' }));
    await user.type(screen.getByLabelText('Question text'), 'Who runs it?');
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => expect(screen.getByText('Question added to Hosting.')).toBeInTheDocument());
    expect(screen.getByText('Question added to Hosting.').closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    const added = { ...protectedQuestion, documentId: 'question-4', questionKey: 'runs', questionText: 'Who runs it?', answerType: 'Text' as const, section: hosting, order: 2, required: false };
    view.rerender(<QuestionnaireGovernance definition={[...questions, added]} placements={[...placements, ...placementsOf([added])]} questionnaire={questionnaire} />);
    await vi.waitFor(() => expect(screen.getByText('Who runs it?').closest('[tabindex="-1"]')).toHaveFocus());
  });

  it('focuses and announces a saved edit', async () => {
    const user = userEvent.setup();
    actions.editQuestionnaireQuestionAction.mockResolvedValue(ok);
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Edit question: Is it monitored?' }));
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => expect(screen.getByText('Question saved.')).toBeInTheDocument());
    await vi.waitFor(() => expect(rowOf('Is it monitored?').querySelector('[tabindex="-1"]')).toHaveFocus());
  });

  it('announces a removed question and focuses the next question in its section', async () => {
    const user = userEvent.setup();
    actions.deleteQuestionnaireQuestionAction.mockResolvedValue(ok);
    const view = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Delete question: Is it protected?' }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Delete this question?' })).getByRole('button', { name: 'Delete question' }));
    await vi.waitFor(() => expect(screen.getByText('Question removed.')).toBeInTheDocument());
    await act(async () => {
      view.rerender(<QuestionnaireGovernance definition={[monitored, hosted]} placements={[...placementsOf([monitored, hosted]), { ...placementsOf([protectedQuestion])[0]!, removed: true }, removedHosting]} questionnaire={questionnaire} />);
    });
    await vi.waitFor(() => expect(rowOf('Is it monitored?').querySelector('[tabindex="-1"]')).toHaveFocus());
  });

  it('names each cleared answer by its question text, removed questions included', async () => {
    const user = userEvent.setup();
    actions.editQuestionnaireQuestionAction.mockResolvedValue({ ok: true, data: { ...questionnaire, events: [], clearedAnswers: [
      { questionKey: 'hosted', explanation: 'The chosen option was removed.' },
      { questionKey: 'region', explanation: 'The question was removed.' },
      { questionKey: 'unknown-key', explanation: 'The answer no longer applies.' },
    ] } });
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Edit question: Where is it hosted?' }));
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => expect(screen.getByText('Answers cleared by this revision')).toBeInTheDocument());
    const notice = screen.getByText('Answers cleared by this revision').parentElement as HTMLElement;
    const items = within(notice).getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual([
      'Where is it hosted?: The chosen option was removed.',
      'Which region holds the data?: The question was removed.',
      'A question no longer in this questionnaire: The answer no longer applies.',
    ]);
    expect(within(notice).getByText('Where is it hosted?')).toHaveClass('font-medium');
    expect(notice).not.toHaveTextContent('hosted:');
    await user.click(within(notice).getByRole('button', { name: 'Dismiss notice' }));
    expect(screen.queryByText('Answers cleared by this revision')).not.toBeInTheDocument();
  });
});
