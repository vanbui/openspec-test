/*
 * Pure aggregation of the production-build performance samples (plan 08-13,
 * decision D-24). The Playwright performance spec takes five samples per key
 * route, summarises them here by median and asserts the summary against the
 * route's budget; the baseline record in docs/performance/phase-08-baseline.md
 * is written from the same summaries. The module imports nothing, so it runs
 * unchanged under vitest's jsdom and under Playwright's Node runner.
 */

/** One measured navigation of a key route, taken in a fresh browser context. */
export type RouteSample = {
  route: string;
  actor: string;
  /** Encoded bytes of the route's `/_next/static/` scripts as the browser downloaded them. */
  deliveredJsBytes: number;
  /** The same scripts after content decoding. */
  decodedJsBytes: number;
  deliveredCssBytes: number;
  scriptCount: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  /** The buffered largest-contentful-paint candidate at settle time, or null when none was reported. */
  lcpMs: number | null;
  assetUrls: readonly string[];
};

/** A route's samples reduced to their medians. */
export type RouteSummary = {
  route: string;
  actor: string;
  sampleCount: number;
  deliveredJsBytes: number;
  decodedJsBytes: number;
  deliveredCssBytes: number;
  scriptCount: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  lcpMs: number | null;
  assetUrls: readonly string[];
};

export type Budget = { deliveredJsBytes: number; ttfbMs: number; lcpMs: number };

export type BudgetBreach = { metric: keyof Budget; measured: number; budget: number };

const BUDGET_METRICS: readonly (keyof Budget)[] = ['deliveredJsBytes', 'ttfbMs', 'lcpMs'];

/** The median of a non-empty sample: the middle value, or the mean of the two middle values. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('PERFORMANCE_EMPTY_SAMPLE');
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Summarises one route's samples by median; every sample must name the same route. */
export function summariseRouteSamples(samples: readonly RouteSample[]): RouteSummary {
  if (samples.length === 0) throw new Error('PERFORMANCE_EMPTY_SAMPLE');
  const [first] = samples;
  if (samples.some((entry) => entry.route !== first.route)) throw new Error('PERFORMANCE_MIXED_ROUTES');

  const medianOf = (read: (entry: RouteSample) => number) => median(samples.map(read));
  const lcpCandidates = samples.flatMap((entry) => (entry.lcpMs === null ? [] : [entry.lcpMs]));

  return {
    route: first.route,
    actor: first.actor,
    sampleCount: samples.length,
    deliveredJsBytes: medianOf((entry) => entry.deliveredJsBytes),
    decodedJsBytes: medianOf((entry) => entry.decodedJsBytes),
    deliveredCssBytes: medianOf((entry) => entry.deliveredCssBytes),
    scriptCount: medianOf((entry) => entry.scriptCount),
    ttfbMs: medianOf((entry) => entry.ttfbMs),
    domContentLoadedMs: medianOf((entry) => entry.domContentLoadedMs),
    loadMs: medianOf((entry) => entry.loadMs),
    lcpMs: lcpCandidates.length === 0 ? null : median(lcpCandidates),
    assetUrls: [...new Set(samples.flatMap((entry) => entry.assetUrls))].sort(),
  };
}

/**
 * Lists every budgeted metric whose median exceeds its budget, in budget order.
 * A value equal to its budget is within it; a summary without an LCP candidate
 * is never reported for LCP.
 */
export function findBudgetBreaches(summary: RouteSummary, budget: Budget): BudgetBreach[] {
  return BUDGET_METRICS.flatMap((metric) => {
    const measured = summary[metric];
    if (measured === null || measured <= budget[metric]) return [];
    return [{ metric, measured, budget: budget[metric] }];
  });
}
