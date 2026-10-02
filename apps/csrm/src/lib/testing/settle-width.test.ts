import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { settleWidthInBrowser } from './settle-width';

/** An element whose scroll and client widths follow `widths`, one reading per call, the last repeating. */
function elementReading(widths: readonly (readonly [number, number])[]): { node: Element; readings: () => number } {
  let reading = 0;
  const current = () => widths[Math.min(reading, widths.length - 1)]!;
  const node = {
    get scrollWidth() { return current()[0]; },
    get clientWidth() {
      const [, client] = current();
      reading += 1;
      return client;
    },
  } as unknown as Element;
  return { node, readings: () => reading };
}

const label = "locator('[data-overflow]')";

describe('settleWidthInBrowser (WR-403)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('resolves once the widths hold for three consecutive frames, a change starting the count again', async () => {
    const { node, readings } = elementReading([[900, 880], [900, 880], [1200, 880], [1200, 880], [1200, 880], [1200, 880]]);

    await settleWidthInBrowser(node, { label, frameLimit: 120 });

    // The first reading, one stable frame, a change, then three stable frames.
    expect(readings()).toBe(6);
  });

  it('fails within the frame limit, naming the element and its last widths, when the layout never settles', async () => {
    const oscillating = Array.from({ length: 400 }, (_, index) => (index % 2 === 0 ? [900, 880] : [1200, 880]) as const);
    const { node, readings } = elementReading(oscillating);

    const settled = settleWidthInBrowser(node, { label, frameLimit: 120 });

    await expect(settled).rejects.toThrow(/^WIDTH_NEVER_SETTLED: locator\('\[data-overflow\]'\) did not hold .* in 120 frames; last widths .*900x880.*1200x880/);
    // The first reading and one per frame: the loop stopped at its limit.
    expect(readings()).toBe(121);
  }, 5_000);
});
