import {
  RELEASED_REQUEST_STATUSES,
  REVIEWABLE_REQUEST_STATUSES,
} from "../../csrm-assessment-request/services/collection-scope";
import { RECENT_ACTIVITY_LIMIT } from "../../../csrm/insights/insight-constants";
import { ACTIVITY_RECORD_TYPE, type ActivityItem, type ActivityKind } from "../../../csrm/insights/recent-activity";
import { normalizeDateTime } from "../../../csrm/insights/utc-date";

/*
 * The recent activity sources (DASH-01, UI-SPEC §2.5.1): one bounded Document
 * Service read per kind of event. Each read filters to the records whose
 * governing timestamp is set, sorts newest first with a documentId tie-break,
 * and reads RECENT_ACTIVITY_LIMIT + 1 rows, so the merge knows exactly when the
 * feed is truncated. The actor comes from the event's own relation, populated
 * with only its documentId and display name.
 *
 * Scope (D-14): request events come only from requests in the analyst review
 * scope, so a request returned to draft and still a draft is never shown; a
 * release is the complete triple of an approved status, an approval date and
 * an approver. Generated drafts name no actor: AI output is advisory, and only a
 * release names the Security Analyst who made it.
 */

type RecordValue = Record<string, unknown>;
type Documents = { findMany: (query: RecordValue) => Promise<RecordValue[]> };

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";
const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";

/** Each source reads one row more than the feed shows. */
const SOURCE_LIMIT = RECENT_ACTIVITY_LIMIT + 1;

/** The analyst review scope: submitted work still in review, and released work. A draft is never in it. */
const REVIEW_SCOPE_STATUSES = Object.freeze([...REVIEWABLE_REQUEST_STATUSES, ...RELEASED_REQUEST_STATUSES]);

/** An actor crosses the boundary as its documentId and display name only. */
const ACTOR = Object.freeze({ fields: ["documentId", "displayName"] });

const DATA_INVALID = "CSRM recent activity data is invalid.";

type ActivitySource = {
  kind: ActivityKind;
  uid: string;
  /** The timestamp attribute that dates the event. */
  timestamp: string;
  filters: RecordValue;
  fields: readonly string[];
  populate: RecordValue | null;
  identifier: (document: RecordValue) => unknown;
  title: (document: RecordValue) => unknown;
  /** The relation that names the actor, or null when the event names no one. */
  actor: string | null;
};

export class RecentActivityRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecentActivityRepositoryError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const requestNumber = (document: RecordValue): unknown => document.requestNumber;
const questionnaireNumber = (document: RecordValue): unknown => document.questionnaireNumber;
const assessmentNumber = (document: RecordValue): unknown => document.assessmentNumber;
const ownTitle = (document: RecordValue): unknown => document.title;
/** An assessment has no title of its own; its row carries the owning request's title. */
const requestTitle = (document: RecordValue): unknown =>
  isRecord(document.assessmentRequest) ? document.assessmentRequest.title : null;

const REQUEST_FIELDS = Object.freeze(["documentId", "requestNumber", "title"] as const);
const QUESTIONNAIRE_FIELDS = Object.freeze(["documentId", "questionnaireNumber", "title"] as const);
const ASSESSMENT_FIELDS = Object.freeze(["documentId", "assessmentNumber"] as const);
const OWNING_REQUEST = Object.freeze({ fields: ["title"] });

const ACTIVITY_SOURCES: readonly ActivitySource[] = Object.freeze([
  {
    kind: "request-submitted",
    uid: REQUEST_UID,
    timestamp: "submittedDate",
    filters: { submittedDate: { $notNull: true }, requestStatus: { $in: [...REVIEW_SCOPE_STATUSES] } },
    fields: [...REQUEST_FIELDS, "submittedDate"],
    populate: { requestor: ACTOR },
    identifier: requestNumber,
    title: ownTitle,
    actor: "requestor",
  },
  {
    kind: "request-returned-to-draft",
    uid: REQUEST_UID,
    timestamp: "revertedAt",
    filters: { revertedAt: { $notNull: true }, requestStatus: { $in: [...REVIEW_SCOPE_STATUSES] } },
    fields: [...REQUEST_FIELDS, "revertedAt"],
    populate: { revertedBy: ACTOR },
    identifier: requestNumber,
    title: ownTitle,
    actor: "revertedBy",
  },
  {
    kind: "questionnaire-generated",
    uid: QUESTIONNAIRE_UID,
    timestamp: "generatedDate",
    filters: { generatedDate: { $notNull: true } },
    fields: [...QUESTIONNAIRE_FIELDS, "generatedDate"],
    populate: null,
    identifier: questionnaireNumber,
    title: ownTitle,
    actor: null,
  },
  {
    kind: "questionnaire-released",
    uid: QUESTIONNAIRE_UID,
    timestamp: "releasedAt",
    filters: { releasedAt: { $notNull: true } },
    fields: [...QUESTIONNAIRE_FIELDS, "releasedAt"],
    populate: { releasedBy: ACTOR },
    identifier: questionnaireNumber,
    title: ownTitle,
    actor: "releasedBy",
  },
  {
    kind: "questionnaire-returned-to-draft",
    uid: QUESTIONNAIRE_UID,
    timestamp: "revertedAt",
    filters: { revertedAt: { $notNull: true } },
    fields: [...QUESTIONNAIRE_FIELDS, "revertedAt"],
    populate: { revertedBy: ACTOR },
    identifier: questionnaireNumber,
    title: ownTitle,
    actor: "revertedBy",
  },
  {
    kind: "assessment-draft-generated",
    uid: ASSESSMENT_UID,
    timestamp: "generatedDate",
    filters: { generatedDate: { $notNull: true } },
    fields: [...ASSESSMENT_FIELDS, "generatedDate"],
    populate: { assessmentRequest: OWNING_REQUEST },
    identifier: assessmentNumber,
    title: requestTitle,
    actor: null,
  },
  {
    kind: "assessment-released",
    uid: ASSESSMENT_UID,
    timestamp: "approvalDate",
    // The complete release triple: approved, an approval date and an approver.
    filters: { approvalDate: { $notNull: true }, assessmentStatus: { $eq: "approved" }, approvedBy: { id: { $notNull: true } } },
    fields: [...ASSESSMENT_FIELDS, "approvalDate"],
    populate: { approvedBy: ACTOR, assessmentRequest: OWNING_REQUEST },
    identifier: assessmentNumber,
    title: requestTitle,
    actor: "approvedBy",
  },
]);

/** A non-empty string, or null. */
function presentText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredText(value: unknown): string {
  const text = presentText(value);
  if (text === null) throw new RecentActivityRepositoryError(DATA_INVALID);
  return text;
}

function actorDisplayName(value: unknown): string | null {
  return isRecord(value) ? presentText(value.displayName) : null;
}

function projectActivity(source: ActivitySource, document: RecordValue): ActivityItem {
  // The read filters on this timestamp, so a missing or malformed one is invalid data.
  const occurredAt = normalizeDateTime(document[source.timestamp]);
  if (occurredAt === null) throw new RecentActivityRepositoryError(DATA_INVALID);
  return {
    kind: source.kind,
    recordType: ACTIVITY_RECORD_TYPE[source.kind],
    documentId: requiredText(document.documentId),
    identifier: presentText(source.identifier(document)),
    title: presentText(source.title(document)),
    actorDisplayName: source.actor === null ? null : actorDisplayName(document[source.actor]),
    occurredAt: occurredAt.toISOString(),
  };
}

async function readSource(documents: (uid: string) => Documents, source: ActivitySource): Promise<ActivityItem[]> {
  const found = await documents(source.uid).findMany({
    filters: source.filters,
    fields: [...source.fields],
    ...(source.populate === null ? {} : { populate: source.populate }),
    sort: [`${source.timestamp}:desc`, "documentId:asc"],
    limit: SOURCE_LIMIT,
  });
  if (!Array.isArray(found) || found.length > SOURCE_LIMIT) throw new RecentActivityRepositoryError(DATA_INVALID);
  return found.map((document) => projectActivity(source, document));
}

/**
 * The newest events of every source, at most RECENT_ACTIVITY_LIMIT + 1 each.
 * Merge them with mergeRecentActivity.
 */
export async function readRecentActivityCandidates(strapi: unknown): Promise<ActivityItem[]> {
  if (!isRecord(strapi) || typeof strapi.documents !== "function") {
    throw new RecentActivityRepositoryError("CSRM recent activity is unavailable.");
  }
  const documents = strapi.documents as (uid: string) => Documents;
  const batches = await Promise.all(ACTIVITY_SOURCES.map((source) => readSource(documents, source)));
  return batches.flat();
}
