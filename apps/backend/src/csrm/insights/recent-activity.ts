/*
 * Recent activity for the analyst dashboard (DASH-01, UI-SPEC §2.5.1).
 *
 * Every event is a column-level timestamp that already exists on a request, a
 * questionnaire or a Risk Assessment (D-01). The repository reads each source
 * with its own bounded query; this module merges those reads into one feed,
 * newest first. It is pure: it makes no Strapi call and never reads the clock,
 * because the order depends only on the recorded instants (D-02).
 *
 * Questionnaire submission and governance-log events are not sources: neither
 * records both a column-level timestamp and an actor (07-RESEARCH §Q5).
 */
import { normalizeDateTime } from "./utc-date";

/** The closed workflow events, in the order UI-SPEC §2.5.1 lists them. */
export const ACTIVITY_KINDS = Object.freeze([
  "request-submitted",
  "request-returned-to-draft",
  "questionnaire-generated",
  "questionnaire-released",
  "questionnaire-returned-to-draft",
  "assessment-draft-generated",
  "assessment-released",
] as const);
export type ActivityKind = typeof ACTIVITY_KINDS[number];

/** The records an event can be about. */
export const ACTIVITY_RECORD_TYPES = Object.freeze(["assessment-request", "questionnaire", "assessment"] as const);
export type ActivityRecordType = typeof ACTIVITY_RECORD_TYPES[number];

/** The record type each kind of event is about. */
export const ACTIVITY_RECORD_TYPE: Readonly<Record<ActivityKind, ActivityRecordType>> = Object.freeze({
  "request-submitted": "assessment-request",
  "request-returned-to-draft": "assessment-request",
  "questionnaire-generated": "questionnaire",
  "questionnaire-released": "questionnaire",
  "questionnaire-returned-to-draft": "questionnaire",
  "assessment-draft-generated": "assessment",
  "assessment-released": "assessment",
});

export type ActivityItem = {
  kind: ActivityKind;
  recordType: ActivityRecordType;
  /** The documentId of the record the event is about. */
  documentId: string;
  /**
   * The request, questionnaire or assessment number. A questionnaire number is
   * optional in the datamodel, so it may be null; the title then carries the row.
   */
  identifier: string | null;
  /** The request title, the questionnaire title, or the owning request's title for an assessment. */
  title: string | null;
  /**
   * The display name of the identity the event names, or null. Generated drafts
   * name no one: AI output is advisory, and only a release names its Security Analyst.
   */
  actorDisplayName: string | null;
  /** The instant the event was recorded, as an ISO 8601 UTC date-time. */
  occurredAt: string;
};

export type RecentActivity = {
  /** At most `limit` events, newest first. */
  rows: ActivityItem[];
  /** True exactly when there were more events than `limit`. */
  truncated: boolean;
};

/* Code-unit comparison, as the database's BINARY collation and compareAlerts use. */
function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function instantOf(item: ActivityItem): number {
  const instant = normalizeDateTime(item.occurredAt);
  if (instant === null) throw new RangeError("An activity event must carry a valid occurredAt instant.");
  return instant.getTime();
}

/**
 * Merges the events of every source into one feed: newest first, then by kind,
 * then by documentId, so equal instants always order the same way whatever
 * order the sources arrive in. Keeps `limit` events and says whether there were
 * more. The input is never reordered in place.
 */
export function mergeRecentActivity(items: readonly ActivityItem[], limit: number): RecentActivity {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("limit must be a whole number, one or more.");
  const ordered = items
    .map((item) => ({ item, instant: instantOf(item) }))
    .sort((left, right) => right.instant - left.instant
      || compareCodeUnits(left.item.kind, right.item.kind)
      || compareCodeUnits(left.item.documentId, right.item.documentId));
  return { rows: ordered.slice(0, limit).map(({ item }) => item), truncated: items.length > limit };
}
