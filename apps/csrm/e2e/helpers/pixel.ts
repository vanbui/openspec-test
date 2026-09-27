import { inflateSync } from 'node:zlib';

import type { Page } from '@playwright/test';

export type Rgb = { r: number; g: number; b: number };

/*
 * The colour one CSS pixel is painted, read from a 1x1 screenshot of the viewport. A computed style
 * says what an element declares, not what the browser paints: a collapsed table border, for one,
 * keeps its computed width while it is drawn somewhere else. The PNG is decoded with zlib alone: a
 * lone pixel has no neighbour to its left or above, so every PNG row filter leaves its bytes as
 * they are, and no image library is needed.
 */
export async function paintedPixel(page: Page, x: number, y: number): Promise<Rgb> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 }, scale: 'css', animations: 'disabled', caret: 'hide' });
  let offset = 8;
  let bitDepth = 0;
  let colourType = -1;
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      if (body.readUInt32BE(0) !== 1 || body.readUInt32BE(4) !== 1) throw new Error('PIXEL_SCREENSHOT_NOT_ONE_PIXEL');
      bitDepth = body[8];
      colourType = body[9];
    }
    if (type === 'IDAT') data.push(body);
    offset += length + 12;
  }
  // 8-bit truecolour, with or without alpha: the only formats a browser screenshot is written in.
  if (bitDepth !== 8 || (colourType !== 2 && colourType !== 6)) throw new Error(`PIXEL_SCREENSHOT_FORMAT_${bitDepth}_${colourType}`);
  const scanline = inflateSync(Buffer.concat(data));
  return { r: scanline[1], g: scanline[2], b: scanline[3] };
}

/** An `rgb(r, g, b)` or `rgba(r, g, b, a)` computed colour as channels. */
export function rgbOf(computed: string): Rgb {
  const channels = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(computed);
  if (!channels) throw new Error(`PIXEL_COLOUR_UNPARSED ${computed}`);
  return { r: Number(channels[1]), g: Number(channels[2]), b: Number(channels[3]) };
}

/** Whether two colours match within a small tolerance for the browser's colour handling. */
export function sameColour(left: Rgb, right: Rgb, tolerance = 3): boolean {
  return Math.abs(left.r - right.r) <= tolerance && Math.abs(left.g - right.g) <= tolerance && Math.abs(left.b - right.b) <= tolerance;
}
