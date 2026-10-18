import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ successToast: vi.fn(), toast: vi.fn(), toastError: vi.fn() }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
vi.mock('sonner', () => ({ toast: Object.assign(mocks.toast, { error: mocks.toastError }) }));
vi.mock('@/components/ui/toast-action', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/ui/toast-action')>();
  return { toastAction: vi.fn(original.toastAction) };
});

import { toastAction } from '@/components/ui/toast-action';
import { UnsentNoteWell } from './unsent-note-well';

const text = 'The vendor’s support team\nworks from two regions.';

type ToastOptions = { action?: { label: string; onClick: (event?: unknown) => void }; description?: string };
function lastSuccessAction(): ToastOptions['action'] {
  return (mocks.successToast.mock.calls.at(-1)?.[1] as ToastOptions | undefined)?.action;
}

function well(props: Partial<Parameters<typeof UnsentNoteWell>[0]> = {}) {
  const onDiscard = vi.fn();
  const onRestore = vi.fn();
  render(<UnsentNoteWell onDiscard={onDiscard} onRestore={onRestore} text={text} {...props} />);
  return { onDiscard, onRestore };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('the unsent-text well (13-UI-SPEC §9.4; D-22; UI-D19)', () => {
  it('holds the text read-only on the inset fill, line breaks kept, with Copy text and Discard text as ghost small buttons', () => {
    well();
    const body = document.querySelector('[data-unsent-note]')!;
    expect(body.textContent).toBe(text);
    expect(body).toHaveClass('whitespace-pre-wrap', '[overflow-wrap:anywhere]');
    // UI-08 (13-UI-SPEC token names): the well's fill is named as the contract names --color-bg-inset.
    expect(body.closest('.bg-surface-muted')).not.toBeNull();
    expect(body.closest('.bg-muted')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    for (const name of ['Copy text', 'Discard text']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('data-variant', 'ghost');
      expect(button).toHaveAttribute('data-size', 'sm');
    }
  });

  it('copies the text to the clipboard and says Note text copied.', async () => {
    const user = userEvent.setup();
    well();
    await user.click(screen.getByRole('button', { name: 'Copy text' }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith('Note text copied.'));
    await expect(navigator.clipboard.readText()).resolves.toBe(text);
  });

  /* UI-04 (13-UI-SPEC Color: danger is for rollback toasts): the text is selected, so the refusal is a neutral toast. */
  it('selects the text and says so in a neutral toast when the browser refuses the clipboard', async () => {
    const user = userEvent.setup();
    well();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    await user.click(screen.getByRole('button', { name: 'Copy text' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Note text not copied', expect.objectContaining({ description: 'The text is selected, so you can copy it yourself.' })));
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(window.getSelection()?.toString()).toBe(text);
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it('discards at once with an Undo toast, and Undo puts the text back and focuses Copy text', async () => {
    const user = userEvent.setup();
    const { onDiscard, onRestore } = well();
    await user.click(screen.getByRole('button', { name: 'Discard text' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-unsent-note]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy text' })).toBeNull();
    expect(mocks.successToast).toHaveBeenCalledWith('Note text discarded.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    expect(toastAction).toHaveBeenCalledWith('Undo', expect.any(Function));
    await act(async () => lastSuccessAction()?.onClick());
    expect(onRestore).toHaveBeenCalledWith(text);
    expect(document.querySelector('[data-unsent-note]')?.textContent).toBe(text);
    expect(mocks.successToast).toHaveBeenLastCalledWith('Note text restored.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy text' })).toHaveFocus());
  });

  /*
   * IN-304 (UI-D18): the well holds kept text that only the tab's store still has, so closing the tab must ask while it
   * shows; once the text is discarded nothing is left to lose, and Undo arms the prompt again.
   */
  it('arms the browser’s leave prompt while it shows the text, and disarms it once the text is discarded (IN-304)', async () => {
    const user = userEvent.setup();
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    well();
    expect(leave()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Discard text' }));
    expect(leave()).toBe(false);
    await act(async () => lastSuccessAction()?.onClick());
    expect(leave()).toBe(true);
  });

  /*
   * 14-UI-SPEC §4.3 (UI-D10): when notes close with files not yet posted, the well lists their names beneath the text, and
   * `Discard text` reads `Discard note` and discards both under the same Undo toast.
   */
  it('lists unsent files’ names beneath the text, and Discard note discards both under one Undo toast', async () => {
    const user = userEvent.setup();
    const { onDiscard, onRestore } = well({ files: ['architecture-deck.pptx', 'data-flow.docx'] });
    const names = screen.getByRole('list', { name: 'Files to add with this note' });
    expect(within(names).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['architecture-deck.pptx', 'data-flow.docx']);
    const body = document.querySelector('[data-unsent-note]')!;
    expect(body.compareDocumentPosition(names) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Discard text' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Discard note' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('list', { name: 'Files to add with this note' })).toBeNull();
    expect(mocks.successToast).toHaveBeenCalledTimes(1);
    /* IN-504 (14-UI-SPEC §9, amended on 2026-10-11 in stage B): the note had files, so the toasts say Note, not Note text. */
    expect(mocks.successToast).toHaveBeenCalledWith('Note discarded.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    await act(async () => lastSuccessAction()?.onClick());
    expect(onRestore).toHaveBeenCalledWith(text);
    expect(screen.getByRole('list', { name: 'Files to add with this note' })).toBeInTheDocument();
    expect(mocks.successToast).toHaveBeenLastCalledWith('Note restored.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy text' })).toHaveFocus());
  });

  /* IN-504: with files and no text there is no Copy text, so Undo puts focus on the well's one action, never the page. */
  it('with files and no text, Undo gives the files back with focus on Discard note, and the toasts say Note (IN-504)', async () => {
    const user = userEvent.setup();
    const { onRestore } = well({ text: '', files: ['architecture-deck.pptx'] });
    expect(screen.queryByRole('button', { name: 'Copy text' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Discard note' }));
    expect(mocks.successToast).toHaveBeenCalledWith('Note discarded.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    await act(async () => lastSuccessAction()?.onClick());
    expect(onRestore).toHaveBeenCalledWith('');
    expect(mocks.successToast).toHaveBeenLastCalledWith('Note restored.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Discard note' })).toHaveFocus());
  });

  it('keeps Discard text when no file is waiting', () => {
    well({ files: [] });
    expect(screen.getByRole('button', { name: 'Discard text' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Files to add with this note' })).toBeNull();
  });

  it('is a client module that takes its words from the domain and toasts only through successToast and toastAction', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-notes/unsent-note-well.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).toMatch(/unsentWellCopy/);
    expect(source).not.toMatch(/'Copy text'|'Discard text'/);
    expect(source).toMatch(/from '@\/components\/ui\/success-toast'/);
    expect(source).toMatch(/from '@\/components\/ui\/toast-action'/);
    expect(source).not.toMatch(/toast\.success/);
    expect(source).not.toMatch(/from 'zod'|notes-schema/);
  });
});
