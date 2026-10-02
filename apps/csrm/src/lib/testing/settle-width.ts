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

export async function settleWidthInBrowser(node: Element, options: WidthSettleOptions): Promise<void> {
  void options;
  const read = () => `${node.scrollWidth}x${node.clientWidth}`;
  let previous = read();
  for (let stable = 0; stable < 3;) {
    await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    const current = read();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
  }
}
