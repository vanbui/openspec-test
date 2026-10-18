import { describe, expect, it } from 'vitest';

import { outstandingProposalsLabel } from './ai-provenance-domain';

/*
 * The count of AI proposals left to review, as the provenance header's line 3 (12-UI-SPEC §1) and the review bar's count
 * line (§3.2) both word it: one field, or a number of fields (walk D11; UI-07 moved the bar's own plural here).
 */
describe('outstandingProposalsLabel', () => {
  it.each([
    [0, '0 AI-proposed fields to review'],
    [1, '1 AI-proposed field to review'],
    [2, '2 AI-proposed fields to review'],
  ])('words %i as "%s"', (count, label) => {
    expect(outstandingProposalsLabel(count)).toBe(label);
  });
});
