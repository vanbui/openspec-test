/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigations = vi.hoisted(() => [] as string[]);

/* next/link's order: onClick, then onNavigate with preventDefault() only, then the navigation (navigation-guard.test.tsx). */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    onNavigate?: (event: { preventDefault: () => void }) => void;
  }) => (
    <a
      {...props}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        event.preventDefault();
        let prevented = false;
        onNavigate?.({ preventDefault: () => { prevented = true; } });
        if (!prevented) navigations.push(href);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { GuardedLink, NavigationGuardProvider, useNavigationGuard } from './navigation-guard';
import { clearAllSessionDrafts } from '@/lib/session-drafts/session-drafts';
import { useUnloadWarning } from './use-unload-warning';

function KeptText({ holding }: { holding: boolean }) {
  useUnloadWarning(holding);
  const guard = useNavigationGuard();
  return <p>{guard.blocking ? 'blocking' : 'not blocking'}</p>;
}

function unloadPrevented(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  navigations.length = 0;
});

/*
 * 13-UI-SPEC §9.3 and UI-D18: text kept in the session store survives in-app navigation, so it arms only the browser's
 * own warning on reload, close and external navigation, never the shell guard's in-app dialog.
 */
describe('useUnloadWarning (UI-D18)', () => {
  it('arms the browser’s warning while text is kept, and lets an in-app link navigate without asking', async () => {
    const user = userEvent.setup();
    const view = render(<NavigationGuardProvider><KeptText holding /><GuardedLink href="/app/requests/r-1">Request</GuardedLink></NavigationGuardProvider>);

    expect(unloadPrevented()).toBe(true);
    expect(screen.getByText('not blocking')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Request' }));
    expect(navigations).toEqual(['/app/requests/r-1']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    view.rerender(<NavigationGuardProvider><KeptText holding={false} /><GuardedLink href="/app/requests/r-1">Request</GuardedLink></NavigationGuardProvider>);
    expect(unloadPrevented()).toBe(false);
  });

  it('stops warning when the component unmounts, and needs no provider', () => {
    const view = render(<KeptText holding />);
    expect(unloadPrevented()).toBe(true);
    view.unmount();
    expect(unloadPrevented()).toBe(false);
  });

  /*
   * WR-401: once the person has chosen Sign out and its kept text is discarded, the sign-out's redirect leaves the page;
   * the browser must not ask a second time about text that is already gone. The stand-down is brief, so a page that
   * stays (a sign-out that failed) warns again.
   */
  it('does not ask a second time once the person has chosen to sign out, and asks again if the page stays', () => {
    const view = render(<KeptText holding />);
    expect(unloadPrevented()).toBe(true);
    const now = Date.now();
    clearAllSessionDrafts();
    expect(unloadPrevented()).toBe(false);
    const later = vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    try {
      expect(unloadPrevented()).toBe(true);
    } finally {
      later.mockRestore();
      view.unmount();
    }
  });

  it('stays out of the shell: the navigation guard, which every route loads, does not import it', () => {
    const guard = readFileSync(resolve(process.cwd(), 'src/components/csrm/navigation-guard.tsx'), 'utf8');
    expect(guard).not.toContain('use-unload-warning');
  });
});
