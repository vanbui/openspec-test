import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NoteActionResult } from './notes-actions';
import type { RequestNote } from './notes-domain';

const mocks = vi.hoisted(() => ({
  setNoteAiInputAction: vi.fn(),
  successToast: vi.fn(),
  toastError: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('./notes-actions', () => ({ setNoteAiInputAction: mocks.setNoteAiInputAction }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('@/components/ui/toast-action', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/ui/toast-action')>();
  return { toastAction: vi.fn(original.toastAction) };
});

import { toastAction } from '@/components/ui/toast-action';
import { NoteAiInputSwitch } from './note-ai-input-switch';

function note(overrides: Partial<RequestNote> = {}): RequestNote {
  return {
    documentId: 'n1', sequence: 1, body: 'After-hours support comes from an offshore team.', authorPart: 'requestor',
    author: { documentId: 'u-jane', displayName: 'Jane Doe' }, postedAt: '2026-10-01T05:47:00.000Z', unread: false,
    changesAiInputs: false, ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function view(value: RequestNote = note()) {
  return render(
    <article>
      <p id="note-n1-header">Jane Doe Requestor · 1 Oct 2026</p>
      <NoteAiInputSwitch describedBy="note-n1-header" note={value} requestId="request-1" />
    </article>,
  );
}

const theSwitch = () => screen.getByRole('switch', { name: 'Changes the AI inputs' });

/*
 * WR-501: in the browser a toast's Undo or Try again button takes focus when it is pressed, so a check that focus is on
 * the switch afterwards must start from focus somewhere else, or it passes whether or not the switch takes it back.
 */
function focusElsewhere(): HTMLButtonElement {
  const elsewhere = document.createElement('button');
  elsewhere.textContent = 'Stand-in for the toast’s button';
  document.body.append(elsewhere);
  elsewhere.focus();
  expect(theSwitch()).not.toHaveFocus();
  return elsewhere;
}

type ToastOptions = { action?: { label: string; onClick: (event?: unknown) => void }; description?: string };
function lastSuccessAction(): ToastOptions['action'] {
  return (mocks.successToast.mock.calls.at(-1)?.[1] as ToastOptions | undefined)?.action;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('the AI-input switch on a note (13-UI-SPEC §10.1, §10.4; X-18; D-26)', () => {
  it('is a switch labelled Changes the AI inputs and described by the note’s header line', () => {
    view();
    expect(theSwitch()).not.toBeChecked();
    expect(theSwitch()).toHaveAccessibleDescription('Jane Doe Requestor · 1 Oct 2026');
  });

  it('shows a served mark as on', () => {
    view(note({ changesAiInputs: true }));
    expect(theSwitch()).toBeChecked();
  });

  it('flips at once at the pending opacity, sends the mark once, then toasts with Undo through successToast and toastAction', async () => {
    const user = userEvent.setup();
    const answer = deferred<NoteActionResult<RequestNote>>();
    mocks.setNoteAiInputAction.mockReturnValue(answer.promise);
    view();
    await user.click(theSwitch());
    expect(theSwitch()).toBeChecked();
    expect(theSwitch().closest('[data-pending]')).toHaveAttribute('data-pending', 'true');
    expect(mocks.setNoteAiInputAction).toHaveBeenCalledTimes(1);
    expect(mocks.setNoteAiInputAction).toHaveBeenCalledWith({ requestId: 'request-1', noteId: 'n1', changesAiInputs: true });
    focusElsewhere();
    await act(async () => answer.resolve({ ok: true, data: note({ changesAiInputs: true }) }));
    expect(theSwitch()).toBeChecked();
    expect(theSwitch().closest('[data-pending]')).toHaveAttribute('data-pending', 'false');
    expect(mocks.successToast).toHaveBeenCalledWith('Note marked as changing the AI inputs.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    expect(toastAction).toHaveBeenCalledWith('Undo', expect.any(Function));
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(theSwitch()).toHaveFocus();
  });

  it('Undo sends the reverse, turns the switch off, says Mark removed. and keeps focus on the switch', async () => {
    const user = userEvent.setup();
    mocks.setNoteAiInputAction
      .mockResolvedValueOnce({ ok: true, data: note({ changesAiInputs: true }) })
      .mockResolvedValueOnce({ ok: true, data: note({ changesAiInputs: false }) });
    view();
    await user.click(theSwitch());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    focusElsewhere();
    await act(async () => lastSuccessAction()?.onClick());
    expect(mocks.setNoteAiInputAction).toHaveBeenLastCalledWith({ requestId: 'request-1', noteId: 'n1', changesAiInputs: false });
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith('Mark removed.'));
    expect(theSwitch()).not.toBeChecked();
    expect(theSwitch()).toHaveFocus();
  });

  it('turning a mark off says so, and its Undo says Mark restored.', async () => {
    const user = userEvent.setup();
    mocks.setNoteAiInputAction
      .mockResolvedValueOnce({ ok: true, data: note({ changesAiInputs: false }) })
      .mockResolvedValueOnce({ ok: true, data: note({ changesAiInputs: true }) });
    view(note({ changesAiInputs: true }));
    await user.click(theSwitch());
    expect(mocks.setNoteAiInputAction).toHaveBeenCalledWith({ requestId: 'request-1', noteId: 'n1', changesAiInputs: false });
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith('Note no longer marked as changing the AI inputs.', expect.anything()));
    expect(theSwitch()).not.toBeChecked();
    await act(async () => lastSuccessAction()?.onClick());
    await waitFor(() => expect(mocks.successToast).toHaveBeenLastCalledWith('Mark restored.'));
    expect(theSwitch()).toBeChecked();
  });

  it('on a 403 rolls the switch back and shows a danger toast titled Mark not changed with family M’s copy and Refresh page', async () => {
    const user = userEvent.setup();
    const answer = deferred<NoteActionResult<RequestNote>>();
    mocks.setNoteAiInputAction.mockReturnValue(answer.promise);
    view();
    await user.click(theSwitch());
    focusElsewhere();
    await act(async () => answer.resolve({ ok: false, kind: 'blocked', message: 'You can’t change the AI inputs on this request.' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(theSwitch()).not.toBeChecked();
    const [title, options] = mocks.toastError.mock.calls[0] as [string, ToastOptions];
    expect(title).toBe('Mark not changed');
    expect(options.description).toBe('You can’t change the AI inputs on this request.');
    expect(options.action?.label).toBe('Refresh page');
    options.action?.onClick();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.successToast).not.toHaveBeenCalled();
    expect(theSwitch()).toHaveFocus();
  });

  it('on a retryable failure offers Try again, which sends the same mark again', async () => {
    const user = userEvent.setup();
    mocks.setNoteAiInputAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t change the mark. Try again.' })
      .mockResolvedValueOnce({ ok: true, data: note({ changesAiInputs: true }) });
    view();
    await user.click(theSwitch());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const options = mocks.toastError.mock.calls[0]?.[1] as ToastOptions;
    expect(options.action?.label).toBe('Try again');
    focusElsewhere();
    await act(async () => options.action?.onClick());
    expect(mocks.setNoteAiInputAction).toHaveBeenCalledTimes(2);
    expect(mocks.setNoteAiInputAction).toHaveBeenLastCalledWith({ requestId: 'request-1', noteId: 'n1', changesAiInputs: true });
    await waitFor(() => expect(theSwitch()).toBeChecked());
    expect(theSwitch()).toHaveFocus();
  });

  it('treats a network failure reaching the action as retryable, in family M’s words', async () => {
    const user = userEvent.setup();
    mocks.setNoteAiInputAction.mockRejectedValue(new Error('offline'));
    view();
    await user.click(theSwitch());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Mark not changed', expect.objectContaining({ description: 'We couldn’t change the mark. Try again.' })));
    expect(theSwitch()).not.toBeChecked();
  });

  it('is a client module that takes its words from the domain and toasts only through successToast and toastAction', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-notes/note-ai-input-switch.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).toMatch(/aiMarkToast/);
    expect(source).not.toContain('Note marked as changing the AI inputs.');
    expect(source).toMatch(/from '@\/components\/ui\/success-toast'/);
    expect(source).toMatch(/from '@\/components\/ui\/toast-action'/);
    expect(source).not.toMatch(/toast\.success/);
    expect(source).not.toMatch(/from 'zod'|notes-schema/);
    expect(source).toMatch(/setNoteAiInputAction/);
  });
});
