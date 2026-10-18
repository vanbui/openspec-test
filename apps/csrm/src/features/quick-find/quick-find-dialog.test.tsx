/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

/*
 * The quick-find dialog (D-48, D-51, UI-SPEC §4.1, §4.3, §4.5): the APG modal dialog with the combobox and
 * listbox of the source-owned shadcn Command over cmdk. The Server Action and the navigation guard are mocked:
 * this proves what the dialog asks and what it opens, through the guard's programmatic entry point.
 */

const quickFindAction = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock('./quick-find-actions', () => ({ quickFindAction }));
vi.mock('@/components/csrm/navigation-guard', () => ({
  useNavigationGuard: () => ({ blocking: false, guardLink: vi.fn(), navigate }),
}));

import type { QuickFindResult, QuickFindViewer } from './quick-find-domain';
import { QuickFindDialog } from './quick-find-dialog';

type DialogHarnessProps = {
  viewer?: QuickFindViewer;
  returnFocusTo?: HTMLElement | null;
  searchControl?: HTMLElement | null;
  initialTerm?: string;
  onOpenChange?: (open: boolean) => void;
};

/* The header control owns the open state and the kept term (UI-D12); this stands in for it. */
function DialogHarness({ viewer = 'requestor', returnFocusTo = null, searchControl = null, initialTerm = '', onOpenChange }: DialogHarnessProps) {
  const [open, setOpen] = useState(true);
  const [term, setTerm] = useState(initialTerm);
  return (
    <QuickFindDialog
      onOpenChange={(next) => {
        onOpenChange?.(next);
        setOpen(next);
      }}
      onTermChange={setTerm}
      open={open}
      returnFocusTo={returnFocusTo}
      searchControl={searchControl}
      term={term}
      viewer={viewer}
    />
  );
}

/* A page with one focusable control before quick find opens, and the header's Search control. */
function PageWithDialog(props: Omit<DialogHarnessProps, 'returnFocusTo' | 'searchControl'>) {
  const [before, setBefore] = useState<HTMLButtonElement | null>(null);
  const [control, setControl] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setBefore} type="button">Before quick find</button>
      <button ref={setControl} type="button">Header search</button>
      {before && control ? <DialogHarness {...props} returnFocusTo={before} searchControl={control} /> : null}
    </>
  );
}

/* Below 768px or from 768px, as the dialog reads the viewport (X-8). */
function stubViewport(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width') ? phone : !phone,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function requestorResult(term: string): QuickFindResult {
  return {
    term,
    groups: [
      {
        kind: 'my-requests',
        label: 'My requests',
        total: 1,
        status: 'ok',
        options: [{ id: 'request-1', href: '/app/requests/request-1', primary: 'RAR-2026-ABC1 · Customer portal', secondary: 'Submitted' }],
      },
    ],
  };
}

beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({ ok: true, data: requestorResult(term) }));
  // As the guard does when nothing is unsaved: run onLeave, then go (D-51).
  navigate.mockImplementation((_href: string, options?: { onLeave?: () => void }) => options?.onLeave?.());
});

afterEach(() => {
  quickFindAction.mockReset();
  navigate.mockReset();
});

function renderDialog(onOpenChange = vi.fn()) {
  render(<DialogHarness onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

describe('the quick-find dialog (D-48, UI-SPEC §4.1, §4.5)', () => {
  it('is a dialog named Search, its title inside it, with focus in the input named Search by number or title', async () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Search' });
    expect(within(dialog).getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    const input = within(dialog).getByRole('combobox', { name: 'Search by number or title' });
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('maxLength', '100');
    expect(input).toHaveAttribute('placeholder', 'Search by number or title');
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(dialog).getByRole('listbox')).toBeInTheDocument();
  });

  it('asks the action for the typed term and shows each group as a listbox group of options', async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    await user.type(input, 'RAR-2026-ABC');
    await waitFor(() => expect(quickFindAction).toHaveBeenLastCalledWith({ term: 'RAR-2026-ABC' }));

    const listbox = screen.getByRole('listbox');
    const group = await within(listbox).findByRole('group', { name: /^My requests/ });
    expect(within(group).getByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ })).toBeInTheDocument();
    expect(within(group).getByText('Submitted')).toBeInTheDocument();
  });

  it('Enter opens the active option through the navigation guard and closes the dialog', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    await user.type(input, 'RAR-2026-ABC');
    const option = await screen.findByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ });
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', option.id));

    await user.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/app/requests/request-1', expect.objectContaining({ onLeave: expect.any(Function) }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('turns cmdk’s client filtering and its Ctrl+N and Ctrl+P bindings off', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({
      ok: true,
      data: {
        term,
        groups: [{
          kind: 'my-requests',
          label: 'My requests',
          total: 2,
          status: 'ok',
          options: [
            { id: 'request-1', href: '/app/requests/request-1', primary: 'RAR-2026-ABC1 · Customer portal', secondary: 'Submitted' },
            { id: 'request-2', href: '/app/requests/request-2', primary: 'RAR-2026-ABC2 · Payroll', secondary: 'Draft' },
          ],
        }],
      },
    }));
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    // The term matches no option's text or href (the server matched a statement): a client filter would hide both.
    await user.type(input, 'statement words');
    const first = await screen.findByRole('option', { name: /^RAR-2026-ABC1/ });
    expect(screen.getByRole('option', { name: /^RAR-2026-ABC2/ })).toBeInTheDocument();
    await waitFor(() => expect(first).toHaveAttribute('aria-selected', 'true'));

    await user.keyboard('{Control>}n{/Control}');
    expect(first, 'Ctrl+N does not move the active option').toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /^RAR-2026-ABC2/ })).toHaveAttribute('aria-selected', 'true');
  });
});

const hint = 'Type 2 or more characters of a number or title.';
const requestorDescription = 'Find one of your requests, questionnaires or risk assessments by its number or title.';
const analystDescription = 'Find a request, questionnaire, risk assessment or Risk by its number or title.';
const scopeSentence = 'Check the number, or try a word from the title. Only records you can open are searched.';

describe('what quick find searched (D-53, UI-SPEC §4.2, §4.4)', () => {
  it('below two characters shows the hint, then the Requestor’s description, and asks nothing', async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Search' });

    const shown = within(dialog).getByText(hint);
    expect(shown.parentElement, 'the hint’s second line is the actor’s description').toHaveTextContent(`${hint}${requestorDescription}`);

    await user.type(within(dialog).getByRole('combobox', { name: 'Search by number or title' }), 'R');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(within(dialog).getByText(hint)).toBeInTheDocument();
    expect(quickFindAction).not.toHaveBeenCalled();
    expect(document.querySelector('[aria-live="polite"]'), 'the hint is not announced').toHaveTextContent('');
  });

  it('gives the Security Analyst their own description under the hint', () => {
    render(<DialogHarness viewer="analyst" />);

    expect(screen.getByText(hint).parentElement).toHaveTextContent(`${hint}${analystDescription}`);
  });

  it('a search with no match says so, says only records the viewer can open are searched, and announces it', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({ ok: true, data: { term, groups: [] } }));
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Search' });

    await user.type(within(dialog).getByRole('combobox', { name: 'Search by number or title' }), 'RAR-2026-ZZZ9');
    const heading = await within(dialog).findByText('No matches for “RAR-2026-ZZZ9”');
    expect(heading, 'the no-matches line is at the 500 weight').toHaveClass('font-medium');
    expect(within(dialog).getByText(scopeSentence)).toBeInTheDocument();
    expect(within(dialog).queryByRole('option')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(hint), 'the hint gives way to the answer').not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('No matches for RAR-2026-ZZZ9'));
  });

  it('a newer term with matches replaces the no-matches state', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => (
      term === 'RAR-2026-ABC' ? { ok: true, data: requestorResult(term) } : { ok: true, data: { term, groups: [] } }
    ));
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    await user.type(input, 'RAR-2026-ZZZ9');
    await screen.findByText('No matches for “RAR-2026-ZZZ9”');
    await user.clear(input);
    await user.type(input, 'RAR-2026-ABC');
    expect(await screen.findByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ })).toBeInTheDocument();
    expect(screen.queryByText(scopeSentence)).not.toBeInTheDocument();
  });
});

function analystResult(term: string): QuickFindResult {
  return {
    term,
    groups: [
      {
        kind: 'review-requests',
        label: 'Requests',
        total: 12,
        status: 'ok',
        options: Array.from({ length: 5 }, (_, index) => ({
          id: `review-${index + 1}`,
          href: `/app/review/requests/review-${index + 1}`,
          primary: `RAR-2026-REV${index + 1} · Payroll platform ${index + 1}`,
          secondary: index === 0 ? 'Under review · Assigned to Bob Doe' : 'Under review · Not picked up',
        })),
        showAllHref: `/app/review/requests?queue=all&q=${encodeURIComponent(term)}`,
      },
      {
        kind: 'my-requests',
        label: 'My requests',
        total: 1,
        status: 'ok',
        options: [{ id: 'request-4', href: '/app/requests/request-4', primary: 'RAR-2026-ABC4 · Payroll platform', secondary: 'Draft' }],
      },
    ],
  };
}

describe('groups, totals and Show all (D-50, UI-SPEC §4.3, §4.4)', () => {
  beforeEach(() => {
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({ ok: true, data: analystResult(term) }));
  });

  it('names each group by its label and total, shows five options and ends a larger group with Show all', async () => {
    const user = userEvent.setup();
    render(<DialogHarness viewer="analyst" />);

    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'Payroll');
    const requests = await screen.findByRole('group', { name: 'Requests, 12 matches' });
    const options = within(requests).getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options[5]).toHaveAccessibleName('Show all 12 in Requests');
    // D-13: an analyst request option's line 2 names who holds it.
    expect(options[0]).toHaveTextContent('Under review · Assigned to Bob Doe');
    expect(options[1]).toHaveTextContent('Under review · Not picked up');
    expect(screen.getByRole('group', { name: 'My requests, 1 match' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'My requests, 1 match' })).queryByRole('option', { name: /^Show all/ })).not.toBeInTheDocument();
  });

  it('Show all opens the list filtered by the term, through the guard', async () => {
    const user = userEvent.setup();
    render(<DialogHarness viewer="analyst" />);

    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'Payroll');
    await user.click(await screen.findByRole('option', { name: 'Show all 12 in Requests' }));
    expect(navigate).toHaveBeenCalledWith('/app/review/requests?queue=all&q=Payroll', expect.objectContaining({ onLeave: expect.any(Function) }));
  });

  it('announces the sum of the group totals in one polite region', async () => {
    const user = userEvent.setup();
    render(<DialogHarness viewer="analyst" />);
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region).toHaveTextContent('');

    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'Payroll');
    await waitFor(() => expect(region).toHaveTextContent('13 matches'));
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});

describe('one search at a time, the latest term winning (D-50)', () => {
  type Deferred = { term: string; resolve: () => void };
  let calls: Deferred[];

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    quickFindAction.mockImplementation(({ term }: { term: string }) => new Promise((resolve) => {
      calls.push({ term, resolve: () => resolve({ ok: true, data: requestorResult(term) }) });
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function typeTerm(value: string) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Search by number or title' }), { target: { value } });
  }

  it('sends one search 250ms after the last keystroke', () => {
    render(<DialogHarness />);

    typeTerm('R');
    typeTerm('RA');
    act(() => { vi.advanceTimersByTime(100); });
    typeTerm('RAR');
    act(() => { vi.advanceTimersByTime(249); });
    expect(quickFindAction).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(quickFindAction).toHaveBeenCalledTimes(1);
    expect(quickFindAction).toHaveBeenCalledWith({ term: 'RAR' });
  });

  it('holds a newer term while a search is in flight, sends it when that returns, and drops the stale result', async () => {
    render(<DialogHarness />);

    typeTerm('RAR');
    act(() => { vi.advanceTimersByTime(250); });
    typeTerm('RAR-2026');
    act(() => { vi.advanceTimersByTime(250); });
    expect(calls.map((call) => call.term), 'nothing else is sent while the first search runs').toEqual(['RAR']);

    await act(async () => { calls[0].resolve(); });
    expect(calls.map((call) => call.term), 'the waiting term goes out once the first returns').toEqual(['RAR', 'RAR-2026']);
    expect(screen.queryByRole('option'), 'the first search’s result is stale and is not shown').not.toBeInTheDocument();

    await act(async () => { calls[1].resolve(); });
    expect(screen.getByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ })).toBeInTheDocument();
  });

  it('sends nothing for fewer than 2 characters', () => {
    render(<DialogHarness />);

    typeTerm(' R ');
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(quickFindAction).not.toHaveBeenCalled();
  });
});

describe('waiting for a search (D-53, UI-D14, UI-SPEC §4.4)', () => {
  type Deferred = { term: string; resolve: () => void };
  let calls: Deferred[];

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    quickFindAction.mockImplementation(({ term }: { term: string }) => new Promise((resolve) => {
      calls.push({ term, resolve: () => resolve({ ok: true, data: requestorResult(term) }) });
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const input = () => screen.getByRole('combobox', { name: 'Search by number or title' });
  const skeletonRows = () => document.querySelectorAll('.quick-find-skeleton-row');
  function typeTerm(value: string) {
    fireEvent.change(input(), { target: { value } });
  }

  it('marks retained matches pending immediately while the new term is debouncing, and preserves their allowed activation', async () => {
    render(<DialogHarness />);
    typeTerm('RA');
    act(() => { vi.advanceTimersByTime(250); });
    await act(async () => { calls[0].resolve(); });
    const oldOption = screen.getByRole('option', { name: /^RAR-2026-ABC1/ });
    await act(async () => { await Promise.resolve(); });
    expect(oldOption).toHaveAttribute('aria-selected', 'true');
    typeTerm('RAR-2026-specific');
    expect(calls).toHaveLength(1);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('listbox')).toHaveClass('quick-find-pending');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/app/requests/request-1', expect.anything());
  });

  it('shows nothing for 300ms after the first search starts, then five skeleton rows, with the list busy', async () => {
    render(<DialogHarness />);

    typeTerm('RAR');
    act(() => { vi.advanceTimersByTime(250); });
    expect(calls).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(299); });
    expect(skeletonRows(), 'nothing for the first 300ms').toHaveLength(0);
    act(() => { vi.advanceTimersByTime(1); });
    expect(skeletonRows()).toHaveLength(5);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelector('[aria-live="polite"]'), 'loading is not announced').toHaveTextContent('');

    await act(async () => { calls[0].resolve(); });
    expect(skeletonRows()).toHaveLength(0);
    expect(screen.getByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ })).toBeInTheDocument();
    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('keeps the previous results at the pending opacity while a newer search runs, and Enter still opens the active option', async () => {
    render(<DialogHarness />);

    typeTerm('RAR');
    act(() => { vi.advanceTimersByTime(250); });
    await act(async () => { calls[0].resolve(); });
    const option = screen.getByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ });
    await act(async () => { await Promise.resolve(); });
    expect(option).toHaveAttribute('aria-selected', 'true');

    typeTerm('RAR-2');
    act(() => { vi.advanceTimersByTime(600); });
    expect(calls.map((call) => call.term)).toEqual(['RAR', 'RAR-2']);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-busy', 'true');
    expect(listbox, 'the previous results stay, at the pending opacity').toHaveClass('quick-find-pending');
    expect(skeletonRows(), 'no skeleton replaces real results').toHaveLength(0);
    expect(option).toBeInTheDocument();

    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/app/requests/request-1', expect.objectContaining({ onLeave: expect.any(Function) }));
  });
});

function failedGroupResult(term: string): QuickFindResult {
  return {
    term,
    groups: [
      requestorResult(term).groups[0],
      { kind: 'my-questionnaires', label: 'My questionnaires', total: 0, status: 'failed', options: [] },
    ],
  };
}

describe('when a list cannot be searched (D-53, T-11-47, T-11-48)', () => {
  it('names the one failed list beside successful empty lists without blank group headings', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({
      ok: true,
      data: {
        term,
        groups: [
          { kind: 'my-requests', label: 'My requests', total: 0, status: 'ok', options: [] },
          { kind: 'my-questionnaires', label: 'My questionnaires', total: 0, status: 'failed', options: [] },
          { kind: 'my-assessments', label: 'My risk assessments', total: 0, status: 'ok', options: [] },
        ],
      },
    }));
    renderDialog();
    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'portal');
    const failed = await screen.findByRole('group', { name: 'My questionnaires' });
    expect(within(failed).getByText('We couldn’t search My questionnaires just now.')).toBeInTheDocument();
    expect(within(failed).getByRole('option', { name: 'Retry search' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^My requests/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^My risk assessments/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Search isn’t available right now.')).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('0 matches. My questionnaires couldn’t be searched.'));
  });

  it('announces each completed equal-count search and retry without loading chatter', async () => {
    const user = userEvent.setup();
    const calls: { term: string; resolve: () => void }[] = [];
    quickFindAction.mockImplementation(({ term }: { term: string }) => new Promise((resolve) => {
      calls.push({ term, resolve: () => resolve({ ok: true, data: failedGroupResult(term) }) });
    }));
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });
    const region = document.querySelector('[aria-live="polite"]');
    if (!region) throw new Error('missing live region');
    const announcements: string[] = [];
    const observer = new MutationObserver(() => {
      if (region.textContent) announcements.push(region.textContent);
    });
    observer.observe(region, { childList: true, subtree: true, characterData: true });
    try {
      await user.type(input, 'portal');
      await waitFor(() => expect(calls).toHaveLength(1));
      expect(announcements).toEqual([]);
      await act(async () => calls[0].resolve());
      await waitFor(() => expect(announcements).toHaveLength(1));

      await user.keyboard('{Control>}a{/Control}');
      await user.paste('payroll');
      await waitFor(() => expect(calls).toHaveLength(2));
      expect(announcements).toHaveLength(1);
      await act(async () => calls[1].resolve());
      await waitFor(() => expect(announcements).toHaveLength(2));

      await user.click(screen.getByRole('option', { name: 'Retry search' }));
      await waitFor(() => expect(calls).toHaveLength(3));
      expect(announcements).toHaveLength(2);
      await act(async () => calls[2].resolve());
      await waitFor(() => expect(announcements).toEqual(Array(3).fill('1 match. My questionnaires couldn’t be searched.')));
      expect(calls.map((call) => call.term)).toEqual(['portal', 'payroll', 'payroll']);
      expect(document.querySelector('[aria-live="polite"]')).toBe(region);
    } finally {
      observer.disconnect();
    }
  });

  it('shows the failed list’s heading, says it couldn’t be searched and offers Retry search, while the other groups still show', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({ ok: true, data: failedGroupResult(term) }));
    renderDialog();

    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'RAR-2026-ABC');
    expect(await screen.findByRole('group', { name: 'My requests, 1 match' })).toBeInTheDocument();
    const failed = screen.getByRole('group', { name: 'My questionnaires' });
    expect(within(failed).getByText('We couldn’t search My questionnaires just now.')).toBeInTheDocument();
    expect(within(failed).getByRole('option', { name: 'Retry search' })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('1 match. My questionnaires couldn’t be searched.'));
  });

  it('Retry search runs the same term again, once, and keeps focus in the input', async () => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(async ({ term }: { term: string }) => ({ ok: true, data: failedGroupResult(term) }));
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    await user.type(input, 'RAR-2026-ABC');
    const retry = await screen.findByRole('option', { name: 'Retry search' });
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(retry).toHaveAttribute('aria-selected', 'true'));
    const before = quickFindAction.mock.calls.length;
    await user.keyboard('{Enter}');

    await waitFor(() => expect(quickFindAction).toHaveBeenCalledTimes(before + 1));
    expect(quickFindAction).toHaveBeenLastCalledWith({ term: 'RAR-2026-ABC' });
    expect(navigate).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it.each([
    ['the action refuses', async () => ({ ok: false, formError: 'Search isn’t available right now.' })],
    ['the action throws', async () => { throw new Error('offline'); }],
    ['every list fails', async ({ term }: { term: string }) => ({
      ok: true,
      data: { term, groups: [{ kind: 'my-requests', label: 'My requests', total: 0, status: 'failed', options: [] }] },
    })],
  ])('when %s, says search isn’t available, with Retry search', async (_case, implementation) => {
    const user = userEvent.setup();
    quickFindAction.mockImplementation(implementation);
    renderDialog();

    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'RAR-2026-ABC');
    // The polite region says it too; the shown line is the one outside it.
    expect(await screen.findByText('Search isn’t available right now.', { ignore: '[aria-live], script, style' })).toBeInTheDocument();
    expect(screen.getByText('Try again in a moment.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Retry search' })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Search isn’t available right now.'));
  });
});

describe('the phone sheet and the desktop frame (X-8, UI-D42, UI-SPEC §4.1)', () => {
  it('Tab then Enter on Clear search clears without opening the selected result', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });
    await user.type(input, 'portal');
    const option = await screen.findByRole('option', { name: /^RAR-2026-ABC1/ });
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));

    await user.tab();
    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(navigate).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('below 768px shows a visible Search heading and a Close control named Close search, and no key hints', async () => {
    stubViewport(true);
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    const heading = screen.getByRole('heading', { name: 'Search' });
    expect(heading).not.toHaveClass('sr-only');
    const close = screen.getByRole('button', { name: 'Close search' });
    expect(close).toHaveTextContent(/^Close search$/);
    expect(document.querySelector('.quick-find-footer')).toBeNull();

    await user.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('from 768px keeps the title visually hidden, has no Close control and shows the key hints, hidden from assistive technology', () => {
    stubViewport(false);
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Search' })).toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: 'Close search' })).not.toBeInTheDocument();
    const footer = document.querySelector('.quick-find-footer');
    expect(footer).not.toBeNull();
    expect(footer).toHaveAttribute('aria-hidden', 'true');
    expect([...(footer?.querySelectorAll('kbd') ?? [])].map((key) => key.textContent)).toEqual(['↑', '↓', 'Enter', 'Esc']);
    expect(footer).toHaveTextContent(/to move.*to open.*to close/);
  });

  it('shows Clear search while the input holds text; it empties the input and returns focus there', async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    await user.type(input, 'RA');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
  });
});

describe('focus (D-48, D-51, UI-D13, UI-SPEC §4.5, §4.6)', () => {
  it('Escape closes quick find and returns focus to the element focused before it opened', async () => {
    const user = userEvent.setup();
    render(<PageWithDialog />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Search by number or title' })).toHaveFocus());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Before quick find' })).toHaveFocus());
  });

  it('after a result opens, focus rests on the header Search control', async () => {
    const user = userEvent.setup();
    render(<PageWithDialog />);

    await user.type(screen.getByRole('combobox', { name: 'Search by number or title' }), 'RAR-2026-ABC');
    const option = await screen.findByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ });
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Header search' })).toHaveFocus());
  });

  it('when the guard blocks, quick find stays open and the guard receives the input, for Keep answering', async () => {
    const user = userEvent.setup();
    navigate.mockImplementation(() => undefined);
    renderDialog();
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    await user.type(input, 'RAR-2026-ABC');
    const option = await screen.findByRole('option', { name: /^RAR-2026-ABC1 · Customer portal/ });
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));
    await user.keyboard('{Enter}');

    expect(navigate).toHaveBeenCalledWith('/app/requests/request-1', expect.objectContaining({ trigger: input }));
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });

  it('opened with a term typed before its code arrived, puts the caret after it rather than selecting it', async () => {
    render(<DialogHarness initialTerm="RA" />);
    const input = screen.getByRole('combobox', { name: 'Search by number or title' });

    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('RA');
    expect([(input as HTMLInputElement).selectionStart, (input as HTMLInputElement).selectionEnd]).toEqual([2, 2]);
  });
});
