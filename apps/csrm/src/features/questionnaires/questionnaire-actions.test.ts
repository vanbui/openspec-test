import { afterEach, describe, expect, it, vi } from 'vitest';
import * as actions from './questionnaire-actions';

const saveQuestionnaireDraft = vi.hoisted(() => vi.fn());
const submitQuestionnaire = vi.hoisted(() => vi.fn());
const revertQuestionnaireToDraft = vi.hoisted(() => vi.fn());
const releaseQuestionnaire = vi.hoisted(() => vi.fn());
const returnQuestionnaireToAnalystReview = vi.hoisted(() => vi.fn());
const addQuestionnaireQuestion = vi.hoisted(() => vi.fn());
const editQuestionnaireQuestion = vi.hoisted(() => vi.fn());
const deleteQuestionnaireQuestion = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('./questionnaire-service', () => ({
  saveQuestionnaireDraft,
  submitQuestionnaire,
  revertQuestionnaireToDraft,
  releaseQuestionnaire,
  returnQuestionnaireToAnalystReview,
  addQuestionnaireQuestion,
  editQuestionnaireQuestion,
  deleteQuestionnaireQuestion,
}));
vi.mock('next/cache', () => ({ revalidatePath }));

afterEach(() => {
  for (const mock of [
    saveQuestionnaireDraft,
    submitQuestionnaire,
    revertQuestionnaireToDraft,
    releaseQuestionnaire,
    returnQuestionnaireToAnalystReview,
    addQuestionnaireQuestion,
    editQuestionnaireQuestion,
    deleteQuestionnaireQuestion,
    revalidatePath,
  ]) mock.mockReset();
});

const conflict = (reason?: string) => ({ data: null, error: { message: 'raw backend detail', status: 409, ...(reason ? { reason } : {}) } });
const failure = (status: number) => ({ data: null, error: { message: 'raw backend detail', status } });

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
      formError: 'You can’t save answers to this questionnaire right now. Refresh the page to see its current state.',
      failure: 'blocked',
    });
    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'Some answers need attention before they can be saved.',
      failure: 'retryable',
    });
    await expect(actions.submitQuestionnaireAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'This questionnaire can’t be submitted in its current state.',
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

describe('answer save refusals tell autosave whether to stop (UI-SPEC §10.2 C, §6.1)', () => {
  const values = { documentId: 'questionnaire-1', answers: [{ questionKey: 'internet-facing', value: true }] };

  it.each([
    ['QUESTIONNAIRE_NOT_ANSWERABLE', 'This questionnaire is no longer open for answers, so your latest answers weren’t saved.'],
    ['QUESTIONNAIRE_ALREADY_SUBMITTED', 'This questionnaire has already been submitted, so your latest answers weren’t saved. Refresh the page to see the submitted answers.'],
    ['QUESTIONNAIRE_HAS_NO_QUESTIONS', 'This questionnaire has no questions to answer.'],
  ])('a 409 %s is blocked, states the reason and returns it', async (reason, formError) => {
    saveQuestionnaireDraft.mockResolvedValueOnce(conflict(reason));

    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({ ok: false, values, formError, failure: 'blocked', reason });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('a 409 without a reason is blocked with the fallback and never asks for a reload', async () => {
    saveQuestionnaireDraft.mockResolvedValueOnce(conflict());

    const result = await actions.saveQuestionnaireDraftAction(values);
    expect(result).toEqual({ ok: false, values, formError: 'Your answers can’t be saved in this questionnaire’s current state.', failure: 'blocked' });
    expect(result).not.toHaveProperty('reason');
  });

  it('a missing questionnaire is blocked; an unavailable service or a thrown transport error is retryable', async () => {
    saveQuestionnaireDraft
      .mockResolvedValueOnce(failure(404))
      .mockResolvedValueOnce(failure(503))
      .mockResolvedValueOnce({ data: null, error: { message: 'network down' } });

    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false, values, formError: 'This questionnaire is no longer available.', failure: 'blocked',
    });
    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false, values, formError: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable',
    });
    await expect(actions.saveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false, values, formError: 'The questionnaire service is unavailable. Please try again later.', failure: 'retryable',
    });
  });

  it('answers that fail validation are retryable, keep their field errors and say they need attention', async () => {
    const result = await actions.saveQuestionnaireDraftAction({
      documentId: 'questionnaire-1',
      answers: [{ questionKey: 'launch_date', value: { invalid: true } }],
    });

    expect(result).toMatchObject({
      ok: false,
      formError: 'Some answers need attention before they can be saved.',
      failure: 'retryable',
      fieldErrors: { 'answers.launch_date': expect.any(Array) },
    });
    expect(saveQuestionnaireDraft).not.toHaveBeenCalled();
  });

  it('a malformed save that no answer change can fix is blocked', async () => {
    await expect(actions.saveQuestionnaireDraftAction({ documentId: '', answers: [] })).resolves.toMatchObject({
      ok: false,
      formError: 'Check the questionnaire details and try again.',
      failure: 'blocked',
    });
  });
});

/*
 * D-11, research Pitfall 8: in Next 16.3.6 any revalidatePath call re-renders the page being edited into the
 * action's response, whatever path it names. The autosave variant revalidates nothing, on success or failure,
 * and otherwise validates and maps failures exactly as Save draft does.
 */
describe('the autosave Server Action revalidates nothing (D-11)', () => {
  const values = { documentId: 'questionnaire-1', answers: [{ questionKey: 'internet-facing', value: true }] };
  const savedResult = {
    questionnaireId: 'questionnaire-1',
    state: 'draft',
    progress: { answered: 1, total: 1, percent: 100 },
    answers: [],
    updatedAt: '2026-09-28T01:00:05.000Z',
  };

  it('is exported beside the explicit save', () => {
    expect(actions.autosaveQuestionnaireDraftAction).toBeTypeOf('function');
  });

  it('saves only documentId plus questionKey and value, and calls revalidatePath zero times', async () => {
    expect(actions.autosaveQuestionnaireDraftAction).toBeTypeOf('function');
    saveQuestionnaireDraft.mockResolvedValueOnce({ data: savedResult, error: null });

    await expect(actions.autosaveQuestionnaireDraftAction({
      ...values,
      answers: [{ questionKey: 'internet-facing', value: true, state: 'submitted', requestor: 'forged-requestor' }],
      identity: 'forged-identity',
    })).resolves.toEqual({ ok: true, data: savedResult });
    expect(saveQuestionnaireDraft).toHaveBeenCalledWith('questionnaire-1', [{ questionKey: 'internet-facing', value: true }]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps a refusal like Save draft, says whether to stop, and still revalidates nothing', async () => {
    expect(actions.autosaveQuestionnaireDraftAction).toBeTypeOf('function');
    saveQuestionnaireDraft
      .mockResolvedValueOnce(conflict('QUESTIONNAIRE_NOT_ANSWERABLE'))
      .mockResolvedValueOnce(failure(403))
      .mockResolvedValueOnce(failure(503));

    await expect(actions.autosaveQuestionnaireDraftAction(values)).resolves.toEqual({
      ok: false,
      values,
      formError: 'This questionnaire is no longer open for answers, so your latest answers weren’t saved.',
      failure: 'blocked',
      reason: 'QUESTIONNAIRE_NOT_ANSWERABLE',
    });
    await expect(actions.autosaveQuestionnaireDraftAction(values)).resolves.toMatchObject({ ok: false, failure: 'blocked' });
    await expect(actions.autosaveQuestionnaireDraftAction(values)).resolves.toMatchObject({ ok: false, failure: 'retryable' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('validates its input before any service call, like Save draft', async () => {
    expect(actions.autosaveQuestionnaireDraftAction).toBeTypeOf('function');

    await expect(actions.autosaveQuestionnaireDraftAction({
      documentId: 'questionnaire-1',
      answers: [{ questionKey: 'launch_date', value: { invalid: true } }],
    })).resolves.toMatchObject({
      ok: false,
      formError: 'Some answers need attention before they can be saved.',
      failure: 'retryable',
      fieldErrors: { 'answers.launch_date': expect.any(Array) },
    });
    await expect(actions.autosaveQuestionnaireDraftAction({ documentId: '', answers: [] })).resolves.toMatchObject({ ok: false, failure: 'blocked' });
    expect(saveQuestionnaireDraft).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('questionnaire submit refusals (UI-SPEC §10.2 D)', () => {
  const values = { documentId: 'questionnaire-1', answers: [{ questionKey: 'internet-facing', value: true }] };

  it.each([
    ['QUESTIONNAIRE_INCOMPLETE', 'Some required questions are unanswered. Answer them, then submit again.'],
    ['QUESTIONNAIRE_ALREADY_SUBMITTED', 'This questionnaire has already been submitted.'],
    ['QUESTIONNAIRE_NOT_ANSWERABLE', 'This questionnaire is no longer open for answers, so it can’t be submitted.'],
    ['QUESTIONNAIRE_HAS_NO_QUESTIONS', 'This questionnaire has no questions to answer.'],
  ])('%s reads its sentence and returns the reason', async (reason, formError) => {
    submitQuestionnaire.mockResolvedValueOnce(conflict(reason));

    await expect(actions.submitQuestionnaireAction(values)).resolves.toEqual({ ok: false, values, formError, reason });
  });

  it('an unlisted reason reads the fallback and returns the reason it was served', async () => {
    submitQuestionnaire.mockResolvedValueOnce(conflict('QUESTION_REMOVED'));

    await expect(actions.submitQuestionnaireAction(values)).resolves.toEqual({
      ok: false, values, formError: 'This questionnaire can’t be submitted in its current state.', reason: 'QUESTION_REMOVED',
    });
  });
});

describe('questionnaire return to draft refusals (UI-SPEC §10.2 B)', () => {
  const input = { documentId: 'questionnaire-1', reason: 'Scope changed' };
  const values = { documentId: 'questionnaire-1', answers: [] };

  it.each([
    ['ASSESSMENT_STARTED', 'Assessment work has started, so this questionnaire can no longer return to draft.'],
    ['REQUEST_NOT_ELIGIBLE', 'The request has moved on, so this questionnaire can no longer return to draft.'],
    ['QUESTIONNAIRE_NOT_SUBMITTED', 'Only a submitted questionnaire can return to draft, and this one isn’t submitted. Refresh the page to see where it is.'],
  ])('%s reads its sentence and returns the reason', async (reason, formError) => {
    revertQuestionnaireToDraft.mockResolvedValueOnce(conflict(reason));

    await expect(actions.revertQuestionnaireToDraftAction(input)).resolves.toEqual({ ok: false, values, formError, reason });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('no reason reads the fallback; other statuses keep their messages', async () => {
    revertQuestionnaireToDraft
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(failure(403))
      .mockResolvedValueOnce(failure(404));

    await expect(actions.revertQuestionnaireToDraftAction(input)).resolves.toEqual({
      ok: false, values, formError: 'This questionnaire can’t return to draft in its current state.',
    });
    await expect(actions.revertQuestionnaireToDraftAction(input)).resolves.toEqual({
      ok: false, values, formError: 'You do not have permission to save this questionnaire.',
    });
    await expect(actions.revertQuestionnaireToDraftAction(input)).resolves.toEqual({
      ok: false, values, formError: 'This questionnaire is no longer available.',
    });
  });
});

const questionChange = {
  DEFINITION_CONFLICT: 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.',
  QUESTIONNAIRE_RELEASED: 'This questionnaire has been released. Return it to analyst review before changing its questions.',
  ASSESSMENT_STARTED: 'An assessment already exists for this request, so its questions can no longer change.',
  REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire’s questions can no longer change.',
  QUESTION_REMOVED: 'This question has been removed. Reload the questions to see the current list.',
  HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes. Contact your administrator.',
  ANSWER_DATA_INVALID: 'A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.',
};

const governance = [
  {
    family: 'E release',
    service: releaseQuestionnaire,
    run: () => actions.releaseQuestionnaireAction({ documentId: 'questionnaire-1' }),
    rows: {
      QUESTIONNAIRE_RELEASED: 'This questionnaire has already been released.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can’t be released.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can’t be released.',
      QUESTIONNAIRE_HAS_NO_QUESTIONS: 'Add at least one question before you release this questionnaire.',
      DEFINITION_INVALID: 'Some questions in this questionnaire are inconsistent, so it can’t be released. Contact your administrator.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t be released. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t be released in its current state.',
  },
  {
    family: 'F return to analyst review',
    service: returnQuestionnaireToAnalystReview,
    run: () => actions.returnQuestionnaireToAnalystReviewAction({ documentId: 'questionnaire-1', reason: 'A question needs a change' }),
    rows: {
      ALREADY_IN_ANALYST_REVIEW: 'This questionnaire is already in analyst review. Refresh the page to see it.',
      ASSESSMENT_STARTED: 'An assessment already exists for this request, so the questionnaire can no longer return to analyst review.',
      REQUEST_NOT_ELIGIBLE: 'The request has moved on, so this questionnaire can no longer return to analyst review.',
      HISTORY_UNAVAILABLE: 'This questionnaire’s change history can’t record more changes, so it can’t return to analyst review. Contact your administrator.',
    },
    fallback: 'This questionnaire can’t return to analyst review in its current state.',
  },
  {
    family: 'G add',
    service: addQuestionnaireQuestion,
    run: () => actions.addQuestionnaireQuestionAction({
      documentId: 'questionnaire-1',
      input: { questionText: 'Where will the service be hosted?', answerType: 'Text', required: true, section: { key: 'hosting', title: 'Hosting', order: 0 }, order: 0 },
    }),
    rows: questionChange,
    fallback: 'This question can’t be saved in the questionnaire’s current state.',
  },
  {
    family: 'G edit',
    service: editQuestionnaireQuestion,
    run: () => actions.editQuestionnaireQuestionAction({ documentId: 'questionnaire-1', questionId: 'question-1', input: { questionText: 'Where is it hosted?' } }),
    rows: questionChange,
    fallback: 'This question can’t be saved in the questionnaire’s current state.',
  },
  {
    family: 'H delete',
    service: deleteQuestionnaireQuestion,
    run: () => actions.deleteQuestionnaireQuestionAction({ documentId: 'questionnaire-1', questionId: 'question-1' }),
    rows: {
      QUESTION_HAS_DEPENDENTS: 'Another question is shown only after this one is answered. Change or remove that question first.',
      LAST_ACTIVE_QUESTION: 'A questionnaire needs at least one question, so its last question can’t be removed.',
      QUESTION_REMOVED: 'This question has already been removed. Reload the page to see the current list.',
      QUESTIONNAIRE_RELEASED: questionChange.QUESTIONNAIRE_RELEASED,
      ASSESSMENT_STARTED: questionChange.ASSESSMENT_STARTED,
      REQUEST_NOT_ELIGIBLE: questionChange.REQUEST_NOT_ELIGIBLE,
      HISTORY_UNAVAILABLE: questionChange.HISTORY_UNAVAILABLE,
      ANSWER_DATA_INVALID: questionChange.ANSWER_DATA_INVALID,
    },
    fallback: 'This question can’t be removed in the questionnaire’s current state.',
  },
];

describe.each(governance)('governance refusals: $family (UI-SPEC §10.2)', ({ service, run, rows, fallback }) => {
  it.each(Object.entries(rows))('%s reads its sentence and returns the reason', async (reason, formError) => {
    service.mockResolvedValueOnce(conflict(reason));

    await expect(run()).resolves.toEqual({ ok: false, formError, reason });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('no reason reads the fallback, which never asks for a reload', async () => {
    service.mockResolvedValueOnce(conflict());

    await expect(run()).resolves.toEqual({ ok: false, formError: fallback });
    expect(fallback).not.toMatch(/reload|refresh/i);
  });

  it('keeps the permission, missing, invalid and unavailable messages', async () => {
    service
      .mockResolvedValueOnce(failure(403))
      .mockResolvedValueOnce(failure(404))
      .mockResolvedValueOnce(failure(400))
      .mockResolvedValueOnce(failure(503));

    await expect(run()).resolves.toEqual({ ok: false, formError: 'You do not have permission to govern this questionnaire.' });
    await expect(run()).resolves.toEqual({ ok: false, formError: 'This questionnaire is no longer available.' });
    await expect(run()).resolves.toEqual({ ok: false, formError: 'The questionnaire details are invalid. Check the fields and try again.' });
    await expect(run()).resolves.toEqual({ ok: false, formError: 'The questionnaire service is unavailable. Please try again later.' });
  });
});
