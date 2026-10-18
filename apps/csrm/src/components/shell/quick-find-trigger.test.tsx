/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

/*
 * The header search control and the shortcut (D-15, D-47, UI-SPEC §3). The real dialog loads through the trigger's
 * own next/dynamic import, so the lazy path is exercised; only its Server Action is mocked, because nothing here
 * searches. (Vitest does not apply vi.mock to the module a dependency imports dynamically, only to that module's own
 * imports.) quick-find-dialog.test.tsx proves the dialog itself.
 */

const quickFindAction = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@/features/quick-find/quick-find-actions', () => ({ quickFindAction }));
vi.mock('@/components/csrm/navigation-guard', () => ({
  useNavigationGuard: () => ({ blocking: false, guardLink: vi.fn(), navigate }),
}));

import { QuickFindDialog } from '@/features/quick-find/quick-find-dialog';
import { quickFindMessages } from '@/features/quick-find/quick-find-domain';
import { QuickFindTrigger } from './quick-find-trigger';

it('keeps the full quick-find domain out of the always-loaded search trigger', () => {
  const trigger = readFileSync(resolve(process.cwd(), 'src/components/shell/quick-find-trigger.tsx'), 'utf8');
  expect(trigger).toContain("import { QUICK_FIND_MAX_TERM_LENGTH } from '@/features/quick-find/quick-find-constants'");
  expect(trigger).not.toMatch(/import\s*\{[^}]*QUICK_FIND_MAX_TERM_LENGTH[^}]*\}\s*from\s*['"]@\/features\/quick-find\/quick-find-domain['"]/);
});

beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({ ok: true, data: { term, groups: [] } }));
  // As the guard does when nothing is unsaved: run onLeave, then go (D-51).
  navigate.mockImplementation((_href: string, options?: { onLeave?: () => void }) => options?.onLeave?.());
});

afterEach(() => {
  vi.unstubAllGlobals();
  quickFindAction.mockReset();
  navigate.mockReset();
});

const searchControl = () => screen.getByRole('button', { name: 'Search' });

/* Quick find once its code has loaded: its frame shows first, then the dialog with its input replaces it (D-52). */
async function loadedDialog(): Promise<HTMLElement> {
  await screen.findByRole('combobox', { name: 'Search by number or title' });
  return screen.getByRole('dialog', { name: 'Search' });
}

describe('the header search control (D-47, UI-SPEC §3)', () => {
  it('is named Search from its visible label and names both shortcuts', () => {
    render(<QuickFindTrigger viewer="requestor" />);

    const control = searchControl();
    expect(control).toHaveTextContent('Search');
    expect(control).not.toHaveAttribute('aria-label');
    expect(control).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    expect(control).toHaveAttribute('aria-haspopup', 'dialog');
    expect(control).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens quick find on click', async () => {
    const user = userEvent.setup();
    render(<QuickFindTrigger viewer="requestor" />);

    const control = searchControl();
    await user.click(control);
    expect(await loadedDialog()).toBeInTheDocument();
    // The modal dialog hides the page behind it from assistive technology, so the control is read directly.
    expect(control).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('the shortcut (D-47, UI-SPEC §3)', () => {
  it('Ctrl+K opens quick find and Ctrl+K again closes it', async () => {
    const user = userEvent.setup();
    render(<QuickFindTrigger viewer="requestor" />);

    await user.keyboard('{Control>}k{/Control}');
    expect(await loadedDialog()).toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());
  });

  it('⌘K (meta) works too, on any platform', async () => {
    const user = userEvent.setup();
    render(<QuickFindTrigger viewer="analyst" />);

    await user.keyboard('{Meta>}k{/Meta}');
    expect(await loadedDialog()).toBeInTheDocument();
  });

  it('works inside a text field, and prevents the browser default only for its own keys', async () => {
    render(<><label>Filter<input /></label><QuickFindTrigger viewer="requestor" /></>);
    const field = screen.getByRole('textbox', { name: 'Filter' });
    field.focus();

    expect(fireEvent.keyDown(field, { key: 'j', ctrlKey: true }), 'Ctrl+J is left alone').toBe(true);
    expect(fireEvent.keyDown(field, { key: 'k' }), 'a plain k is left alone').toBe(true);
    expect(fireEvent.keyDown(field, { key: 'K', ctrlKey: true }), 'Ctrl+K is handled').toBe(false);
    expect(await loadedDialog()).toBeInTheDocument();
  });

  it('ignores a repeated key and IME composition', async () => {
    render(<QuickFindTrigger viewer="requestor" />);

    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, repeat: true });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, isComposing: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
    expect(searchControl()).toHaveAttribute('aria-expanded', 'false');
  });

  it('does nothing while another dialog is open', async () => {
    render(
      <>
        <div aria-label="Navigation" role="dialog" />
        <QuickFindTrigger viewer="requestor" />
      </>,
    );

    expect(fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true }), 'the browser keeps its own key').toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('does nothing while a confirmation is open', async () => {
    render(
      <>
        <div aria-label="Leave this questionnaire?" role="alertdialog" />
        <QuickFindTrigger viewer="requestor" />
      </>,
    );

    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
  });
});

describe('the shortcut hint (X-7, UI-SPEC §3)', () => {
  function stubUserAgent(userAgent: string) {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is not in the server markup, so server and client render the same control', () => {
    const markup = renderToString(<QuickFindTrigger viewer="requestor" />);

    expect(markup).toContain('Search');
    expect(markup).not.toContain('<kbd');
  });

  it('shows ⌘ K on an Apple device, after mount, hidden from assistive technology', async () => {
    stubUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15');
    render(<QuickFindTrigger viewer="requestor" />);

    const control = searchControl();
    await waitFor(() => expect(control.querySelectorAll('kbd')).toHaveLength(2));
    expect([...control.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual(['⌘', 'K']);
    expect(control.querySelector('kbd')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(control).toHaveAccessibleName('Search');
  });

  it('shows Ctrl K elsewhere', async () => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36');
    render(<QuickFindTrigger viewer="requestor" />);

    const control = searchControl();
    await waitFor(() => expect([...control.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual(['Ctrl', 'K']));
    expect(control).toHaveAccessibleName('Search');
  });

  it('draws each key as the X-7 kbd from the direction’s tokens', async () => {
    render(<QuickFindTrigger viewer="requestor" />);
    const control = searchControl();
    await waitFor(() => expect(control.querySelectorAll('kbd')).toHaveLength(2));
    for (const key of control.querySelectorAll('kbd')) expect(key).toHaveClass('shortcut-key', 'micro-label');

    const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const rule = globals.match(/\n\.shortcut-key \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/border:\s*1px solid var\(--border\);/);
    expect(rule).toMatch(/border-radius:\s*var\(--radius-sm\);/);
    expect(rule).toMatch(/padding:\s*0 4px;/);
    expect(rule).toMatch(/color:\s*var\(--foreground-secondary\);/);
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('the control below 768px (X-7, UI-SPEC §3)', () => {
  const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
  const phone = globals.match(/@media \(max-width: 767px\) \{\s*\.header-search \{[\s\S]*?\n\}/)?.[0] ?? '';

  it('is an icon-only circle at the touch-target size whose label stays in its name, visually hidden, with no hint', () => {
    expect(phone).toMatch(/\.header-search \{\s*width:\s*44px;\s*height:\s*44px;\s*padding:\s*0;\s*\}/);
    expect(phone).toMatch(/\.header-search-label \{[^}]*clip-path:\s*inset\(50%\);/);
    expect(phone).toMatch(/\.header-search \.shortcut-hint \{\s*display:\s*none;\s*\}/);
    expect(phone).not.toMatch(/\.header-search-label \{[^}]*display:\s*none/);
  });
});

describe('aria-expanded follows the dialog', () => {
  it('turns false again when Escape closes quick find', async () => {
    const user = userEvent.setup();
    render(<QuickFindTrigger viewer="requestor" />);
    const control = searchControl();

    await user.click(control);
    await loadedDialog();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());
    expect(control).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('the kept term (UI-D12)', () => {
  it('reopening shows the last term, selected, so typing replaces it', async () => {
    const user = userEvent.setup();
    render(<QuickFindTrigger viewer="requestor" />);

    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox', { name: 'Search by number or title' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('RAR');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());

    await user.keyboard('{Control>}k{/Control}');
    const reopened = await screen.findByRole('combobox', { name: 'Search by number or title' }) as HTMLInputElement;
    await waitFor(() => expect(reopened).toHaveFocus());
    expect(reopened).toHaveValue('RAR');
    expect([reopened.selectionStart, reopened.selectionEnd]).toEqual([0, 3]);
  });
});

describe('opening a result (UI-D13, UI-SPEC §4.6)', () => {
  it('sends focus to the header Search control once quick find closes', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({
      ok: true,
      data: {
        term,
        groups: [{
          kind: 'my-requests',
          label: 'My requests',
          total: 1,
          status: 'ok',
          options: [{ id: 'request-1', href: '/app/requests/request-1', primary: 'RAR-2026-ABC1 · Customer portal', secondary: 'Submitted' }],
        }],
      },
    }));
    render(<><button type="button">Elsewhere</button><QuickFindTrigger viewer="requestor" /></>);
    screen.getByRole('button', { name: 'Elsewhere' }).focus();

    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox', { name: 'Search by number or title' });
    await user.type(input, 'RAR-2026-ABC');
    const option = await screen.findByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ });
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));
    await user.keyboard('{Enter}');

    expect(navigate).toHaveBeenCalledWith('/app/requests/request-1', expect.anything());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());
    await waitFor(() => expect(searchControl()).toHaveFocus());
  });
});

describe('loading the dialog (D-52, UI-SPEC §4.7)', () => {
  type DialogModule = { QuickFindDialog: typeof QuickFindDialog };

  it('bounds typed-ahead text to 100 characters so the loaded input can still search', async () => {
    const user = userEvent.setup();
    let arrive: (module: DialogModule) => void = () => undefined;
    const loadDialog = () => new Promise<DialogModule>((resolve) => { arrive = resolve; });
    render(<QuickFindTrigger loadDialog={loadDialog} viewer="requestor" />);
    await user.keyboard('{Control>}k{/Control}');
    const frame = await screen.findByRole('dialog', { name: 'Search' });
    await waitFor(() => expect(frame.contains(document.activeElement)).toBe(true));
    await user.keyboard('A'.repeat(101));
    await act(async () => { arrive({ QuickFindDialog }); });
    const input = await screen.findByRole('combobox', { name: 'Search by number or title' });
    expect(input).toHaveValue('A'.repeat(100));
    await waitFor(() => expect(quickFindAction).toHaveBeenCalledWith({ term: 'A'.repeat(100) }));
  });

  it.each(['loading', 'failed'] as const)('Escape from the %s frame restores the opening field', async (state) => {
    const user = userEvent.setup();
    const loadDialog = state === 'loading'
      ? () => new Promise<DialogModule>(() => undefined)
      : () => Promise.reject(new Error('chunk failed'));
    render(<><label>Filter<input /></label><QuickFindTrigger loadDialog={loadDialog} viewer="requestor" /></>);
    const field = screen.getByRole('textbox', { name: 'Filter' });
    field.focus();
    await user.keyboard('{Control>}k{/Control}');
    const frame = await screen.findByRole('dialog', { name: 'Search' });
    if (state === 'failed') {
      const retry = await screen.findByRole('button', { name: quickFindMessages.retry });
      retry.focus();
    } else {
      await waitFor(() => expect(frame.contains(document.activeElement)).toBe(true));
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('opened by the shortcut before its code arrives, shows the frame and a skeleton input row, then focuses the input, losing nothing typed', async () => {
    const user = userEvent.setup();
    let arrive: (module: DialogModule) => void = () => undefined;
    const loadDialog = vi.fn(() => new Promise<DialogModule>((resolve) => { arrive = resolve; }));
    render(<QuickFindTrigger loadDialog={loadDialog} viewer="requestor" />);

    await user.keyboard('{Control>}k{/Control}');
    const frame = await screen.findByRole('dialog', { name: 'Search' });
    expect(frame.querySelector('[data-slot="skeleton"]'), 'the input row is a skeleton').not.toBeNull();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await waitFor(() => expect(frame.contains(document.activeElement)).toBe(true));

    await user.keyboard('RA');
    await act(async () => { arrive({ QuickFindDialog }); });

    const input = await screen.findByRole('combobox', { name: 'Search by number or title' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input, 'nothing typed while the code loaded is lost').toHaveValue('RA');
    await user.keyboard('R');
    expect(input).toHaveValue('RAR');
  });

  it('when the code cannot load, shows the every-list-failed state, and Retry search loads it again', async () => {
    const user = userEvent.setup();
    const loadDialog = vi.fn<() => Promise<DialogModule>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue({ QuickFindDialog });
    render(<QuickFindTrigger loadDialog={loadDialog} viewer="requestor" />);

    await user.keyboard('{Control>}k{/Control}');
    const frame = await screen.findByRole('dialog', { name: 'Search' });
    expect(await screen.findByText(quickFindMessages.unavailable)).toBeInTheDocument();
    expect(screen.getByText(quickFindMessages.unavailableDetail)).toBeInTheDocument();
    expect(frame).toHaveTextContent('Search isn’t available right now.Try again in a moment.');

    await user.click(screen.getByRole('button', { name: quickFindMessages.retry }));
    const input = await screen.findByRole('combobox', { name: 'Search by number or title' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(loadDialog).toHaveBeenCalledTimes(2);
  });
});
