import { afterEach, describe, expect, it, vi } from 'vitest';

import * as actions from './assessment-actions';

const startAssessmentDraft = vi.hoisted(() => vi.fn());
const getAssessmentDraftJob = vi.hoisted(() => vi.fn());
const retryAssessmentDraftJob = vi.hoisted(() => vi.fn());
const startQuestionnaireGeneration = vi.hoisted(() => vi.fn());
const getQuestionnaireGenerationJob = vi.hoisted(() => vi.fn());
const getRequestGenerationJobs = vi.hoisted(() => vi.fn());
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
const listAdministrationControls = vi.hoisted(() => vi.fn());

vi.mock('./assessment-service', () => ({
  startAssessmentDraft,
  getAssessmentDraftJob,
  retryAssessmentDraftJob,
  startQuestionnaireGeneration,
  getQuestionnaireGenerationJob,
  getRequestGenerationJobs,
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
vi.mock('@/features/administration/administration-service', () => ({ listAdministrationControls }));

afterEach(() => {
  for (const mock of [
    startAssessmentDraft,
    getAssessmentDraftJob,
    retryAssessmentDraftJob,
    startQuestionnaireGeneration,
    getQuestionnaireGenerationJob,
    getRequestGenerationJobs,
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
    listAdministrationControls,
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

  /* Phase 15 (15-UI-SPEC §3.3, §12, §13 family I; D-12, D-18, D-32): the optional instruction and its refusals. */
  it('sends an instruction with questionnaire generation, and refuses a non-string instruction without calling', async () => {
    const job = { jobId: 'job-1', requestId: 'request-1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: '2026-08-30T01:02:03.000Z', status: 'queued' };
    startQuestionnaireGeneration.mockResolvedValueOnce(success(job));
    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: false, instruction: 'Cover the offshore support team and payroll data' })).resolves.toEqual({ ok: true, data: job });
    expect(startQuestionnaireGeneration).toHaveBeenCalledWith('request-1', false, 'Cover the offshore support team and payroll data');
    startQuestionnaireGeneration.mockClear();
    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: false, instruction: 42 })).resolves.toMatchObject({ ok: false });
    expect(startQuestionnaireGeneration).not.toHaveBeenCalled();
  });

  it('reads an instruction refusal with Q1’s sentence and its reason, and OWN_REQUEST with family I’s', async () => {
    startQuestionnaireGeneration.mockResolvedValueOnce({ data: null, error: { message: 'raw', status: 400, reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT' } });
    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: false, instruction: 'The vendor processes payroll.' })).resolves.toEqual({
      ok: false,
      formError: 'The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.',
      reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT',
    });
    startQuestionnaireGeneration.mockResolvedValueOnce({ data: null, error: { message: 'raw', status: 403, reason: 'OWN_REQUEST' } });
    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: false, instruction: 'Cover payroll.' })).resolves.toEqual({
      ok: false,
      formError: 'A Security Analyst can’t give the AI an instruction on a request they raised. Generate without one, or ask another Security Analyst.',
      reason: 'OWN_REQUEST',
    });
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

  it('polls the generation jobs of a request by request identifier alone, without revalidating', async () => {
    const jobs = {
      questionnaireGeneration: {
        job: { jobId: 'job-1', requestId: 'request/1', providerName: 'Configured provider', providerVersion: '1', attempt: 1, queuedAt: '2026-08-30T01:02:03.000Z', status: 'running', startedAt: '2026-08-30T01:02:04.000Z' },
        canRetry: false,
      },
      assessmentDraft: null,
    };
    getRequestGenerationJobs.mockResolvedValueOnce(success(jobs));

    await expect(actions.getRequestGenerationJobsAction({ requestId: 'request/1' })).resolves.toEqual({ ok: true, data: jobs });
    await expect(actions.getRequestGenerationJobsAction({ requestId: '' })).resolves.toMatchObject({ ok: false });
    await expect(actions.getRequestGenerationJobsAction({ requestId: 'request-1', jobId: 'forged' })).resolves.toMatchObject({ ok: false });
    expect(getRequestGenerationJobs).toHaveBeenCalledTimes(1);
    expect(getRequestGenerationJobs).toHaveBeenCalledWith('request/1');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses a request generation poll the server refuses, without disclosing why or naming an assessment', async () => {
    getRequestGenerationJobs.mockResolvedValueOnce(failure(403)).mockResolvedValueOnce(failure(404));

    await expect(actions.getRequestGenerationJobsAction({ requestId: 'request-1' })).resolves.toEqual({ ok: false, formError: 'You do not have permission to check generation for this request.' });
    await expect(actions.getRequestGenerationJobsAction({ requestId: 'request-1' })).resolves.toEqual({ ok: false, formError: 'This request is no longer available.' });
    expect(revalidatePath).not.toHaveBeenCalled();
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

  /* WR-103: a save whose AI review history can't take its record is refused for that reason, which a reload can't fix. */
  it('reads an assessment or Risk save refused by the AI review history as that refusal, retaining values', async () => {
    const formError = 'The review history of this assessment’s AI proposals can’t record more changes, so your changes weren’t saved. Contact your administrator.';
    const conflict = { data: null, error: { message: 'raw internal detail', status: 409, reason: 'AI_RUN_RECORD_UNAVAILABLE' } };
    updateAssessment.mockResolvedValueOnce(conflict);
    updateRisk.mockResolvedValueOnce(conflict);

    await expect(actions.saveAssessmentAction({ assessmentId: 'assessment-1', values: { summary: 'Keep this value' } }))
      .resolves.toEqual({ ok: false, values: { summary: 'Keep this value' }, formError });
    await expect(actions.updateRiskAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: { riskStatement: 'Keep this statement' } }))
      .resolves.toEqual({ ok: false, values: { riskStatement: 'Keep this statement' }, formError });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  /* Phase 16 §6.5 (16-UI-SPEC §13 R1): a Risk withdrawn meanwhile refuses its edit and its control changes in R1's words. */
  it('reads a Risk or mitigation control change refused because the Risk was withdrawn as R1’s sentence, retaining values', async () => {
    const formError = 'This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.';
    const withdrawn = { data: null, error: { message: 'raw internal detail', status: 409, reason: 'RISK_WITHDRAWN' } };
    updateRisk.mockResolvedValueOnce(withdrawn);
    updateControlImplementation.mockResolvedValueOnce(withdrawn);
    createControlImplementation.mockResolvedValueOnce(withdrawn);
    deleteControlImplementation.mockResolvedValueOnce(withdrawn);

    // FE3-05: the closed reason comes back too, so the page reads the Risk again (§6.5).
    const reason = 'RISK_WITHDRAWN';
    await expect(actions.updateRiskAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: { riskStatement: 'Keep this statement' } }))
      .resolves.toEqual({ ok: false, values: { riskStatement: 'Keep this statement' }, formError, reason });
    await expect(actions.updateControlImplementationAction({ assessmentId: 'assessment-1', implementationId: 'implementation-1', values: { evidence: 'Keep this evidence' } }))
      .resolves.toEqual({ ok: false, values: { evidence: 'Keep this evidence' }, formError, reason });
    await expect(actions.createControlImplementationAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: { control: 'control-1', evidence: 'Keep this evidence' } }))
      .resolves.toEqual({ ok: false, values: expect.objectContaining({ evidence: 'Keep this evidence' }), formError, reason });
    await expect(actions.deleteControlImplementationAction({ assessmentId: 'assessment-1', implementationId: 'implementation-1' }))
      .resolves.toEqual({ ok: false, formError, reason });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  /*
   * CR-02 with WR-103: removing a planned control an AI suggestion added proposes that suggestion again, recorded in the
   * run's history, so a history that can't take the record refuses the removal with its own reason, which a reload
   * can't fix. Any other conflict keeps the generic sentence.
   */
  it('reads a mitigation control removal refused by the AI review history as that refusal', async () => {
    deleteControlImplementation.mockResolvedValueOnce({ data: null, error: { message: 'raw internal detail', status: 409, reason: 'AI_RUN_RECORD_UNAVAILABLE' } });
    deleteControlImplementation.mockResolvedValueOnce({ data: null, error: { message: 'raw internal detail', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' } });
    const input = { assessmentId: 'assessment-1', implementationId: 'implementation-1' };

    await expect(actions.deleteControlImplementationAction(input)).resolves.toEqual({
      ok: false,
      formError: 'The review history of this assessment’s AI proposals can’t record more changes, so your changes weren’t saved. Contact your administrator.',
    });
    await expect(actions.deleteControlImplementationAction(input)).resolves.toEqual({ ok: false, formError: 'This assessment changed. Reload and try again.' });
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

  it('states the length limit of Risk text and asks for a valid exemption review date (UI-SPEC §13.3)', async () => {
    const result = await actions.createRiskAction({
      assessmentId: 'assessment-1',
      values: { riskStatement: 'r'.repeat(65_536), treatmentPlan: 't'.repeat(65_536), exemptionReviewDate: '2026-12-01' },
    });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        riskStatement: ['Use 65,535 characters or fewer.'],
        treatmentPlan: ['Use 65,535 characters or fewer.'],
        exemptionReviewDate: ['Enter a valid exemption review date.'],
      },
    });
    expect(createRisk).not.toHaveBeenCalled();
  });

  it('asks for a control when Add mitigation control has none, and states the evidence limit', async () => {
    for (const control of [null, '', '  ']) {
      await expect(actions.createControlImplementationAction({ assessmentId: 'assessment-1', riskId: 'risk-1', values: { control } })).resolves.toMatchObject({
        ok: false,
        fieldErrors: { control: ['Choose a control.'] },
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

    /* WR-205: a generation that failed for another reason names the request, never an assessment. */
    it('words a refused or unavailable generation about the request, never an assessment', async () => {
      service.mockResolvedValueOnce(failure(403)).mockResolvedValueOnce(failure(503));

      await expect(run()).resolves.toEqual({ ok: false, formError: 'You do not have permission to generate a questionnaire for this request.' });
      await expect(run()).resolves.toEqual({ ok: false, formError: 'The questionnaire generation service is unavailable. Please try again later.' });
    });
  });

  it('says the request is gone when a start finds no request, and the generation is gone when a retry finds no job', async () => {
    startQuestionnaireGeneration.mockResolvedValueOnce(failure(404));
    retryQuestionnaireGenerationJob.mockResolvedValueOnce(failure(404));
    getQuestionnaireGenerationJob.mockResolvedValueOnce(failure(404)).mockResolvedValueOnce(failure(403));

    await expect(actions.startQuestionnaireGenerationAction({ requestId: 'request-1', replaceUnansweredQuestionnaire: false })).resolves.toEqual({ ok: false, formError: 'This request is no longer available.' });
    await expect(actions.retryQuestionnaireGenerationJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: false, formError: 'This questionnaire generation is no longer available.' });
    await expect(actions.getQuestionnaireGenerationJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: false, formError: 'This questionnaire generation is no longer available.' });
    await expect(actions.getQuestionnaireGenerationJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: false, formError: 'You do not have permission to generate a questionnaire for this request.' });
  });
});

/*
 * WR-205 (D-22): an assessment draft refusal reads its reason, or a fallback that says the draft can't be
 * generated in the current state; never "This assessment changed. Reload and try again.", because nothing changed
 * and no assessment may exist yet. Its other failures name the questionnaire or the draft generation.
 */
describe('assessment draft generation refusals', () => {
  const conflict = (reason?: string) => ({ data: null, error: { message: 'raw internal detail', status: 409, ...(reason ? { reason } : {}) } });
  const drafts = [
    { name: 'start', service: startAssessmentDraft, run: () => actions.startAssessmentDraftAction({ questionnaireId: 'questionnaire-1' }) },
    { name: 'retry', service: retryAssessmentDraftJob, run: () => actions.retryAssessmentDraftJobAction({ jobId: 'job-1' }) },
  ];

  describe.each(drafts)('$name', ({ service, run }) => {
    it('reads the fallback for a conflict with no reason, never the changed-reload message', async () => {
      service.mockResolvedValueOnce(conflict());

      const result = await run();
      expect(result).toEqual({ ok: false, formError: 'An assessment draft can’t be generated for this questionnaire in its current state.' });
      expect(JSON.stringify(result)).not.toMatch(/changed|Reload/);
    });

    it.each([
      ['QUESTIONNAIRE_NOT_SUBMITTED', 'Draft generation can begin only after the linked questionnaire is submitted.'],
      ['ASSESSMENT_STARTED', 'An assessment already exists for this request, so a draft can’t be generated.'],
    ])('%s reads its sentence and returns the reason', async (reason, formError) => {
      service.mockResolvedValueOnce(conflict(reason));

      await expect(run()).resolves.toEqual({ ok: false, formError, reason });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('words a refused or unavailable draft generation without naming an assessment that may not exist', async () => {
      service.mockResolvedValueOnce(failure(403)).mockResolvedValueOnce(failure(503));

      await expect(run()).resolves.toEqual({ ok: false, formError: 'You do not have permission to generate an assessment draft for this questionnaire.' });
      await expect(run()).resolves.toEqual({ ok: false, formError: 'The assessment service is unavailable. Please try again later.' });
    });
  });

  it('says the questionnaire is gone when a start finds none, and the draft generation is gone when a job read finds none', async () => {
    startAssessmentDraft.mockResolvedValueOnce(failure(404));
    getAssessmentDraftJob.mockResolvedValueOnce(failure(404));

    await expect(actions.startAssessmentDraftAction({ questionnaireId: 'questionnaire-1' })).resolves.toEqual({ ok: false, formError: 'This questionnaire is no longer available.' });
    await expect(actions.getAssessmentDraftJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: false, formError: 'This draft generation is no longer available.' });
  });
});

describe('control search for the Control picker (D-29, UI-SPEC §13.1)', () => {
  const page = (data: unknown[]) => ({ data: { data, meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: data.length } } }, error: null });
  const app11 = {
    documentId: 'control-app-11',
    controlNumber: 'APP-11',
    name: 'APP-11 — Security of personal information',
    description: null,
    controlType: null,
    framework: 'Privacy Act 1988 — Australian Privacy Principles and Notifiable Data Breaches scheme',
    frameworkVersion: null,
  };
  const iso51 = { ...app11, documentId: 'control-5-1', controlNumber: '5.1', name: '5.1', framework: 'ISO/IEC 27001 Information security management systems — Annex A' };

  it('searches the library once by number, name or framework, one page of 10, and names each control by its label', async () => {
    listAdministrationControls.mockResolvedValueOnce(page([app11, iso51]));

    await expect(actions.searchControlsAction({ search: '  APP  ' })).resolves.toEqual({
      ok: true,
      data: [
        { documentId: 'control-app-11', name: 'APP-11 · Security of personal information', detail: app11.framework },
        { documentId: 'control-5-1', name: '5.1 · ISO/IEC 27001 Information security management systems — Annex A' },
      ],
    });
    expect(listAdministrationControls).toHaveBeenCalledTimes(1);
    expect(listAdministrationControls).toHaveBeenCalledWith(expect.objectContaining({ q: 'APP', page: 1, pageSize: 10 }));
  });

  it.each([
    ['a blank search', { search: '   ' }],
    ['an over-long search', { search: 'x'.repeat(201) }],
    ['an unknown field', { search: 'APP', pageSize: 100 }],
    ['no input', undefined],
  ])('refuses %s without a call', async (_case, input) => {
    await expect(actions.searchControlsAction(input)).resolves.toMatchObject({ ok: false });
    expect(listAdministrationControls).not.toHaveBeenCalled();
  });

  it('accepts a search of exactly 200 characters', async () => {
    listAdministrationControls.mockResolvedValueOnce(page([]));
    await expect(actions.searchControlsAction({ search: 'x'.repeat(200) })).resolves.toEqual({ ok: true, data: [] });
  });

  it('says plainly when the analyst may not search, and otherwise that the service is unavailable', async () => {
    listAdministrationControls.mockResolvedValueOnce(failure(403));
    await expect(actions.searchControlsAction({ search: 'APP' })).resolves.toEqual({ ok: false, formError: 'You do not have permission to search these records.' });
    listAdministrationControls.mockResolvedValueOnce(failure(503));
    await expect(actions.searchControlsAction({ search: 'APP' })).resolves.toEqual({ ok: false, formError: 'The selection service is unavailable. Please try again later.' });
  });
});
