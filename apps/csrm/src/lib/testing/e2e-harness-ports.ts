/*
 * The ports the Playwright harness derives for the servers it starts (SR-10). Every band lies below
 * 32768, outside the operating systems' ephemeral ranges (Linux hands out 32768 to 60999 by default,
 * Windows 49152 to 65535), so no connection the run itself opens can already hold a harness port.
 * The bands are disjoint, so no two servers of one run can meet whatever their process ids are, and
 * each stays clear of the development servers' 1337 and 3000. A server a spec spawns also checks
 * that its port is free before it starts (`e2e/helpers/ports.ts`); the two servers the configuration
 * starts are checked by Playwright, which refuses to start over a URL that already answers.
 *
 * The module imports nothing, so it runs unchanged under vitest and inside the Playwright config.
 */

/** Ports per band: a process id picks its slot inside the band. */
export const HARNESS_PORT_BAND_WIDTH = 2_000;

export const harnessPortBands = {
  /** The run's Strapi (`strapi develop`), started by playwright.config.ts. */
  strapi: 20_000,
  /** The run's production web server (`next start`), started by playwright.config.ts. */
  web: 22_000,
  /** production-hardening.spec.ts: the run's build started without the attestation. */
  unattestedProduction: 24_000,
  /** production-hardening.spec.ts: the run's build started with NODE_ENV=development. */
  unattestedDevelopment: 26_000,
  /** design-system-conformance.spec.ts: the ordinary `next dev` server. */
  ordinaryDevelopment: 28_000,
} as const;

export type HarnessPortBand = keyof typeof harnessPortBands;

/** The lowest port any supported operating system hands out as an ephemeral port by default. */
export const LOWEST_EPHEMERAL_PORT = 32_768;

export function harnessPort(band: HarnessPortBand, pid: number): number {
  return harnessPortBands[band] + (pid % HARNESS_PORT_BAND_WIDTH);
}
