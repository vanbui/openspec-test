import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AssignmentActionResult } from './assignment-actions';
import type { RequestAssignment } from './assignment-domain';

const mocks = vi.hoisted(() => ({
  changeAssigneeAction: vi.fn(),
  successToast: vi.fn(),
  toastError: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('./assignment-actions', () => ({ changeAssigneeAction: mocks.changeAssigneeAction }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('@/components/ui/toast-action', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/ui/toast-action')>();
  return { toastAction: vi.fn(original.toastAction) };
});

import { toastAction } from '@/components/ui/toast-action';
import { QueuePickUpButton } from './queue-pick-up-button';

const bob = { documentId: 'bob-id', displayName: 'Bob Doe' };
const first = 'RAR-2026-0001';
const second = 'RAR-2026-0002';

function served(overrides: Partial<RequestAssignment> = {}): RequestAssignment {
  return { assignee: bob, assignedBy: bob, assignedAt: '2026-10-09T01:02:03.000Z', actions: ['reassign', 'unassign'], ownRequest: false, history: [], viewer: bob, ...overrides };
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolvePromise = done; });
  return { promise, resolve: resolvePromise };
}

/* Two queue rows, each with its request number link and its Pick up, as the table renders them. */
function queue(status = 'submitted') {
  return render(
    <table>
      <tbody>
        <tr>
          <td><a href="/app/review/requests/request-1">{first}</a></td>
          <td><QueuePickUpButton requestId="request-1" requestNumber={first} requestStatus={status} viewer={bob} /></td>
        </tr>
        <tr>
          <td><a href="/app/review/requests/request-2">{second}</a></td>
          <td><QueuePickUpButton requestId="request-2" requestNumber={second} requestStatus={status} viewer={bob} /></td>
        </tr>
      </tbody>
    </table>,
  );
}

type ToastOptions = { action?: { label: string; onClick: (event?: unknown) => void } };
const lastToastAction = () => (mocks.successToast.mock.calls.at(-1)?.[1] as ToastOptions | undefined)?.action;

afterEach(() => {
  vi.clearAllMocks();
});

describe('Pick up from a queue row (13-UI-SPEC §2.2, §7; D-16)', () => {
  it('is an outline small button named for its request', () => {
    queue();
    const button = screen.getByRole('button', { name: `Pick up ${first}` });
    expect(button).toHaveTextContent('Pick up');
    expect(button).toHaveAttribute('data-variant', 'outline');
    expect(button).toHaveAttribute('data-size', 'sm');
  });

  it('shows the viewer’s name at once, sends the pick-up with no expected holder and moves focus to the next Pick up', async () => {
    const user = userEvent.setup();
    const answer = deferred<AssignmentActionResult<RequestAssignment>>();
    mocks.changeAssigneeAction.mockReturnValueOnce(answer.promise);
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    expect(screen.getByText('Bob Doe')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Pick up ${first}` })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Pick up ${second}` })).toHaveFocus();
    expect(mocks.changeAssigneeAction).toHaveBeenCalledTimes(1);
    expect(mocks.changeAssigneeAction).toHaveBeenCalledWith({ requestId: 'request-1', requestNumber: first, analyst: 'bob-id', expectedAnalyst: null });

    await act(async () => answer.resolve({ ok: true, data: served() }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`You picked up ${first}.`, expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
    expect(toastAction).toHaveBeenCalledWith('Undo', expect.any(Function));
    expect(screen.getByText('Bob Doe')).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('moves focus to the row’s request number link when no other Pick up remains', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValue({ ok: true, data: served() });
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${second}` }));
    expect(screen.getByRole('link', { name: second })).toHaveFocus();
  });

  it('Undo sends the return to the queue with the viewer as the expected holder and says the request is back', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: served() })
      .mockResolvedValueOnce({ ok: true, data: served({ assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'] }) });
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastToastAction()?.onClick());

    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith({ requestId: 'request-1', requestNumber: first, analyst: null, expectedAnalyst: 'bob-id' });
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith(`Pick-up undone. ${first} is back in the queue.`));
    expect(await screen.findByRole('button', { name: `Pick up ${first}` })).toHaveFocus();
  });

  it('offers no Undo on a released request, whose toast says how to change who holds it', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: true, data: served() });
    queue('approved');

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`You picked up ${first}. Reassign it if someone else should hold it.`, { action: undefined }));
  });

  it('rolls a refusal back to Pick up and shows family K’s copy in a danger toast', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: false, kind: 'blocked', reason: 'ASSIGNMENT_CHANGED', message: 'Sam Analyst now holds this request, so your change wasn’t made.', currentHolder: 'Sam Analyst' });
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not picked up', expect.objectContaining({
      description: 'Sam Analyst now holds this request, so your change wasn’t made.',
      action: expect.objectContaining({ label: 'Refresh page' }),
    })));
    expect(await screen.findByRole('button', { name: `Pick up ${first}` })).toBeInTheDocument();
    expect(mocks.successToast).not.toHaveBeenCalled();
    // ASSIGNMENT_CHANGED reads the queue again at once, so the row names who holds it now (§7.2).
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('offers Try again on a retryable failure, which sends the same pick-up again', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t change the assignment. Try again.' })
      .mockResolvedValueOnce({ ok: true, data: served() });
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const options = mocks.toastError.mock.calls[0]?.[1] as ToastOptions;
    expect(options.action?.label).toBe('Try again');
    await act(async () => options.action?.onClick());
    await waitFor(() => expect(mocks.changeAssigneeAction).toHaveBeenCalledTimes(2));
    expect(mocks.changeAssigneeAction).toHaveBeenLastCalledWith({ requestId: 'request-1', requestNumber: first, analyst: 'bob-id', expectedAnalyst: null });
  });

  /* WR-301: a call that never reaches the Server Action (the network, a stale deploy) rolls back in place, never the error page. */
  it('rolls a pick-up whose call fails in transport back to Pick up with family K’s retryable copy (WR-301)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Request not picked up', expect.objectContaining({
      description: 'We couldn’t change the assignment. Try again.',
      action: expect.objectContaining({ label: 'Try again' }),
    })));
    expect(await screen.findByRole('button', { name: `Pick up ${first}` })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it('tells the person when an Undo’s call fails in transport, titled Couldn’t undo, with Try again (WR-301)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: served() })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    queue();

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastToastAction()?.onClick());

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Couldn’t undo', expect.objectContaining({
      description: 'We couldn’t change the assignment. Try again.',
      action: expect.objectContaining({ label: 'Try again' }),
    })));
    expect(screen.getByText('Bob Doe')).toBeInTheDocument();
  });

  /*
   * D2 (the pilot's walk, W11): in a filtered queue (Assigned to: Not picked up) the queue read again after a pick-up no
   * longer lists the row, which takes the focused request number link with it. Focus must not fall to the page body
   * (§7.3): it goes to the list's empty state, or to the page heading when other rows remain.
   */
  function filteredQueue(rows: 'one' | 'none' | 'own') {
    return (
      <main>
        <h1>Requests</h1>
        {rows === 'none' ? (
          <section data-slot="state"><h2>No assessment requests match these filters</h2></section>
        ) : (
          <table>
            <tbody>
              {rows === 'one' ? (
                <tr>
                  <td><a href="/app/review/requests/request-1">{first}</a></td>
                  <td><QueuePickUpButton requestId="request-1" requestNumber={first} requestStatus="submitted" viewer={bob} /></td>
                </tr>
              ) : null}
              <tr>
                <td><a href="/app/review/requests/request-own">RAR-2026-0009</a></td>
                <td>You raised it</td>
              </tr>
            </tbody>
          </table>
        )}
      </main>
    );
  }

  it('moves focus to the empty state when the queue read again no longer lists the only row picked up (D2)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: true, data: served() });
    const view = render(filteredQueue('one'));

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    expect(screen.getByRole('link', { name: first })).toHaveFocus();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());

    view.rerender(filteredQueue('none'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No assessment requests match these filters' })).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it('moves focus to the page heading when the row picked up leaves a queue that still lists others (D2)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockResolvedValueOnce({ ok: true, data: served() });
    const view = render(filteredQueue('one'));

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    expect(screen.getByRole('link', { name: first })).toHaveFocus();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());

    view.rerender(filteredQueue('own'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Requests', level: 1 })).toHaveFocus());
  });

  /*
   * IN-302: a request an Undo put back takes focus when its Pick up is rendered again, but only while the queue is
   * being read again: a request the refreshed queue no longer lists must not steal focus whenever it appears later.
   */
  it('does not let a request an Undo restored steal focus once the queue has been read again without it (IN-302)', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction
      .mockResolvedValueOnce({ ok: true, data: served() })
      .mockResolvedValueOnce({ ok: true, data: served({ assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'] }) });
    const view = render(filteredQueue('one'));

    await user.click(screen.getByRole('button', { name: `Pick up ${first}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    /* The queue read again no longer lists it; the Undo succeeds, but someone else picks it up before the next read. */
    view.rerender(filteredQueue('own'));
    await act(async () => lastToastAction()?.onClick());
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith(`Pick-up undone. ${first} is back in the queue.`));

    const later = Date.now() + 60_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(later);
    try {
      const own = screen.getByRole('link', { name: 'RAR-2026-0009' });
      own.focus();
      view.rerender(filteredQueue('one'));
      expect(screen.getByRole('button', { name: `Pick up ${first}` })).not.toHaveFocus();
      expect(own).toHaveFocus();
    } finally {
      now.mockRestore();
    }
  });

  it('is full width at the touch height on a phone card, and the card says who holds it once picked up', async () => {
    const user = userEvent.setup();
    mocks.changeAssigneeAction.mockReturnValueOnce(new Promise(() => undefined));
    render(<QueuePickUpButton layout="card" requestId="request-1" requestNumber={first} requestStatus="submitted" viewer={bob} />);
    const button = screen.getByRole('button', { name: `Pick up ${first}` });
    expect(button.className).toMatch(/\bw-full\b/);
    expect(button.className).toMatch(/\bmin-h-11\b/);

    await user.click(button);
    expect(screen.getByText('Assigned to Bob Doe')).toBeInTheDocument();
  });

  it('is a client module that toasts only through successToast and toastAction', () => {
    const source = readFileSync(resolve(__dirname, 'queue-pick-up-button.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).toContain('successToast');
    expect(source).toContain('toastAction');
    expect(source).not.toContain('toast.success');
  });
});
