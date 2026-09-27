import { describe, expect, it } from 'vitest';

import { validatedReturnTo } from './return-to';

/*
 * SR-08: the sign-in page carries this value in its form and the sign-in action redirects to it,
 * and the browser resolves the redirect against the web origin with WHATWG URL parsing. That parser
 * drops tab and newline, reads a backslash as a slash and resolves dot segments, so a value that
 * merely starts with one slash can still name another origin: `/sign-in?returnTo=/%09/evil.example`
 * reaches the validator as `/\t/evil.example`, which the browser resolves to `//evil.example`. Only a
 * same-origin absolute path may come back; everything else is the fallback.
 */
const webOrigin = 'https://csrm.example';

const hostile: ReadonlyArray<readonly [label: string, value: string]> = [
  ['a tab after the leading slash, as /sign-in?returnTo=/%09/evil.example delivers it', '/\t/evil.example'],
  ['a newline after the leading slash', '/\n/evil.example'],
  ['a carriage return and newline after the leading slash', '/\r\n/evil.example'],
  ['a tab inside the path', '/app/\trequests'],
  ['a NUL character', '/app\u0000'],
  ['a DEL character', '/app\u007f'],
  ['a backslash after the leading slash', '/\\evil.example'],
  ['a backslash inside the path', '/app\\review'],
  ['a protocol-relative URL', '//evil.example'],
  ['three slashes', '///evil.example'],
  ['a slash and a backslash', '/\\/evil.example'],
  ['a percent-encoded tab', '/%09/evil.example'],
  ['a percent-encoded newline', '/%0a/evil.example'],
  ['a percent-encoded carriage return and newline', '/%0D%0A/evil.example'],
  ['a percent-encoded backslash', '/%5Cevil.example'],
  ['a percent-encoded second slash', '/%2F/evil.example'],
  ['two percent-encoded slashes in lower case', '/%2f%2fevil.example'],
  ['a dot segment that resolves to a protocol-relative path', '/.//evil.example'],
  ['an encoded dot segment that resolves to a protocol-relative path', '/%2e//evil.example'],
  ['an absolute URL', 'https://evil.example/app'],
  ['a javascript URL', 'javascript:alert(1)'],
  ['a relative path', 'app/requests'],
  ['an empty value', ''],
];

describe('validatedReturnTo', () => {
  it.each([
    '/app',
    '/app/requests/new',
    '/app/requests/abc123',
    '/app/risks?sort=targetDate%3Aasc&pageSize=25',
    '/app/requests?status=submitted#results',
    '/app/review/requests/abc123?queue=awaiting-requestor',
  ])('keeps the same-origin path %s', (path) => {
    expect(validatedReturnTo(path)).toBe(path);
  });

  it.each(hostile)('refuses %s', (_label, value) => {
    expect(validatedReturnTo(value)).toBe('/app');
  });

  it('never returns a value the browser would resolve to another origin', () => {
    for (const [label, value] of hostile) {
      expect(new URL(validatedReturnTo(value), webOrigin).origin, label).toBe(webOrigin);
    }
  });

  it("returns the caller's fallback for a missing or refused value", () => {
    expect(validatedReturnTo(undefined)).toBe('/app');
    expect(validatedReturnTo(null)).toBe('/app');
    expect(validatedReturnTo('/\t/evil.example', '/app/requests')).toBe('/app/requests');
  });
});
