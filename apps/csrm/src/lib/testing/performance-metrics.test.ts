import { describe, expect, it } from 'vitest';

import {
  findBudgetBreaches,
  median,
  summariseRouteSamples,
  type Budget,
  type RouteSample,
  type RouteSummary,
} from './performance-metrics';

function sample(overrides: Partial<RouteSample> = {}): RouteSample {
  return {
    route: '/app/risks',
    actor: 'Security Analyst',
    deliveredJsBytes: 200_000,
    decodedJsBytes: 700_000,
    deliveredCssBytes: 20_000,
    scriptCount: 20,
    ttfbMs: 100,
    domContentLoadedMs: 300,
    loadMs: 400,
    lcpMs: 500,
    assetUrls: ['/_next/static/chunks/a.js'],
    ...overrides,
  };
}

function summary(overrides: Partial<RouteSummary> = {}): RouteSummary {
  return {
    route: '/app/risks',
    actor: 'Security Analyst',
    sampleCount: 5,
    deliveredJsBytes: 250_000,
    decodedJsBytes: 800_000,
    deliveredCssBytes: 20_000,
    scriptCount: 20,
    ttfbMs: 120,
    domContentLoadedMs: 300,
    loadMs: 400,
    lcpMs: 900,
    assetUrls: [],
    ...overrides,
  };
}

const budget: Budget = { deliveredJsBytes: 300_000, ttfbMs: 500, lcpMs: 2_500 };

describe('median', () => {
  it('returns the middle value of an odd count', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('returns the mean of the two middle values of an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('sorts numerically rather than as text', () => {
    expect(median([100, 9, 20])).toBe(20);
  });

  it('refuses an empty sample', () => {
    expect(() => median([])).toThrow('PERFORMANCE_EMPTY_SAMPLE');
  });

  it('leaves the caller’s array in its original order', () => {
    const values = [5, 3, 9, 1];

    median(values);

    expect(values).toEqual([5, 3, 9, 1]);
  });
});

describe('summariseRouteSamples', () => {
  const samples: RouteSample[] = [
    sample({
      deliveredJsBytes: 210_000, decodedJsBytes: 720_000, deliveredCssBytes: 21_000, scriptCount: 21,
      ttfbMs: 90, domContentLoadedMs: 310, loadMs: 420, lcpMs: 400,
    }),
    sample({
      deliveredJsBytes: 190_000, decodedJsBytes: 680_000, deliveredCssBytes: 19_000, scriptCount: 19,
      ttfbMs: 130, domContentLoadedMs: 290, loadMs: 380, lcpMs: null,
    }),
    sample({
      deliveredJsBytes: 200_000, decodedJsBytes: 700_000, deliveredCssBytes: 20_000, scriptCount: 20,
      ttfbMs: 110, domContentLoadedMs: 300, loadMs: 400, lcpMs: 600,
    }),
  ];

  it('summarises every numeric field by its median across the samples', () => {
    expect(summariseRouteSamples(samples)).toMatchObject({
      route: '/app/risks',
      actor: 'Security Analyst',
      sampleCount: 3,
      deliveredJsBytes: 200_000,
      decodedJsBytes: 700_000,
      deliveredCssBytes: 20_000,
      scriptCount: 20,
      ttfbMs: 110,
      domContentLoadedMs: 300,
      loadMs: 400,
    });
  });

  it('takes the LCP median over the samples that recorded a candidate', () => {
    expect(summariseRouteSamples(samples).lcpMs).toBe(500);
  });

  it('reports no LCP when no sample recorded a candidate', () => {
    const withoutLcp = samples.map((entry) => ({ ...entry, lcpMs: null }));

    expect(summariseRouteSamples(withoutLcp).lcpMs).toBeNull();
  });

  it('lists every asset once, sorted', () => {
    const withAssets = [
      sample({ assetUrls: ['/_next/static/chunks/c.js', '/_next/static/chunks/a.js'] }),
      sample({ assetUrls: ['/_next/static/chunks/b.css', '/_next/static/chunks/a.js'] }),
      sample({ assetUrls: [] }),
    ];

    expect(summariseRouteSamples(withAssets).assetUrls).toEqual([
      '/_next/static/chunks/a.js',
      '/_next/static/chunks/b.css',
      '/_next/static/chunks/c.js',
    ]);
  });

  it('refuses samples from different routes', () => {
    expect(() => summariseRouteSamples([sample(), sample({ route: '/app/review' })]))
      .toThrow('PERFORMANCE_MIXED_ROUTES');
  });

  it('refuses an empty sample', () => {
    expect(() => summariseRouteSamples([])).toThrow('PERFORMANCE_EMPTY_SAMPLE');
  });
});

describe('findBudgetBreaches', () => {
  it('reports nothing when every metric is within budget, a value equal to its budget included', () => {
    expect(findBudgetBreaches(summary({ deliveredJsBytes: 300_000, ttfbMs: 120, lcpMs: 900 }), budget))
      .toEqual([]);
  });

  it('reports each metric over budget with its measured value and budget, in budget order', () => {
    expect(findBudgetBreaches(summary({ deliveredJsBytes: 300_001, ttfbMs: 120, lcpMs: 2_600 }), budget))
      .toEqual([
        { metric: 'deliveredJsBytes', measured: 300_001, budget: 300_000 },
        { metric: 'lcpMs', measured: 2_600, budget: 2_500 },
      ]);
  });

  it('reports all three metrics when all three are over budget', () => {
    expect(findBudgetBreaches(summary({ deliveredJsBytes: 400_000, ttfbMs: 501, lcpMs: 3_000 }), budget)
      .map(({ metric }) => metric)).toEqual(['deliveredJsBytes', 'ttfbMs', 'lcpMs']);
  });

  it('never reports LCP for a summary without an LCP candidate', () => {
    expect(findBudgetBreaches(summary({ ttfbMs: 900, lcpMs: null }), { ...budget, lcpMs: 0 }))
      .toEqual([{ metric: 'ttfbMs', measured: 900, budget: 500 }]);
  });
});
