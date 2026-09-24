import { afterEach, describe, expect, it, vi } from 'vitest';
import * as actions from './questionnaire-actions';

const saveQuestionnaireDraft = vi.hoisted(() => vi.fn());
const submitQuestionnaire = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('./questionnaire-service', () => ({ saveQuestionnaireDraft, submitQuestionnaire }));
vi.mock('next/cache', () => ({ revalidatePath }));

afterEach(() => {
  saveQuestionnaireDraft.mockReset();
  submitQuestionnaire.mockReset();
  revalidatePath.mockReset();
});

describe('questionnaire Server Action contract', () => {
  it('revalidates unknown input and sends only documentId plus questionKey/value', async () => {
    const result = {
      questionnaireId: 'questionnaire-1',
      state: 'draft',
      progress: { answered: 1, total: 1, percent: 100 },
      answers: [],
      updatedAt: '2026-08-29T10:00:00.000Z',
    };
    saveQuestionnaireDraft.mockResolvedValueOnce({ data: result, error: null });
    const input = {
      documentId: 'questionnaire-1',
      answers: [{
        questionKey: 'internet-facing',
        value: true,
        state: 'submitted',
        updatedAt: '2020-01-01T00:00:00.000Z',
        requestor: 'forged-requestor',
        definition: { required: false },
      }],
      identity: 'forged-identity',
      questionnaireState: 'submitted',
    };

    await expect(actions.saveQuestionnaireDraftAction(input)).resolves.toEqual({ ok: true, data: result });
    expect(saveQuestionnaireDraft).toHaveBeenCalledWith('questionnaire-1', [
      { questionKey: 'internet-facing', value: true },
    ]);
    expect(revalidatePath.mock.calls).toEqual([
      ['/app'],
      ['/app/questionnaires'],
      ['/app/questionnaires/questionnaire-1'],
    ]);
  });

  it('maps safe failures, preserves answer values, and never invalidates failed routes', async () => {
    const values = {
      documentId: 'questionnaire-1',
      answers: [{ questionKey: 'internet-facing', value: true }],
    };
    saveQuestionnaireDraft
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 403 } })
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 400 } });
    submitQuestionnaire
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 409 } })
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 404 } })
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 503 } });

    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'You do not have permission to save this questionnaire.',
    });
    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'The questionnaire answers are invalid. Check the fields and try again.',
    });
    await expect(actions.submitQuestionnaireAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'This questionnaire changed or is no longer answerable. Reload and try again.',
    });
    await expect(actions.submitQuestionnaireAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'This questionnaire is no longer available.',
    });
    await expect(actions.submitQuestionnaireAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'The questionnaire service is unavailable. Please try again later.',
    });
    await expect(actions.saveQuestionnaireDraftAction({ documentId: '', answers: values.answers })).resolves.toMatchObject({
      ok: false,
      formError: expect.any(String),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps nested answer issues to registered question paths without inventing answers.answers', async () => {
    const result = await actions.saveQuestionnaireDraftAction({
      documentId: 'questionnaire-1',
      answers: [{ questionKey: 'launch_date', value: { invalid: true } }],
    });

    expect(result).toMatchObject({ ok: false, fieldErrors: { 'answers.launch_date': expect.any(Array) } });
    expect(result).not.toHaveProperty('fieldErrors.answers');
    expect(JSON.stringify(result)).not.toContain('answers.answers');
  });

  it('invalidates Requestor and analyst detail routes only after successful submit', async () => {
    const submitted = {
      questionnaireId: 'questionnaire/1',
      state: 'submitted',
      progress: { answered: 1, total: 1, percent: 100 },
      answers: [],
      updatedAt: '2026-08-29T10:00:00.000Z',
      submittedAt: '2026-08-29T10:00:00.000Z',
    };
    submitQuestionnaire.mockResolvedValueOnce({ data: submitted, error: null });

    await expect(actions.submitQuestionnaireAction({
      documentId: 'questionnaire/1', answers: [{ questionKey: 'internet-facing', value: true }],
    })).resolves.toEqual({ ok: true, data: submitted });
    expect(submitQuestionnaire).toHaveBeenCalledWith('questionnaire/1');
    expect(revalidatePath.mock.calls).toEqual([
      ['/app'],
      ['/app/questionnaires'],
      ['/app/questionnaires/questionnaire%2F1'],
      ['/app/review/questionnaires/questionnaire%2F1'],
    ]);
  });
});
