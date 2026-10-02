/** @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

vi.mock('next/navigation', () => ({ usePathname: () => '/app', useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/time/time-zone-actions', () => ({ syncViewerTimeZoneAction: vi.fn(async () => ({ ok: false })) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('../../../app/actions/session', () => ({
  setDevelopmentRole: vi.fn(),
  signOutOfSession: vi.fn(),
}));

import { signOutOfSession } from '../../../app/actions/session';
import { AppShell } from './app-shell';

const granted = new Set(['assessment-request:read'] as const);

beforeEach(() => {
  installTestResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AppShell in OIDC mode (an account, no development role)', () => {
  it('shows an initials account button in the header and no sidebar footer', () => {
    render(
      <AppShell account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('button', { name: 'JD, account menu for Jane Doe' })).toBeInTheDocument();
    expect(document.querySelector('.shell-footer')).toBeNull();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Development role' })).not.toBeInTheDocument();
  });

  it('opens a menu with the name and a Sign out item that invokes the sign-out action', async () => {
    const user = userEvent.setup();
    render(
      <AppShell account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: 'JD, account menu for Jane Doe' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Jane Doe')).toBeInTheDocument();
    const signOut = within(menu).getByRole('menuitem', { name: 'Sign out' });
    expect(signOut.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    await user.click(signOut);
    await waitFor(() => expect(signOutOfSession).toHaveBeenCalledTimes(1));
  });

  it('opens from the keyboard', async () => {
    const user = userEvent.setup();
    render(
      <AppShell account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    screen.getByRole('button', { name: 'JD, account menu for Jane Doe' }).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('shows the name and the email as two separate lines', async () => {
    const user = userEvent.setup();
    render(
      <AppShell account={{ displayName: 'Jane Doe', email: 'jane.doe@idambox.com' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: 'JD, account menu for Jane Doe' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(menu).getByText('jane.doe@idambox.com')).toBeInTheDocument();
  });

  it('does not repeat an email-only identity', async () => {
    const user = userEvent.setup();
    render(
      <AppShell account={{ displayName: 'jane.doe@idambox.com', email: 'jane.doe@idambox.com' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: /account menu for jane.doe@idambox.com/ }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByText('jane.doe@idambox.com')).toHaveLength(1);
  });
});

describe('AppShell in development mode (a role, no account), unchanged', () => {
  it('shows the role switcher and no account menu or Sign out control', () => {
    render(
      <AppShell granted={granted} role="Requestor" timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getAllByRole('combobox', { name: 'Development role' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /account menu/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });
});

describe('AppShell with neither a role nor an account, byte-identical to before', () => {
  it('renders no shell-footer and no account menu', () => {
    render(
      <AppShell granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    expect(document.querySelector('.shell-footer')).toBeNull();
    expect(screen.queryByRole('button', { name: /account menu/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Development role' })).not.toBeInTheDocument();
  });
});
