import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssignmentActionResult } from './assignment-actions';
import type { RequestAssignment } from './assignment-domain';

const mocks = vi.hoisted(() => ({
  changeAssigneeAction: vi.fn(),
  listAssignableAnalystsAction: vi.fn(),
  successToast: vi.fn(),
  toastError: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('./assignment-actions', () => ({
  changeAssigneeAction: mocks.changeAssigneeAction,
  listAssignableAnalystsAction: mocks.listAssignableAnalystsAction,
}));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('@/components/ui/toast-action', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/ui/toast-action')>();
  return { toastAction: vi.fn(original.toastAction) };
});

import { toastAction } from '@/components/ui/toast-action';
import { installTestResizeObserver } from '@/test/layout-stubs';
import { AssignmentBlock } from './assignment-block';

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const sam = { documentId: 'u4', displayName: 'Sam Analyst' };
const RAR = 'RAR-2026-0001';
const at = '2026-10-09T01:02:03.000Z';

function view(overrides: Partial<RequestAssignment> = {}): RequestAssignment {
  return { assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'], ownRequest: false, history: [], viewer: bob, ...overrides };
}

function block(assignment: Parameters<typeof AssignmentBlock>[0]['assignment'], requestStatus = 'submitted') {
  return render(<AssignmentBlock assignment={assignment} draftOwnerKey="owner-key" requestId="request-1" requestNumber={RAR} requestStatus={requestStatus} />);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

type Toast = { action?: { label: string; onClick: (event?: unknown) => void } };
function lastToastAction(): Toast['action'] {
  const options = mocks.successToast.mock.calls.at(-1)?.[1] as Toast | undefined;
  return options?.action;
}

beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [] });
});

afterEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('the assignment block (UI-SPEC §5.2, X-15)', () => {
  it('shows an unassigned request with Pick up and Assign named for the request', () => {
    block(view());
    const section = screen.getByRole('region', { name: 'Assignment' });
    expect(within(section).getByText('Not picked up')).toBeInTheDocument();
    expect(within(section).getByText('Any Security Analyst who didn’t raise this request can pick it up.')).toBeInTheDocument();
    const buttons = within(section).getAllByRole('button').filter((button) => !/assignment history/.test(button.textContent ?? ''));
    expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([`Pick up ${RAR}`, `Assign ${RAR}`]);
    expect(within(section).getByRole('button', { name: `Assign ${RAR}` })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  /* UI-03 (13-UI-SPEC Spacing, 8px): below 768px the status line, caption and stacked actions sit 8px apart. */
  it('stacks the status, caption and actions 8px apart below 768px', () => {
    block(view());
    const section = screen.getByRole('region', { name: 'Assignment' });
    const status = within(section).getByText('Not picked up');
    const row = within(section).getByRole('button', { name: `Pick up ${RAR}` }).parentElement!.parentElement!;
    expect(row).toContainElement(status);
    expect(row).toHaveClass('flex-col', 'gap-2', 'md:flex-row', 'md:gap-4');
    expect(row).not.toHaveClass('gap-4');
    expect(status.parentElement).toHaveClass('gap-2');
  });

  it('applies Pick up at once, confirms with an Undo toast and moves focus to the status line', async () => {
    const user = userEvent.setup();
    const answer = deferred<AssignmentActionResult<RequestAssignment>>();
    mocks.changeAssigneeAction.mockReturnValueOnce(answer.promise);
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    const status = screen.getByText('Assigned to Bob Doe');
    expect(status).toHaveFocus();
    expect(mocks.changeAssigneeAction).toHaveBeenCalledTimes(1);
    expect(mocks.changeAssigneeAction).toHaveBeenCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: 'u1', expectedAnalyst: null });

    await act(async () => answer.resolve({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }) }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`You picked up ${RAR}.`, expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
    expect(toastAction).toHaveBeenCalledWith('Undo', expect.any(Function));
    expect(screen.getByText('Assigned to Bob Doe')).toBeInTheDocument();
    expect(screen.getByText(/^Picked up/)).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('Undo sends the unassign with the new holder as the expected one and says the request is back in the queue', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }) })
      .mockResolvedValueOnce({ ok: true, data: view() });
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    /* In the browser the toast's Undo button holds focus when it is pressed, so the block must bring it back (§7.3, WR-501). */
    const toastUndo = document.createElement('button');
    document.body.append(toastUndo);
    toastUndo.focus();
    expect(screen.getByText('Assigned to Bob Doe')).not.toHaveFocus();
    await act(async () => lastToastAction()?.onClick());

    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: null, expectedAnalyst: 'u1' });
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith(`Pick-up undone. ${RAR} is back in the queue.`));
    expect(screen.getByText('Not picked up')).toHaveFocus();
    toastUndo.remove();
  });

  it('rolls a refused action back and shows family K’s copy in a danger toast', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: false, kind: 'blocked', reason: 'OWN_REQUEST', message: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.' });
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not picked up', expect.objectContaining({
      description: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
      action: expect.objectContaining({ label: 'Refresh page' }),
    })));
    expect(screen.getByText('Not picked up')).toBeInTheDocument();
    expect(screen.queryByText('Assigned to Bob Doe')).not.toBeInTheDocument();
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it('offers Try again on a retryable failure, which sends the same change again', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t change the assignment. Try again.' })
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }) });
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const options = mocks.toastError.mock.calls[0]?.[1] as Toast;
    expect(options.action?.label).toBe('Try again');
    await act(async () => options.action?.onClick());
    expect(mocks.changeAssigneeAction).toHaveBeenCalledTimes(2);
    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: 'u1', expectedAnalyst: null });
  });

  /* WR-301: a call that never reaches the Server Action (the network, a stale deploy) rolls back in place, never the error page. */
  it('rolls a pick-up whose call fails in transport back in place with family K’s retryable copy (WR-301)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }) });
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not picked up', expect.objectContaining({
      description: 'We couldn’t change the assignment. Try again.',
      action: expect.objectContaining({ label: 'Try again' }),
    })));
    expect(screen.getByRole('region', { name: 'Assignment' })).toBeInTheDocument();
    expect(screen.getByText('Not picked up')).toBeInTheDocument();
    expect(mocks.successToast).not.toHaveBeenCalled();

    await act(async () => (mocks.toastError.mock.calls[0]?.[1] as Toast).action?.onClick());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`You picked up ${RAR}.`, expect.anything()));
    expect(screen.getByText('Assigned to Bob Doe')).toBeInTheDocument();
  });

  it('rolls an Undo whose call fails in transport back in place, titled Couldn’t undo (WR-301)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }) })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastToastAction()?.onClick());

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Couldn’t undo', expect.objectContaining({
      description: 'We couldn’t change the assignment. Try again.',
      action: expect.objectContaining({ label: 'Try again' }),
    })));
    expect(screen.getByText('Assigned to Bob Doe')).toBeInTheDocument();
  });

  it('keeps the picker’s reason when an assignment’s call fails in transport, and settles the picker (WR-301)', async () => {
    const user = userEvent.setup();
    mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [bob, sam] });
    mocks.changeAssigneeAction.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    block(view());

    await user.click(screen.getByRole('button', { name: `Assign ${RAR}` }));
    const picker = await screen.findByRole('dialog', { name: `Assign ${RAR}` });
    await user.click(await within(picker).findByRole('option', { name: 'Sam Analyst' }));
    await user.type(within(picker).getByRole('textbox', { name: 'Reason (optional)' }), 'Sam covers this system.');
    await user.click(within(picker).getByRole('button', { name: 'Assign to Sam Analyst' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not assigned', expect.objectContaining({ description: 'We couldn’t change the assignment. Try again.' })));
    expect(screen.getByText('Not picked up')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-key:request-1')).toContain('Sam covers this system.');
  });

  it('names the new holder and refreshes the page at once when someone else changed the assignment first', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({
      ok: false, kind: 'blocked', reason: 'ASSIGNMENT_CHANGED', currentHolder: 'Sam Analyst',
      message: 'Sam Analyst now holds this request, so your change wasn’t made.',
    });
    block(view());

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not picked up', expect.objectContaining({ description: 'Sam Analyst now holds this request, so your change wasn’t made.' })));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Not picked up')).toBeInTheDocument();
  });

  it('takes a colleague’s request with Assign to me, and its Undo hands it back to them', async () => {
    const user = userEvent.setup();
    const held = view({ assignee: sam, assignedBy: sam, assignedAt: at, actions: ['assign-to-me', 'reassign', 'unassign'] });
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }) })
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: sam, assignedBy: bob, assignedAt: at, actions: ['assign-to-me', 'reassign', 'unassign'] }) });
    block(held);
    expect(screen.getByText('Assigned to Sam Analyst')).toBeInTheDocument();
    expect(screen.getByText(/^Picked up/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Assign ${RAR} to me` }));
    expect(mocks.changeAssigneeAction).toHaveBeenCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: 'u1', expectedAnalyst: 'u4' });
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${RAR} is now assigned to you.`, expect.anything()));

    await act(async () => lastToastAction()?.onClick());
    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: 'u4', expectedAnalyst: 'u1', analystName: 'Sam Analyst' });
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith(`Undone. ${RAR} is assigned to Sam Analyst again.`));
    expect(screen.getByText('Assigned to Sam Analyst')).toBeInTheDocument();
    expect(screen.getByText(/^Assigned by Bob Doe/)).toBeInTheDocument();
  });

  it('returns a request to the queue', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: true, data: view() });
    block(view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'] }));

    await user.click(screen.getByRole('button', { name: `Return ${RAR} to the queue` }));
    expect(mocks.changeAssigneeAction).toHaveBeenCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: null, expectedAnalyst: 'u1' });
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${RAR} returned to the queue.`, expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
    expect(screen.getByText('Not picked up')).toHaveFocus();
  });

  it('offers no Undo for a pick-up after release and says how to correct it (UI-D4)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: true, data: view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign'] }) });
    block(view(), 'approved');
    expect(screen.getByText('Released before CSRM recorded assignments. Assign it so its monitoring reaches a Security Analyst.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Pick up ${RAR}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`You picked up ${RAR}. Reassign it if someone else should hold it.`, {}));
  });

  it('shows a released request held by the viewer with no Return to queue (D-08)', () => {
    block(view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign'] }), 'approved');
    expect(screen.getByRole('button', { name: `Reassign ${RAR}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Return ${RAR} to the queue` })).not.toBeInTheDocument();
  });

  it('tells the analyst who raised the request why there is no control, and offers none', () => {
    block(view({ actions: [], ownRequest: true }));
    expect(screen.getByText('You raised this request, so another Security Analyst picks it up.')).toBeInTheDocument();
    for (const name of [/^Pick up/, /^Assign/, /^Reassign/, /^Return/]) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('says a draft keeps its assignment until it is resubmitted, and offers no control', () => {
    block(view({ assignee: sam, assignedBy: bob, assignedAt: at, actions: [] }), 'draft');
    expect(screen.getByText('Assigned to Sam Analyst')).toBeInTheDocument();
    expect(screen.getByText('This request is a draft, so its assignment stays as it is until it’s resubmitted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reassign/ })).not.toBeInTheDocument();
  });

  it('renders nothing for the Requestor’s view, so no Requestor surface can show an assignment control', () => {
    const { container } = block({ assignee: { displayName: 'Bob Doe' } });
    expect(container).toBeEmptyDOMElement();
    const none = block(null);
    expect(none.container).toBeEmptyDOMElement();
  });

  it('shows the history toggle only when the log has events', () => {
    block(view({ assignee: bob, assignedBy: bob, assignedAt: at, actions: ['reassign', 'unassign'], history: [{ action: 'pick-up', by: bob, at, from: null, to: bob, reason: null }] }));
    expect(screen.getByRole('button', { name: 'Show assignment history (1)' })).toBeInTheDocument();
  });

  it('assigns through the picker with a reason; its Undo returns the request to the queue and the reason stays cleared', async () => {
    const user = userEvent.setup();
    mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [bob, sam] });
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: sam, assignedBy: bob, assignedAt: at, actions: ['assign-to-me', 'reassign', 'unassign'] }) })
      .mockResolvedValueOnce({ ok: true, data: view() });
    block(view());

    const trigger = screen.getByRole('button', { name: `Assign ${RAR}` });
    await user.click(trigger);
    const picker = await screen.findByRole('dialog', { name: `Assign ${RAR}` });
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    await user.click(await within(picker).findByRole('option', { name: 'Sam Analyst' }));
    await user.type(within(picker).getByRole('textbox', { name: 'Reason (optional)' }), 'Sam covers this system.');
    await user.click(within(picker).getByRole('button', { name: 'Assign to Sam Analyst' }));

    expect(mocks.changeAssigneeAction).toHaveBeenCalledWith({
      requestId: 'request-1', requestNumber: RAR, analyst: 'u4', expectedAnalyst: null, analystName: 'Sam Analyst', reason: 'Sam covers this system.',
    });
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${RAR} assigned to Sam Analyst.`, expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
    await waitFor(() => expect(screen.getByText('Assigned to Sam Analyst')).toHaveFocus());
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-key:request-1')).toBeNull();

    await act(async () => lastToastAction()?.onClick());
    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith({ requestId: 'request-1', requestNumber: RAR, analyst: null, expectedAnalyst: 'u4' });
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith(`Assignment undone. ${RAR} is back in the queue.`));
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-key:request-1')).toBeNull();

    await user.click(screen.getByRole('button', { name: `Assign ${RAR}` }));
    const again = await screen.findByRole('dialog', { name: `Assign ${RAR}` });
    expect(within(again).getByRole('textbox', { name: 'Reason (optional)' })).toHaveValue('');
  });

  it('clears the kept reason and choice when a failed picker assignment is recorded through Try again (WR-302)', async () => {
    const user = userEvent.setup();
    const unloadPrevented = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [bob, sam] });
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t change the assignment. Try again.' })
      .mockResolvedValueOnce({ ok: true, data: view({ assignee: sam, assignedBy: bob, assignedAt: at, actions: ['assign-to-me', 'reassign', 'unassign'] }) });
    block(view());

    await user.click(screen.getByRole('button', { name: `Assign ${RAR}` }));
    const picker = await screen.findByRole('dialog', { name: `Assign ${RAR}` });
    await user.click(await within(picker).findByRole('option', { name: 'Sam Analyst' }));
    await user.type(within(picker).getByRole('textbox', { name: 'Reason (optional)' }), 'Sam covers this system.');
    await user.click(within(picker).getByRole('button', { name: 'Assign to Sam Analyst' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not assigned', expect.objectContaining({ action: expect.objectContaining({ label: 'Try again' }) })));
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-key:request-1')).toContain('Sam covers this system.');

    await act(async () => (mocks.toastError.mock.calls[0]?.[1] as Toast).action?.onClick());
    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith(expect.objectContaining({ analyst: 'u4', reason: 'Sam covers this system.' }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${RAR} assigned to Sam Analyst.`, expect.anything()));
    await waitFor(() => expect(window.sessionStorage.getItem('csrm-draft:assign:owner-key:request-1')).toBeNull());
    expect(unloadPrevented()).toBe(false);

    await user.click(screen.getByRole('button', { name: `Reassign ${RAR}` }));
    const again = await screen.findByRole('dialog', { name: `Reassign ${RAR}` });
    expect(within(again).getByRole('textbox', { name: 'Reason (optional)' })).toHaveValue('');
    expect(within(again).queryByText('Restored from earlier in this session.')).not.toBeInTheDocument();
  });

  it('keeps the open picker’s search, choice and list when the block renders again (WR-304)', async () => {
    const user = userEvent.setup();
    mocks.listAssignableAnalystsAction.mockImplementation(async ({ q }: { q?: string }) => ({ ok: true, data: q ? [sam] : [bob, sam] }));
    const assignment = view();
    const props = { assignment, draftOwnerKey: 'owner-key', requestId: 'request-1', requestNumber: RAR, requestStatus: 'submitted' } as const;
    const { rerender } = render(<AssignmentBlock {...props} />);

    await user.click(screen.getByRole('button', { name: `Assign ${RAR}` }));
    const picker = await screen.findByRole('dialog', { name: `Assign ${RAR}` });
    const search = within(picker).getByRole('combobox', { name: 'Search Security Analysts' });
    await user.type(search, 'Sam');
    await waitFor(() => expect(mocks.listAssignableAnalystsAction).toHaveBeenCalledWith({ requestId: 'request-1', q: 'Sam' }));
    await user.click(await within(picker).findByRole('option', { name: 'Sam Analyst' }));
    const reads = mocks.listAssignableAnalystsAction.mock.calls.length;

    /* A generation job's status report, a refresh or a revalidation renders the page, and so the block, again. */
    rerender(<AssignmentBlock {...props} />);
    await act(async () => { await new Promise((done) => setTimeout(done, 350)); });

    expect(within(picker).getByRole('combobox', { name: 'Search Security Analysts' })).toHaveValue('Sam');
    expect(within(picker).getByRole('button', { name: 'Assign to Sam Analyst' })).toBeInTheDocument();
    expect(within(picker).getAllByRole('option').map((option) => option.textContent)).toEqual(['Sam Analyst']);
    expect(mocks.listAssignableAnalystsAction).toHaveBeenCalledTimes(reads);
  });

  it('loads the picker only on demand, through next/dynamic', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-assignment/assignment-block.tsx'), 'utf8');
    expect(source).toContain("from 'next/dynamic'");
    expect(source).toContain("import('./assign-picker')");
    expect(source).not.toMatch(/import \{[^}]*AssignPicker[^}]*\} from '\.\/assign-picker'/);
  });

  it('is a client module that reaches no zod and toasts only through successToast', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-assignment/assignment-block.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).not.toMatch(/from 'zod'|assignment-schema/);
    expect(source).toContain("from '@/components/ui/success-toast'");
    expect(source).toContain("from '@/components/ui/toast-action'");
    expect(source).not.toContain('toast.success');
  });
});

/*
 * D1 (the 13-19 walk; 13-UI-SPEC §5.2, §11): `Pick up on the request page` links to `#assignment`. The request route
 * streams the page in behind its loading boundary, after the browser and the router have tried to scroll there, so the
 * block lands on its own region once it exists: the section comes into view and its heading takes focus (Phase 10 UI-D27).
 */
describe('landing on #assignment (D1)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  const scrolledIds = () => vi.mocked(Element.prototype.scrollIntoView).mock.contexts.map((element) => (element as Element).id);

  it('brings the section into view and focuses its heading once the block exists', async () => {
    window.history.replaceState(null, '', '/app/review/requests/request-1#assignment');
    block(view());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Assignment' })).toHaveFocus());
    expect(scrolledIds()).toContain('assignment');
  });

  it('leaves a fragment that is not its own to its owner', async () => {
    window.history.replaceState(null, '', '/app/review/requests/request-1#notes');
    block(view());
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    expect(screen.getByRole('heading', { name: 'Assignment' })).not.toHaveFocus();
    expect(scrolledIds()).not.toContain('assignment');
  });
});
