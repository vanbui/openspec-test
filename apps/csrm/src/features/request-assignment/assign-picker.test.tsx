import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

import type { AssignmentActionResult } from './assignment-actions';
import type { AssignmentPerson } from './assignment-domain';

const mocks = vi.hoisted(() => ({
  listAssignableAnalystsAction: vi.fn(),
  changeAssigneeAction: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('./assignment-actions', () => ({
  listAssignableAnalystsAction: mocks.listAssignableAnalystsAction,
  changeAssigneeAction: mocks.changeAssigneeAction,
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

import { AssignPicker } from './assign-picker';

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const second = { documentId: 'u2', displayName: 'Second Analyst' };
const sam = { documentId: 'u4', displayName: 'Sam Analyst' };
const RAR = 'RAR-2026-0001';
const storageKey = `csrm-draft:assign:owner-a:request-1`;

type ListResult = AssignmentActionResult<AssignmentPerson[]>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function Harness({ mode = 'reassign', currentAssigneeId = 'u1', onAssign, returnFocus }: {
  mode?: 'assign' | 'reassign';
  currentAssigneeId?: string | null;
  onAssign: (analyst: AssignmentPerson, reason?: string) => Promise<boolean>;
  returnFocus?: (assigned: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} ref={anchor} type="button">{mode === 'assign' ? 'Assign' : 'Reassign'} {RAR}</button>
      <button type="button">Elsewhere on the page</button>
      <AssignPicker
        anchor={anchor}
        currentAssigneeId={currentAssigneeId}
        draftOwnerKey="owner-a"
        mode={mode}
        onAssign={onAssign}
        onOpenChange={setOpen}
        open={open}
        requestId="request-1"
        requestNumber={RAR}
        {...(returnFocus ? { returnFocus } : {})}
      />
    </>
  );
}

function stubViewport(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width') ? phone : !phone,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

async function openPicker(user: ReturnType<typeof userEvent.setup>, mode: 'assign' | 'reassign' = 'reassign') {
  await user.click(screen.getByRole('button', { name: `${mode === 'assign' ? 'Assign' : 'Reassign'} ${RAR}` }));
  return screen.findByRole('dialog', { name: `${mode === 'assign' ? 'Assign' : 'Reassign'} ${RAR}` });
}

beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [bob, second, sam] } satisfies ListResult);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('the assign picker (13-UI-SPEC §6, X-15)', () => {
  it('opens with focus in its search and lists the served analysts without the current assignee', async () => {
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);

    const search = within(dialog).getByRole('combobox', { name: 'Search Security Analysts' });
    expect(search).toHaveAttribute('placeholder', 'Search Security Analysts');
    await waitFor(() => expect(search).toHaveFocus());
    expect(await within(dialog).findByRole('option', { name: 'Second Analyst' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toEqual(['Second Analyst', 'Sam Analyst']);
    expect(mocks.listAssignableAnalystsAction).toHaveBeenCalledWith({ requestId: 'request-1' });
    expect(within(dialog).getByRole('button', { name: 'Assign to a Security Analyst' })).toBeInTheDocument();
  });

  it('searches on typing after a pause and applies only the latest answer', async () => {
    const user = userEvent.setup();
    const early = deferred<ListResult>();
    mocks.listAssignableAnalystsAction.mockImplementation(async ({ q }: { q?: string }) => {
      if (q === 'S') return early.promise;
      if (q === 'Sam') return { ok: true, data: [sam] };
      return { ok: true, data: [bob, second, sam] };
    });
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    await within(dialog).findByRole('option', { name: 'Second Analyst' });

    const search = within(dialog).getByRole('combobox', { name: 'Search Security Analysts' });
    await user.type(search, 'S');
    await waitFor(() => expect(mocks.listAssignableAnalystsAction).toHaveBeenCalledWith({ requestId: 'request-1', q: 'S' }));
    await user.type(search, 'am');
    await waitFor(() => expect(mocks.listAssignableAnalystsAction).toHaveBeenCalledWith({ requestId: 'request-1', q: 'Sam' }));
    await waitFor(() => expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toEqual(['Sam Analyst']));
    await act(async () => early.resolve({ ok: true, data: [second] }));
    expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toEqual(['Sam Analyst']);
    expect(mocks.listAssignableAnalystsAction).not.toHaveBeenCalledWith({ requestId: 'request-1', q: 'Sa' });
  });

  it('shows four skeleton rows after 300ms of loading, with the list busy', async () => {
    vi.useFakeTimers();
    mocks.listAssignableAnalystsAction.mockReturnValue(new Promise(() => undefined));
    render(<Harness onAssign={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: `Reassign ${RAR}` }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const dialog = screen.getByRole('dialog', { name: `Reassign ${RAR}` });
    expect(dialog.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(dialog.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(dialog.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);
    expect(within(dialog).getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
  });

  it('says when nobody else can be assigned, and when nobody matches the search', async () => {
    const user = userEvent.setup();
    mocks.listAssignableAnalystsAction.mockImplementation(async ({ q }: { q?: string }) => ({ ok: true, data: q ? [] : [bob] }));
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    expect(await within(dialog).findByText('No other Security Analyst can be assigned')).toBeInTheDocument();
    expect(within(dialog).getByText('Only active Security Analysts who didn’t raise this request can be assigned.')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('combobox', { name: 'Search Security Analysts' }), 'zz');
    expect(await within(dialog).findByText('No Security Analyst matches “zz”')).toBeInTheDocument();
  });

  it('offers Try again when the list could not load', async () => {
    const user = userEvent.setup();
    mocks.listAssignableAnalystsAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t load Security Analysts.' })
      .mockResolvedValueOnce({ ok: true, data: [bob, sam] });
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    expect(await within(dialog).findByText('We couldn’t load Security Analysts.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByRole('option', { name: 'Sam Analyst' })).toBeInTheDocument();
    expect(mocks.listAssignableAnalystsAction).toHaveBeenCalledTimes(2);
  });

  it('closes with family K’s copy when the viewer may not assign this request', async () => {
    const user = userEvent.setup();
    mocks.listAssignableAnalystsAction.mockResolvedValueOnce({
      ok: false, kind: 'blocked', reason: 'OWN_REQUEST', message: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
    });
    render(<Harness onAssign={vi.fn()} />);
    /* The refusal can arrive before the frame has been looked for, so only the trigger is clicked here. */
    await user.click(screen.getByRole('button', { name: `Reassign ${RAR}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not reassigned', expect.objectContaining({
      description: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('marks a chosen analyst without applying it, and asks for a choice before assigning', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn(async () => true);
    render(<Harness onAssign={onAssign} />);
    const dialog = await openPicker(user);

    await user.click(within(dialog).getByRole('button', { name: 'Assign to a Security Analyst' }));
    expect(within(dialog).getByText('Choose a Security Analyst first.')).toBeInTheDocument();
    expect(onAssign).not.toHaveBeenCalled();

    await user.click(await within(dialog).findByRole('option', { name: 'Sam Analyst' }));
    expect(onAssign).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('option', { name: 'Sam Analyst' })).toHaveAttribute('data-chosen', 'true');
    expect(within(dialog).queryByText('Choose a Security Analyst first.')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Assign to Sam Analyst' })).toBeInTheDocument();
  });

  /*
   * UI-01 (13-UI-SPEC §6 List, amended 2026-10-10): the option the keys or the pointer highlight is cmdk's active option
   * (`aria-selected`, on `--color-bg-inset`); the chosen one reads at 500 with its `Check` and exposes its state as
   * `aria-checked`. The two never look or announce alike, and nothing is chosen until the person chooses.
   */
  it('sets the chosen option apart from the active one in weight and in its exposed state, not only by its check', async () => {
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    const second = await within(dialog).findByRole('option', { name: 'Second Analyst' });
    const samOption = within(dialog).getByRole('option', { name: 'Sam Analyst' });

    expect(second).toHaveAttribute('aria-selected', 'true');
    for (const option of [second, samOption]) {
      expect(option).toHaveAttribute('aria-checked', 'false');
      expect(within(option).getByText(option === second ? 'Second Analyst' : 'Sam Analyst')).not.toHaveClass('font-medium');
    }

    await user.click(samOption);
    const search = within(dialog).getByRole('combobox', { name: 'Search Security Analysts' });
    await user.click(search);
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(second).toHaveAttribute('aria-selected', 'true'));

    expect(samOption).toHaveAttribute('aria-selected', 'false');
    expect(samOption).toHaveAttribute('aria-checked', 'true');
    expect(within(samOption).getByText('Sam Analyst')).toHaveClass('font-medium');
    expect(second).toHaveAttribute('aria-checked', 'false');
    expect(within(second).getByText('Second Analyst')).not.toHaveClass('font-medium');
    expect(second).toHaveClass('data-[selected=true]:bg-surface-muted');
  });

  it('chooses nobody on its own, even when the list holds a single analyst', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn(async () => true);
    mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [sam] } satisfies ListResult);
    render(<Harness onAssign={onAssign} />);
    const dialog = await openPicker(user);
    expect(await within(dialog).findByRole('option', { name: 'Sam Analyst' })).toHaveAttribute('aria-checked', 'false');
    await user.click(within(dialog).getByRole('button', { name: 'Assign to a Security Analyst' }));
    expect(within(dialog).getByText('Choose a Security Analyst first.')).toBeInTheDocument();
    expect(onAssign).not.toHaveBeenCalled();
  });

  /* §7.3: after an assignment the owner places focus (the block's status line), and the trigger is not refocused (IN-501). */
  it('assigns the chosen analyst with the reason and closes, handing focus to its owner as an assignment', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn(async () => true);
    const returnFocus = vi.fn();
    render(<Harness onAssign={onAssign} returnFocus={returnFocus} />);
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('option', { name: 'Sam Analyst' }));
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    expect(reason).toHaveAccessibleDescription('Recorded in the assignment history. Up to 500 characters.');
    await user.type(reason, 'Sam covers this system.');
    await user.click(within(dialog).getByRole('button', { name: 'Assign to Sam Analyst' }));

    expect(onAssign).toHaveBeenCalledWith(sam, 'Sam covers this system.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(returnFocus).toHaveBeenCalledTimes(1);
    expect(returnFocus).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: `Reassign ${RAR}` })).not.toHaveFocus();
  });

  it('tells its owner a close without an assignment is not one, so focus can return to the trigger', async () => {
    const user = userEvent.setup();
    const returnFocus = vi.fn();
    render(<Harness onAssign={vi.fn()} returnFocus={returnFocus} />);
    await openPicker(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(returnFocus).toHaveBeenCalledWith(false);
  });

  it('refuses a reason over 500 characters before sending anything', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn(async () => true);
    render(<Harness onAssign={onAssign} />);
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('option', { name: 'Sam Analyst' }));
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    await user.click(reason);
    await user.paste('x'.repeat(501));
    await user.click(within(dialog).getByRole('button', { name: 'Assign to Sam Analyst' }));

    expect(within(dialog).getByText('Keep the reason to 500 characters or fewer.')).toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('assigns with Ctrl+Enter in the reason', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn(async () => true);
    render(<Harness onAssign={onAssign} />);
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('option', { name: 'Sam Analyst' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason (optional)' }), 'Covering');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onAssign).toHaveBeenCalledWith(sam, 'Covering');
  });

  it('returns focus to the trigger when Escape closes it', async () => {
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    await openPicker(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: `Reassign ${RAR}` })).toHaveFocus();
  });

  /*
   * UI-02 (13-UI-SPEC Motion; AGENTS.md shadcn first): the picker composes the shared Popover and Sheet, so it moves
   * as every popover and sheet in the app does (the §5 popover slide and zoom; the sheet's slide), with no motion of its
   * own. UI-03: the popover sits at the shared default offset (4px), not 6px.
   */
  it('opens as the shared popover from 768px, with its slide, at the shared offset', async () => {
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    expect(dialog).toHaveAttribute('data-slot', 'popover-content');
    expect(dialog).toHaveClass('data-[side=bottom]:slide-in-from-top-2', 'data-[state=open]:zoom-in-95', 'w-[min(480px,calc(100vw-2rem))]');
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-assignment/assign-picker.tsx'), 'utf8');
    expect(source).toMatch(/from '@\/components\/ui\/popover'/);
    expect(source).not.toMatch(/sideOffset/);
  });

  it('opens as the shared sheet below 768px, full screen, sliding in as the shared sheet does', async () => {
    stubViewport(true);
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    expect(dialog).toHaveAttribute('data-slot', 'sheet-content');
    expect(dialog).toHaveClass('inset-0', 'data-[state=open]:slide-in-from-bottom', 'data-[state=closed]:slide-out-to-bottom');
    expect(within(dialog).getAllByRole('button', { name: /close/i }).map((button) => button.getAttribute('aria-label'))).toEqual(['Close assign']);
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
  });

  it('is a full-screen sheet below 768px with a visible Close named Close assign', async () => {
    stubViewport(true);
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    expect(within(dialog).getByRole('heading', { name: `Reassign ${RAR}` })).toBeVisible();
    const close = within(dialog).getByRole('button', { name: 'Close assign' });
    expect(close).toHaveTextContent('Close');
    expect(within(dialog).getByRole('button', { name: 'Assign to a Security Analyst' })).toHaveClass('w-full');
    await user.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: `Reassign ${RAR}` })).toHaveFocus();
  });
});

describe('the picker never loses a typed reason (UI-D31)', () => {
  async function typeReasonAndChoose(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('option', { name: 'Sam Analyst' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason (optional)' }), 'Sam covers this system.');
    return dialog;
  }

  async function expectRestored(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await openPicker(user);
    expect(within(dialog).getByRole('textbox', { name: 'Reason (optional)' })).toHaveValue('Sam covers this system.');
    expect(within(dialog).getByText('Restored from earlier in this session.')).toBeInTheDocument();
    expect(await within(dialog).findByRole('button', { name: 'Assign to Sam Analyst' })).toBeInTheDocument();
    return dialog;
  }

  it('keeps the reason and the choice through Escape', async () => {
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    await typeReasonAndChoose(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expectRestored(user);
  });

  it('keeps them through a click outside', async () => {
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    await typeReasonAndChoose(user);
    await user.click(screen.getByRole('button', { name: 'Elsewhere on the page' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expectRestored(user);
  });

  it('keeps them through the sheet’s Close', async () => {
    stubViewport(true);
    const user = userEvent.setup();
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await typeReasonAndChoose(user);
    await user.click(within(dialog).getByRole('button', { name: 'Close assign' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expectRestored(user);
  });

  it('keeps them through a remount, such as in-app navigation and back', async () => {
    const user = userEvent.setup();
    const view = render(<Harness onAssign={vi.fn()} />);
    await typeReasonAndChoose(user);
    view.unmount();
    expect(window.sessionStorage.getItem(storageKey)).toContain('Sam covers this system.');
    render(<Harness onAssign={vi.fn()} />);
    await expectRestored(user);
  });

  it('restores the reason but no choice when the served list no longer holds the kept analyst', async () => {
    const user = userEvent.setup();
    const view = render(<Harness onAssign={vi.fn()} />);
    await typeReasonAndChoose(user);
    view.unmount();
    mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [bob, second] });
    render(<Harness onAssign={vi.fn()} />);
    const dialog = await openPicker(user);
    expect(within(dialog).getByRole('textbox', { name: 'Reason (optional)' })).toHaveValue('Sam covers this system.');
    await within(dialog).findByRole('option', { name: 'Second Analyst' });
    expect(within(dialog).getByRole('button', { name: 'Assign to a Security Analyst' })).toBeInTheDocument();
  });

  it('clears them when the assignment succeeds, and keeps them when it fails', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn<(analyst: AssignmentPerson, reason?: string) => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<Harness onAssign={onAssign} />);
    const dialog = await typeReasonAndChoose(user);
    await user.click(within(dialog).getByRole('button', { name: 'Assign to Sam Analyst' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem(storageKey)).toContain('Sam covers this system.');

    const again = await expectRestored(user);
    await user.click(within(again).getByRole('button', { name: 'Assign to Sam Analyst' }));
    await waitFor(() => expect(window.sessionStorage.getItem(storageKey)).toBeNull());

    const fresh = await openPicker(user);
    expect(within(fresh).getByRole('textbox', { name: 'Reason (optional)' })).toHaveValue('');
    expect(within(fresh).queryByText('Restored from earlier in this session.')).not.toBeInTheDocument();
  });

  it('removes another person’s kept drafts from the store when it mounts for the signed-in person (IN-402)', () => {
    window.sessionStorage.setItem('csrm-draft:assign:owner-b:request-1', '{"reason":"Someone else’s reason","analyst":null}');
    window.sessionStorage.setItem('csrm-draft:note:owner-b:request-2', 'Someone else’s note');
    window.sessionStorage.setItem(storageKey, '{"reason":"Mine","analyst":null}');
    render(<Harness onAssign={vi.fn()} />);
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-b:request-1')).toBeNull();
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-b:request-2')).toBeNull();
    expect(window.sessionStorage.getItem(storageKey)).toContain('Mine');
  });

  it('arms the browser’s unload warning while a kept reason holds text, and never blocks in-app navigation', async () => {
    const user = userEvent.setup();
    const unloadPrevented = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    render(<Harness onAssign={vi.fn(async () => true)} />);
    expect(unloadPrevented()).toBe(false);
    const dialog = await typeReasonAndChoose(user);
    expect(unloadPrevented()).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(unloadPrevented()).toBe(true);
    expect(dialog).not.toBeInTheDocument();

    const again = await openPicker(user);
    await user.click(within(again).getByRole('button', { name: 'Assign to Sam Analyst' }));
    await waitFor(() => expect(unloadPrevented()).toBe(false));
  });

  it('is a client module that reaches no zod', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-assignment/assign-picker.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).not.toMatch(/from 'zod'|assignment-schema/);
    for (const copy of ['Search Security Analysts', 'Close assign', 'Restored from earlier in this session.']) expect(source).toContain(copy);
  });
});
