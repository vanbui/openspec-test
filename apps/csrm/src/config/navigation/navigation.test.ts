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
import { describe, expect, it } from 'vitest';

import { administrationConfig, administrationKinds } from '@/features/administration/administration-config';
import type { Capability } from '@/lib/capabilities/capability-adapter';

import {
  activeNavigationHref,
  analystNavigationProfile,
  navigationCountMeaning,
  navigationProfileFor,
  profileItems,
  requestorNavigationProfile,
  sectionNavigationCount,
  type NavigationProfile,
} from './navigation';
import { pageHeadings, routeTitle } from './page-headings';

const requestorGranted = new Set<Capability>(['assessment-request:create', 'assessment-request:read']);
const analystGranted = new Set<Capability>([
  'assessment-request:create',
  'assessment-request:read',
  'assessment:review',
  'risk:manage',
  'administration:manage',
]);

/*
 * D-09, UI-SPEC §2.1 (UAT-002): a sidebar label is the level-one heading of the page it opens, so a
 * person who clicks "Requests" lands on "Requests". The expected headings are the contract's own
 * table, written out here, not read back from the module under test.
 */
const contractHeadings = new Map<string, string>([
  ['/app', 'Home'],
  ['/app/requests', 'My requests'],
  ['/app/questionnaires', 'My questionnaires'],
  ['/app/assessments', 'My risk assessments'],
  ['/app/requests/new', 'New request'],
  ['/app/review/assigned', 'Assigned to me'],
  ['/app/review/requests', 'Requests'],
  ['/app/review/questionnaires', 'Questionnaires'],
  ['/app/review/assessments', 'Risk assessments'],
  ['/app/risks', 'Risk register'],
  ['/app/alerts', 'Alerts'],
  ['/app/reports', 'Reports'],
  ['/app/admin/risk-types', 'Risk Types'],
  ['/app/admin/controls', 'Controls'],
  ['/app/admin/information-systems', 'Information Systems'],
  ['/app/admin/information-assets', 'Information Assets'],
]);

/** A profile as [section label, [item label, href, capability, icon][]] rows, for comparing with the contract. */
function outline(profile: NavigationProfile) {
  return profile.sections.map((section) => ({
    id: section.id,
    label: section.label,
    collapsible: section.collapsible ?? null,
    items: section.items.map((item) => [item.label, item.href, item.capability, item.icon]),
  }));
}

describe('page headings (D-09, UI-SPEC §2.1)', () => {
  it('holds one heading per navigation destination, in the contract’s casing', () => {
    expect(pageHeadings).toEqual({
      home: 'Home',
      myRequests: 'My requests',
      newRequest: 'New request',
      myQuestionnaires: 'My questionnaires',
      myRiskAssessments: 'My risk assessments',
      assignedToMe: 'Assigned to me',
      reviewRequests: 'Requests',
      reviewQuestionnaires: 'Questionnaires',
      reviewAssessments: 'Risk assessments',
      riskRegister: 'Risk register',
      alerts: 'Alerts',
      reports: 'Reports',
    });
  });

  it('titles a route "{heading} | IdamBox CSRM"', () => {
    expect(routeTitle('My requests')).toBe('My requests | IdamBox CSRM');
    expect(routeTitle(pageHeadings.riskRegister)).toBe('Risk register | IdamBox CSRM');
  });
});

describe('navigation profiles (D-06 to D-08, UI-SPEC §1.1)', () => {
  it('chooses the Security Analyst profile for assessment:review, otherwise the Requestor profile', () => {
    expect(navigationProfileFor(analystGranted)).toBe(analystNavigationProfile);
    expect(navigationProfileFor(new Set<Capability>(['assessment:review']))).toBe(analystNavigationProfile);
    expect(navigationProfileFor(requestorGranted)).toBe(requestorNavigationProfile);
    expect(navigationProfileFor(new Set<Capability>(['assessment-request:read', 'risk:manage', 'administration:manage']))).toBe(requestorNavigationProfile);
    expect(navigationProfileFor(new Set<Capability>())).toBe(requestorNavigationProfile);
  });

  it('gives the Requestor the New request primary action, then Home, then My work', () => {
    const profile = navigationProfileFor(requestorGranted);

    expect(profile.primaryAction).toEqual({
      href: '/app/requests/new',
      label: 'New request',
      capability: 'assessment-request:create',
      icon: FilePlus2Icon,
    });
    expect(outline(profile)).toEqual([
      { id: 'top', label: null, collapsible: null, items: [['Home', '/app', 'assessment-request:read', HouseIcon]] },
      {
        id: 'my-work',
        label: 'My work',
        collapsible: null,
        items: [
          ['My requests', '/app/requests', 'assessment-request:read', FileTextIcon],
          ['My questionnaires', '/app/questionnaires', 'assessment-request:read', ClipboardListIcon],
          ['My risk assessments', '/app/assessments', 'assessment-request:read', ShieldCheckIcon],
        ],
      },
    ]);
  });

  it('gives the Security Analyst Home, Assessment work, Oversight, Reference data, then a collapsed My own requests', () => {
    const profile = navigationProfileFor(analystGranted);

    expect(profile.primaryAction).toBeUndefined();
    expect(outline(profile)).toEqual([
      { id: 'top', label: null, collapsible: null, items: [['Home', '/app', 'assessment-request:read', HouseIcon]] },
      {
        id: 'assessment-work',
        label: 'Assessment work',
        collapsible: null,
        items: [
          // D-14 (13-UI-SPEC §1): the work the viewer holds comes first, then the team's pick-up pool.
          ['Assigned to me', '/app/review/assigned', 'assessment:review', UserRoundCheckIcon],
          ['Requests', '/app/review/requests', 'assessment:review', InboxIcon],
          ['Questionnaires', '/app/review/questionnaires', 'assessment:review', ClipboardCheckIcon],
          ['Risk assessments', '/app/review/assessments', 'assessment:review', ShieldAlertIcon],
        ],
      },
      {
        id: 'oversight',
        label: 'Oversight',
        collapsible: null,
        items: [
          ['Risk register', '/app/risks', 'risk:manage', Table2Icon],
          ['Alerts', '/app/alerts', 'assessment:review', BellIcon],
          ['Reports', '/app/reports', 'assessment:review', FileChartColumnIcon],
        ],
      },
      {
        id: 'reference-data',
        label: 'Reference data',
        collapsible: null,
        items: [
          ['Risk Types', '/app/admin/risk-types', 'administration:manage', LayersIcon],
          ['Controls', '/app/admin/controls', 'administration:manage', SlidersHorizontalIcon],
          ['Information Systems', '/app/admin/information-systems', 'administration:manage', ServerIcon],
          ['Information Assets', '/app/admin/information-assets', 'administration:manage', DatabaseIcon],
        ],
      },
      {
        id: 'own-requests',
        label: 'My own requests',
        collapsible: { defaultCollapsed: true },
        items: [
          ['My requests', '/app/requests', 'assessment-request:read', FileTextIcon],
          ['New request', '/app/requests/new', 'assessment-request:create', FilePlus2Icon],
        ],
      },
    ]);
  });

  it('puts no personal item above the analyst’s review work (ROADMAP success criterion 1)', () => {
    const labels = analystNavigationProfile.sections.map((section) => section.label);
    const ownIndex = labels.indexOf('My own requests');
    expect(ownIndex).toBe(labels.length - 1);
    expect(labels.indexOf('Assessment work')).toBeLessThan(ownIndex);
    const beforeReview = analystNavigationProfile.sections.slice(0, labels.indexOf('Assessment work')).flatMap((section) => section.items);
    expect(beforeReview.map((item) => item.label)).toEqual(['Home']);
  });

  it('holds no analyst item in the Requestor profile (T-11-18)', () => {
    const capabilities = new Set(profileItems(requestorNavigationProfile).map((item) => item.capability));
    expect([...capabilities].sort()).toEqual(['assessment-request:read']);
    expect(requestorNavigationProfile.primaryAction?.capability).toBe('assessment-request:create');
  });

  it('gives every actor Home, so no navigation is empty', () => {
    for (const profile of [requestorNavigationProfile, analystNavigationProfile]) {
      expect(profile.sections[0]).toMatchObject({ id: 'top', label: null });
      expect(profile.sections[0].items.map((item) => item.href)).toEqual(['/app']);
    }
  });

  it('lists every item of every section, collapsed ones included, for the current-item rule', () => {
    expect(profileItems(analystNavigationProfile).map((item) => item.href)).toEqual([
      '/app',
      '/app/review/assigned',
      '/app/review/requests',
      '/app/review/questionnaires',
      '/app/review/assessments',
      '/app/risks',
      '/app/alerts',
      '/app/reports',
      '/app/admin/risk-types',
      '/app/admin/controls',
      '/app/admin/information-systems',
      '/app/admin/information-assets',
      '/app/requests',
      '/app/requests/new',
    ]);
    // The primary action is not a navigation item, so it never competes for the current item (UI-D43).
    expect(profileItems(requestorNavigationProfile).map((item) => item.href)).toEqual([
      '/app',
      '/app/requests',
      '/app/questionnaires',
      '/app/assessments',
    ]);
  });
});

describe('the current item over a profile (D-06)', () => {
  it.each([
    ['/app/review/assigned', '/app/review/assigned'],
    ['/app/review/requests/abc', '/app/review/requests'],
    ['/app/review/assessments/assessment-9', '/app/review/assessments'],
    ['/app/requests/new', '/app/requests/new'],
    ['/app/requests/request-7/edit', '/app/requests'],
    ['/app/admin/controls/control-3', '/app/admin/controls'],
    ['/app', '/app'],
  ])('marks the analyst’s longest match on %s', (pathname, expected) => {
    expect(activeNavigationHref(pathname, profileItems(analystNavigationProfile))).toBe(expected);
  });

  it.each([
    ['/app/requests/new', '/app/requests'],
    ['/app/requests', '/app/requests'],
    ['/app/questionnaires/q-1', '/app/questionnaires'],
    ['/app/review/requests', null],
  ])('marks the Requestor’s longest match on %s', (pathname, expected) => {
    expect(activeNavigationHref(pathname, profileItems(requestorNavigationProfile))).toBe(expected);
  });
});

describe('navigation labels equal their page headings (D-09)', () => {
  const profiles = [requestorNavigationProfile, analystNavigationProfile];
  const everyEntry = profiles.flatMap((profile) => [
    ...(profile.primaryAction ? [profile.primaryAction] : []),
    ...profileItems(profile),
  ]);

  it('labels every item and primary action with the heading of the page it opens', () => {
    for (const entry of everyEntry) {
      expect(contractHeadings.get(entry.href), `${entry.href} is a navigation destination`).toBeDefined();
      expect(entry.label, entry.href).toBe(contractHeadings.get(entry.href));
    }
    expect(new Set(everyEntry.map((entry) => entry.href))).toEqual(new Set(contractHeadings.keys()));
  });

  it('reads each label from the one heading its page renders', () => {
    const headings = new Set<string>(Object.values(pageHeadings));
    const adminHeadings = new Map<string, string>(administrationKinds.map((kind) => [administrationConfig[kind].listPath, administrationConfig[kind].pluralLabel]));

    for (const entry of everyEntry) {
      if (entry.href.startsWith('/app/admin/')) expect(entry.label, entry.href).toBe(adminHeadings.get(entry.href));
      else expect(headings.has(entry.label), `${entry.href} reads pageHeadings`).toBe(true);
    }
  });

  it('keeps every label a short fixed string on one line', () => {
    for (const entry of everyEntry) {
      expect(entry.label).not.toMatch(/\n/);
      expect(entry.label.length, entry.label).toBeLessThanOrEqual(24);
    }
    for (const section of profiles.flatMap((profile) => profile.sections)) {
      if (section.label) expect(section.label.length, section.label).toBeLessThanOrEqual(24);
    }
  });
});

/** Each item that carries a count, as [section id, href, count key], in profile order. */
function countedItems(profile: NavigationProfile) {
  return profile.sections.flatMap((section) => section.items
    .filter((item) => item.count !== undefined)
    .map((item) => [section.id, item.href, item.count]));
}

describe('navigation counts (D-10, UI-SPEC §1.3)', () => {
  it('counts the Requestor’s My requests (needs your action) and My questionnaires (to answer) only', () => {
    expect(countedItems(requestorNavigationProfile)).toEqual([
      ['my-work', '/app/requests', 'myRequestsNeedingAction'],
      ['my-work', '/app/questionnaires', 'questionnairesToAnswer'],
    ]);
    expect(requestorNavigationProfile.primaryAction?.count).toBeUndefined();
  });

  it('counts the analyst’s Assigned to me (need your action), Requests (waiting for pick-up), Alerts (overdue) and own My requests (needs your action) only', () => {
    // D-14 (13-UI-SPEC §1): what needs the viewer, and what waits for anyone to pick it up.
    expect(countedItems(analystNavigationProfile)).toEqual([
      ['assessment-work', '/app/review/assigned', 'assignedToMeNeedingAction'],
      ['assessment-work', '/app/review/requests', 'requestsWaitingForPickUp'],
      ['oversight', '/app/alerts', 'overdueAlerts'],
      ['own-requests', '/app/requests', 'myRequestsNeedingAction'],
    ]);
  });

  it('gives each collapsible section’s counted items one meaning, so its collapsed button can show their sum', () => {
    for (const profile of [requestorNavigationProfile, analystNavigationProfile]) {
      for (const section of profile.sections.filter((entry) => entry.collapsible)) {
        expect(new Set(section.items.flatMap((item) => (item.count ? [item.count] : []))).size, section.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sums a section’s known figures once per key, and knows nothing when no figure is known', () => {
    const ownItems = analystNavigationProfile.sections.find((section) => section.id === 'own-requests')!.items;
    expect(sectionNavigationCount({ myRequestsNeedingAction: 2, overdueAlerts: 6 }, ownItems)).toBe(2);
    expect(sectionNavigationCount({ myRequestsNeedingAction: 0 }, ownItems)).toBe(0);
    expect(sectionNavigationCount({ overdueAlerts: 6 }, ownItems)).toBeUndefined();
    const twice = [{ count: 'overdueAlerts' as const }, { count: 'overdueAlerts' as const }, { count: 'requestsWaitingForPickUp' as const }, {}];
    expect(sectionNavigationCount({ overdueAlerts: 6, requestsWaitingForPickUp: 1 }, twice)).toBe(7);
  });

  it.each([
    ['myRequestsNeedingAction', 1, 'needs your action'],
    ['myRequestsNeedingAction', 3, 'need your action'],
    ['questionnairesToAnswer', 1, 'to answer'],
    ['questionnairesToAnswer', 2, 'to answer'],
    ['assignedToMeNeedingAction', 1, 'needs your action'],
    ['assignedToMeNeedingAction', 3, 'need your action'],
    ['requestsWaitingForPickUp', 1, 'waiting for pick-up'],
    ['requestsWaitingForPickUp', 4, 'waiting for pick-up'],
    ['overdueAlerts', 1, 'overdue'],
    ['overdueAlerts', 6, 'overdue'],
  ] as const)('says what %s counts at %i: "%s"', (key, count, meaning) => {
    expect(navigationCountMeaning(key, count)).toBe(meaning);
  });
});
