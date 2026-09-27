import { describe, expect, it } from 'vitest';

import {
  HARNESS_PORT_BAND_WIDTH,
  LOWEST_EPHEMERAL_PORT,
  harnessPort,
  harnessPortBands,
  type HarnessPortBand,
} from './e2e-harness-ports';

const bands = Object.entries(harnessPortBands) as Array<[HarnessPortBand, number]>;
const rangeOf = (base: number) => ({ first: base, last: base + HARNESS_PORT_BAND_WIDTH - 1 });

/*
 * SR-10: a harness port inside an ephemeral range can already be held by a connection the run
 * opened, and two bands that overlap can hand two servers of one run the same port.
 */
describe('the harness port bands', () => {
  it.each(bands)('keeps the %s band below every default ephemeral range and above the privileged ports', (_band, base) => {
    const { first, last } = rangeOf(base);
    expect(first).toBeGreaterThanOrEqual(1_024);
    // Linux hands out 32768-60999 by default and Windows 49152-65535.
    expect(last).toBeLessThan(32_768);
    expect(last).toBeLessThan(49_152);
  });

  it('records the lowest default ephemeral port as Linux states it', () => {
    expect(LOWEST_EPHEMERAL_PORT).toBe(32_768);
  });

  it('never lets two bands overlap', () => {
    const overlaps: string[] = [];
    for (const [leftName, leftBase] of bands) {
      for (const [rightName, rightBase] of bands) {
        if (leftName >= rightName) continue;
        const left = rangeOf(leftBase);
        const right = rangeOf(rightBase);
        if (left.first <= right.last && right.first <= left.last) overlaps.push(`${leftName}/${rightName}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('keeps every band clear of the development servers on 1337 and 3000', () => {
    for (const [band, base] of bands) {
      const { first, last } = rangeOf(base);
      for (const port of [1_337, 3_000]) expect(port >= first && port <= last, `${band} holds ${port}`).toBe(false);
    }
  });

  it.each([0, 1, 1_999, 2_000, 12_345, 65_535, 2_147_483_647])('derives a port inside each band for process id %i', (pid) => {
    for (const [band, base] of bands) {
      const port = harnessPort(band, pid);
      expect(port).toBeGreaterThanOrEqual(base);
      expect(port).toBeLessThanOrEqual(rangeOf(base).last);
    }
  });
});
