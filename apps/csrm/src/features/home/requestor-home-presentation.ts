import { FileTextIcon, HourglassIcon, ListChecksIcon, ShieldCheckIcon } from 'lucide-react';

import { assessmentRatings } from '../assessments/assessment-domain';
import type { AssessmentRating, ReleasedAssessmentSummary } from '../assessments/assessment-schema';
import { formatRequestDate, myRequestNextStep, requestHolderPresentation, type MyRequestItem, type MyRequestList, type NextActionPresentation, type RequestHolder } from '../requests/request-domain';
import type { HomeSectionCopy, HomeSectionLink } from './home-section';

/*
 * The Requestor Home's state and every word and destination it shows (UI-SPEC §5.2, §5.4). The server decides
 * each request's holder, stage, next step and age (D-19 to D-21); these functions only word, link and bound what
 * the reads carry, so no copy is assembled in JSX. The module is zod-free, so any client component can read it.
 */

/** One Home section's read: its data, or unavailable when that read alone failed. */
export type RequestorHomeSection<T> = { status: 'ready'; data: T } | { status: 'unavailable' };

/** The released section reads two things: the newest released assessments and the counts by overall rating. */
export type RequestorHomeReleased = {
  records: readonly ReleasedAssessmentSummary[];
  total: number;
  ratings: Record<AssessmentRating, number>;
};

export type RequestorHomeData = {
  needsAction: RequestorHomeSection<MyRequestList>;
  withAnalyst: RequestorHomeSection<MyRequestList>;
  released: RequestorHomeSection<RequestorHomeReleased>;
  /**
   * The Requestor's requests with notes new to them (D-24), from the status summary. 0 when that read failed or was
   * refused: the new-notes row is then absent and nothing else changes (13-UI-SPEC §12.3).
   */
  withUnreadNotes: number;
};

export type RequestorHomeState =
  | { kind: 'ready'; home: RequestorHomeData }
  | { kind: 'error' }
  | { kind: 'permission-denied' };

const noRequests: MyRequestList = { items: [], pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } };

/** The Home a Requestor with no request at all sees, and the empty fixture's safe data (D-23). */
export const emptyRequestorHome: RequestorHomeData = {
  needsAction: { status: 'ready', data: noRequests },
  withAnalyst: { status: 'ready', data: noRequests },
  released: { status: 'ready', data: { records: [], total: 0, ratings: { Low: 0, Moderate: 0, High: 0, Critical: 0 } } },
  withUnreadNotes: 0,
};

const countFormat = new Intl.NumberFormat('en-AU');

function formatCount(value: number): string {
  return countFormat.format(value);
}

/** A Home section's frame copy, its error noun, its empty states and the list its figures open. */
export type RequestorHomeSectionCopy = HomeSectionCopy & {
  /** Completes "We couldn’t load {noun}". */
  errorNoun: string;
  /** The list the section's total opens, filtered to exactly the section's records (D-35). */
  list: { name: string; href: string };
  /** How many items the section shows (D-19). */
  bound: number;
  /** "No {noun} yet": the Requestor has never had such a record; only Needs your action carries an action (UI-D18). */
  firstUse?: { noun: string; description: string; action?: HomeSectionLink };
  /** "No {noun}": the work is done; quiet, with no action (direction §4 Empty states). */
  cleared?: { noun: string; description: string };
};

/** Every word the Requestor Home shows (UI-SPEC §5.2, §5.4). */
export const requestorHomeCopy = {
  needsAction: {
    heading: 'Needs your action',
    headingId: 'requestor-home-needs-action-heading',
    icon: ListChecksIcon,
    description: 'Requests and questionnaires waiting for you.',
    errorNoun: 'requests waiting for you',
    list: { name: 'My requests', href: '/app/requests?holder=requestor' },
    bound: 10,
    firstUse: {
      noun: 'requests',
      description: 'Start a request when you plan a change that needs a cyber risk assessment.',
      action: { label: 'New request', href: '/app/requests/new' },
    },
    cleared: { noun: 'requests waiting for you', description: 'When a request or questionnaire needs you, it appears here.' },
  } satisfies RequestorHomeSectionCopy,
  withAnalyst: {
    heading: 'With the Security Analyst',
    headingId: 'requestor-home-with-analyst-heading',
    icon: HourglassIcon,
    description: 'Requests a Security Analyst is working on.',
    errorNoun: 'requests with the Security Analyst',
    list: { name: 'My requests', href: '/app/requests?holder=analyst' },
    bound: 5,
    cleared: { noun: 'requests with the Security Analyst', description: 'Requests appear here while a Security Analyst works on them.' },
  } satisfies RequestorHomeSectionCopy,
  released: {
    heading: 'Released assessments',
    headingId: 'requestor-home-released-heading',
    icon: ShieldCheckIcon,
    description: 'Your most recently released risk assessments.',
    errorNoun: 'released assessments',
    list: { name: 'My risk assessments', href: '/app/assessments' },
    bound: 5,
    firstUse: { noun: 'released risk assessments', description: 'Assessments appear here after a Security Analyst releases them.' },
    chipsLabel: 'Released assessments by overall rating',
    itemsLabel: 'Released risk assessments',
    releasedLead: 'Released',
    notRated: 'Not rated',
  } satisfies RequestorHomeSectionCopy & Record<'chipsLabel' | 'itemsLabel' | 'releasedLead' | 'notRated', string>,
  /** The skeleton's status name, shared with the analyst Home (§5.4). */
  loadingLabel: 'Loading Home',
  returnedLead: 'Returned to draft on',
  /** The page error, when every read failed (§5.4). */
  pageErrorNoun: 'your requests',
  /** A refused read. Home is where this renders, so a link back to Home would loop (UI-D19). */
  permission: { area: 'your requests', action: { label: 'Return to sign in', href: '/sign-in' } },
} as const;

/** The footer of a populated section: "Showing {shown} of {total}" when truncated, then "View all {total} in {list}". */
export function sectionFooter(copy: RequestorHomeSectionCopy, shown: number, total: number): { note: string | null; links: HomeSectionLink[] } {
  if (total === 0) return { note: null, links: [] };
  return {
    note: shown < total ? `Showing ${formatCount(shown)} of ${formatCount(total)}` : null,
    links: [{ label: `View all ${formatCount(total)} in ${copy.list.name}`, href: copy.list.href }],
  };
}

function requestHref(item: Pick<MyRequestItem, 'documentId'>): string {
  return `/app/requests/${encodeURIComponent(item.documentId)}`;
}

/* ------------------------------------------------------- New notes (D-17, D-24; 13-UI-SPEC §12.3) */

/** The new-notes row: a block link under the page header to My requests filtered to the requests with new notes. */
export type NewNotesRow = { label: string; href: string };

/**
 * `New notes on {n} {request|requests}`, opening the list whose total equals the figure (X-10), or null at zero: the
 * row is absent rather than a zero, because there is nothing new to act on (UI-D25).
 */
export function newNotesRow(withUnreadNotes: number): NewNotesRow | null {
  if (!Number.isSafeInteger(withUnreadNotes) || withUnreadNotes <= 0) return null;
  return {
    label: `New notes on ${formatCount(withUnreadNotes)} ${withUnreadNotes === 1 ? 'request' : 'requests'}`,
    href: '/app/requests?notes=unread',
  };
}

/** An item's X-17 marker: `{k} new {note|notes}`, a link to the request's thread named for the request. */
export type UnreadMarker = { text: string; label: string; href: string };

function unreadMarker(item: MyRequestItem): UnreadMarker | null {
  if (item.unreadNotes <= 0) return null;
  const text = `${formatCount(item.unreadNotes)} new ${item.unreadNotes === 1 ? 'note' : 'notes'}`;
  return { text, label: `${text} on ${item.requestNumber}`, href: `${requestHref(item)}#notes` };
}

/** Line 2 gains ` · Assigned to {name}` when a Security Analyst holds the request, and nothing otherwise (D-17). */
function withAssignee(caption: string, item: MyRequestItem): string {
  return item.assignee ? `${caption} · Assigned to ${item.assignee.displayName}` : caption;
}

export type NeedsActionItemView = {
  key: string;
  title: string;
  href: string;
  /** `{request number} · Due {due date}` or `{request number} · No due date`. */
  caption: string;
  /** The server's next step; it links only to somewhere the title does not already go (UI-D17). */
  nextStep: NextActionPresentation | null;
  /** A returned draft: when, as an instant the page shows in the viewer's zone, and the reason line, if any. */
  returned: { at: string; reasonText: string | null } | null;
  /** A questionnaire to answer: `{answered} of {total} answered` and the progress bar's name and value. */
  progress: { text: string; label: string; percent: number } | null;
  /** The notes new to the Requestor, below the item's last line (X-17). */
  unread: UnreadMarker | null;
};

/** A request or questionnaire waiting for the Requestor (UI-SPEC §5.2, Needs your action). */
export function needsActionItemView(item: MyRequestItem): NeedsActionItemView {
  const href = requestHref(item);
  const due = formatRequestDate(item.dueDate);
  const nextStep = myRequestNextStep(item);
  const progress = item.questionnaire;

  return {
    key: item.documentId,
    title: item.title,
    href,
    caption: withAssignee(`${item.requestNumber} · ${due ? `Due ${due}` : 'No due date'}`, item),
    nextStep: nextStep && nextStep.href === href ? { summary: nextStep.summary } : nextStep,
    returned: item.returned ? { at: item.returned.at, reasonText: item.returned.reason ? `Reason: ${item.returned.reason}` : null } : null,
    progress: progress ? {
      text: `${formatCount(progress.answered)} of ${formatCount(progress.total)} answered`,
      label: `${formatCount(progress.answered)} of ${formatCount(progress.total)} questions answered`,
      percent: progress.total === 0 ? 0 : Math.round((Math.min(progress.answered, progress.total) / progress.total) * 100),
    } : null,
    unread: unreadMarker(item),
  };
}

/**
 * Whether the Requestor has no request at all, so Needs your action offers New request rather than its cleared
 * state (UI-D18). Every request is held by the Requestor, by the Security Analyst, or by no one once its
 * assessment is released (D-20), so three known empty sections mean no request. An unavailable section is not
 * known to be empty, and the Home then shows the cleared state, which offers no action it cannot stand behind.
 */
export function isFirstUse(home: RequestorHomeData): boolean {
  return home.needsAction.status === 'ready' && home.needsAction.data.pagination.total === 0
    && home.withAnalyst.status === 'ready' && home.withAnalyst.data.pagination.total === 0
    && home.released.status === 'ready' && home.released.data.total === 0;
}

/** How long ago a request was submitted, from the server's whole days since submission (UI-SPEC §5.2). */
export function submittedAgo(days: number): string {
  if (days === 0) return 'Submitted today';
  return days === 1 ? 'Submitted 1 day ago' : `Submitted ${formatCount(days)} days ago`;
}

export type WithAnalystItemView = {
  key: string;
  title: string;
  href: string;
  /** `{request number} · Submitted …`, or the number alone when the server has no submission date. */
  caption: string;
  /** The server's sentence naming the Security Analyst; never a link, because the Requestor does not hold the step. */
  sentence: string | null;
  /** The notes new to the Requestor, below the item's last line (X-17). */
  unread: UnreadMarker | null;
};

/** A request a Security Analyst is working on (UI-SPEC §5.2, With the Security Analyst; D-21). */
export function withAnalystItemView(item: MyRequestItem): WithAnalystItemView {
  return {
    key: item.documentId,
    title: item.title,
    href: requestHref(item),
    caption: withAssignee(item.daysSinceSubmission === null ? item.requestNumber : `${item.requestNumber} · ${submittedAgo(item.daysSinceSubmission)}`, item),
    sentence: myRequestNextStep(item)?.summary ?? null,
    unread: unreadMarker(item),
  };
}

export type ReleasedItemView = {
  key: string;
  assessmentNumber: string;
  href: string;
  requestTitle: string | null;
  /** The release instant, which the page shows as a date in the viewer's zone (D-55). */
  approvalDate: string | null;
  rating: AssessmentRating | null;
};

/** A released risk assessment of the Requestor's (UI-SPEC §5.2, Released assessments). */
export function releasedItemView(assessment: ReleasedAssessmentSummary): ReleasedItemView {
  return {
    key: assessment.documentId,
    assessmentNumber: assessment.assessmentNumber,
    href: `/app/assessments/${encodeURIComponent(assessment.documentId)}`,
    requestTitle: assessment.requestTitle,
    approvalDate: assessment.approvalDate,
    rating: assessment.overallRating,
  };
}

export type RatingChip = {
  rating: AssessmentRating;
  count: number;
  countText: string;
  /** My risk assessments filtered by this overall rating, whose total equals the count; null for a zero, which is plain (X-10). */
  href: string | null;
  /** `{Rating}: {n} released risk {assessment|assessments}` (UI-SPEC §8.1), beginning with the visible rating (WCAG 2.5.3). */
  accessibleName: string;
};

/** The four rating chips in the ladder's order, Low to Critical (UI-SPEC §5.2, D-35). */
export function ratingChipLinks(ratings: Record<AssessmentRating, number>): RatingChip[] {
  return assessmentRatings.map((rating) => {
    const count = ratings[rating];
    return {
      rating,
      count,
      countText: formatCount(count),
      href: count > 0 ? `/app/assessments?overallRating=${encodeURIComponent(rating)}` : null,
      accessibleName: `${rating}: ${formatCount(count)} released risk ${count === 1 ? 'assessment' : 'assessments'}`,
    };
  });
}

/* ------------------------------------------------------- The analyst Home's own requests */

/** Your own requests on the analyst Home (D-18 item 7, UI-SPEC §5.3). */
export const ownRequestsCopy = {
  heading: 'Your own requests',
  headingId: 'analyst-home-own-requests-heading',
  icon: FileTextIcon,
  description: 'Requests you raised yourself, as a Requestor.',
  /** Completes "We couldn’t load {noun}". */
  errorNoun: 'your own requests',
  links: [
    { label: 'View My requests', href: '/app/requests' },
    { label: 'New request', href: '/app/requests/new' },
  ],
} as const satisfies HomeSectionCopy & { errorNoun: string; links: readonly HomeSectionLink[] };

export type OwnRequestsRow = {
  key: Exclude<RequestHolder, 'none'>;
  label: string;
  count: number;
  countText: string;
  /** My requests filtered by this holder, whose total equals the count (D-35). */
  href: string;
  /** `{label}: {n} {request|requests}` (UI-SPEC §5.3), which begins with the visible label and count (SC 2.5.3). */
  accessibleName: string;
};

/**
 * The two link rows of Your own requests, from the status summary's byHolder: the requests waiting for the
 * analyst as a Requestor, then those with a Security Analyst. A zero row still renders, because a zero is data.
 * The labels are the Requestor Home's section names, so one vocabulary runs from Home to My requests.
 */
export function ownRequestsRows(byHolder: Record<RequestHolder, number>): OwnRequestsRow[] {
  return (['requestor', 'analyst'] as const).map((holder) => {
    const label = requestHolderPresentation[holder].label;
    const count = byHolder[holder];
    const countText = formatCount(count);
    return {
      key: holder,
      label,
      count,
      countText,
      href: `/app/requests?holder=${holder}`,
      accessibleName: `${label}: ${countText} ${count === 1 ? 'request' : 'requests'}`,
    };
  });
}
