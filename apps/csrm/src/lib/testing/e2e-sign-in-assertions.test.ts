import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * D-15 and T-08-11-04: every browser sign-in proves the application shell, never the URL alone.
 * '/sign-in?returnTo=/app' also ends in '/app', so a URL assertion passes on a click that never left
 * sign-in. The security audit checked this with a one-off grep (observation O-2); this keeps it true.
 *
 * A sign-in is a click on a development identity's `Continue as …` button. The function that makes
 * the click must then assert the level-one Dashboard heading and the role in the banner. No spec may
 * assert the signed-in URL as `toHaveURL(/\/app$/)`, which is the URL-only form the audit searched for.
 */

const e2eDirectory = resolve(process.cwd(), 'e2e');
const URL_ONLY_SIGN_IN = /toHaveURL\(\s*\/\\\/app\$\/\s*[,)]/;
const DASHBOARD_HEADING = /getByRole\(\s*'heading',\s*\{[^}]*\bname:\s*'Dashboard'/;
const BANNER_ROLE = /getByRole\(\s*'banner'\s*\)/;

function specModules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) return specModules(full);
    return /\.ts$/.test(entry.name) ? [full] : [];
  });
}

/** Every sign-in in `source` that does not prove the shell, and every URL-only sign-in assertion. */
function signInFindings(fileName: string, source: string): string[] {
  const findings: string[] = [];
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lineOf = (node: ts.Node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'click'
      && /Continue as\b/.test(node.expression.expression.getText(file))
    ) {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
      const body = (owner ?? file).getText(file);
      if (!DASHBOARD_HEADING.test(body) || !BANNER_ROLE.test(body)) {
        findings.push(`SIGN_IN_WITHOUT_SHELL ${fileName}:${lineOf(node)}`);
      }
    }
    if (ts.isCallExpression(node) && URL_ONLY_SIGN_IN.test(node.getText(file)) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toHaveURL') {
      findings.push(`URL_ONLY_SIGN_IN ${fileName}:${lineOf(node)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
}

describe('browser sign-in assertions', () => {
  it('proves the shell after every sign-in in the browser suite, never the URL alone', () => {
    const modules = specModules(e2eDirectory);
    const findings = modules.flatMap((file) => signInFindings(relative(process.cwd(), file).split(sep).join('/'), readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
    // The scan reaches the shared helper and the specs' own helpers, so an empty result is not vacuous.
    const signingIn = modules.filter((file) => /Continue as\b[^\n]*\.click\(\)/.test(readFileSync(file, 'utf8')));
    expect(signingIn.length).toBeGreaterThanOrEqual(6);
  });

  it('reports a sign-in helper that asserts only the URL', () => {
    const urlOnly = `
      async function signIn(page: Page, role: string) {
        await page.goto('/sign-in?returnTo=/app');
        await page.getByRole('button', { name: \`Continue as \${role}\` }).click();
        await expect(page).toHaveURL(/\\/app$/);
      }`;
    expect(signInFindings('e2e/url-only.spec.ts', urlOnly)).toEqual([
      'SIGN_IN_WITHOUT_SHELL e2e/url-only.spec.ts:4',
      'URL_ONLY_SIGN_IN e2e/url-only.spec.ts:5',
    ]);
  });

  it('reports a sign-in helper that proves the heading but not the role', () => {
    const headingOnly = `
      async function signIn(page: Page) {
        await page.getByRole('button', { name: 'Continue as Requestor' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true })).toBeVisible();
      }`;
    expect(signInFindings('e2e/heading-only.spec.ts', headingOnly)).toEqual(['SIGN_IN_WITHOUT_SHELL e2e/heading-only.spec.ts:3']);
  });

  it('accepts the shared helper shape', () => {
    const shell = `
      export async function signInAs(page: Page, role: SignInRole): Promise<void> {
        await page.getByRole('button', { name: \`Continue as \${role}\`, exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true })).toBeVisible();
        await expect(page.getByRole('banner').getByText(role, { exact: true })).toBeVisible();
      }`;
    expect(signInFindings('e2e/helpers/navigation.ts', shell)).toEqual([]);
  });
});
