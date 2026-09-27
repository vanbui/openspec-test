/*
 * The return path the sign-in page carries in its form and the sign-in action redirects to. The
 * browser resolves that redirect against the web origin with WHATWG URL parsing, which drops tab and
 * newline, reads a backslash as a slash and resolves dot segments, so a value that merely starts with
 * one slash can still name another origin: `/\t/evil.example` resolves to `//evil.example` (SR-08).
 * Only a same-origin absolute path comes back, serialised from its parsed form; anything else is the
 * fallback.
 */
const returnToBase = new URL('http://return-to.invalid');
/** A control character or a backslash, literal or percent-encoded, anywhere in the value. */
const unsafeCharacter = /[\u0000-\u001F\u007F\\]|%(?:[01][0-9A-F]|7F|5C)/i;
/** A second slash or backslash straight after the first, literal or percent-encoded. */
const protocolRelative = /^\/(?:[/\\]|%2F|%5C)/i;

export function validatedReturnTo(returnTo: string | null | undefined, fallback = '/app'): string {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) return fallback;
  if (protocolRelative.test(returnTo) || unsafeCharacter.test(returnTo)) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(returnTo, returnToBase);
  } catch {
    return fallback;
  }
  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  // Dot segments are resolved by now, so `/.//evil.example` would come back as `//evil.example`.
  return parsed.origin === returnToBase.origin && !protocolRelative.test(path) ? path : fallback;
}
