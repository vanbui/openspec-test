/*
 * X-23 (14-UI-SPEC "File names and sizes"; UI-D24): a file's size in 1,024-byte units, so it reads consistently with
 * the limit's label (`25 MB` is 26,214,400 bytes). Under 1 KB in bytes, under 1 MB in whole kilobytes rounded up
 * (`640 KB`), otherwise in megabytes to one decimal place, rounded up as kilobytes are (`2.4 MB`). Rounding up means a
 * file over the limit never reads as the limit (`25.1 MB` one byte over; IN-404, WR-604), and a size whose kilobytes,
 * rounded up, would reach 1,024 reads in megabytes (`1.0 MB`, never `1,024 KB`). Counts take the voice rules' en-AU
 * grouping (`1,023 bytes`). The renderer adds `tabular-nums`. Plain and dependency-free, so client modules, Server
 * Actions and Phase 19's exports share it (D-24).
 */

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

const whole = new Intl.NumberFormat('en-AU');
const tenths = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatFileSize(bytes: number): string {
  if (bytes < KILOBYTE) return `${whole.format(bytes)} ${bytes === 1 ? 'byte' : 'bytes'}`;
  const kilobytes = Math.ceil(bytes / KILOBYTE);
  if (kilobytes < KILOBYTE) return `${whole.format(kilobytes)} KB`;
  /* Tenths of a megabyte, rounded up; `bytes * 10` is exact, and so is dividing it by a power of two. */
  return `${tenths.format(Math.ceil((bytes * 10) / MEGABYTE) / 10)} MB`;
}
