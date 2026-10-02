/*
 * The in-page half of `settleElementWidth` (e2e/helpers/settle.ts). Playwright serialises this function into
 * the page, so it must refer to nothing outside itself.
 *
 * Right after a viewport change the layout can still be settling, so a single early reading can see the
 * previous width's layout. The element's scroll and client widths must hold for three consecutive animation
 * frames.
 */
export type WidthSettleOptions = {
  /** Names the element in a failure, for example the Locator's own description. */
  label: string;
  /** The most frames to wait. */
  frameLimit: number;
};

/*
 * WR-403: a layout that keeps changing (a ResizeObserver feedback loop toggling the width, for example) fails
 * after `frameLimit` frames with the element and its last readings, instead of hanging until the test timeout.
 */
export async function settleWidthInBrowser(node: Element, { label, frameLimit }: WidthSettleOptions): Promise<void> {
  const read = () => `${node.scrollWidth}x${node.clientWidth}`;
  let previous = read();
  const recent = [previous];
  for (let stable = 0, frames = 0; stable < 3; frames += 1) {
    if (frames >= frameLimit) {
      throw new Error(`WIDTH_NEVER_SETTLED: ${label} did not hold its widths for three frames in ${frameLimit} frames; last widths (scroll x client) ${recent.join(', ')}`);
    }
    await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    const current = read();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    recent.push(current);
    if (recent.length > 6) recent.shift();
  }
}
