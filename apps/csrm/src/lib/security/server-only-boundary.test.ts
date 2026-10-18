import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The server-only boundary (D-22, T-08-10-05). Next inlines only NEXT_PUBLIC_ variables into
 * browser bundles, so a secret can reach a client chunk only through a module a client component
 * imports. Every module that holds the transport, the session, the capability grants, the E2E
 * runtime gates or a feature service therefore starts with `import 'server-only'`, which fails the
 * build the moment a client component pulls it in. The list is enumerated from the tree, so a new
 * *-service.ts or auth module is covered without editing this file. The production client-chunk scan
 * in e2e/production-hardening.spec.ts is the proof of the other side.
 */

const webRoot = process.cwd();
const src = resolve(webRoot, 'src');
const display = (path: string) => relative(webRoot, path).split(sep).join('/');

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const isTest = (path: string) => /\.test\.[cm]?[jt]sx?$/.test(path);
const isSourceModule = (path: string) => /\.tsx?$/.test(path) && !path.endsWith('.d.ts') && !isTest(path);

const transportModules = walk(join(src, 'lib', 'api', 'transport')).filter(isSourceModule);
// return-to.ts is excluded by D-22: a pure path validator that holds nothing secret.
const authModules = walk(join(src, 'lib', 'auth')).filter(isSourceModule).filter((path) => !path.endsWith(`${sep}return-to.ts`));
const gateModules = [
  // The sidebar counts' reads run through feature services, so the composition is server-only too (11-13).
  ['components', 'shell', 'navigation-counts.ts'],
  ['lib', 'capabilities', 'analyst-review-gate.ts'],
  ['lib', 'capabilities', 'development-capabilities.ts'],
  ['lib', 'capabilities', 'server-guard.ts'],
  ['lib', 'testing', 'e2e-ui-state.ts'],
  ['lib', 'testing', 'e2e-runtime-attestation.ts'],
  ['lib', 'time', 'viewer-time-zone.ts'],
].map((segments) => join(src, ...segments));
const serviceModules = walk(join(src, 'features')).filter((path) => path.endsWith('-service.ts'));
const guardedModules = [...transportModules, ...authModules, ...gateModules, ...serviceModules];

/** The source from its first statement on: leading whitespace, line comments and block comments removed. */
function fromFirstStatement(source: string): string {
  let rest = source.replace(/^﻿/, '');
  for (;;) {
    rest = rest.trimStart();
    if (rest.startsWith('//')) {
      const lineEnd = rest.indexOf('\n');
      rest = lineEnd === -1 ? '' : rest.slice(lineEnd + 1);
    } else if (rest.startsWith('/*')) {
      const commentEnd = rest.indexOf('*/');
      rest = commentEnd === -1 ? '' : rest.slice(commentEnd + 2);
    } else {
      return rest;
    }
  }
}

const serverOnlyFirst = /^import\s+(['"])server-only\1\s*;?/;

describe('the server-only boundary', () => {
  it('covers the transport, the auth modules, the capability and E2E gates, and every feature service', () => {
    expect(serviceModules.length).toBeGreaterThanOrEqual(9);
    expect(guardedModules.map(display)).toEqual(expect.arrayContaining([
      'src/components/shell/navigation-counts.ts',
      'src/lib/api/transport/server-client.ts',
      'src/lib/auth/development-runtime.ts',
      'src/lib/auth/development-session-adapter.ts',
      'src/lib/auth/session-adapter.ts',
      'src/lib/capabilities/analyst-review-gate.ts',
      'src/lib/capabilities/development-capabilities.ts',
      'src/lib/capabilities/server-guard.ts',
      'src/lib/testing/e2e-ui-state.ts',
      'src/lib/testing/e2e-runtime-attestation.ts',
      'src/lib/time/viewer-time-zone.ts',
      'src/features/administration/administration-service.ts',
      'src/features/requests/request-service.ts',
      'src/features/risks/risk-service.ts',
    ]));
    for (const path of gateModules) expect(existsSync(path), display(path)).toBe(true);
  });

  it.each(guardedModules.map((path) => [display(path), path]))("%s starts with import 'server-only'", (_name, path) => {
    expect(fromFirstStatement(readFileSync(path, 'utf8'))).toMatch(serverOnlyFirst);
  });

  it('looks past leading comments, and only past comments', () => {
    expect(fromFirstStatement("// why\n/* more\n why */\nimport 'server-only';\n")).toMatch(serverOnlyFirst);
    expect(fromFirstStatement("import { z } from 'zod';\nimport 'server-only';\n")).not.toMatch(serverOnlyFirst);
    expect(fromFirstStatement("'use server';\nimport 'server-only';\n")).not.toMatch(serverOnlyFirst);
    expect(fromFirstStatement("import 'server-only-helpers';\n")).not.toMatch(serverOnlyFirst);
  });

  it('keeps the content security policy builder pure, with no server-only import', () => {
    // proxy.ts is its only production caller; it holds no secret and is unit-tested without mocks.
    const source = readFileSync(join(src, 'lib', 'security', 'content-security-policy.ts'), 'utf8');

    expect(source).not.toMatch(/['"]server-only['"]/);
  });
});
