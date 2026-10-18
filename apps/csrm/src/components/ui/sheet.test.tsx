import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestResizeObserver, installTestResizeObserver } from '@/test/layout-stubs';
import { Sheet, SheetContent, SheetTitle } from './sheet';

/*
 * The pilot's walk, D3: while a bottom sheet that leaves room above it is open, the shared Sheet publishes its height
 * as `--open-bottom-sheet-height` on the document, so the toaster (sonner.tsx) stacks its toasts above the sheet and
 * never over its controls. A sheet that fills the screen leaves nowhere above it, so it publishes nothing and the toasts
 * keep their corner; a side sheet publishes nothing. Closing the sheet withdraws the height.
 *
 * jsdom lays nothing out, so the sheet's laid-out height is stubbed.
 */
const sheetHeight = () => document.documentElement.style.getPropertyValue('--open-bottom-sheet-height');
let height = 0;
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

beforeEach(() => {
  installTestResizeObserver();
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) { return this.dataset.slot === 'sheet-content' ? height : 0; },
  });
});

afterEach(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight);
  vi.unstubAllGlobals();
});

function sheet(open: boolean, side: 'bottom' | 'right' = 'bottom') {
  return (
    <Sheet open={open}>
      <SheetContent aria-describedby={undefined} side={side}>
        <SheetTitle>vendor-security-pack.pdf</SheetTitle>
      </SheetContent>
    </Sheet>
  );
}

describe('an open bottom sheet’s height, for the toaster (D3)', () => {
  it('is published while the sheet is open, follows its size, and is withdrawn when it closes', () => {
    height = 300;
    const view = render(sheet(true));
    expect(sheetHeight()).toBe('300px');

    height = 360;
    act(() => TestResizeObserver.notifyAll());
    expect(sheetHeight()).toBe('360px');

    view.rerender(sheet(false));
    expect(sheetHeight()).toBe('');
  });

  it('is not published for a bottom sheet that fills the screen', () => {
    height = window.innerHeight;
    render(sheet(true));
    expect(sheetHeight()).toBe('');
  });

  it('is not published for a side sheet', () => {
    height = 300;
    render(sheet(true, 'right'));
    expect(sheetHeight()).toBe('');
  });
});
