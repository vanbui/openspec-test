/*
 * The one per-request serialisation every Phase 13 write uses (13-RESEARCH §E): the Phase 06.1 return to draft,
 * the assignment, and the notes, mark-read and AI-input paths that follow.
 *
 * Two layers, both required:
 *
 * 1. An in-process promise tail per request. Every writer to one request waits for the writer before it, so two
 *    writers in this process never hold, or wait for, the database at the same time for the same request. There is
 *    ONE tail map, in this module: two maps would let two writers to one request run side by side in-process.
 * 2. A transaction that takes `SELECT id … WHERE documentId = ? FOR UPDATE` on the request row before `work` reads
 *    anything. Every read that decides must happen inside `work`, after the lock. On PostgreSQL (R-08-37) the row
 *    lock blocks a second transaction, from another process, until the first commits. On SQLite, the development
 *    and test database, knex compiles FOR UPDATE to a plain SELECT and Strapi's single connection serialises every
 *    transaction instead.
 *
 * Inside `work`, Document Service, `strapi.db.query` and `strapi.db.queryBuilder` calls join the transaction through
 * Strapi's async context. Raw `strapi.db.connection` knex does not: it must call `.transacting(trx)`, or on SQLite
 * it waits for the only connection until the pool times out (13-RESEARCH Pitfall 1).
 *
 * Lock order (CR-101). Three other paths lock the same request row FOR UPDATE:
 *   - `lockRequestAndQuestionnaire` (questionnaire generation: the request row, then the questionnaire row),
 *   - `lockQuestionnaireAndRequest` (questionnaire governance and answers: the request row, then the questionnaire
 *     row), both in `csrm-questionnaire/services/questionnaire-row-locks.ts`,
 *   - `lockAssessmentRequest` (the assessment draft, `csrm-assessment/services/assessment-workflow.ts`).
 * `withRequestLock` takes only the request row, as the first row of its transaction. It is never called inside one
 * of those transactions, and its `work` never calls one of them, so every transaction that locks the request row
 * takes it first and none waits for it while holding a questionnaire row. This module imports neither of them.
 *
 * Never nest `withRequestLock` for one request: the inner call would wait on its own tail forever.
 */

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";

export type RequestLockStrapi = {
  db: {
    transaction: <T>(work: (context: { trx: unknown }) => Promise<T>) => Promise<T>;
    queryBuilder: (uid: string) => {
      select: (columns: string[]) => unknown;
      where: (where: Record<string, unknown>) => unknown;
      forUpdate: () => unknown;
      transacting: (transaction: unknown) => unknown;
      execute: <T>() => Promise<T>;
    };
  };
};

const requestTails = new Map<string, Promise<void>>();

export async function withRequestLock<T>(
  strapi: RequestLockStrapi,
  requestDocumentId: string,
  work: (trx: unknown) => Promise<T>,
): Promise<T> {
  const previous = requestTails.get(requestDocumentId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  requestTails.set(requestDocumentId, tail);
  await previous;
  try {
    return await strapi.db.transaction(async ({ trx }) => {
      const query = strapi.db.queryBuilder(REQUEST_UID);
      query.select(["id"]);
      query.where({ documentId: requestDocumentId });
      query.forUpdate();
      query.transacting(trx);
      await query.execute<unknown>();
      return work(trx);
    });
  } finally {
    release();
    if (requestTails.get(requestDocumentId) === tail) requestTails.delete(requestDocumentId);
  }
}
