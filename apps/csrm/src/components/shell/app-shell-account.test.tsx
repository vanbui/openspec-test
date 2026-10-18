/** @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

vi.mock('next/navigation', () => ({ usePathname: () => '/app', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/time/time-zone-actions', () => ({ syncViewerTimeZoneAction: vi.fn(async () => ({ ok: false })) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('@/features/quick-find/quick-find-actions', () => ({ quickFindAction: vi.fn() }));
vi.mock('../../../app/actions/session', () => ({
  setDevelopmentRole: vi.fn(),
  signOutOfSession: vi.fn(),
}));
vi.mock('@/lib/session-drafts/session-drafts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/session-drafts/session-drafts')>();
  return { ...original, clearAllSessionDrafts: vi.fn(original.clearAllSessionDrafts) };
});

import { signOutOfSession } from '../../../app/actions/session';
import { clearAllSessionDrafts } from '@/lib/session-drafts/session-drafts';
import { quickFindAction } from '@/features/quick-find/quick-find-actions';
import { AppShell } from './app-shell';

const granted = new Set(['assessment-request:read'] as const);

beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AppShell in OIDC mode (an account, no development role)', () => {
  it.each(['identity', 'capabilities'] as const)('discards quick-find state when the server-resolved %s changes', async (change) => {
    const user = userEvent.setup();
    vi.mocked(quickFindAction).mockResolvedValue({ ok: true, data: { term: 'RAR', groups: [{
      kind: 'my-requests', label: 'My requests', total: 1, status: 'ok',
      options: [{ id: 'private', href: '/app/requests/private', primary: 'Private request', secondary: 'Submitted' }],
    }] } });
    const full = new Set(['assessment-request:read', 'assessment:review', 'risk:manage'] as const);
    const view = render(<AppShell account={{ displayName: 'Same display name' }} counts={Promise.resolve({})} granted={full} identityKey="first-viewer" timeZone={null}><p>content</p></AppShell>);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('combobox', { name: 'Search by number or title' }), 'RAR');
    expect(await screen.findByRole('option', { name: /^Private request/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    view.rerender(<AppShell account={{ displayName: 'Same display name' }} counts={Promise.resolve({})} granted={change === 'capabilities' ? new Set(['assessment-request:read', 'assessment:review'] as const) : full} identityKey={change === 'identity' ? 'second-viewer' : 'first-viewer'} timeZone={null}><p>content</p></AppShell>);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('combobox', { name: 'Search by number or title' })).toHaveValue('');
    expect(screen.queryByRole('option', { name: /^Private request/ })).not.toBeInTheDocument();
  });

  it('shows an initials account button in the header and no sidebar footer', () => {
    render(
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
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
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
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

  /*
   * 13-UI-SPEC §9.3, UI-D17, UI-D31 (T-13-32): signing out leaves no unsent note or reason for the next person. WR-401:
   * while any is kept, Sign out asks first, and only Sign out in that dialog clears it, before the sign-out action runs.
   */
  function keepDrafts() {
    window.sessionStorage.setItem('csrm-draft:assign:owner-a:request-1', 'Sam covers this system.');
    window.sessionStorage.setItem('csrm-draft:note:owner-a:request-1', 'Unsent note');
    window.sessionStorage.setItem('other-app-key', 'kept');
  }

  async function chooseSignOut(user: ReturnType<typeof userEvent.setup>) {
    render(
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: 'JD, account menu for Jane Doe' }));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }));
  }

  it('asks before signing out while unsent text is kept, and Stay signed in keeps the text and the session (WR-401)', async () => {
    const user = userEvent.setup();
    keepDrafts();
    await chooseSignOut(user);

    const dialog = await screen.findByRole('alertdialog', { name: 'Sign out and discard unsent text?' });
    expect(dialog).toHaveAccessibleDescription('Signing out discards the note text and assignment reasons you haven’t sent.');
    expect(signOutOfSession).not.toHaveBeenCalled();
    expect(clearAllSessionDrafts).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-a:request-1')).toBe('Unsent note');

    await user.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(signOutOfSession).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-a:request-1')).toBe('Sam covers this system.');
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-a:request-1')).toBe('Unsent note');
    window.sessionStorage.clear();
  });

  it('clears every kept draft once Sign out is chosen in that dialog, before the sign-out action runs (WR-401)', async () => {
    const user = userEvent.setup();
    keepDrafts();
    let keptWhenSigningOut: string | null = 'not signed out';
    vi.mocked(signOutOfSession).mockImplementationOnce(async () => {
      keptWhenSigningOut = window.sessionStorage.getItem('csrm-draft:assign:owner-a:request-1');
      return undefined as never;
    });
    await chooseSignOut(user);

    const dialog = await screen.findByRole('alertdialog', { name: 'Sign out and discard unsent text?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(signOutOfSession).toHaveBeenCalledTimes(1));
    expect(clearAllSessionDrafts).toHaveBeenCalledTimes(1);
    expect(keptWhenSigningOut).toBeNull();
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-a:request-1')).toBeNull();
    expect(window.sessionStorage.getItem('other-app-key')).toBe('kept');
    window.sessionStorage.clear();
  });

  it('signs out at once, asking nothing, when no text is kept', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('other-app-key', 'kept');
    await chooseSignOut(user);

    await waitFor(() => expect(signOutOfSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    window.sessionStorage.clear();
  });

  it('opens from the keyboard', async () => {
    const user = userEvent.setup();
    render(
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
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
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'Jane Doe', email: 'jane.doe@idambox.com' }} granted={granted} timeZone={null}>
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
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'jane.doe@idambox.com', email: 'jane.doe@idambox.com' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: /account menu for jane.doe@idambox.com/ }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByText('jane.doe@idambox.com')).toHaveLength(1);
  });
});

describe('AppShell in development mode (a role, no account), unchanged', () => {
  it('forgets private quick-find results and the term when the development identity changes without a reload', async () => {
    const user = userEvent.setup();
    vi.mocked(quickFindAction).mockResolvedValue({ ok: true, data: { term: 'RAR', groups: [{
      kind: 'my-requests', label: 'My requests', total: 1, status: 'ok',
      options: [{ id: 'jane-private', href: '/app/requests/jane-private', primary: 'Jane private request', secondary: 'Submitted' }],
    }] } });
    const view = render(<AppShell counts={Promise.resolve({})} granted={granted} role="Requestor" timeZone={null}><p>content</p></AppShell>);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('combobox', { name: 'Search by number or title' }), 'RAR');
    expect(await screen.findByRole('option', { name: /^Jane private request/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    view.rerender(<AppShell counts={Promise.resolve({})} granted={granted} role="Secondary Requestor" timeZone={null}><p>content</p></AppShell>);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('combobox', { name: 'Search by number or title' })).toHaveValue('');
    expect(screen.queryByText('Jane private request')).not.toBeInTheDocument();
    expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
  });

  it('shows the role switcher and no account menu or Sign out control', () => {
    render(
      <AppShell counts={Promise.resolve({})} granted={granted} role="Requestor" timeZone={null}>
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
      <AppShell counts={Promise.resolve({})} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    expect(document.querySelector('.shell-footer')).toBeNull();
    expect(screen.queryByRole('button', { name: /account menu/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Development role' })).not.toBeInTheDocument();
  });
});

describe('AppShell header search control (D-15, D-47, UI-SPEC §3)', () => {
  it('sits in the header before the role tag, after Menu and the title, for a viewer who may read requests', () => {
    render(
      <AppShell counts={Promise.resolve({})} granted={granted} role="Requestor" timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    const banner = screen.getByRole('banner');
    const search = within(banner).getByRole('button', { name: 'Search' });
    expect(search).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    const menu = within(banner).getByRole('button', { name: 'Menu' });
    const role = within(banner).getByText('Requestor', { exact: true });
    expect(menu.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(role) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sits before the account menu in OIDC mode', () => {
    render(
      <AppShell counts={Promise.resolve({})} account={{ displayName: 'Jane Doe' }} granted={granted} timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    const banner = screen.getByRole('banner');
    const search = within(banner).getByRole('button', { name: 'Search' });
    const account = within(banner).getByRole('button', { name: 'JD, account menu for Jane Doe' });
    expect(search.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is absent for a viewer who may not read requests', () => {
    render(
      <AppShell counts={Promise.resolve({})} granted={new Set()} role="Requestor" timeZone={null}>
        <p>content</p>
      </AppShell>,
    );

    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
  });
});
