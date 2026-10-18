import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runArtifactDisposition, runArtifactNames, runArtifactPaths } from './e2e-run-artifacts';

const invocationId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const strapiDir = join('repo', 'apps', 'backend');
const webDir = join('repo', 'apps', 'csrm');

describe('the disposition of a finished run', () => {
  it('removes the artifacts of a run that passed', () => {
    expect(runArtifactDisposition(0, false)).toBe('remove');
  });

  it.each([
    ['failed', 1],
    ['was interrupted', 130],
  ])('keeps the artifacts of a run that %s, for debugging', (_outcome, exitCode) => {
    expect(runArtifactDisposition(exitCode, false)).toBe('keep-failed');
    expect(runArtifactDisposition(exitCode, true)).toBe('keep-failed');
  });

  it('keeps the artifacts of a passing run when they were asked for', () => {
    expect(runArtifactDisposition(0, true)).toBe('keep-requested');
  });
});

describe("a run's artifact names and paths", () => {
  it('names the database, the attachment store and both builds by the invocation id', () => {
    expect(runArtifactNames(invocationId)).toEqual({
      databaseFilename: `.tmp/playwright-e2e-${invocationId}.db`,
      attachmentDir: `.tmp/playwright-attachments-${invocationId}`,
      nextDistDir: `.tmp/playwright-next-${invocationId}`,
      ordinaryNextDistDir: `.tmp/playwright-ordinary-next-${invocationId}`,
    });
  });

  it.each(['', '*', '..', 'not-a-uuid', `${invocationId}/..`, invocationId.toUpperCase()])(
    'refuses %j as an invocation id, so no pattern or parent directory can be named',
    (id) => {
      expect(() => runArtifactNames(id)).toThrow('E2E_RUN_ID_INVALID');
    },
  );

  /*
   * IN-607: the run's attachment store sits beside its database and follows it, so a failed run keeps the files its kept
   * database references, and a passing run removes both.
   */
  it("lists exactly this run's seven paths, the attachment store beside the database, and nothing that another run could own", () => {
    const paths = runArtifactPaths({ strapiDir, webDir, names: runArtifactNames(invocationId) });

    expect(paths).toEqual([
      join(strapiDir, `.tmp/playwright-e2e-${invocationId}.db`),
      `${join(strapiDir, `.tmp/playwright-e2e-${invocationId}.db`)}-journal`,
      `${join(strapiDir, `.tmp/playwright-e2e-${invocationId}.db`)}-wal`,
      `${join(strapiDir, `.tmp/playwright-e2e-${invocationId}.db`)}-shm`,
      join(strapiDir, `.tmp/playwright-attachments-${invocationId}`),
      join(webDir, `.tmp/playwright-next-${invocationId}`),
      join(webDir, `.tmp/playwright-ordinary-next-${invocationId}`),
    ]);
    for (const path of paths) expect(path).toContain(invocationId);
    expect(paths).not.toContain(join(strapiDir, '.tmp'));
    expect(paths).not.toContain(join(webDir, '.tmp'));
  });
});
