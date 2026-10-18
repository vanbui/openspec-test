import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { Toaster } from './sonner';

/*
 * The shared toaster (direction §4 Toasts and Buttons; X-14), on every route through the root layout.
 *
 * - WR-602 and the pilot's walk, D3 (WCAG 2.5.8; direction §4 Buttons, "touch targets ≥44px below 768px"): a toast's
 *   Close is at least 24px from 768px and the touch-target height below it, where it sits after the toast's action
 *   rather than over the toast's corner, as the action already is.
 * - D3: the stack keeps the direction's bottom placement, above any bottom sheet that is open (`--open-bottom-sheet-height`,
 *   which the shared Sheet publishes), so a toast never covers the sheet's controls; with no sheet it sits at the page's
 *   gutter, as before.
 */
afterEach(() => {
  act(() => { toast.dismiss(); });
});

async function showToast() {
  render(<Toaster />);
  act(() => { toast.success('vendor-security-pack.pdf included in the AI inputs.', { action: { label: 'Undo', onClick: () => undefined } }); });
  return screen.findByRole('button', { name: 'Close toast' });
}

describe('the toast’s Close (WR-602, D3)', () => {
  it('is 24px from 768px, and below 768px the touch-target height after the action, as the action is', async () => {
    const close = await showToast();
    expect(close).toHaveClass('!size-6', 'max-md:!size-11', 'max-md:!static', 'max-md:!order-last', 'max-md:!transform-none');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveClass('max-md:!min-h-11');
  });
});

describe('the toast stack over an open bottom sheet (D3)', () => {
  it('sits the page’s gutter above the bottom edge, plus the height of any open bottom sheet', async () => {
    await showToast();
    const toaster = document.querySelector<HTMLElement>('[data-sonner-toaster]')!;
    expect(toaster.style.getPropertyValue('--offset-bottom')).toBe('calc(var(--open-bottom-sheet-height, 0px) + var(--gutter-sm))');
    expect(toaster.style.getPropertyValue('--mobile-offset-bottom')).toBe('calc(var(--open-bottom-sheet-height, 0px) + var(--gutter-xs))');
    expect(toaster).toHaveAttribute('data-y-position', 'bottom');
    expect(toaster).toHaveAttribute('data-x-position', 'right');
  });
});
