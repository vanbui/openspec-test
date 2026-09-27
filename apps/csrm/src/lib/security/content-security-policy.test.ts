import { getScriptNonceFromHeader } from 'next/dist/server/app-render/get-script-nonce-from-header';
import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy, CSP_NONCE_PATTERN } from './content-security-policy';

/*
 * The Content-Security-Policy every page response carries (D-19, D-42, T-08-10-01 to T-08-10-03).
 * The builder is pure: proxy.ts calls it once per request with a fresh nonce, whether the build runs
 * under `next dev`, and whether the request arrived over HTTPS.
 */

const productionDirectives = [
  "default-src 'self'",
  "script-src 'self' 'nonce-abc' 'strict-dynamic'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
] as const;

function build(overrides: Partial<Parameters<typeof buildContentSecurityPolicy>[0]> = {}): string {
  return buildContentSecurityPolicy({ nonce: 'abc', development: false, https: false, ...overrides });
}

const directivesOf = (policy: string): string[] => policy.split('; ');
const directiveNamed = (policy: string, name: string): string | undefined =>
  directivesOf(policy).find((directive) => directive.split(' ')[0] === name);
const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;

describe('the production policy (next build, next start)', () => {
  const policy = build();

  it('is exactly the documented directives, joined by "; "', () => {
    expect(policy).toBe(productionDirectives.join('; '));
  });

  it('never allows eval and adds no upgrade over plain HTTP', () => {
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain('upgrade-insecure-requests');
  });

  it("keeps scripts strict: a nonce with 'strict-dynamic', and 'unsafe-inline' only in style-src", () => {
    expect(directiveNamed(policy, 'script-src')).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(occurrences(policy, "'unsafe-inline'")).toBe(1);
    expect(directiveNamed(policy, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('carries the nonce once, in script-src only', () => {
    expect(occurrences(policy, "'nonce-")).toBe(1);
    expect(directiveNamed(policy, 'style-src')).not.toContain('nonce');
  });

  it('refuses framing, plugins and a foreign base URL', () => {
    expect(directiveNamed(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directiveNamed(policy, 'object-src')).toBe("object-src 'none'");
    expect(directiveNamed(policy, 'base-uri')).toBe("base-uri 'self'");
    expect(directiveNamed(policy, 'form-action')).toBe("form-action 'self'");
  });

  it('names every directive once', () => {
    const names = directivesOf(policy).map((directive) => directive.split(' ')[0]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('the development policy (next dev)', () => {
  /*
   * next dev differs in one source only. React's development build evaluates code to rebuild
   * server error stacks in the browser, and the development runtime evaluates hot updates, so
   * script-src gains 'unsafe-eval'. Everything else is the production policy: the nonce and
   * 'strict-dynamic' stay, styles are unchanged, and the hot-reload socket
   * (ws://<same host>/_next/webpack-hmr) is same-origin, which connect-src 'self' already allows.
   */
  const production = build();
  const development = build({ development: true });

  it("adds 'unsafe-eval' to script-src", () => {
    expect(directiveNamed(development, 'script-src')).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic' 'unsafe-eval'");
  });

  it('changes nothing else', () => {
    const withoutScripts = (policy: string) => directivesOf(policy).filter((directive) => !directive.startsWith('script-src '));
    expect(withoutScripts(development)).toEqual(withoutScripts(production));
    expect(directivesOf(development)).toHaveLength(directivesOf(production).length);
  });

  it('is exactly this policy', () => {
    expect(development).toBe([
      "default-src 'self'",
      "script-src 'self' 'nonce-abc' 'strict-dynamic' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '));
  });

  it("still allows no inline script: 'unsafe-inline' stays out of script-src", () => {
    expect(directiveNamed(development, 'script-src')).not.toContain("'unsafe-inline'");
    expect(occurrences(development, "'unsafe-inline'")).toBe(1);
  });
});

describe('a request that arrived over HTTPS', () => {
  it('appends upgrade-insecure-requests as the last directive', () => {
    expect(build({ https: true })).toBe(`${productionDirectives.join('; ')}; upgrade-insecure-requests`);
  });

  it('keeps the development difference', () => {
    const policy = build({ https: true, development: true });
    expect(directiveNamed(policy, 'script-src')).toContain("'unsafe-eval'");
    expect(directivesOf(policy).at(-1)).toBe('upgrade-insecure-requests');
  });
});

describe('the nonce', () => {
  it.each(['', ' ', "abc'", 'abc;', 'abc def', 'a"b', 'a\nb', 'abc*', 'ab=c', '=abc', 'abc===', 'é', "'; script-src *"])(
    'refuses %j before it can reach a header',
    (nonce) => {
      expect(() => build({ nonce })).toThrow(/^CSP_NONCE_INVALID/);
    },
  );

  it.each(['abc', 'QUJD+/09', 'QUJD-_09', 'YWJj', 'YWI=', 'YQ=='])('accepts the base64 or base64url nonce %j', (nonce) => {
    expect(CSP_NONCE_PATTERN.test(nonce)).toBe(true);
    expect(directiveNamed(build({ nonce }), 'script-src')).toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
  });

  it('never echoes a refused nonce in the error', () => {
    let message = '';
    try {
      build({ nonce: 'leak me;' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^CSP_NONCE_INVALID/);
    expect(message).not.toContain('leak me');
  });

  it('is the nonce Next extracts from the request header and applies to its own scripts', () => {
    // The proxy generates the nonce this way; Next reads it back with this function (app-render).
    for (const development of [false, true]) {
      for (const https of [false, true]) {
        const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
        expect(CSP_NONCE_PATTERN.test(nonce)).toBe(true);
        expect(getScriptNonceFromHeader(buildContentSecurityPolicy({ nonce, development, https }))).toBe(nonce);
      }
    }
  });
});
