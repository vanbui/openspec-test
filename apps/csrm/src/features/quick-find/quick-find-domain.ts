import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import { QUICK_FIND_MAX_TERM_LENGTH } from './quick-find-constants';

export { QUICK_FIND_MAX_TERM_LENGTH } from './quick-find-constants';

/*
 * Quick find's vocabulary (UX-10; D-49, D-50; UI-SPEC §4.2, §4.3), free of zod so the dialog and the header control
 * read it without downloading the validation library (plan 08-13). The Server Action builds its results from these
 * kinds; the dialog renders them. Nothing here reads a record, and capabilities only choose which lists are asked:
 * Strapi scopes every read, so navigation visibility is never authorisation.
 */

/** One group per list quick find can search, each mirroring a sidebar list (UI-D11). */
export const quickFindGroupKinds = [
  'review-requests',
  'review-questionnaires',
  'review-assessments',
  'risks',
  'my-requests',
  'my-questionnaires',
  'my-assessments',
] as const;
export type QuickFindGroupKind = (typeof quickFindGroupKinds)[number];

/** Whose searches run: the Security Analyst's review lists, or a Requestor's own lists (UI-SPEC §4.2). */
export type QuickFindViewer = 'requestor' | 'analyst';

/** One result: display fields and an href only, never a record (D-49). */
export interface QuickFindOption {
  readonly id: string;
  readonly href: string;
  /** `{identifier} · {name}` (X-4). */
  readonly primary: string;
  /** The status label (with who holds an analyst's request), or a Risk's residual rating and stage. */
  readonly secondary: string;
}

/** One list's matches: at most five options, the list's served total and, above five, a link to the whole list. */
export interface QuickFindGroup {
  readonly kind: QuickFindGroupKind;
  readonly label: string;
  readonly total: number;
  /** `failed` when the list could not be searched; it then carries no option (D-53). */
  readonly status: 'ok' | 'failed';
  readonly options: readonly QuickFindOption[];
  readonly showAllHref?: string;
}

export interface QuickFindResult {
  /** The trimmed term the groups answer, so the dialog applies only the latest term's result (D-50). */
  readonly term: string;
  /** Includes successful empty lists for failure classification; the dialog omits their headings. */
  readonly groups: readonly QuickFindGroup[];
}

/** The term, trimmed, is searched from 2 to 100 characters (D-49, UI-SPEC §4.4); the input's maxLength is 100. */
export const QUICK_FIND_MIN_TERM_LENGTH = 2;
/** Options shown per group (D-50). */
export const QUICK_FIND_GROUP_SIZE = 5;
/** The pause after the last keystroke before a search is sent (D-50: about 250ms). */
export const QUICK_FIND_DEBOUNCE_MS = 250;

/** Each group is labelled as its sidebar item (UI-SPEC §4.2, UI-D11). */
export const quickFindGroupLabels: Readonly<Record<QuickFindGroupKind, string>> = {
  'review-requests': 'Requests',
  'review-questionnaires': 'Questionnaires',
  'review-assessments': 'Risk assessments',
  risks: 'Risk register',
  'my-requests': 'My requests',
  'my-questionnaires': 'My questionnaires',
  'my-assessments': 'My risk assessments',
};

const requestorGroups: readonly QuickFindGroupKind[] = ['my-requests', 'my-questionnaires', 'my-assessments'];

/*
 * Each group's whole list, filtered by the term (UI-SPEC §4.3): its Show all destination. Requests opens the All
 * requests view, because quick find searched every queue.
 */
const showAllPaths: Readonly<Record<QuickFindGroupKind, string>> = {
  'review-requests': '/app/review/requests?queue=all&q=',
  'review-questionnaires': '/app/review/questionnaires?q=',
  'review-assessments': '/app/review/assessments?q=',
  risks: '/app/risks?q=',
  'my-requests': '/app/requests?q=',
  'my-questionnaires': '/app/questionnaires?q=',
  'my-assessments': '/app/assessments?q=',
};

/** Whose searches the viewer's grants choose: the analyst's when they hold assessment:review. */
export function quickFindViewer(granted: ReadonlySet<Capability>): QuickFindViewer {
  return can('assessment:review', granted) ? 'analyst' : 'requestor';
}

/** The lists quick find asks for this viewer, in the sidebar's order (UI-SPEC §4.2). A list it cannot read is never asked. */
export function quickFindGroupsFor(granted: ReadonlySet<Capability>): readonly QuickFindGroupKind[] {
  if (!can('assessment-request:read', granted)) return [];
  if (!can('assessment:review', granted)) return requestorGroups;
  // An analyst's own requests may also appear in Requests; each group mirrors its list, so neither drops it (UI-D11).
  return [
    'review-requests',
    'review-questionnaires',
    'review-assessments',
    ...(can('risk:manage', granted) ? (['risks'] as const) : []),
    'my-requests',
  ];
}

/** The group's list filtered by the term, for `Show all {total} in {label}` (UI-SPEC §4.3, UI-D15). */
export function quickFindShowAllHref(kind: QuickFindGroupKind, term: string): string {
  return `${showAllPaths[kind]}${encodeURIComponent(term)}`;
}

const countFormat = new Intl.NumberFormat('en-AU');

/** A count's figure, grouped as every list's total is, and its noun: `12` and `matches`, `1` and `match`. */
export function matchCount(count: number): { figure: string; noun: 'match' | 'matches' } {
  return { figure: countFormat.format(count), noun: count === 1 ? 'match' : 'matches' };
}

/** `{n} match` or `{n} matches`. */
export function matchCountLabel(count: number): string {
  const { figure, noun } = matchCount(count);
  return `${figure} ${noun}`;
}

/** The last option of a group holding more than five: `Show all {total} in {group label}` (UI-SPEC §4.3). */
export function quickFindShowAllLabel(group: QuickFindGroup): string {
  return `Show all ${matchCount(group.total).figure} in ${group.label}`;
}

/*
 * Every line quick find's states show or announce (D-53, UI-SPEC §4.4), in one place so the dialog and its tests read
 * the same words. A failure names the list, never its cause (T-11-47).
 */
export const quickFindMessages = {
  /** Below two characters, the list area's first line; the actor's description follows it. */
  hint: 'Type 2 or more characters of a number or title.',
  /** A completed search with no option, at the 500 weight. */
  noMatches: (term: string) => `No matches for “${term}”`,
  noMatchesDetail: 'Check the number, or try a word from the title. Only records you can open are searched.',
  noMatchesAnnouncement: (term: string) => `No matches for ${term}`,
  /** Under a failed list's heading. */
  groupFailed: (label: string) => `We couldn’t search ${label} just now.`,
  /** Every list failed, or the search itself (or, in the header control, the dialog's code) could not run. */
  unavailable: 'Search isn’t available right now.',
  unavailableDetail: 'Try again in a moment.',
  retry: 'Retry search',
} as const;

/** What one completed search came to in the dialog: the action's groups, or nothing at all when search itself failed. */
export type QuickFindOutcome = QuickFindResult | { readonly term: string; readonly unavailable: true };

/** The state a completed search shows (UI-SPEC §4.4). */
export type QuickFindOutcomeState = 'results' | 'no-matches' | 'unavailable';

/*
 * A search is unavailable when the action refused or threw, or every readable list failed. Successful empty
 * lists still answered, so a failed list beside them is a partial failure. Only an entirely successful empty
 * search shows the no-matches state; partial failures keep their named heading and retry option.
 */
export function quickFindOutcomeState(outcome: QuickFindOutcome): QuickFindOutcomeState {
  if ('unavailable' in outcome) return 'unavailable';
  if (outcome.groups.length === 0) return 'no-matches';
  if (outcome.groups.every((group) => group.status === 'failed')) return 'unavailable';
  return outcome.groups.every((group) => group.status === 'ok' && group.total === 0) ? 'no-matches' : 'results';
}

const listFormat = new Intl.ListFormat('en-AU', { style: 'long', type: 'conjunction' });

/** What the polite region says once a search completes, once per search (UI-SPEC §4.4). */
export function quickFindAnnouncement(outcome: QuickFindOutcome | null): string {
  if (!outcome) return '';
  const state = quickFindOutcomeState(outcome);
  if (state === 'unavailable' || 'unavailable' in outcome) return quickFindMessages.unavailable;
  if (state === 'no-matches') return quickFindMessages.noMatchesAnnouncement(outcome.term);
  const found = matchCountLabel(outcome.groups.reduce((sum, group) => sum + (group.status === 'ok' ? group.total : 0), 0));
  const failed = outcome.groups.filter((group) => group.status === 'failed').map((group) => group.label);
  return failed.length === 0 ? found : `${found}. ${listFormat.format(failed)} couldn’t be searched.`;
}

/** What quick find searches, by viewer: the dialog's description (UI-SPEC §4.2). */
export function quickFindDescription(viewer: QuickFindViewer): string {
  return viewer === 'analyst'
    ? 'Find a request, questionnaire, risk assessment or Risk by its number or title.'
    : 'Find one of your requests, questionnaires or risk assessments by its number or title.';
}

/** Whether a typed value, once trimmed, is a term quick find searches. */
export function isSearchableTerm(value: string): boolean {
  const term = value.trim();
  return term.length >= QUICK_FIND_MIN_TERM_LENGTH && term.length <= QUICK_FIND_MAX_TERM_LENGTH;
}

/**
 * An analyst request option's line 2 (D-13, 13-UI-SPEC §4): its status, then who holds it, as the queue's own
 * projection names them: `Submitted · Assigned to Bob Doe` or `Submitted · Not picked up`.
 */
export function quickFindRequestLine(status: string, assignee: { readonly displayName: string } | null): string {
  return `${status} · ${assignee ? `Assigned to ${assignee.displayName}` : 'Not picked up'}`;
}
