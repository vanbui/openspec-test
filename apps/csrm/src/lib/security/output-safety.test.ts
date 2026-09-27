import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Output safety (D-21 validation record, T-08-10-07). No module under app/ or src/, and neither
 * proxy.ts nor instrumentation-client.ts beside them, may write HTML or code into the page outside
 * React's escaping: no dangerouslySetInnerHTML, eval, new Function, document.write, srcdoc or
 * javascript: URL, and no innerHTML, outerHTML or insertAdjacentHTML write. No module renders a
 * <script> of its own or uses next/script either: every script on a page is Next's, which carries
 * the per-request nonce, and anything else would be blocked by the Content-Security-Policy. Tests
 * and the test setup under src/test are not shipped and are not scanned; declaration files hold no
 * runtime code.
 */

const webRoot = process.cwd();
const scannedRoots = [resolve(webRoot, 'app'), resolve(webRoot, 'src')];
// The two shipped modules that live beside app/: the request proxy and the browser instrumentation.
const rootModules = ['proxy.ts', 'instrumentation-client.ts'].map((name) => resolve(webRoot, name));
const testSupport = resolve(webRoot, 'src', 'test');
const display = (path: string) => relative(webRoot, path).split(sep).join('/');

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const isTest = (path: string) => /\.test\.[cm]?[jt]sx?$/.test(path);
const shippedSource = [...scannedRoots.flatMap(walk), ...rootModules]
  .filter((path) => /\.(?:[cm]?[jt]sx?|css)$/.test(path))
  .filter((path) => !path.endsWith('.d.ts') && !isTest(path) && !path.startsWith(`${testSupport}${sep}`));

const sinks = [
  { name: 'dangerouslySetInnerHTML', pattern: /dangerouslySetInnerHTML/ },
  { name: 'eval(', pattern: /\beval\s*\(/ },
  { name: 'new Function(', pattern: /\bnew\s+Function\s*\(/ },
  { name: 'document.write', pattern: /\bdocument\s*\.\s*write(?:ln)?\b/ },
  { name: 'srcdoc=', pattern: /\bsrcdoc\s*=/i },
  { name: 'javascript:', pattern: /javascript\s*:/i },
  { name: 'innerHTML or outerHTML write', pattern: /\.\s*(?:inner|outer)HTML\s*\+?=(?!=)/ },
  { name: 'insertAdjacentHTML(', pattern: /\binsertAdjacentHTML\s*\(/ },
] as const;

const ownScripts = [
  { name: 'next/script', pattern: /['"]next\/script['"]/ },
  { name: 'a <script> element', pattern: /<script\b/i },
] as const;

describe('output safety', () => {
  it('scans every shipped module under app/ and src/', () => {
    expect(shippedSource.length).toBeGreaterThan(200);
    expect(shippedSource.map(display)).toEqual(expect.arrayContaining([
      'app/layout.tsx',
      'app/globals.css',
      'src/lib/api/transport/server-client.ts',
      'proxy.ts',
      'instrumentation-client.ts',
    ]));
    expect(shippedSource.some(isTest)).toBe(false);
  });

  it.each(shippedSource.map((path) => [display(path), path]))('%s writes no unsafe HTML or code sink', (_name, path) => {
    const source = readFileSync(path, 'utf8');
    for (const { name, pattern } of sinks) expect(source, `${display(path)} uses ${name}`).not.toMatch(pattern);
  });

  it.each(shippedSource.map((path) => [display(path), path]))('%s renders no script of its own', (_name, path) => {
    const source = readFileSync(path, 'utf8');
    for (const { name, pattern } of ownScripts) expect(source, `${display(path)} uses ${name}`).not.toMatch(pattern);
  });

  it('keeps next/script out of the root layout', () => {
    expect(readFileSync(resolve(webRoot, 'app', 'layout.tsx'), 'utf8')).not.toMatch(/next\/script/);
  });

  it('recognises each sink, and not words that merely contain one', () => {
    const offending = [
      '<div dangerouslySetInnerHTML={{ __html: html }} />',
      'const value = eval(code);',
      'window.eval (code)',
      'const run = new Function("return 1");',
      'document.write(html);',
      'document.writeln(html);',
      '<iframe srcDoc={html} />',
      '<iframe srcdoc="<p>x</p>">',
      '<a href="javascript:void(0)">x</a>',
      "location.href = 'JavaScript:alert(1)';",
      'node.innerHTML = html;',
      'node.outerHTML += html;',
      "node.insertAdjacentHTML('beforeend', html);",
    ];
    for (const sample of offending) expect(sinks.some(({ pattern }) => pattern.test(sample)), sample).toBe(true);

    const harmless = ['const retrieval = retrieval(state);', 'approval(request);', 'if (node.innerHTML === expected) return;', 'const functionName = 1;', 'evaluate(rule);'];
    for (const sample of harmless) expect(sinks.some(({ pattern }) => pattern.test(sample)), sample).toBe(false);

    expect(ownScripts.some(({ pattern }) => pattern.test("import Script from 'next/script';"))).toBe(true);
    expect(ownScripts.some(({ pattern }) => pattern.test('<script src="/x.js" />'))).toBe(true);
  });
});
