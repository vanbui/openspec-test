import { afterEach, describe, expect, it, vi } from 'vitest';
import * as service from './questionnaire-service';

const get = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const normalizeTransportError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: async () => ({ GET: get, PATCH: patch, POST: post }),
  normalizeTransportError,
}));

const request = {
  availability: 'available' as const,
  documentId: 'request-1',
  requestNumber: 'RAR-2026-X7K4Q2',
  title: 'Customer portal review',
  requestStatus: 'questionnaire-in-progress',
};
const questionnaire = {
  documentId: 'questionnaire-1',
  questionnaireNumber: 'QUES-DEV-001',
  title: 'Service security questionnaire',
  description: 'Describe the service security posture.',
  state: 'draft',
  progress: { answered: 1, total: 2, percent: 50 },
  assessmentRequest: request,
  updatedAt: '2026-08-29T10:00:00.000Z',
};
const question = {
  documentId: 'question-1',
  questionText: 'Is the service internet facing?',
  answerType: 'Boolean',
  options: {
    schemaVersion: 1,
    questionKey: 'internet-facing',
    section: { key: 'service', title: 'Service context', order: 0 },
    order: 0,
    required: true,
  },
  answer: {
    schemaVersion: 1,
    value: true,
    state: 'draft',
    updatedAt: '2026-08-29T10:00:00.000Z',
  },
};
const pagination = { page: 1, pageSize: 50, pageCount: 1, total: 1 };

afterEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
  normalizeTransportError.mockReset();
});

describe('questionnaire service contract', () => {
  it('uses every exact generated read path and returns bounded actor-specific projections', async () => {
    get
      .mockResolvedValueOnce({ data: { data: [{ ...questionnaire, secret: 'hidden' }], meta: { pagination } }, response: { status: 200 } })
      .mockResolvedValueOnce({ data: { data: { notStarted: 1, draft: 2, submitted: 3, total: 6, secret: 9 } }, response: { status: 200 } })
      .mockResolvedValueOnce({ data: { data: [{ ...questionnaire, secret: 'hidden' }], meta: { pagination } }, response: { status: 200 } })
      .mockResolvedValueOnce({ data: { data: { awaitingSubmission: 4, readyForReview: 2, total: 6, secret: 9 } }, response: { status: 200 } })
      .mockResolvedValueOnce({ data: { data: { ...questionnaire, secret: 'hidden' } }, response: { status: 200 } })
      .mockResolvedValueOnce({ data: { data: [{ ...question, secret: 'hidden' }] }, response: { status: 200 } });

    await expect(service.listMyQuestionnaires()).resolves.toEqual({ data: [questionnaire], error: null });
    await expect(service.getMyQuestionnaireSummary()).resolves.toEqual({
      data: { notStarted: 1, draft: 2, submitted: 3, total: 6 }, error: null,
    });
    await expect(service.listQuestionnairesForReview()).resolves.toEqual({ data: [questionnaire], error: null });
    await expect(service.getReviewSummary()).resolves.toEqual({
      data: { awaitingSubmission: 4, readyForReview: 2, total: 6 }, error: null,
    });
    await expect(service.getQuestionnaire('questionnaire-1')).resolves.toEqual({ data: questionnaire, error: null });
    await expect(service.getQuestionnaireQuestions('questionnaire-1')).resolves.toMatchObject({
      data: [{ questionKey: 'internet-facing', answer: { value: true } }], error: null,
    });

    expect(get.mock.calls).toEqual([
      ['/v1/my_questionnaires', { params: { query: { page: 1, pageSize: 50, sort: ['updatedAt:desc'] } } }],
      ['/v1/my_questionnaires/status_summary'],
      ['/v1/questionnaires', { params: { query: { page: 1, pageSize: 50, sort: ['updatedAt:desc'] } } }],
      ['/v1/questionnaires/review_summary'],
      ['/v1/questionnaires/{questionnaireId}', { params: { path: { questionnaireId: 'questionnaire-1' } } }],
      ['/v1/questionnaires/{questionnaireId}/questions', { params: { path: { questionnaireId: 'questionnaire-1' } } }],
    ]);
    expect(service).not.toHaveProperty('listQuestionnaires');
    expect(JSON.stringify(get.mock.calls)).not.toContain('requestor');
    expect(JSON.stringify(get.mock.calls)).not.toContain('identity');
  });

  it('allowlists draft bodies and parses authoritative mutation results', async () => {
    const authoritative = {
      questionnaireId: 'questionnaire-1',
      state: 'draft',
      progress: { answered: 1, total: 2, percent: 50 },
      answers: [question],
      updatedAt: '2026-08-29T10:00:00.000Z',
      internal: 'hidden',
    };
    patch.mockResolvedValueOnce({ data: { data: authoritative }, response: { status: 200 } });
    post.mockResolvedValueOnce({
      data: { data: { ...authoritative, state: 'submitted', submittedAt: '2026-08-29T10:01:00.000Z' } },
      response: { status: 200 },
    });
    const answers = [{ questionKey: 'internet-facing', value: true }];

    await expect(service.saveQuestionnaireDraft('questionnaire-1', answers)).resolves.toMatchObject({
      data: { questionnaireId: 'questionnaire-1', state: 'draft', answers: [{ questionKey: 'internet-facing' }] }, error: null,
    });
    await expect(service.submitQuestionnaire('questionnaire-1')).resolves.toMatchObject({
      data: { questionnaireId: 'questionnaire-1', state: 'submitted' }, error: null,
    });

    expect(patch).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/answers', {
      params: { path: { questionnaireId: 'questionnaire-1' } },
      body: { answers },
    });
    expect(post).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/submit', {
      params: { path: { questionnaireId: 'questionnaire-1' } },
    });
    const body = patch.mock.calls[0]?.[1]?.body;
    for (const forbidden of ['identity', 'requestor', 'state', 'updatedAt', 'submittedAt', 'definition', 'questionnaire']) {
      expect(body).not.toHaveProperty(forbidden);
      expect(body.answers[0]).not.toHaveProperty(forbidden);
    }
  });

  it('rejects malformed external payloads and normalizes status and transport failures', async () => {
    const forbidden = { data: null, error: { message: 'You do not have permission to access this questionnaire.', status: 403 } };
    const unavailable = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
    normalizeTransportError.mockImplementation((_error: unknown, status?: number) => status === 403 ? forbidden : unavailable);
    get
      .mockResolvedValueOnce({ data: { data: [{ ...questionnaire, state: 'forged' }], meta: { pagination } }, response: { status: 200 } })
      .mockResolvedValueOnce({ error: { name: 'Forbidden', message: 'raw internal detail' }, response: { status: 403 } })
      .mockRejectedValueOnce(new Error('connection string and internal detail'));

    await expect(service.listMyQuestionnaires()).resolves.toEqual(unavailable);
    await expect(service.getQuestionnaire('questionnaire-1')).resolves.toEqual(forbidden);
    await expect(service.getQuestionnaireQuestions('questionnaire-1')).resolves.toEqual(unavailable);
  });

  it('keeps a deleted question out of every question list it returns', async () => {
    // A deleted question is retained for its history but is no longer part of
    // the questionnaire (D-07), wherever the list arrives: the questions read,
    // a draft save, a submission or a revert.
    const deletedQuestion = {
      documentId: 'question-2',
      questionText: 'Which region hosts the service?',
      answerType: 'Text',
      options: {
        schemaVersion: 2,
        questionKey: 'hosting-region',
        section: { key: 'service', title: 'Service context', order: 0 },
        order: 1,
        required: false,
        deleted: { deletedAt: '2026-09-21T00:00:00.000Z', deletedBy: 'analyst-1' },
      },
      answer: null,
    };
    const answersFor = (result: unknown) => (result as { data: { answers?: { questionKey: string }[] } | { questionKey: string }[] }).data;
    const mutation = {
      questionnaireId: 'questionnaire-1',
      state: 'draft',
      progress: { answered: 1, total: 1, percent: 100 },
      answers: [question, deletedQuestion],
      updatedAt: '2026-08-29T10:00:00.000Z',
    };
    get.mockResolvedValueOnce({ data: { data: [question, deletedQuestion] }, response: { status: 200 } });
    patch.mockResolvedValueOnce({ data: { data: mutation }, response: { status: 200 } });
    post
      .mockResolvedValueOnce({ data: { data: { ...mutation, state: 'submitted', submittedAt: '2026-08-29T10:01:00.000Z' } }, response: { status: 200 } })
      .mockResolvedValueOnce({
        data: { data: { ...mutation, revert: { reason: 'Correct the hosting answer.', revertedAt: '2026-08-29T10:02:00.000Z', revertedBy: { documentId: 'analyst-1' } } } },
        response: { status: 200 },
      });

    const read = await service.getQuestionnaireQuestions('questionnaire-1');
    expect((answersFor(read) as { questionKey: string }[]).map((entry) => entry.questionKey)).toEqual(['internet-facing']);
    for (const result of [
      await service.saveQuestionnaireDraft('questionnaire-1', [{ questionKey: 'internet-facing', value: true }]),
      await service.submitQuestionnaire('questionnaire-1'),
      await service.revertQuestionnaireToDraft('questionnaire-1', 'Correct the hosting answer.'),
    ]) {
      expect(result.error).toBeNull();
      const { answers } = answersFor(result) as { answers: { questionKey: string }[] };
      expect(answers.map((entry) => entry.questionKey)).toEqual(['internet-facing']);
    }
  });

  it('rejects an unavailable request relationship that carries a protected identifier', async () => {
    const malformed = { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', status: 503 } };
    normalizeTransportError.mockReturnValue(malformed);
    get.mockResolvedValueOnce({
      data: { data: { ...questionnaire, assessmentRequest: { availability: 'unavailable', documentId: 'protected-request' } } },
      response: { status: 200 },
    });

    await expect(service.getQuestionnaire('questionnaire-1')).resolves.toEqual(malformed);
  });

  it('passes bounded page queries and requires authoritative pagination metadata', async () => {
    const query = service.parseQuestionnaireListQuery({ status: 'draft', page: '2', pageSize: '25', sort: 'title:asc' });
    get.mockResolvedValueOnce({
      data: { data: [questionnaire], meta: { pagination: { page: 2, pageSize: 25, pageCount: 2, total: 26 } } },
      response: { status: 200 },
    });

    await expect(service.listMyQuestionnaires(query)).resolves.toEqual({
      data: { questionnaires: [questionnaire], pagination: { page: 2, pageSize: 25, pageCount: 2, total: 26 } },
      error: null,
    });
    expect(get).toHaveBeenCalledWith('/v1/my_questionnaires', {
      params: { query: { status: 'draft', page: 2, pageSize: 25, sort: ['title:asc'] } },
    });
    expect(service.parseQuestionnaireListQuery({ page: '0', pageSize: '500', sort: 'forged' })).toEqual({
      page: 1, pageSize: 25, sort: 'updatedAt:desc',
    });
  });

  it('serializes only one native questionnaire status for both collection endpoints', async () => {
    for (const status of ['not-started', 'draft', 'submitted'] as const) {
      const query = service.parseQuestionnaireListQuery({ status, q: '  service  ', page: '2', pageSize: '10' });
      get
        .mockResolvedValueOnce({ data: { data: [questionnaire], meta: { pagination } }, response: { status: 200 } })
        .mockResolvedValueOnce({ data: { data: [questionnaire], meta: { pagination } }, response: { status: 200 } });

      await service.listMyQuestionnaires(query);
      await service.listQuestionnairesForReview(query);

      expect(get).toHaveBeenNthCalledWith((status === 'not-started' ? 1 : status === 'draft' ? 3 : 5), '/v1/my_questionnaires', {
        params: { query: { q: 'service', status, page: 2, pageSize: 10, sort: ['updatedAt:desc'] } },
      });
      expect(get).toHaveBeenNthCalledWith((status === 'not-started' ? 2 : status === 'draft' ? 4 : 6), '/v1/questionnaires', {
        params: { query: { q: 'service', status, page: 2, pageSize: 10, sort: ['updatedAt:desc'] } },
      });
    }

    const malformedStatuses: Array<string | string[]> = ['', 'approved', ['draft', 'submitted']];
    for (const status of malformedStatuses) {
      expect(service.parseQuestionnaireListQuery({ status })).toEqual({ page: 1, pageSize: 25, sort: 'updatedAt:desc' });
    }
  });

  /* D-18: question events carry a text snapshot, bounded at 500 characters on both event shapes. */
  it('accepts a question text snapshot up to the 500-character event bound and no further', () => {
    const parse = (label: string, data: unknown) => service.contractResponseParsers.find((entry) => entry.label === label)?.parser.safeParse({ data }).success;
    const timelineEvent = (questionText: string) => ({ kind: 'question-edited', at: '2026-09-03T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, questionKey: 'hosting-region', questionText });
    expect(parse('getQuestionnaire', { ...questionnaire, events: [timelineEvent('a'.repeat(500))] })).toBe(true);
    expect(parse('getQuestionnaire', { ...questionnaire, events: [timelineEvent('a'.repeat(501))] })).toBe(false);
    const release = { releasedAt: '2026-09-01T00:00:00.000Z', releasedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' } };
    const storedEvent = (questionText: string) => ({ schemaVersion: 1, kind: 'question-added', at: '2026-09-03T00:00:00.000Z', by: 'analyst-1', questionKey: 'hosting-region', questionText });
    const governance = (questionText: string) => ({ ...questionnaire, release, events: [storedEvent(questionText)] });
    expect(parse('addQuestionnaireQuestion', governance('a'.repeat(500)))).toBe(true);
    expect(parse('addQuestionnaireQuestion', governance('a'.repeat(501)))).toBe(false);
  });
});
