/*
 * The in-page half of `settleScrollPosition` (e2e/helpers/settle.ts). Playwright serialises this function into
 * the page, so it must refer to nothing outside itself.
 *
 * A keyboard scroll animates: ArrowRight moves a table region 40px over about ten frames, so the first frame
 * that has moved is not where the scroll stops, and a focus scroll can still be moving the page. The element's
 * scroll position and the page's must hold for three consecutive animation frames.
 */
export type ScrollSettleOptions = {
  /** Names the element in a failure, for example the Locator's own description. */
  label: string;
  /** The most frames to wait. */
  frameLimit: number;
};

/* A scroll that never comes to rest fails after `frameLimit` frames, naming the element and its last positions. */
export async function settleScrollInBrowser(node: Element, { label, frameLimit }: ScrollSettleOptions): Promise<void> {
  const page = node.ownerDocument.scrollingElement;
  const read = () => `${node.scrollLeft},${node.scrollTop} page ${page?.scrollLeft ?? 0},${page?.scrollTop ?? 0}`;
  let previous = read();
  const recent = [previous];
  for (let stable = 0, frames = 0; stable < 3; frames += 1) {
    if (frames >= frameLimit) {
      throw new Error(`SCROLL_NEVER_SETTLED: ${label} did not hold its scroll position for three frames in ${frameLimit} frames; last positions (element left,top page left,top) ${recent.join('; ')}`);
    }
    await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    const current = read();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    recent.push(current);
    if (recent.length > 6) recent.shift();
  }
}
