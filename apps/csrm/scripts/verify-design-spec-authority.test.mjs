import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyDesignSpecAuthority } from './verify-design-spec-authority.mjs';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const phaseOneSpec = '.planning/workstreams/csrm/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md';
const phaseSixSpec = '.planning/workstreams/csrm/phases/06-administration-and-csv-imports/06-UI-SPEC.md';

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'csrm-design-authority-'));
  await cp(join(repositoryRoot, 'docs'), join(root, 'docs'), { recursive: true });
  await cp(join(repositoryRoot, '.planning'), join(root, '.planning'), { recursive: true });
  return root;
}

test('accepts UI specifications that defer colour values to the design direction', async (t) => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.doesNotThrow(() => verifyDesignSpecAuthority(root));
});

test('rejects a UI specification without the design-direction reference', async (t) => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const specPath = join(root, phaseSixSpec);
  const specification = await readFile(specPath, 'utf8');
  await writeFile(specPath, specification.replaceAll('docs/design/csrm-design-direction.md', 'docs/design/removed.md'));

  assert.throws(
    () => verifyDesignSpecAuthority(root),
    /Phase 06 UI specification Color section must reference docs\/design\/csrm-design-direction\.md/,
  );
});

test('rejects a duplicated semantic token and hexadecimal value row', async (t) => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const specPath = join(root, phaseOneSpec);
  const specification = await readFile(specPath, 'utf8');
  await writeFile(
    specPath,
    specification.replace('## Color and semantic tokens', '## Color and semantic tokens\n\n| Test | `--color-test` (`#ABCDEF`) | Duplicate |'),
  );

  assert.throws(
    () => verifyDesignSpecAuthority(root),
    /Phase 01 UI specification contains a duplicate semantic colour token\/hexadecimal value pairing/,
  );
});
