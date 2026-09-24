import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('enables deleting a question once a second active question exists', () => {
    const secondQuestion = { ...definition[0], documentId: 'question-2', questionKey: 'protected-2', questionText: 'Is it monitored?' };
    render(<QuestionnaireGovernance definition={[...definition, secondQuestion]} questionnaire={questionnaire} />);
    for (const button of screen.getAllByRole('button', { name: 'Delete' })) expect(button).toBeEnabled();
  });
});
