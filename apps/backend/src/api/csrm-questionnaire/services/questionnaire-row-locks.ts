/*
 * One lock order for every mutation of a questionnaire (CR-101): the assessment request's row, then the
 * questionnaire's row, both FOR UPDATE, taken at the start of the transaction and before anything is read.
 *
 * A replacement (generation) and every governance mutation (release, return to review, question add, edit
 * and delete) rewrite the same append-only governance log and question set, and a Requestor's answer save
 * writes the questionnaire's questions and then its request's status. Holding both rows means none of them
 * can read the log or the questions while another is between its own read and its write, so no event is
 * dropped and a release never publishes questions it did not see (D-09). Taking them in one order everywhere
 * means two of these transactions can never deadlock on each other.
 *
 * On PostgreSQL (R-08-37) the locks block a second transaction until the first commits. On SQLite, the
 * development database, FOR UPDATE is ignored and Strapi's single connection already serialises every
 * transaction, so the locks are harmless there; the mounted tests emulate PostgreSQL's locks to prove the
 * protocol (tests/helpers/strapi-http-harness.ts, interleaveInTransactionWindow).
 */

type RecordValue = Record<string, unknown>;

export type QuestionnaireRowLockStrapi = {
  documents: (uid: string) => { findOne: (query: RecordValue) => Promise<RecordValue | null> };
  db: {
    queryBuilder: (uid: string) => {
      select: (columns: string[]) => unknown;
      where: (where: RecordValue) => unknown;
      forUpdate: () => unknown;
      transacting: (transaction: unknown) => unknown;
      execute: <T>() => Promise<T>;
    };
  };
};

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";

function relationDocumentId(value: unknown): string | null {
  if (typeof value === "string") return value;
  return typeof value === "object" && value !== null && typeof (value as RecordValue).documentId === "string"
    ? (value as RecordValue).documentId as string
    : null;
}

async function lockRow(strapi: QuestionnaireRowLockStrapi, uid: string, documentId: string, transaction: unknown): Promise<void> {
  const query = strapi.db.queryBuilder(uid);
  query.select(["id"]);
  query.where({ documentId });
  query.forUpdate();
  query.transacting(transaction);
  await query.execute<unknown>();
}

/**
 * For a mutation that starts from a request (a replacement): locks the request's row, then its
 * questionnaire's row when it has one, and returns that questionnaire's id. Only generation creates a
 * questionnaire for a request, and it does so under this request lock, so the relation read after the
 * request lock is the one the questionnaire lock covers.
 */
export async function lockRequestAndQuestionnaire(
  strapi: QuestionnaireRowLockStrapi,
  requestDocumentId: string,
  transaction: unknown,
): Promise<string | null> {
  await lockRow(strapi, REQUEST_UID, requestDocumentId, transaction);
  const request = await strapi.documents(REQUEST_UID).findOne({ documentId: requestDocumentId, populate: { questionnaire: true } });
  const questionnaireDocumentId = relationDocumentId(request?.questionnaire);
  if (questionnaireDocumentId) await lockRow(strapi, QUESTIONNAIRE_UID, questionnaireDocumentId, transaction);
  return questionnaireDocumentId;
}

/**
 * For a mutation that starts from a questionnaire (governance, answers): locks its request's row, then the
 * questionnaire's row. A questionnaire's request is set when it is created and never changes, so reading it
 * before either lock is held cannot pick the wrong row. A questionnaire that does not exist locks only its
 * own (absent) row, and the caller's read then reports it as not found.
 */
export async function lockQuestionnaireAndRequest(
  strapi: QuestionnaireRowLockStrapi,
  questionnaireDocumentId: string,
  transaction: unknown,
): Promise<void> {
  const questionnaire = await strapi.documents(QUESTIONNAIRE_UID).findOne({ documentId: questionnaireDocumentId, populate: { assessmentRequest: true } });
  const requestDocumentId = relationDocumentId(questionnaire?.assessmentRequest);
  if (requestDocumentId) await lockRow(strapi, REQUEST_UID, requestDocumentId, transaction);
  await lockRow(strapi, QUESTIONNAIRE_UID, questionnaireDocumentId, transaction);
}
