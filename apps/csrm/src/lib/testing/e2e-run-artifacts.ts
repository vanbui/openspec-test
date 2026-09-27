import { join } from 'node:path';

/*
 * The throwaway database and builds one Playwright run makes, and what the run does with them when
 * it ends (SR-09). A run that passes removes them. A run that fails or is interrupted keeps them for
 * debugging, and so does a passing run started with CSRM_E2E_KEEP_ARTIFACTS=1. Every path is named
 * by the run's invocation id and listed exactly, never matched by a pattern, so another run's files,
 * which may still be in use, are never touched.
 */

export const KEEP_ARTIFACTS_VARIABLE = 'CSRM_E2E_KEEP_ARTIFACTS';

export type RunArtifactDisposition = 'remove' | 'keep-failed' | 'keep-requested';

/** Playwright exits 0 when the run passed, 1 when it failed and 130 when it was interrupted. */
export function runArtifactDisposition(exitCode: number, keepRequested: boolean): RunArtifactDisposition {
  if (exitCode !== 0) return 'keep-failed';
  return keepRequested ? 'keep-requested' : 'remove';
}

export type RunArtifactNames = {
  /** The SQLite file the run's Strapi uses, relative to apps/strapi. */
  databaseFilename: string;
  /** The production build `next build` writes, relative to apps/web. */
  nextDistDir: string;
  /** The build the conformance spec's ordinary `next dev` server writes, relative to apps/web. */
  ordinaryNextDistDir: string;
};

const invocationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function runArtifactNames(invocationId: string): RunArtifactNames {
  if (!invocationIdPattern.test(invocationId)) {
    throw new Error('E2E_RUN_ID_INVALID: a run names its artifacts by a random UUID only');
  }
  return {
    databaseFilename: `.tmp/playwright-e2e-${invocationId}.db`,
    nextDistDir: `.tmp/playwright-next-${invocationId}`,
    ordinaryNextDistDir: `.tmp/playwright-ordinary-next-${invocationId}`,
  };
}

/** Every path the run can leave behind: the SQLite file with the sidecar files SQLite may write, and both builds. */
export function runArtifactPaths(input: { strapiDir: string; webDir: string; names: RunArtifactNames }): string[] {
  const database = join(input.strapiDir, input.names.databaseFilename);
  return [
    ...['', '-journal', '-wal', '-shm'].map((suffix) => `${database}${suffix}`),
    join(input.webDir, input.names.nextDistDir),
    join(input.webDir, input.names.ordinaryNextDistDir),
  ];
}
