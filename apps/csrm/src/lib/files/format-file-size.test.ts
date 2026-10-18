import { describe, expect, it } from 'vitest';

import { formatFileSize } from './format-file-size';

/*
 * X-23 (14-UI-SPEC "File names and sizes"; UI-D24): sizes use 1,024-byte units to match the limit's label, `25 MB`.
 * Under 1 KB in bytes, under 1 MB in whole kilobytes rounded up, otherwise in megabytes to one decimal place, rounded up
 * as kilobytes are (IN-404, WR-604), so a file over the limit never reads as the limit. Counts take en-AU grouping (the
 * voice rules' `1,204`).
 */
describe('formatFileSize (X-23)', () => {
  it('names a size under 1 KB in bytes, grouped as en-AU counts are (IN-404)', () => {
    expect(formatFileSize(1023)).toBe('1,023 bytes');
    expect(formatFileSize(82)).toBe('82 bytes');
    expect(formatFileSize(1)).toBe('1 byte');
  });

  it('names a size under 1 MB in whole kilobytes, rounded up', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(655_000)).toBe('640 KB');
    expect(formatFileSize(1_047_552)).toBe('1,023 KB');
  });

  it('names a size in megabytes once its kilobytes, rounded up, would reach 1,024 (IN-404)', () => {
    expect(formatFileSize(1_047_553)).toBe('1.0 MB');
    expect(formatFileSize(1_048_064)).toBe('1.0 MB');
    expect(formatFileSize(1_048_575)).toBe('1.0 MB');
  });

  it('names a size from 1 MB in megabytes to one decimal place, rounded up (IN-404, WR-604)', () => {
    expect(formatFileSize(1_048_576)).toBe('1.0 MB');
    expect(formatFileSize(1_048_577)).toBe('1.1 MB');
    expect(formatFileSize(2_516_582)).toBe('2.4 MB');
    expect(formatFileSize(12_582_912)).toBe('12.0 MB');
    expect(formatFileSize(26_214_400)).toBe('25.0 MB');
    expect(formatFileSize(26_214_401)).toBe('25.1 MB');
    expect(formatFileSize(31_457_280)).toBe('30.0 MB');
    expect(formatFileSize(1_048_576_000)).toBe('1,000.0 MB');
  });
});
