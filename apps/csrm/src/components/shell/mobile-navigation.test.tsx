/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BellIcon, FileTextIcon, HouseIcon, LayersIcon } from 'lucide-react';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn());
const prefetch = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ usePathname, useRouter: () => ({ prefetch, push: vi.fn() }) }));
/* The stand-in exposes the prefetch prop it was given, so a test can read which links prefetch by default. */
vi.mock('next/link', () => ({
  default: ({ children, prefetch: linkPrefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null }) => (
    <a data-prefetch={linkPrefetch === undefined ? 'default' : String(linkPrefetch)} {...props}>{children}</a>
  ),
}));

import {
  activeNavigationHref,
  type NavigationCounts,
  type NavigationItem,
  type NavigationProfile,
} from '../../config/navigation/navigation';
import { CapabilityNavigation, MobileNavigation } from './capability-navigation';

const granted = new Set([
  'assessment-request:create',
  'assessment-request:read',
  'assessment:review',
  'risk:manage',
] as const);

const analystGranted = new Set([...granted, 'administration:manage'] as const);

const requestorGranted = new Set(['assessment-request:create', 'assessment-request:read'] as const);

/*
 * Test-local items prove the current-item rule apart from the shipped profiles, which the
 * "sections" describes below pin.
 */
const localItems: readonly NavigationItem[] = [
  { href: '/app', label: 'Home', capability: 'assessment-request:read', icon: HouseIcon },
  { href: '/app/requests', label: 'My requests', capability: 'assessment-request:read', icon: FileTextIcon },
  { href: '/app/requests/new', label: 'New request', capability: 'assessment-request:create', icon: FileTextIcon },
  { href: '/app/review/requests', label: 'Requests', capability: 'assessment:review', icon: FileTextIcon },
  { href: '/app/alerts', label: 'Alerts', capability: 'assessment:review', icon: BellIcon },
  { href: '/app/reports', label: 'Reports', capability: 'assessment:review', icon: FileTextIcon },
  { href: '/app/admin/controls', label: 'Controls', capability: 'administration:manage', icon: LayersIcon },
];

function currentLinks() {
  return screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
}

function primaryNavigation(container: HTMLElement | Document = document) {
  return within(container as HTMLElement).getByRole('navigation', { name: 'Primary navigation' });
}

/** The visible groups' names and section buttons' labels inside the landmark, in DOM order. */
function sectionOutline(nav: HTMLElement) {
  return Array.from(nav.querySelectorAll<HTMLElement>('[role="group"]:not([hidden]), button[aria-expanded]'))
    .map((element) => element.getAttribute('aria-label') ?? (element.textContent ?? '').trim());
}

/** The links that sit outside every group, in DOM order. */
function ungroupedLinks(nav: HTMLElement) {
  return within(nav).getAllByRole('link').filter((link) => link.closest('[role="group"]') === null).map((link) => link.textContent);
}

describe('activeNavigationHref', () => {
  it.each([
    ['/app', '/app'],
    ['/app/requests', '/app/requests'],
    ['/app/requests/new', '/app/requests/new'],
    ['/app/requests/request-7', '/app/requests'],
    ['/app/review/requests', '/app/review/requests'],
    ['/app/review/requests/request-42', '/app/review/requests'],
    ['/app/alerts', '/app/alerts'],
    ['/app/reports/risk-exposure', '/app/reports'],
    ['/app/admin/controls/control-3', '/app/admin/controls'],
  ])('makes the longest matching item current for %s', (pathname, expected) => {
    expect(activeNavigationHref(pathname, localItems)).toBe(expected);
  });

  it('matches only at a path-segment boundary', () => {
    expect(activeNavigationHref('/app/requestsx', localItems)).toBeNull();
    expect(activeNavigationHref('/app/reviewer/requests', localItems)).toBeNull();
  });

  it('lets Home match only itself, so an unlisted route marks nothing current', () => {
    expect(activeNavigationHref('/app/unknown', localItems)).toBeNull();
    // The retired analyst dashboard address redirects to Home; no item claims it (D-17).
    expect(activeNavigationHref('/app/review', localItems)).toBeNull();
    expect(activeNavigationHref('/app/admin/controls', localItems.filter((item) => item.capability !== 'administration:manage'))).toBeNull();
  });
});

describe('the Security Analyst’s sections (D-08, UI-SPEC §1.1, §1.2)', () => {
  it('shows Home, then Assessment work, Oversight, Reference data and a collapsed My own requests, in that order', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={analystGranted} />);

    const nav = primaryNavigation();
    expect(sectionOutline(nav)).toEqual(['Assessment work', 'Oversight', 'Reference data', 'My own requests']);
    // No personal item sits above the review work: only Home is outside the sections.
    expect(ungroupedLinks(nav)).toEqual(['Home']);
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/app');

    const assessmentWork = within(nav).getByRole('group', { name: 'Assessment work' });
    expect(within(assessmentWork).getByText('Assessment work', { selector: 'p' })).toHaveClass('micro-label');
    expect(within(assessmentWork).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Assigned to me', '/app/review/assigned'],
      ['Requests', '/app/review/requests'],
      ['Questionnaires', '/app/review/questionnaires'],
      ['Risk assessments', '/app/review/assessments'],
    ]);

    const oversight = within(nav).getByRole('group', { name: 'Oversight' });
    expect(within(oversight).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Risk register', '/app/risks'],
      ['Alerts', '/app/alerts'],
      ['Reports', '/app/reports'],
    ]);

    const referenceData = within(nav).getByRole('group', { name: 'Reference data' });
    expect(within(referenceData).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Risk Types',
      'Controls',
      'Information Systems',
      'Information Assets',
    ]);
  });

  it('starts My own requests collapsed: a button naming its hidden group, which holds no link', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={analystGranted} />);

    const toggle = screen.getByRole('button', { name: 'My own requests' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const groupId = toggle.getAttribute('aria-controls');
    expect(groupId).toBeTruthy();
    const group = document.getElementById(groupId!);
    expect(group).not.toBeNull();
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-label', 'My own requests');
    expect(group).toHaveAttribute('hidden');
    expect(group!.querySelectorAll('a')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'My requests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New request' })).not.toBeInTheDocument();
  });

  it('renders a section only when the viewer can see one of its items', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={granted} />);

    expect(sectionOutline(primaryNavigation())).toEqual(['Assessment work', 'Oversight', 'My own requests']);
    expect(screen.queryByRole('group', { name: 'Reference data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Risk Types' })).not.toBeInTheDocument();
  });

  it('renders whatever sections a supplied profile holds, skipping one with no visible item (D-13)', () => {
    usePathname.mockReturnValue('/app');
    const profile: NavigationProfile = {
      sections: [
        { id: 'top', label: null, items: [localItems[0]] },
        { id: 'assigned', label: 'Assigned to me', items: [localItems[3]] },
        { id: 'admin-only', label: 'Admin only', items: [localItems[6]] },
      ],
    };

    render(<CapabilityNavigation granted={granted} profile={profile} />);

    expect(sectionOutline(primaryNavigation())).toEqual(['Assigned to me']);
    expect(screen.queryByRole('group', { name: 'Admin only' })).not.toBeInTheDocument();
    expect(ungroupedLinks(primaryNavigation())).toEqual(['Home']);
  });

  it.each([
    ['/app', 'Home'],
    ['/app/review/assigned', 'Assigned to me'],
    ['/app/review/requests', 'Requests'],
    ['/app/review/requests/request-42', 'Requests'],
    ['/app/review/assessments/assessment-9', 'Risk assessments'],
    ['/app/reports/risk-exposure', 'Reports'],
    ['/app/admin/controls/control-3', 'Controls'],
  ])('marks exactly one current item on %s', (pathname, label) => {
    usePathname.mockReturnValue(pathname);

    render(<CapabilityNavigation granted={analystGranted} />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });

  it('shows no Analyst dashboard, Workspace or Requestor work item', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={analystGranted} />);

    for (const name of ['Analyst dashboard', 'Workspace', 'My questionnaires', 'My risk assessments']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });
});

describe('the Requestor’s sections (D-07, UI-SPEC §1.1, §1.2)', () => {
  it('leads with the New request primary action, then Home, then My work', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={requestorGranted} />);

    const nav = primaryNavigation();
    const links = within(nav).getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('New request');
    expect(links[0]).toHaveAttribute('href', '/app/requests/new');
    expect(links[0]).toHaveClass('nav-primary-action');
    expect(links[0]).not.toHaveAttribute('aria-current');
    expect(links[1]).toHaveAccessibleName('Home');
    expect(ungroupedLinks(nav)).toEqual(['New request', 'Home']);
    expect(sectionOutline(nav)).toEqual(['My work']);

    const myWork = within(nav).getByRole('group', { name: 'My work' });
    expect(within(myWork).getByText('My work', { selector: 'p' })).toHaveClass('micro-label');
    expect(within(myWork).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['My requests', '/app/requests'],
      ['My questionnaires', '/app/questionnaires'],
      ['My risk assessments', '/app/assessments'],
    ]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers no primary action without the create capability', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={new Set(['assessment-request:read'] as const)} />);

    expect(screen.queryByRole('link', { name: 'New request' })).not.toBeInTheDocument();
    expect(ungroupedLinks(primaryNavigation())).toEqual(['Home']);
  });

  it('shows a Requestor no analyst section or item, and nothing current on an analyst URL', () => {
    usePathname.mockReturnValue('/app/alerts');

    render(<CapabilityNavigation granted={requestorGranted} />);

    for (const name of ['Oversight', 'Assessment work', 'Reference data', 'My own requests']) {
      expect(screen.queryByRole('group', { name })).not.toBeInTheDocument();
    }
    for (const name of ['Alerts', 'Reports', 'Assigned to me', 'Requests', 'Risk register', 'Analyst dashboard']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(currentLinks()).toHaveLength(0);
  });

  it.each([
    ['/app', 'Home'],
    ['/app/requests/request-7', 'My requests'],
    ['/app/questionnaires/q-1', 'My questionnaires'],
  ])('marks exactly one current item on %s', (pathname, label) => {
    usePathname.mockReturnValue(pathname);

    render(<CapabilityNavigation granted={requestorGranted} />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });
});

describe('the drawer renders the same profile (D-12)', () => {
  it('lists the analyst’s sections and the collapsed My own requests in the sheet', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={analystGranted} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    const nav = primaryNavigation(sheet);
    expect(sectionOutline(nav)).toEqual(['Assessment work', 'Oversight', 'Reference data', 'My own requests']);
    expect(ungroupedLinks(nav)).toEqual(['Home']);
    expect(within(sheet).getByRole('button', { name: 'My own requests' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(sheet).queryByRole('link', { name: 'Analyst dashboard' })).not.toBeInTheDocument();
    // D-14: the phone drawer leads Assessment work with the work the viewer holds, as the sidebar does.
    expect(within(within(nav).getByRole('group', { name: 'Assessment work' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Assigned to me', 'Requests', 'Questionnaires', 'Risk assessments']);
    expect(within(sheet).getByRole('link', { name: 'Assigned to me' })).toHaveAttribute('href', '/app/review/assigned');
  });

  it('keeps Close navigation first, then the Requestor’s New request, Home and My work', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={requestorGranted} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close navigation' }));
    await user.tab();
    expect(document.activeElement).toBe(within(sheet).getByRole('link', { name: 'New request' }));
    await user.tab();
    expect(document.activeElement).toBe(within(sheet).getByRole('link', { name: 'Home' }));
    expect(sectionOutline(primaryNavigation(sheet))).toEqual(['My work']);
  });
});

describe('the Requestor’s New request primary action (X-6, UI-D43)', () => {
  it.each(['/app', '/app/requests', '/app/requests/new', '/app/questionnaires/q-1'])('is the first element in the landmark and never current on %s', (pathname) => {
    usePathname.mockReturnValue(pathname);

    render(<CapabilityNavigation granted={requestorGranted} />);

    const nav = primaryNavigation();
    const action = within(nav).getByRole('link', { name: 'New request' });
    expect(nav.firstElementChild).toBe(action);
    expect(action).toHaveClass('nav-primary-action');
    expect(action).not.toHaveAttribute('aria-current');
    expect(action.querySelector('svg')).toHaveClass('nav-link-icon');
  });

  it('leaves My requests current on /app/requests/new', () => {
    usePathname.mockReturnValue('/app/requests/new');

    render(<CapabilityNavigation granted={requestorGranted} />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('My requests');
  });
});

describe('the analyst’s collapsible My own requests (D-08, UI-D7, UI-SPEC §1.4)', () => {
  function ownGroup() {
    const toggle = screen.getByRole('button', { name: 'My own requests' });
    return { toggle, group: document.getElementById(toggle.getAttribute('aria-controls') ?? '') };
  }

  it('toggles with Enter and Space, rendering its items only while open and keeping focus on the button', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<CapabilityNavigation granted={analystGranted} />);

    const { toggle, group } = ownGroup();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(group).toHaveAttribute('hidden');
    expect(group!.querySelectorAll('a')).toHaveLength(0);

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(group).not.toHaveAttribute('hidden');
    expect(within(group!).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['My requests', '/app/requests'],
      ['New request', '/app/requests/new'],
    ]);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.querySelector('svg')).toHaveClass('lucide-chevron-down');

    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(group).toHaveAttribute('hidden');
    expect(group!.querySelectorAll('a')).toHaveLength(0);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.querySelector('svg')).toHaveClass('lucide-chevron-right');
  });

  it('is a button of class nav-section-toggle, not a link', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={analystGranted} />);

    const { toggle } = ownGroup();
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveClass('nav-section-toggle');
  });

  it.each([
    ['/app/requests', 'My requests'],
    ['/app/requests/abc', 'My requests'],
    ['/app/requests/abc/edit', 'My requests'],
    ['/app/requests/new', 'New request'],
  ])('starts expanded on %s, with its item current', (pathname, label) => {
    usePathname.mockReturnValue(pathname);

    render(<CapabilityNavigation granted={analystGranted} />);

    const { toggle, group } = ownGroup();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(group).not.toHaveAttribute('hidden');
    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
    expect(group).toContainElement(current[0]);
  });

  it('opens itself on a client navigation to one of its items, and never closes itself', () => {
    usePathname.mockReturnValue('/app');
    const view = render(<CapabilityNavigation granted={analystGranted} />);
    expect(ownGroup().toggle).toHaveAttribute('aria-expanded', 'false');

    usePathname.mockReturnValue('/app/requests');
    view.rerender(<CapabilityNavigation granted={analystGranted} />);
    expect(ownGroup().toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'My requests' })).toHaveAttribute('aria-current', 'page');

    usePathname.mockReturnValue('/app/review/requests');
    view.rerender(<CapabilityNavigation granted={analystGranted} />);
    expect(ownGroup().toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute('aria-current', 'page');
  });

  it('starts collapsed again on a fresh mount: the state is never persisted', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();
    const view = render(<CapabilityNavigation granted={analystGranted} />);
    await user.click(ownGroup().toggle);
    expect(ownGroup().toggle).toHaveAttribute('aria-expanded', 'true');
    view.unmount();

    render(<CapabilityNavigation granted={analystGranted} />);
    expect(ownGroup().toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('works the same way in the drawer, under Close navigation', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={analystGranted} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close navigation' }));
    const toggle = within(sheet).getByRole('button', { name: 'My own requests' });
    expect(within(sheet).queryByRole('link', { name: 'My requests' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(sheet).getByRole('link', { name: 'New request' })).toHaveAttribute('href', '/app/requests/new');
    // The button is not a link, so it neither navigates nor closes the drawer.
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
  });

  it('closes the drawer when the Requestor’s primary action navigates', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={requestorGranted} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'New request' }));

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });
});

describe('intent prefetch for Reference data (UI-D8, UI-SPEC §1.7)', () => {
  beforeEach(() => prefetch.mockReset());

  it('renders the Reference data links without automatic prefetch, and keeps the default elsewhere', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={analystGranted} />);

    const referenceData = screen.getByRole('group', { name: 'Reference data' });
    for (const link of within(referenceData).getAllByRole('link')) expect(link, link.textContent ?? '').toHaveAttribute('data-prefetch', 'false');
    for (const name of ['Home', 'Assigned to me', 'Requests', 'Questionnaires', 'Risk assessments', 'Risk register', 'Alerts', 'Reports']) {
      expect(screen.getByRole('link', { name }), name).toHaveAttribute('data-prefetch', 'default');
    }
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('prefetches a Reference data destination on pointer enter and on focus', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={analystGranted} />);

    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Controls' }));
    expect(prefetch).toHaveBeenLastCalledWith('/app/admin/controls');
    fireEvent.focus(screen.getByRole('link', { name: 'Information Assets' }));
    expect(prefetch).toHaveBeenLastCalledWith('/app/admin/information-assets');
    expect(prefetch).toHaveBeenCalledTimes(2);

    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Alerts' }));
    fireEvent.focus(screen.getByRole('link', { name: 'Home' }));
    expect(prefetch).toHaveBeenCalledTimes(2);
  });
});

describe('navigation counts (D-10, UI-SPEC §1.2, §1.3)', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/app');
  });

  /* The counts stream in: a read suspends its count alone, so the render settles inside an awaited act. */
  async function renderSettled(ui: ReactElement) {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => { result = render(ui); });
    // A settled read pings its suspended count after the first act; the next act renders it.
    await act(async () => {});
    return result!;
  }

  it('names the Requestor’s My requests by its content: the label, the count and what it counts', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ myRequestsNeedingAction: 3 })} granted={requestorGranted} />);

    const link = await within(primaryNavigation()).findByRole('link', { name: 'My requests, 3 need your action' });
    expect(link).toHaveAttribute('href', '/app/requests');
    // The meaning is in the name, never in an aria-label, so the visible words start the name (WCAG 2.5.3).
    expect(link).not.toHaveAttribute('aria-label');
    const count = link.querySelector('.nav-count');
    expect(count).toHaveTextContent(/^3$/);
    expect(count).not.toHaveClass('sr-only');
    // The neutral tag's type is the micro lockup (§4 Tags and chips), the document's one 11px style.
    expect(count).toHaveClass('micro-label');
    // The count sits after the label.
    expect(link.textContent?.indexOf('My requests')).toBe(0);
  });

  it('says "needs" for one', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ myRequestsNeedingAction: 1 })} granted={requestorGranted} />);

    expect(await within(primaryNavigation()).findByRole('link', { name: 'My requests, 1 needs your action' })).toBeInTheDocument();
  });

  it('names My questionnaires by how many wait to be answered', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ questionnairesToAnswer: 2 })} granted={requestorGranted} />);

    expect(await within(primaryNavigation()).findByRole('link', { name: 'My questionnaires, 2 to answer' })).toHaveAttribute('href', '/app/questionnaires');
  });

  it('shows no count for a zero or a missing figure: never a 0', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ myRequestsNeedingAction: 0, questionnairesToAnswer: 2 })} granted={requestorGranted} />);

    const nav = primaryNavigation();
    await within(nav).findByRole('link', { name: 'My questionnaires, 2 to answer' });
    const myRequests = within(nav).getByRole('link', { name: 'My requests' });
    expect(myRequests.querySelector('.nav-count')).toBeNull();
    expect(myRequests).toHaveTextContent(/^My requests$/);
    expect(within(nav).getByRole('link', { name: 'My risk assessments' }).querySelector('.nav-count')).toBeNull();
    expect(nav.querySelectorAll('.nav-count')).toHaveLength(1);
    expect(myRequests.querySelector('[data-nav-count-state]')).toHaveAttribute('data-nav-count-state', 'ready');
    expect(myRequests.querySelector('[data-nav-count-state]')).toHaveAttribute('data-nav-count-value', '0');
  });

  it('distinguishes a failed or missing count from a successfully settled zero without exposing a figure', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ questionnairesToAnswer: 0 })} granted={requestorGranted} />);
    const nav = primaryNavigation();
    const unknown = within(nav).getByRole('link', { name: 'My requests' });
    const zero = within(nav).getByRole('link', { name: 'My questionnaires' });
    expect(unknown.querySelector('[data-nav-count-state]')).toHaveAttribute('data-nav-count-state', 'unavailable');
    expect(unknown.querySelector('[data-nav-count-state]')).not.toHaveAttribute('data-nav-count-value');
    expect(zero.querySelector('[data-nav-count-state]')).toHaveAttribute('data-nav-count-state', 'ready');
    expect(zero.querySelector('[data-nav-count-state]')).toHaveAttribute('data-nav-count-value', '0');
    expect(nav.querySelectorAll('.nav-count')).toHaveLength(0);
    expect(unknown).toHaveAccessibleName('My requests');
    expect(zero).toHaveAccessibleName('My questionnaires');
  });

  it('shows no count while the figures are unknown, and none at all without them', async () => {
    const { unmount } = await renderSettled(<CapabilityNavigation counts={new Promise<NavigationCounts>(() => {})} granted={requestorGranted} />);
    expect(within(primaryNavigation()).getByRole('link', { name: 'My requests' })).toBeInTheDocument();
    expect(document.querySelectorAll('.nav-count')).toHaveLength(0);
    expect(document.querySelectorAll('[data-nav-count-state]')).toHaveLength(0);
    unmount();

    render(<CapabilityNavigation granted={requestorGranted} />);
    expect(within(primaryNavigation()).getByRole('link', { name: 'My requests' })).toBeInTheDocument();
    expect(document.querySelectorAll('.nav-count')).toHaveLength(0);
  });

  it('names the analyst’s Assigned to me, Requests and Alerts by what they count', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ assignedToMeNeedingAction: 3, requestsWaitingForPickUp: 9, overdueAlerts: 6 })} granted={analystGranted} />);

    const nav = primaryNavigation();
    // D-14 (13-UI-SPEC §1): what needs the viewer, and what waits for anyone to pick it up.
    expect(within(nav).getByRole('link', { name: 'Assigned to me, 3 need your action' })).toHaveAttribute('href', '/app/review/assigned');
    expect(within(nav).getByRole('link', { name: 'Requests, 9 waiting for pick-up' })).toHaveAttribute('href', '/app/review/requests');
    expect(within(nav).getByRole('link', { name: 'Alerts, 6 overdue' })).toHaveAttribute('href', '/app/alerts');
    expect(within(nav).getByRole('link', { name: 'Questionnaires' }).querySelector('.nav-count')).toBeNull();
  });

  it('says "needs your action" for one assigned request, and "waiting for pick-up" for one or many', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ assignedToMeNeedingAction: 1, requestsWaitingForPickUp: 1 })} granted={analystGranted} />);

    expect(within(primaryNavigation()).getByRole('link', { name: 'Assigned to me, 1 needs your action' })).toBeInTheDocument();
    expect(within(primaryNavigation()).getByRole('link', { name: 'Requests, 1 waiting for pick-up' })).toBeInTheDocument();
  });

  it('shows no assigned count at zero or when its read failed', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ assignedToMeNeedingAction: 0, requestsWaitingForPickUp: 2 })} granted={analystGranted} />);
    const nav = primaryNavigation();
    expect(within(nav).getByRole('link', { name: 'Assigned to me' }).querySelector('.nav-count')).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Requests, 2 waiting for pick-up' })).toBeInTheDocument();
  });

  it('shows the collapsed My own requests button its items’ count, and moves it to My requests once open', async () => {
    const user = userEvent.setup();
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ myRequestsNeedingAction: 1, requestsWaitingForPickUp: 9 })} granted={analystGranted} />);

    const nav = primaryNavigation();
    const toggle = within(nav).getByRole('button', { name: 'My own requests, 1 needs your action' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-label');
    expect(toggle.querySelector('.nav-count')).toHaveTextContent(/^1$/);

    await user.click(toggle);
    await act(async () => {});

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('My own requests');
    expect(toggle.querySelector('.nav-count')).toBeNull();
    const own = within(nav).getByRole('group', { name: 'My own requests' });
    expect(within(own).getByRole('link', { name: 'My requests, 1 needs your action' })).toBeInTheDocument();
  });

  it('shows the collapsed button no count when its items have none', async () => {
    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ myRequestsNeedingAction: 0, requestsWaitingForPickUp: 9 })} granted={analystGranted} />);

    const toggle = within(primaryNavigation()).getByRole('button', { name: 'My own requests' });
    expect(toggle.querySelector('.nav-count')).toBeNull();
  });

  it('renders the same counts in the drawer (D-12)', async () => {
    const user = userEvent.setup();
    await renderSettled(<MobileNavigation counts={Promise.resolve({ assignedToMeNeedingAction: 2, requestsWaitingForPickUp: 9, overdueAlerts: 6, myRequestsNeedingAction: 2 })} granted={analystGranted} />);

    // The drawer mounts its navigation on opening, so its counts settle inside the opening's awaited act.
    await act(async () => { await user.click(screen.getByRole('button', { name: 'Menu' })); });

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    const nav = primaryNavigation(sheet);
    expect(within(nav).getByRole('link', { name: 'Assigned to me, 2 need your action' })).toHaveAttribute('href', '/app/review/assigned');
    expect(within(nav).getByRole('link', { name: 'Requests, 9 waiting for pick-up' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Alerts, 6 overdue' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'My own requests, 2 need your action' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('counts the analyst’s own My requests when its section is open', async () => {
    usePathname.mockReturnValue('/app/requests');

    await renderSettled(<CapabilityNavigation counts={Promise.resolve({ myRequestsNeedingAction: 1 })} granted={analystGranted} />);

    const own = within(primaryNavigation()).getByRole('group', { name: 'My own requests' });
    expect(await within(own).findByRole('link', { name: 'My requests, 1 needs your action' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('navigation sheet and sticky header styles', () => {
  const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

  function ruleBody(selector: RegExp) {
    const match = globals.match(selector);
    if (!match) throw new Error(`No rule matches ${selector}`);
    return match[1];
  }

  it('lets the navigation sheet scroll so every item and the role switcher stay reachable', () => {
    const sheet = ruleBody(/\n\.sheet-content \{([^}]*)\}/);
    expect(sheet).toMatch(/overflow-y:\s*auto;/);
    expect(sheet).toMatch(/overscroll-behavior:\s*contain;/);
  });

  it('draws the primary action as the light-filled pill of X-6, from the direction’s tokens only', () => {
    const action = ruleBody(/\n\.nav-primary-action \{([^}]*)\}/);
    expect(action).toMatch(/border-radius:\s*var\(--radius-full\);/);
    expect(action).toMatch(/background:\s*var\(--background\);/);
    expect(action).toMatch(/color:\s*var\(--foreground\);/);
    expect(action).toMatch(/font-size:\s*var\(--text-button-size\);/);
    expect(action).toMatch(/box-shadow:\s*var\(--shadow-button-light\);/);
    expect(action).toMatch(/min-height:\s*44px;/);
    expect(action).toMatch(/transform var\(--duration-fast\) var\(--ease-out-expo\)/);
    expect(action).not.toMatch(/#[0-9a-f]{3,8}\b/i);

    const hover = ruleBody(/\n\.nav-primary-action:hover \{([^}]*)\}/);
    expect(hover).toMatch(/transform:\s*translateY\(-1px\);/);
    expect(hover).toMatch(/box-shadow:\s*var\(--shadow-button-light-hover\);/);
    expect(hover).not.toMatch(/background|color:/);

    // The §4 Buttons default height from 768px; the touch-target height below it.
    expect(globals).toMatch(/@media \(min-width: 48rem\) \{\s*\.nav-primary-action \{\s*min-height:\s*36px;\s*\}\s*\}/);
    // Reduced motion removes the lift.
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.nav-primary-action:hover \{\s*transform:\s*none;\s*\}\s*\}/);
  });

  it('draws the section button at the nav item height with the item hover fill and the micro-label text', () => {
    const toggle = ruleBody(/\n\.nav-section-toggle \{([^}]*)\}/);
    expect(toggle).toMatch(/width:\s*100%;/);
    expect(toggle).toMatch(/min-height:\s*36px;/);
    expect(toggle).toMatch(/border-radius:\s*var\(--radius-md\);/);
    expect(toggle).toMatch(/color:\s*var\(--sidebar-muted\);/);
    expect(toggle).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(ruleBody(/\n\.nav-section-toggle:hover \{([^}]*)\}/)).toMatch(/background:\s*var\(--sidebar-active\);/);
    // Focus: the sidebar's inverse ring covers it, in the sidebar and in the sheet.
    expect(globals).toMatch(/\.sidebar :focus-visible,\s*\.sheet-content :focus-visible \{\s*outline-color:\s*var\(--sidebar-focus-ring\);/);
  });

  it('draws a count as the sidebar’s neutral tag in the item’s own colour, at the item’s end (X-6)', () => {
    const count = ruleBody(/\n\.nav-count \{([^}]*)\}/);
    expect(count).toMatch(/margin-inline-start:\s*auto;/);
    expect(count).toMatch(/border:\s*1px solid var\(--line-on-dark-strong\);/);
    expect(count).toMatch(/border-radius:\s*var\(--radius-full\);/);
    // Its type comes from the micro-label lockup alone, so the rule sets no font of its own.
    expect(count).not.toMatch(/font-(size|weight|family)|line-height/);
    expect(count).toMatch(/font-variant-numeric:\s*tabular-nums;/);
    expect(count).toMatch(/color:\s*inherit;/);
    expect(count).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    // The comma before the count stays inline beside the label and is hidden by opacity alone.
    expect(ruleBody(/\n\.nav-count-separator \{([^}]*)\}/)).toMatch(/^\s*opacity:\s*0;\s*$/);
  });

  it('keeps scrolled-to and focused content clear of the sticky header at both header heights', () => {
    expect(ruleBody(/\nhtml \{([^}]*)\}/)).toMatch(/scroll-padding-top:\s*var\(--header-h-sm\);/);
    expect(globals).toMatch(
      /@media \(min-width: 48rem\) \{\s*html \{\s*scroll-padding-top:\s*var\(--header-h-md\);\s*\}\s*\}/,
    );
  });

  it('fits every page into a 320px viewport beside a classic scrollbar: html and body set no width (WCAG 1.4.10)', () => {
    // A 15px classic scrollbar leaves a 305px content box at a 320px viewport (and at 1280px zoomed to 400%), so a
    // 320px minimum width on body scrolled every shell page sideways by the scrollbar's width.
    const setsAWidth = /(?:^|[\s;])(?:min-)?width\s*:/;
    expect(ruleBody(/\nbody \{([^}]*)\}/)).not.toMatch(setsAWidth);
    expect(ruleBody(/\nhtml \{([^}]*)\}/)).not.toMatch(setsAWidth);
  });
});

describe('list keys (no React key warning in development)', () => {
  it('passes every JSX key before any spread, so Next’s compiler keeps each link’s children static', () => {
    // Next's SWC compiles a key placed after a spread to createElement(type, { ...spread, key, children: [...] }). React
    // marks only children passed as arguments as static, so Next's Link then rendered its icon and label as an unkeyed
    // list ("Each child in a list should have a unique "key" prop ... passed a child from CapabilityNavigation").
    // Vitest's esbuild passes the children as arguments, so a rendered test cannot see it; this source check can.
    const path = 'src/components/shell/capability-navigation.tsx';
    const file = ts.createSourceFile(path, readFileSync(resolve(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const keysAfterSpread: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        let spread = false;
        for (const attribute of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attribute)) spread = true;
          else if (spread && attribute.name.getText(file) === 'key') {
            keysAfterSpread.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} <${node.tagName.getText(file)}>`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);

    expect(keysAfterSpread).toEqual([]);
  });

  it('renders both profiles, their counts and the open own-requests section with no key warning', async () => {
    const consoleError = vi.spyOn(console, 'error');
    try {
      usePathname.mockReturnValue('/app/requests');
      const counts = Promise.resolve({ myRequestsNeedingAction: 2, questionnairesToAnswer: 1, assignedToMeNeedingAction: 3, requestsWaitingForPickUp: 9, overdueAlerts: 6 });
      await act(async () => {
        render(<CapabilityNavigation counts={counts} granted={analystGranted} />);
        render(<CapabilityNavigation counts={counts} granted={requestorGranted} />);
      });
      await act(async () => {});

      expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(2);
      expect(screen.getByRole('link', { name: 'Requests, 9 waiting for pick-up' })).toBeInTheDocument();
      const keyWarnings = consoleError.mock.calls.filter((call) => call.some((part) => String(part).includes('unique "key" prop')));
      expect(keyWarnings).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('capability navigation', () => {
  it('marks the matching nested route as active from the pathname hook', () => {
    usePathname.mockReturnValue('/app/review/requests/request-42');

    render(<CapabilityNavigation granted={granted} />);

    expect(screen.getByRole('link', { name: 'Requests' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Risk assessments' })).toHaveAttribute('href', '/app/review/assessments');
    // The analyst's own work is not a Requestor's My work list (D-08).
    expect(screen.queryByRole('link', { name: 'My risk assessments' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('hides analyst review navigation without the review capability', () => {
    usePathname.mockReturnValue('/app');
    render(<CapabilityNavigation granted={new Set(['assessment-request:read'] as const)} />);
    expect(screen.queryByRole('link', { name: 'Risk assessments' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My risk assessments' })).toBeInTheDocument();
  });

  it('uses the shared micro-label treatment for the Reference data section label', () => {
    usePathname.mockReturnValue('/app/admin/controls');

    render(<CapabilityNavigation granted={analystGranted} />);

    expect(within(screen.getByRole('group', { name: 'Reference data' })).getByText('Reference data')).toHaveClass('micro-label');
  });

  it('opens and closes a labelled modal navigation Sheet with keyboard and pointer interactions', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={granted} />);

    /*
     * WCAG 2.5.3 Label in Name: the trigger's accessible name is its visible label, with no
     * aria-label beside it, and it still exposes its state and the sheet it controls.
     */
    const trigger = screen.getByRole('button', { name: 'Menu' });
    // Any capitalisation of the retired name, so no second name can come back beside the label.
    expect(screen.queryByRole('button', { name: /open navigation/i })).toBeNull();
    expect(trigger).not.toHaveAttribute('aria-label');
    expect(trigger).toHaveTextContent(/^Menu$/);
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(sheet.id).not.toBe('');
    expect(trigger).toHaveAttribute('aria-controls', sheet.id);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close navigation' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    fireEvent.pointerDown(screen.getByTestId('sheet-overlay'));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await user.click(trigger);
    await user.click(screen.getByRole('link', { name: 'Requests' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the mobile menu trigger first in tab order for Administration users', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={new Set([...granted, 'administration:manage'])} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('navigation', { name: 'Administration shortcuts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });
});
