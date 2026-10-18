import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

import { SUCCESS_TOAST_DURATION_MS, successToast } from './success-toast';

/* The toast region Sonner draws, holding one toast with its Close and its action, beside a control on the page. */
function toastRegion() {
  const page = document.createElement('button');
  const list = document.createElement('ol');
  list.setAttribute('data-sonner-toaster', '');
  const item = document.createElement('li');
  item.setAttribute('data-sonner-toast', '');
  const close = document.createElement('button');
  const undo = document.createElement('button');
  item.append(close, undo);
  list.append(item);
  document.body.append(page, list);
  return { close, page, undo };
}

/* The options Sonner received for the last toast. */
function lastOptions(): { id: string; duration: number; action?: { label: string; onClick: (event: unknown) => void }; onDismiss?: (toast: unknown) => void } {
  return toast.success.mock.calls.at(-1)?.[1];
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

describe('successToast (direction §4 Toasts, X-14; WCAG 2.2.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toast.success.mockReset();
    toast.dismiss.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('closes after the direction’s 5s success timing, and leaves Sonner no timer of its own', () => {
    successToast('Issue statement confirmed on RSK-001.');
    expect(SUCCESS_TOAST_DURATION_MS).toBe(5_000);
    expect(toast.success).toHaveBeenCalledWith('Issue statement confirmed on RSK-001.', expect.objectContaining({ duration: Infinity }));
    const { id } = lastOptions();
    advance(SUCCESS_TOAST_DURATION_MS - 1);
    expect(toast.dismiss).not.toHaveBeenCalled();
    advance(1);
    expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith(id);
  });

  it('pauses while focus is inside the toast region, however it got there, and resumes with the time it had left', () => {
    const { close, page, undo } = toastRegion();
    successToast('Issue statement confirmed on RSK-001.', { action: { label: 'Undo', onClick: vi.fn() } });
    const { id } = lastOptions();
    advance(2_000);
    act(() => close.focus());
    advance(1_000);
    act(() => undo.focus());
    advance(30_000);
    expect(toast.dismiss).not.toHaveBeenCalled();
    act(() => page.focus());
    advance(2_999);
    expect(toast.dismiss).not.toHaveBeenCalled();
    advance(1);
    expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith(id);
  });

  it('pauses while the pointer is over the toast region, as Sonner does', () => {
    const { page, undo } = toastRegion();
    successToast('Suggestion dismissed: UATA-001 · File integrity verification.');
    const { id } = lastOptions();
    advance(1_000);
    fireEvent.mouseOver(undo);
    advance(30_000);
    expect(toast.dismiss).not.toHaveBeenCalled();
    fireEvent.mouseOut(undo, { relatedTarget: page });
    advance(3_999);
    expect(toast.dismiss).not.toHaveBeenCalled();
    advance(1);
    expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith(id);
  });

  it('pauses while the page is hidden, as Sonner does', () => {
    successToast('Confirmation undone.');
    const { id } = lastOptions();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    advance(30_000);
    expect(toast.dismiss).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    advance(SUCCESS_TOAST_DURATION_MS);
    expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith(id);
    hidden.mockRestore();
  });

  it('keeps the action’s label, runs it, and closes nothing more once the action or a dismissal ends the toast', () => {
    const onClick = vi.fn();
    successToast('Issue statement confirmed on RSK-001.', { action: { label: 'Undo', onClick } });
    const confirmed = lastOptions();
    expect(confirmed.action?.label).toBe('Undo');
    confirmed.action?.onClick('click');
    expect(onClick).toHaveBeenCalledExactlyOnceWith('click');

    successToast('Confirmation undone.');
    lastOptions().onDismiss?.({});
    advance(60_000);
    expect(toast.dismiss).not.toHaveBeenCalled();
  });
});
