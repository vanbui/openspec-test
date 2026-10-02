/** @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

/*
 * A stand-in for next/link that keeps the installed link.js order (client/app-dir/link.js): the click
 * calls the onClick prop with the event, then, unless that prevented it, calls onNavigate with an object
 * holding only preventDefault(), and navigates unless that was called.
 */
const navigations = vi.hoisted(() => [] as string[]);
const push = vi.hoisted(() => vi.fn());
const signOutOfSession = vi.hoisted(() => vi.fn());

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
        if (event.defaultPrevented) return;
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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/app/questionnaires/q-1' }));
vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));
vi.mock('../../../app/actions/session', () => ({ signOutOfSession, setDevelopmentRole: vi.fn() }));

import { AccountMenu } from '../shell/account-menu';
import { CapabilityNavigation, MobileNavigation } from '../shell/capability-navigation';
import { Wordmark } from '../shell/wordmark';
import { GuardedLink, NavigationGuardProvider, useLeaveGuard, useNavigationGuard } from './navigation-guard';

const granted = new Set(['assessment-request:read', 'assessment-request:create'] as const);

const waitingDescription = 'Your latest answers are still being saved. If you leave now, they may not be saved.';
const failedDescription = 'Your latest answers weren’t saved. If you leave now, they’ll be lost.';

/** Stands in for the questionnaire: registers its leave state and shows the page heading. */
function Questionnaire({ blocking, reason = 'waiting', children }: { blocking: boolean; reason?: 'waiting' | 'failed'; children?: ReactNode }) {
  useLeaveGuard(blocking, reason);
  return <><h1>Customer portal questionnaire</h1>{children}</>;
}

function page(blocking: boolean, reason: 'waiting' | 'failed' = 'waiting', showLink = true) {
  return (
    <NavigationGuardProvider>
      <Questionnaire blocking={blocking} reason={reason}>
        {showLink ? <GuardedLink href="/app/requests/r-1">Assessment request RAR-2026-X7K4Q2</GuardedLink> : null}
      </Questionnaire>
    </NavigationGuardProvider>
  );
}

beforeEach(() => {
  installTestResizeObserver();
  navigations.length = 0;
  push.mockReset();
  signOutOfSession.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the leave guard (D-12, UI-SPEC §6.3)', () => {
  it('lets a link navigate when nothing is unsaved', async () => {
    const user = userEvent.setup();
    render(page(false));

    await user.click(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' }));
    expect(navigations).toEqual(['/app/requests/r-1']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('stops a link while a save waits and asks first, with Keep answering focused', async () => {
    const user = userEvent.setup();
    render(page(true));

    await user.click(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' }));
    expect(navigations).toEqual([]);
    const dialog = screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' });
    expect(dialog).toHaveAccessibleDescription(waitingDescription);
    expect(within(dialog).getByRole('button', { name: 'Keep answering' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Leave questionnaire' })).toBeInTheDocument();
  });

  it('says the answers will be lost when the last save failed', async () => {
    const user = userEvent.setup();
    render(page(true, 'failed'));

    await user.click(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' })).toHaveAccessibleDescription(failedDescription);
  });

  it('Keep answering closes the warning and returns focus to the link', async () => {
    const user = userEvent.setup();
    render(page(true));
    const link = screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' });

    await user.click(link);
    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(link).toHaveFocus());
    expect(push).not.toHaveBeenCalled();
    expect(navigations).toEqual([]);
  });

  it('Escape closes the warning without leaving', async () => {
    const user = userEvent.setup();
    render(page(true));

    await user.click(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('returns focus to the page heading when the activated link has gone', async () => {
    const user = userEvent.setup();
    const view = render(page(true));

    await user.click(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' }));
    view.rerender(page(true, 'waiting', false));
    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
  });

  it('Leave questionnaire goes to the chosen link', async () => {
    const user = userEvent.setup();
    render(page(true));

    await user.click(screen.getByRole('link', { name: 'Assessment request RAR-2026-X7K4Q2' }));
    await user.click(screen.getByRole('button', { name: 'Leave questionnaire' }));
    expect(push).toHaveBeenCalledWith('/app/requests/r-1');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('asks the browser to warn on reload or close only while something is unsaved', () => {
    const view = render(page(true));
    const whileBlocking = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(whileBlocking);
    expect(whileBlocking.defaultPrevented).toBe(true);

    view.rerender(page(false));
    const afterSave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it('a questionnaire that unmounts stops blocking', async () => {
    const user = userEvent.setup();
    const view = render(page(true));
    view.rerender(<NavigationGuardProvider><GuardedLink href="/app">Workspace</GuardedLink></NavigationGuardProvider>);

    await user.click(screen.getByRole('link', { name: 'Workspace' }));
    expect(navigations).toEqual(['/app']);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('without a provider nothing blocks and nothing asks', async () => {
    const user = userEvent.setup();
    function Probe() {
      const guard = useNavigationGuard();
      return <p>{guard.blocking ? 'blocking' : 'not blocking'}</p>;
    }
    render(<><Probe /><GuardedLink href="/app">Home page</GuardedLink><Wordmark /><CapabilityNavigation granted={granted} /></>);

    expect(screen.getByText('not blocking')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Home page' }));
    await user.click(screen.getByRole('link', { name: 'BProton, IdamBox CSRM home' }));
    await user.click(screen.getByRole('link', { name: 'My Requests' }));
    expect(navigations).toEqual(['/app', '/app', '/app/requests']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('the shell links consult the guard', () => {
  it('the sidebar navigation and the wordmark ask first while something is unsaved', async () => {
    const user = userEvent.setup();
    render(
      <NavigationGuardProvider>
        <Wordmark />
        <CapabilityNavigation granted={granted} />
        <Questionnaire blocking />
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole('link', { name: 'My Requests' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leave questionnaire' }));
    expect(push).toHaveBeenLastCalledWith('/app/requests');

    await user.click(screen.getByRole('link', { name: 'BProton, IdamBox CSRM home' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(navigations).toEqual([]);
  });

  it('a blocked link in the mobile sheet keeps the sheet open with focus back on that link', async () => {
    const user = userEvent.setup();
    render(
      <NavigationGuardProvider>
        <MobileNavigation granted={granted} />
        <Questionnaire blocking />
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Navigation' });
    const myRequests = within(sheet).getByRole('link', { name: 'My Requests' });
    await user.click(myRequests);

    // The warning hides the page behind it from assistive technology, the sheet included, but the sheet stays open.
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' })).toBeInTheDocument();
    expect(navigations).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await waitFor(() => expect(myRequests).toHaveFocus());
    expect(push).not.toHaveBeenCalled();
  });

  it('Leave questionnaire from the mobile sheet closes the sheet and navigates', async () => {
    const user = userEvent.setup();
    render(
      <NavigationGuardProvider>
        <MobileNavigation granted={granted} />
        <Questionnaire blocking />
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'My Requests' }));
    await user.click(screen.getByRole('button', { name: 'Leave questionnaire' }));

    expect(push).toHaveBeenCalledWith('/app/requests');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('a link in the mobile sheet closes the sheet and returns focus to Menu when nothing is unsaved', async () => {
    const user = userEvent.setup();
    render(
      <NavigationGuardProvider>
        <MobileNavigation granted={granted} />
        <Questionnaire blocking={false} />
      </NavigationGuardProvider>,
    );

    const menu = screen.getByRole('button', { name: 'Menu' });
    await user.click(menu);
    await user.click(within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'My Requests' }));

    expect(navigations).toEqual(['/app/requests']);
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
    await waitFor(() => expect(menu).toHaveFocus());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Sign out asks first while something is unsaved, and signs out only on Leave questionnaire', async () => {
    const user = userEvent.setup();
    render(
      <NavigationGuardProvider>
        <AccountMenu displayName="Jane Doe" email="jane@example.test" />
        <Questionnaire blocking />
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'JD, account menu for Jane Doe' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' })).toBeInTheDocument();
    expect(signOutOfSession).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Leave questionnaire' }));
    await waitFor(() => expect(signOutOfSession).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented, 'the chosen sign-out is not asked about twice').toBe(false);
  });
});
