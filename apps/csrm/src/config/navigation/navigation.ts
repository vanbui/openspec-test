import type { LucideIcon } from 'lucide-react';
import {
  BellIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FilePlus2Icon,
  FileTextIcon,
  HouseIcon,
  InboxIcon,
  LayersIcon,
  ServerIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Table2Icon,
  UserRoundCheckIcon,
} from 'lucide-react';

import { administrationConfig } from '@/features/administration/administration-config';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

import { pageHeadings } from './page-headings';

/*
 * Navigation is data (D-06, D-13): one profile per actor, as ordered sections of capability-gated items.
 * The shell renders whatever the chosen profile holds, so a later item, section or profile is an entry
 * here and never a component change.
 *
 * This is presentation only. Which links a person sees follows their granted capabilities, but seeing a
 * link authorises nothing: every route gate and every Strapi policy behind each destination still decides
 * what that person may read or do.
 */

/**
 * What a navigation item's count counts (D-10, UI-SPEC §1.3; 13 D-14). Only items that hold work carry one: the
 * Requestor's My requests (needs your action) and My questionnaires (to answer), and the analyst's Assigned to me
 * (the requests they hold that need them), Requests (those nobody has picked up), Alerts (overdue) and own My
 * requests (needs your action).
 */
export type NavigationCountKey =
  | 'myRequestsNeedingAction'
  | 'questionnairesToAnswer'
  | 'assignedToMeNeedingAction'
  | 'requestsWaitingForPickUp'
  | 'overdueAlerts';

/**
 * The figures behind the counts, by key. A key is absent while its read is refused or failed, and a zero is
 * kept as zero: the navigation shows neither, so it never shows a 0, a dash or an error (D-11).
 */
export type NavigationCounts = Partial<Record<NavigationCountKey, number>>;

export interface NavigationItem {
  href: string;
  label: string;
  capability: Capability;
  icon: LucideIcon;
  /** The count this item shows beside its label, when it holds work (D-10). */
  count?: NavigationCountKey;
}

/**
 * What a count means, as it follows the number in the link's name: "My requests, 3 need your action",
 * "Assigned to me, 1 needs your action", "Requests, 4 waiting for pick-up", "Alerts, 6 overdue",
 * "My questionnaires, 2 to answer" (UI-SPEC §1.3; 13-UI-SPEC §1).
 */
export function navigationCountMeaning(key: NavigationCountKey, count: number): string {
  switch (key) {
    case 'myRequestsNeedingAction':
    case 'assignedToMeNeedingAction':
      return count === 1 ? 'needs your action' : 'need your action';
    case 'questionnairesToAnswer':
      return 'to answer';
    case 'requestsWaitingForPickUp':
      return 'waiting for pick-up';
    case 'overdueAlerts':
      return 'overdue';
  }
}

/**
 * A collapsed section's figure (UI-SPEC §1.2): the sum of its items' known figures, each key once, or
 * undefined when none is known, so a section whose reads all failed shows no count.
 */
export function sectionNavigationCount(counts: NavigationCounts, items: readonly Pick<NavigationItem, 'count'>[]): number | undefined {
  let total: number | undefined;
  for (const key of new Set(items.flatMap((item) => (item.count ? [item.count] : [])))) {
    const value = counts[key];
    if (value !== undefined) total = (total ?? 0) + value;
  }
  return total;
}

/** A figure the navigation shows: a count above zero. Zero and an unknown figure show nothing (D-10, D-11). */
export function shownNavigationCount(value: number | undefined): number | null {
  return value !== undefined && value > 0 ? value : null;
}

/** An actor's primary action: a light-filled pill first in the navigation, never a current item (X-6, UI-D43). */
export type NavigationPrimaryAction = NavigationItem;

export interface NavigationSection {
  /** A stable key for the section; also the base of the collapsible group's element id. */
  id: string;
  /** The section's visible name, which also names its group; null for the unlabelled top section. */
  label: string | null;
  /** A section of personal or occasional work may collapse; it opens itself on one of its own pages. */
  collapsible?: { defaultCollapsed: boolean };
  /**
   * How the section's links prefetch: the router's default unless `'intent'`, which fetches a destination
   * only on pointer enter or focus, for occasional destinations (UI-D8).
   */
  prefetch?: 'intent';
  items: readonly NavigationItem[];
}

export interface NavigationProfile {
  primaryAction?: NavigationPrimaryAction;
  sections: readonly NavigationSection[];
}

const homeHref = '/app';

/*
 * Every label is the heading of the page it opens (D-09): a pageHeadings entry, or for Reference data
 * the collection's pluralLabel, which its own heading reads.
 */
const home: NavigationItem = { href: homeHref, label: pageHeadings.home, capability: 'assessment-request:read', icon: HouseIcon };
/* The Requestor's My requests and the analyst's own both count the requests whose next action is theirs (D-10). */
const myRequests: NavigationItem = { href: '/app/requests', label: pageHeadings.myRequests, capability: 'assessment-request:read', icon: FileTextIcon, count: 'myRequestsNeedingAction' };
const newRequest: NavigationItem = { href: '/app/requests/new', label: pageHeadings.newRequest, capability: 'assessment-request:create', icon: FilePlus2Icon };

/** The Requestor: New request first, then Home, then their own work (D-07, UI-SPEC §1.1). */
export const requestorNavigationProfile: NavigationProfile = {
  primaryAction: newRequest,
  sections: [
    { id: 'top', label: null, items: [home] },
    {
      id: 'my-work',
      label: 'My work',
      items: [
        myRequests,
        { href: '/app/questionnaires', label: pageHeadings.myQuestionnaires, capability: 'assessment-request:read', icon: ClipboardListIcon, count: 'questionnairesToAnswer' },
        { href: '/app/assessments', label: pageHeadings.myRiskAssessments, capability: 'assessment-request:read', icon: ShieldCheckIcon },
      ],
    },
  ],
};

/**
 * The Security Analyst: Home, then the review work, oversight and reference data, with the analyst's own
 * requests last and collapsed, so no personal item sits above the review work (D-08, UI-SPEC §1.1).
 */
export const analystNavigationProfile: NavigationProfile = {
  sections: [
    { id: 'top', label: null, items: [home] },
    {
      id: 'assessment-work',
      label: 'Assessment work',
      items: [
        // The work the viewer holds, first, then the team's pool of requests nobody has picked up (D-14).
        { href: '/app/review/assigned', label: pageHeadings.assignedToMe, capability: 'assessment:review', icon: UserRoundCheckIcon, count: 'assignedToMeNeedingAction' },
        { href: '/app/review/requests', label: pageHeadings.reviewRequests, capability: 'assessment:review', icon: InboxIcon, count: 'requestsWaitingForPickUp' },
        { href: '/app/review/questionnaires', label: pageHeadings.reviewQuestionnaires, capability: 'assessment:review', icon: ClipboardCheckIcon },
        { href: '/app/review/assessments', label: pageHeadings.reviewAssessments, capability: 'assessment:review', icon: ShieldAlertIcon },
      ],
    },
    {
      id: 'oversight',
      label: 'Oversight',
      items: [
        { href: '/app/risks', label: pageHeadings.riskRegister, capability: 'risk:manage', icon: Table2Icon },
        { href: '/app/alerts', label: pageHeadings.alerts, capability: 'assessment:review', icon: BellIcon, count: 'overdueAlerts' },
        { href: '/app/reports', label: pageHeadings.reports, capability: 'assessment:review', icon: FileChartColumnIcon },
      ],
    },
    {
      id: 'reference-data',
      label: 'Reference data',
      prefetch: 'intent',
      items: [
        { href: '/app/admin/risk-types', label: administrationConfig['risk-types'].pluralLabel, capability: 'administration:manage', icon: LayersIcon },
        { href: '/app/admin/controls', label: administrationConfig.controls.pluralLabel, capability: 'administration:manage', icon: SlidersHorizontalIcon },
        { href: '/app/admin/information-systems', label: administrationConfig['information-systems'].pluralLabel, capability: 'administration:manage', icon: ServerIcon },
        { href: '/app/admin/information-assets', label: administrationConfig['information-assets'].pluralLabel, capability: 'administration:manage', icon: DatabaseIcon },
      ],
    },
    {
      id: 'own-requests',
      label: 'My own requests',
      collapsible: { defaultCollapsed: true },
      items: [myRequests, newRequest],
    },
  ],
};

/**
 * The profile for a viewer, chosen from their capabilities: the Security Analyst's for `assessment:review`,
 * otherwise the Requestor's (D-06). Presentation only; it grants nothing.
 */
export function navigationProfileFor(granted: ReadonlySet<Capability>): NavigationProfile {
  return can('assessment:review', granted) ? analystNavigationProfile : requestorNavigationProfile;
}

/**
 * Every item of every section, collapsed sections included, in order. The primary action is not an item,
 * so it never competes for the current item. Feed the visible ones to activeNavigationHref.
 */
export function profileItems(profile: NavigationProfile): readonly NavigationItem[] {
  return profile.sections.flatMap((section) => section.items);
}

/**
 * The one item to mark current: the item whose href is the longest match of the pathname at a path
 * segment boundary, so `/app/requests/new` is New request alone and `/app/review/requests/{id}` is
 * Requests alone. Home (`/app`) matches only itself, so a route no item lists marks
 * nothing current. Pass the items the viewer can see.
 */
export function activeNavigationHref(pathname: string, items: readonly Pick<NavigationItem, 'href'>[]): string | null {
  let active: string | null = null;

  for (const { href } of items) {
    const matches = href === homeHref
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

    if (matches && (active === null || href.length > active.length)) active = href;
  }

  return active;
}
