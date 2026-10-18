import { afterEach, describe, expect, it, vi } from 'vitest';

import { settleScrollInBrowser } from './settle-scroll';

/*
 * A scroller and the page around it whose scroll positions follow `positions`, one entry per animation frame and
 * the last repeating: each entry is [the scroller's scrollLeft, the page's scrollTop]. The entry before the first
 * frame is the reading taken before any frame has run.
 */
function scrollerPerFrame(positions: readonly (readonly [number, number])[]): { node: Element; frames: () => number } {
  let frame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => {
    frame += 1;
    callback(0);
  }, 0));
  const current = () => positions[Math.min(frame, positions.length - 1)]!;
  const page = { scrollLeft: 0, get scrollTop() { return current()[1]; } };
  const node = {
    get scrollLeft() { return current()[0]; },
    scrollTop: 0,
    ownerDocument: { scrollingElement: page },
  } as unknown as Element;
  return { node, frames: () => frame };
}

const label = "getByRole('region', { name: 'Risk Register results, scrolls horizontally', exact: true })";

describe('settleScrollInBrowser', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves once a smooth scroll has stopped for three consecutive frames, a two-frame pause mid-way included', async () => {
    // ArrowRight's 40px as the diagnostic run read it: the main thread saw 37 twice before the animation reached 40.
    const { node, frames } = scrollerPerFrame([[0, 0], [12, 0], [27, 0], [37, 0], [37, 0], [40, 0], [40, 0], [40, 0], [40, 0]]);

    await settleScrollInBrowser(node, { label, frameLimit: 120 });

    // The pause at 37 holds for one frame only; 40 then holds for frames six, seven and eight.
    expect(frames()).toBe(8);
  });

  it('counts the page scrolling as movement, so a page still moving after a focus scroll is waited for', async () => {
    const { node, frames } = scrollerPerFrame([[40, 0], [40, 0], [40, 120], [40, 375], [40, 375], [40, 375], [40, 375]]);

    await settleScrollInBrowser(node, { label, frameLimit: 120 });

    expect(frames()).toBe(6);
  });

  it('fails within the frame limit, naming the element and its last positions, when the scroll never settles', async () => {
    const oscillating = Array.from({ length: 400 }, (_, index): readonly [number, number] => [index % 2 === 0 ? 39 : 40, 0]);
    const { node, frames } = scrollerPerFrame(oscillating);

    const settled = settleScrollInBrowser(node, { label, frameLimit: 120 });

    await expect(settled).rejects.toThrow(/^SCROLL_NEVER_SETTLED: getByRole\('region'.* did not hold its scroll position .* in 120 frames; last positions .*39,0 page 0,0.*40,0 page 0,0/);
    // One reading per frame: the loop stopped at its limit.
    expect(frames()).toBe(120);
  }, 5_000);
});
