import { afterEach, describe, expect, it, vi } from 'vitest';

import * as actions from './assessment-actions';

const startAssessmentDraft = vi.hoisted(() => vi.fn());
const getAssessmentDraftJob = vi.hoisted(() => vi.fn());
const retryAssessmentDraftJob = vi.hoisted(() => vi.fn());
const startQuestionnaireGeneration = vi.hoisted(() => vi.fn());
const getQuestionnaireGenerationJob = vi.hoisted(() => vi.fn());
const retryQuestionnaireGenerationJob = vi.hoisted(() => vi.fn());
const updateAssessment = vi.hoisted(() => vi.fn());
const createRisk = vi.hoisted(() => vi.fn());
const updateRisk = vi.hoisted(() => vi.fn());
const createControlImplementation = vi.hoisted(() => vi.fn());
const updateControlImplementation = vi.hoisted(() => vi.fn());
const deleteControlImplementation = vi.hoisted(() => vi.fn());
const releaseAssessment = vi.hoisted(() => vi.fn());
const searchActiveUsers = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('./assessment-service', () => ({
  startAssessmentDraft,
  getAssessmentDraftJob,
  retryAssessmentDraftJob,
  startQuestionnaireGeneration,
  getQuestionnaireGenerationJob,
  retryQuestionnaireGenerationJob,
  updateAssessment,
  createRisk,
  updateRisk,
  createControlImplementation,
  updateControlImplementation,
  deleteControlImplementation,
  releaseAssessment,
  searchActiveUsers,
}));
vi.mock('next/cache', () => ({ revalidatePath }));

afterEach(() => {
  for (const mock of [
    startAssessmentDraft,
    getAssessmentDraftJob,
    retryAssessmentDraftJob,
    startQuestionnaireGeneration,
    getQuestionnaireGenerationJob,
    retryQuestionnaireGenerationJob,
    updateAssessment,
    createRisk,
    updateRisk,
    createControlImplementation,
    updateControlImplementation,
    deleteControlImplementation,
    releaseAssessment,
    searchActiveUsers,
    revalidatePath,
  ]) mock.mockReset();
});

const success = (data: unknown = { documentId: 'result-1' }) => ({ data, error: null });
const failure = (status: number) => ({ data: null, error: { message: 'raw internal detail', status } });

describe('assessment Server Action boundary', () => {
  it('validates a bounded owner search and invokes the typed service once', async () => {
    const owners = [{ documentId: 'user-1', displayName: 'Alex Analyst' }];
    searchActiveUsers.mockResolvedValueOnce(success(owners));

    await expect(actions.searchActiveUsersAction({ search: '  Alex  ' })).resolves.toEqual({ ok: true, data: owners });
    await expect(actions.searchActiveUsersAction({ search: '' })).resolves.toMatchObject({ ok: false });
    await expect(actions.searchActiveUsersAction({ search: 'x'.repeat(101) })).resolves.toMatchObject({ ok: false });
    await expect(actions.searchActiveUsersAction({ search: 'Alex', selectedId: 'forged-user' })).resolves.toMatchObject({ ok: false });

    expect(searchActiveUsers).toHaveBeenCalledTimes(1);
    expect(searchActiveUsers).toHaveBeenCalledWith('Alex');
  });

  it.each([403, 503])('maps owner-search %s failures to safe non-disclosing errors', async (status) => {
    searchActiveUsers.mockResolvedValueOnce(failure(status));

    const result = await actions.searchActiveUsersAction({ search: 'Alex' });

    expect(result).toMatchObject({ ok: false, formError: expect.not.stringContaining('raw internal detail') });
    expect(result).toMatchObject({ ok: false, formError: expect.not.stringContaining('Alex') });
  });

  it('validates job start, poll, and retry identifiers before one typed service call', async () => {
    const job = { jobId: 'job-1', questionnaireId: 'questionnaire-1', attempt: 1, queuedAt: '2026-08-30T01:02:03.000Z', status: 'queued' };
    startAssessmentDraft.mockResolvedValueOnce(success(job));
    getAssessmentDraftJob.mockResolvedValueOnce(success(job));
    retryAssessmentDraftJob.mockResolvedValueOnce(success({ ...job, attempt: 2 }));

    await expect(actions.startAssessmentDraftAction({ questionnaireId: 'questionnaire/1' })).resolves.toEqual({ ok: true, data: job });
    await expect(actions.getAssessmentDraftJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: true, data: job });
    await expect(actions.retryAssessmentDraftJobAction({ jobId: 'job-1' })).resolves.toMatchObject({ ok: true, data: { attempt: 2 } });
    expect(startAssessmentDraft).toHaveBeenCalledWith('questionnaire/1');
    expect(getAssessmentDraftJob).toHaveBeenCalledWith('job-1');
    expect(retryAssessmentDraftJob).toHaveBeenCalledWith('job-1');
    expect(revalidatePath.mock.calls).toEqual([
      ['/app/review/requests'],
      ['/app/review/questionnaires/questionnaire%2F1'],
      ['/app/review/assessments'],
      ['/app/review/requests'],
      ['/app/review/assessments'],
    ]);
  });

  it('accepts only the request identifier and replacement acknowledgement for questionnaire generation', async () => {
    const job = { jobId: 'job-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: '2026-08-30T01:02:03.000Z', status: 'queued' };
    startQuestionnaireGeneration.mockResolvedValueOnce(success(job));
    getQuestionnaireGenerationJob.mockResolvedValueOnce(success(job));
    retryQuestionnaireGenerationJob.mockResolvedValueOnce(success({ ...job, attempt: 2 }));

    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request/1', replaceUnansweredQuestionnaire: false })).resolves.toEqual({ ok: true, data: job });
    await expect(actions.getQuestionnaireGenerationJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: true, data: job });
    await expect(actions.retryQuestionnaireGenerationJobAction({ jobId: 'job-1' })).resolves.toMatchObject({ ok: true, data: { attempt: 2 } });
    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: false, providerName: 'forged' })).resolves.toMatchObject({ ok: false });
    expect(startQuestionnaireGeneration).toHaveBeenCalledWith('request/1', false);
    expect(getQuestionnaireGenerationJob).toHaveBeenCalledWith('job-1');
    expect(retryQuestionnaireGenerationJob).toHaveBeenCalledWith('job-1');
  });

  it('rejects forged Assessment and Risk fields before transport and retains submitted values', async () => {
    const assessmentInput = {
      assessmentId: 'assessment-1',
      values: { summary: 'Reviewed', overallRating: 'High', assessmentStatus: 'approved' },
      identity: 'forged-user',
    };
    const riskInput = {
      assessmentId: 'assessment-1',
      values: { riskStatement: 'Material risk', riskNumber: 'FORGED', approvedBy: 'user-1' },
    };

    await expect(actions.saveAssessmentAction(assessmentInput)).resolves.toMatchObject({
      ok: false,
      values: assessmentInput.values,
      fieldErrors: { assessmentStatus: expect.any(Array), identity: expect.any(Array) },
    });
    await expect(actions.createRiskAction(riskInput)).resolves.toMatchObject({
      ok: false,
      values: riskInput.values,
      fieldErrors: { riskNumber: expect.any(Array), approvedBy: expect.any(Array) },
    });
    expect(updateAssessment).not.toHaveBeenCalled();
    expect(createRisk).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('routes exact full Risk and ControlImplementation allowlists and never exposes Risk delete', async () => {
    const riskValues = {
      riskStatement: 'Material risk',
      issueStatement: null,
      inherentRating: 'High',
      residualRating: 'Moderate',
      targetDate: '2026-10-30',
    };
    const controlValues = {
      control: 'control-1',
      controlOwner: 'user-1',
      controlStatus: 'Implemented',
      effectivenessRating: 'Effective',
      evidence: 'Reviewed evidence',
      implementationDueDate: '2026-09-30',
      implementedDate: '2026-08-15',
      reviewDate: '2026-11-15',
    };
    createRisk.mockResolvedValueOnce(success());
    updateRisk.mockResolvedValueOnce(success());
    createControlImplementation.mockResolvedValueOnce(success());
    updateControlImplementation.mockResolvedValueOnce(success());
    deleteControlImplementation.mockResolvedValueOnce(success(undefined));

    await actions.createRiskAction({ assessmentId: 'assessment-1', values: riskValues });
    await actions.updateRiskAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: riskValues });
    await actions.createControlImplementationAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: controlValues });
    await actions.updateControlImplementationAction({ assessmentId: 'assessment-1', implementationId: 'implementation-1', values: controlValues });
    await actions.deleteControlImplementationAction({ assessmentId: 'assessment-1', implementationId: 'implementation-1' });

    expect(createRisk).toHaveBeenCalledWith('assessment-1', riskValues);
    expect(updateRisk).toHaveBeenCalledWith('risk-1', riskValues);
    expect(createControlImplementation).toHaveBeenCalledWith('risk-1', controlValues);
    expect(updateControlImplementation).toHaveBeenCalledWith('implementation-1', controlValues);
    expect(deleteControlImplementation).toHaveBeenCalledWith('implementation-1');
    expect(actions).not.toHaveProperty('deleteRiskAction');
    expect(revalidatePath).toHaveBeenCalledWith('/app/review/assessments/assessment-1');
    expect(revalidatePath).toHaveBeenCalledWith('/app/assessments/assessment-1');
  });

  it.each([
    [400, 'invalid'],
    [403, 'permission'],
    [404, 'no longer available'],
    [409, 'changed'],
  ] as const)('maps %s failures safely, retains values, and performs no invalidation', async (status, message) => {
    const input = { assessmentId: 'assessment-1', values: { summary: 'Keep this value' } };
    updateAssessment.mockResolvedValueOnce(failure(status));

    await expect(actions.saveAssessmentAction(input)).resolves.toMatchObject({
      ok: false,
      values: input.values,
      formError: expect.stringContaining(message),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a retryable release failure and invalidates analyst and Requestor paths only on success', async () => {
    releaseAssessment
      .mockResolvedValueOnce(failure(409))
      .mockResolvedValueOnce(success({ documentId: 'assessment/1', assessmentStatus: 'approved' }));

    await expect(actions.releaseAssessmentAction({ assessmentId: 'assessment/1' })).resolves.toEqual({
      ok: false,
      formError: 'This assessment changed or is not ready for release. Reload and try again.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();

    await expect(actions.releaseAssessmentAction({ assessmentId: 'assessment/1' })).resolves.toMatchObject({ ok: true });
    expect(revalidatePath.mock.calls).toEqual([
      ['/app'],
      ['/app/assessments'],
      ['/app/assessments/assessment%2F1'],
      ['/app/review/requests'],
      ['/app/review/assessments'],
      ['/app/review/assessments/assessment%2F1'],
    ]);
  });
});

/*
 * WR-04: the analyst editor's Add Risk and Add mitigation control forms show the messages these actions
 * return under each field, so every message is the product's own copy (direction section 4 Forms), never a
 * validation library default. The forms send an emptied field as null.
 */
describe('analyst editor validation copy', () => {
  it('asks for the Risk statement when Add Risk has none', async () => {
    for (const riskStatement of [null, '', '   ']) {
      await expect(actions.createRiskAction({ assessmentId: 'assessment-1', values: { riskStatement } })).resolves.toEqual({
        ok: false,
        values: { riskStatement },
        fieldErrors: { riskStatement: ['Enter a risk statement.'] },
        formError: 'Check the assessment details and try again.',
      });
    }
    expect(createRisk).not.toHaveBeenCalled();
  });

  it('states the length limit of Risk text and the format of the exemption review date', async () => {
    const result = await actions.createRiskAction({
      assessmentId: 'assessment-1',
      values: { riskStatement: 'r'.repeat(65_536), treatmentPlan: 't'.repeat(65_536), exemptionReviewDate: '2026-12-01' },
    });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        riskStatement: ['Use 65,535 characters or fewer.'],
        treatmentPlan: ['Use 65,535 characters or fewer.'],
        exemptionReviewDate: ['Enter the date and time as YYYY-MM-DDTHH:mm:ssZ.'],
      },
    });
    expect(createRisk).not.toHaveBeenCalled();
  });

  it('asks for a reusable Control when Add mitigation control has none, and states the evidence limit', async () => {
    for (const control of [null, '', '  ']) {
      await expect(actions.createControlImplementationAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: { control } })).resolves.toMatchObject({
        ok: false,
        fieldErrors: { control: ['Select a reusable Control.'] },
      });
    }
    await expect(actions.createControlImplementationAction({
      assessmentId: 'assessment-1', riskId: 'risk-1', values: { control: 'control-1', evidence: 'e'.repeat(65_536) },
    })).resolves.toMatchObject({ ok: false, fieldErrors: { evidence: ['Use 65,535 characters or fewer.'] } });
    expect(createControlImplementation).not.toHaveBeenCalled();
  });
});

describe('questionnaire generation refusals (UI-SPEC §10.2 I)', () => {
  const conflict = (reason?: string) => ({ data: null, error: { message: 'raw internal detail', status: 409, ...(reason ? { reason } : {}) } });
  const generation = [
    { name: 'start', service: startQuestionnaireGeneration, run: () => actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: true }) },
    { name: 'retry', service: retryQuestionnaireGenerationJob, run: () => actions.retryQuestionnaireGenerationJobAction({ jobId: 'job-1' }) },
  ];

  describe.each(generation)('$name', ({ service, run }) => {
    it.each([
      ['REQUEST_NOT_ELIGIBLE', 'A questionnaire can be generated only while the request is submitted, and this request has moved on.'],
      ['QUESTIONNAIRE_RELEASED', 'This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.'],
    ])('%s reads its sentence and returns the reason', async (reason, formError) => {
      service.mockResolvedValueOnce(conflict(reason));

      await expect(run()).resolves.toEqual({ ok: false, formError, reason });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('no reason, or one generation does not list, reads the fallback and never asks for a reload', async () => {
      service.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(conflict('QUESTION_REMOVED'));

      await expect(run()).resolves.toEqual({ ok: false, formError: 'A questionnaire can’t be generated for this request in its current state.' });
      await expect(run()).resolves.toEqual({
        ok: false,
        formError: 'A questionnaire can’t be generated for this request in its current state.',
        reason: 'QUESTION_REMOVED',
      });
    });

    it('keeps the permission and unavailable messages', async () => {
      service.mockResolvedValueOnce(failure(403)).mockResolvedValueOnce(failure(503));

      await expect(run()).resolves.toEqual({ ok: false, formError: 'You do not have permission to change this assessment.' });
      await expect(run()).resolves.toEqual({ ok: false, formError: 'The assessment service is unavailable. Please try again later.' });
    });
  });

  it('leaves every other assessment action’s conflict message as it was', async () => {
    startAssessmentDraft.mockResolvedValueOnce(conflict('REQUEST_NOT_ELIGIBLE'));

    await expect(actions.startAssessmentDraftAction({ questionnaireId: 'questionnaire-1' })).resolves.toEqual({
      ok: false,
      formError: 'This assessment changed. Reload and try again.',
    });
  });
});
