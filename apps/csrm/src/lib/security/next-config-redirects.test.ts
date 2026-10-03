import { describe, expect, it } from 'vitest';

import nextConfig from '../../../next.config';

/*
 * D-17 and T-11-13: the analyst dashboard became Home, so its old address answers a temporary redirect
 * to /app from the configuration, before the proxy and any rendering. Next keeps the query on a
 * redirect. The rule is the exact path with a fixed destination, so nothing a client sends chooses
 * the target (no open redirect), and the review queues under /app/review/ are untouched.
 */
describe('the /app/review redirect', () => {
  it('is the one redirect: /app/review to /app, temporary (307)', async () => {
    expect(await nextConfig.redirects?.()).toEqual([{ source: '/app/review', destination: '/app', permanent: false }]);
  });

  it('matches the exact path only, never a review queue or a pattern a request could fill', async () => {
    for (const rule of (await nextConfig.redirects?.()) ?? []) {
      expect(rule.source).not.toMatch(/[:*(]/);
      expect(rule.destination).not.toMatch(/[:*(]|^https?:/);
    }
  });
});
