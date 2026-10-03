/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BellIcon, FileChartColumnIcon, HouseIcon } from 'lucide-react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ usePathname }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import {
  activeNavigationHref,
  navigation,
  navigationGroups,
  type NavigationItem,
} from '../../config/navigation/navigation';
import { CapabilityNavigation, MobileNavigation } from './capability-navigation';

const granted = new Set([
  'assessment-request:create',
  'assessment-request:read',
  'assessment:review',
  'risk:manage',
] as const);

const requestorGranted = new Set(['assessment-request:create', 'assessment-request:read'] as const);

/*
 * Test-local copies of the Phase 7 entries prove the group and current-item mechanics apart from
 * the shipped order, which the "shipped" describes below pin. The Reports items are listed after the
 * Administration items on purpose: groups render in navigationGroups order, not list order.
 */
const alertsItem: NavigationItem = {
  href: '/app/alerts',
  label: 'Alerts',
  capability: 'assessment:review',
  icon: BellIcon,
  group: 'Reports',
};
const reportsItem: NavigationItem = {
  href: '/app/reports',
  label: 'Reports',
  capability: 'assessment:review',
  icon: FileChartColumnIcon,
  group: 'Reports',
};
const phaseSevenItems = [alertsItem, reportsItem];
const withoutPhaseSeven = navigation.filter((item) => !phaseSevenItems.some((extra) => extra.href === item.href));
const phaseSevenNavigation: readonly NavigationItem[] = [
  ...withoutPhaseSeven.filter((item) => !item.group),
  ...withoutPhaseSeven.filter((item) => item.group === 'Administration'),
  alertsItem,
  reportsItem,
];

function currentLinks() {
  return screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
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
    expect(activeNavigationHref(pathname, phaseSevenNavigation)).toBe(expected);
  });

  it('matches only at a path-segment boundary', () => {
    expect(activeNavigationHref('/app/requestsx', phaseSevenNavigation)).toBeNull();
    expect(activeNavigationHref('/app/reviewer/requests', phaseSevenNavigation)).toBeNull();
  });

  it('lets Home match only itself, so an unlisted route marks nothing current', () => {
    expect(activeNavigationHref('/app/unknown', phaseSevenNavigation)).toBeNull();
    // The retired analyst dashboard address redirects to Home; no item claims it (D-17).
    expect(activeNavigationHref('/app/review', phaseSevenNavigation)).toBeNull();
    expect(
      activeNavigationHref(
        '/app/admin/risk-types',
        phaseSevenNavigation.filter((item) => item.group !== 'Administration'),
      ),
    ).toBeNull();
  });
});

describe('capability navigation current item', () => {
  it.each([
    ['/app/requests/new', 'New request'],
    ['/app/review/requests/request-42', 'Assessment Requests'],
    ['/app/review/requests', 'Assessment Requests'],
    ['/app/review/assessments/assessment-9', 'Risk Assessments'],
    ['/app', 'Home'],
  ])('marks exactly one current item in the shipped navigation on %s', (pathname, label) => {
    usePathname.mockReturnValue(pathname);

    render(<CapabilityNavigation granted={granted} />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });

  it.each([
    ['/app/alerts', 'Alerts'],
    ['/app', 'Home'],
    ['/app/review/requests/request-42', 'Assessment Requests'],
    ['/app/reports/risk-exposure', 'Reports'],
    ['/app/requests/new', 'New request'],
  ])('marks exactly one current item across the Phase 7 groups on %s', (pathname, label) => {
    usePathname.mockReturnValue(pathname);

    render(<CapabilityNavigation granted={granted} items={phaseSevenNavigation} />);

    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });
});

describe('capability navigation groups', () => {
  it('renders groups in navigationGroups order, Reports before Administration', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={new Set([...granted, 'administration:manage'])} items={phaseSevenNavigation} />);

    expect(navigationGroups).toEqual(['Reports', 'Administration']);
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Reports', 'Administration']);

    const reports = screen.getByRole('group', { name: 'Reports' });
    expect(within(reports).getByText('Reports', { selector: 'p' })).toHaveClass('micro-label');
    expect(within(reports).getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/app/alerts');
    expect(within(reports).getAllByRole('link').map((link) => link.textContent)).toEqual(['Alerts', 'Reports']);
    expect(within(screen.getByRole('group', { name: 'Administration' })).queryByRole('link', { name: 'Alerts' })).toBeNull();

    // Home is a primary item, outside every group.
    expect(screen.getByRole('link', { name: 'Home' }).closest('[role="group"]')).toBeNull();
  });

  it('renders a group only when one of its items is visible', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={granted} items={phaseSevenNavigation} />);

    expect(screen.getByRole('group', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Administration' })).not.toBeInTheDocument();
  });

  it('shows a Requestor neither the Reports group nor any analyst item', () => {
    usePathname.mockReturnValue('/app/alerts');

    render(<CapabilityNavigation granted={requestorGranted} items={phaseSevenNavigation} />);

    expect(screen.queryByRole('group', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alerts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Analyst dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    // A route the Requestor cannot see marks nothing current.
    expect(currentLinks()).toHaveLength(0);
  });
});

describe('shipped Home navigation', () => {
  it('ships Home first for every actor, and no analyst dashboard item', () => {
    // Home is /app for every actor (D-16); the analyst dashboard address redirects there (D-17).
    expect(navigation[0]).toEqual({ href: '/app', label: 'Home', capability: 'assessment-request:read', icon: HouseIcon });
    expect(navigation.find((item) => item.href === '/app/review')).toBeUndefined();
    expect(navigation.map((item) => item.label)).not.toContain('Analyst dashboard');
    expect(navigation.map((item) => item.label)).not.toContain('Workspace');
  });

  it('shows the analyst Home and the three review queues, with no Analyst dashboard link', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={granted} />);

    const labels = within(screen.getByRole('navigation', { name: 'Primary navigation' })).getAllByRole('link').map((link) => link.textContent);
    expect(labels[0]).toBe('Home');
    const index = labels.indexOf('Assessment Requests');
    expect(labels.slice(index, index + 3)).toEqual(['Assessment Requests', 'Questionnaires', 'Risk Assessments']);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('link', { name: 'Analyst dashboard' })).not.toBeInTheDocument();
  });

  it('marks Home alone current on /app, and a review queue alone current under /app/review', () => {
    usePathname.mockReturnValue('/app');
    const view = render(<CapabilityNavigation granted={granted} />);
    expect(currentLinks()).toHaveLength(1);
    expect(currentLinks()[0]).toHaveAccessibleName('Home');
    view.unmount();

    usePathname.mockReturnValue('/app/review/requests');
    render(<CapabilityNavigation granted={granted} />);
    expect(currentLinks()).toHaveLength(1);
    expect(currentLinks()[0]).toHaveAccessibleName('Assessment Requests');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('gives a Requestor the same Home item, and no Analyst dashboard link', () => {
    usePathname.mockReturnValue('/app');

    render(<CapabilityNavigation granted={requestorGranted} />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Analyst dashboard' })).not.toBeInTheDocument();
  });

  it('lists Home first, and no Analyst dashboard, in the mobile navigation sheet', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={granted} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    const labels = within(sheet).getAllByRole('link').map((link) => link.textContent);
    expect(labels[0]).toBe('Home');
    expect(labels).not.toContain('Analyst dashboard');
    expect(within(sheet).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/app');
  });
});

describe('shipped Phase 7 navigation', () => {
  it('ships Alerts then Reports in the Reports group, gated by assessment:review, immediately before Administration', () => {
    const alerts = navigation.find((item) => item.href === '/app/alerts');
    const reports = navigation.find((item) => item.href === '/app/reports');

    expect(alerts).toEqual({ href: '/app/alerts', label: 'Alerts', capability: 'assessment:review', icon: BellIcon, group: 'Reports' });
    expect(reports).toEqual({ href: '/app/reports', label: 'Reports', capability: 'assessment:review', icon: FileChartColumnIcon, group: 'Reports' });
    const index = navigation.indexOf(alerts!);
    expect(navigation[index + 1]).toBe(reports);
    expect(navigation[index + 2]?.group).toBe('Administration');
    expect(navigation.slice(0, index).every((item) => !item.group)).toBe(true);
  });

  it('marks Reports alone current on a report, with Alerts then Reports in the analyst Reports group', () => {
    usePathname.mockReturnValue('/app/reports/risk-exposure');

    render(<CapabilityNavigation granted={new Set([...granted, 'administration:manage'])} />);

    const reports = screen.getByRole('group', { name: 'Reports' });
    expect(within(reports).getAllByRole('link').map((link) => link.textContent)).toEqual(['Alerts', 'Reports']);
    expect(within(reports).getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/app/reports');
    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Reports');
  });

  it('shows a Requestor neither Alerts nor Reports on a report URL', () => {
    usePathname.mockReturnValue('/app/reports/risk-exposure');

    render(<CapabilityNavigation granted={requestorGranted} />);

    expect(screen.queryByRole('group', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alerts' })).not.toBeInTheDocument();
    expect(currentLinks()).toHaveLength(0);
  });

  it('shows the analyst the Reports group with Alerts, before Administration, and marks Alerts alone current', () => {
    usePathname.mockReturnValue('/app/alerts');

    render(<CapabilityNavigation granted={new Set([...granted, 'administration:manage'])} />);

    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Reports', 'Administration']);
    const reports = screen.getByRole('group', { name: 'Reports' });
    expect(within(reports).getByText('Reports', { selector: 'p' })).toHaveClass('micro-label');
    expect(within(reports).getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/app/alerts');
    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Alerts');
  });

  it('shows a Requestor neither the Reports group nor Alerts in the shipped navigation', () => {
    usePathname.mockReturnValue('/app/alerts');

    render(<CapabilityNavigation granted={requestorGranted} />);

    expect(screen.queryByRole('group', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alerts' })).not.toBeInTheDocument();
    expect(currentLinks()).toHaveLength(0);
  });

  it('lists Alerts and Reports in the mobile navigation sheet for the analyst', async () => {
    usePathname.mockReturnValue('/app');
    const user = userEvent.setup();

    render(<MobileNavigation granted={granted} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    const reportsGroup = within(sheet).getByRole('group', { name: 'Reports' });
    expect(within(reportsGroup).getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/app/alerts');
    expect(within(reportsGroup).getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/app/reports');
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

  it('keeps scrolled-to and focused content clear of the sticky header at both header heights', () => {
    expect(ruleBody(/\nhtml \{([^}]*)\}/)).toMatch(/scroll-padding-top:\s*var\(--header-h-sm\);/);
    expect(globals).toMatch(
      /@media \(min-width: 48rem\) \{\s*html \{\s*scroll-padding-top:\s*var\(--header-h-md\);\s*\}\s*\}/,
    );
  });
});

describe('capability navigation', () => {
  it('marks the matching nested route as active from the pathname hook', () => {
    usePathname.mockReturnValue('/app/review/requests/request-42');

    render(<CapabilityNavigation granted={granted} />);

    expect(screen.getByRole('link', { name: 'Assessment Requests' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Risk Assessments' })).toHaveAttribute('href', '/app/review/assessments');
    expect(screen.getByRole('link', { name: 'My Risk Assessments' })).toHaveAttribute('href', '/app/assessments');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('hides analyst review navigation without the review capability', () => {
    usePathname.mockReturnValue('/app');
    render(<CapabilityNavigation granted={new Set(['assessment-request:read'] as const)} />);
    expect(screen.queryByRole('link', { name: 'Risk Assessments' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Risk Assessments' })).toBeInTheDocument();
  });

  it('uses the shared micro-label treatment for the Administration section label', () => {
    usePathname.mockReturnValue('/app/admin/controls');

    render(<CapabilityNavigation granted={new Set([...granted, 'administration:manage'])} />);

    expect(within(screen.getByRole('group', { name: 'Administration' })).getByText('Administration')).toHaveClass('micro-label');
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
    await user.click(screen.getByRole('link', { name: 'Assessment Requests' }));
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
