import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RiskProposalJob } from './risk-curation-domain';
import { handoffRiskSuggestionJob, takeRiskSuggestionJob } from './risk-proposal-job-handoff';
import { suggestionsJobFixture } from './test-fixtures';

const job = suggestionsJobFixture as unknown as RiskProposalJob;

afterEach(() => {
  takeRiskSuggestionJob('a1');
  vi.useRealTimers();
});

describe('the Suggest more risks handoff (16-UI-SPEC §10.2)', () => {
  it('hands a job to its assessment’s section once', () => {
    handoffRiskSuggestionJob(job);
    expect(takeRiskSuggestionJob('a2')).toBeNull();
    expect(takeRiskSuggestionJob('a1')).toBe(job);
    expect(takeRiskSuggestionJob('a1')).toBeNull();
  });

  it('discards a job no section took while it could still be followed, so a later visit never follows a stale one (FE4-12)', () => {
    vi.useFakeTimers();
    handoffRiskSuggestionJob(job);
    vi.advanceTimersByTime(30_001);
    expect(takeRiskSuggestionJob('a1')).toBeNull();
  });
});
