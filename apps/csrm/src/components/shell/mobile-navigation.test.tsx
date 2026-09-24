/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ usePathname }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import { CapabilityNavigation, MobileNavigation } from './capability-navigation';

const granted = new Set([
  'assessment-request:create',
  'assessment-request:read',
  'assessment:review',
  'risk:manage',
] as const);

describe('capability navigation', () => {
  it('marks the matching nested route as active from the pathname hook', () => {
    usePathname.mockReturnValue('/app/review/requests/request-42');

    render(<CapabilityNavigation granted={granted} />);

    expect(screen.getByRole('link', { name: 'Assessment Requests' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Risk Assessments' })).toHaveAttribute('href', '/app/review/assessments');
    expect(screen.getByRole('link', { name: 'My Risk Assessments' })).toHaveAttribute('href', '/app/assessments');
    expect(screen.getByRole('link', { name: 'Workspace' }).getAttribute('aria-current')).toBeNull();
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

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Navigation' })).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close navigation' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
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
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.queryByRole('navigation', { name: 'Administration shortcuts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });
});
