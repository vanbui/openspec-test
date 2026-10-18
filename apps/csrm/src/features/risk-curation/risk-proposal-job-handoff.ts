import type { RiskProposalJob } from './risk-curation-domain';

/*
 * A Suggest more risks request started from the AI inputs signal (16-UI-SPEC §10.2) can be acknowledged before the
 * section's on-demand body has mounted or the page's read has been refreshed. The job is held here, in this page's memory,
 * only until the section for its assessment takes it and follows it in place. A plain module with no directive and no
 * imports beyond a type, so the signal's button adds next to nothing to the editor's first load.
 */
const pending = new Map<string, { readonly job: RiskProposalJob; readonly at: number }>();
const listeners = new Set<() => void>();

/*
 * FE4-12: how long a handed-over job waits for its section, the section's automatic checks (30 seconds). A job no section
 * took by then is discarded, so a later visit in the same session never follows a job that finished long ago.
 */
const HANDOFF_MAX_AGE_MS = 30_000;

export function handoffRiskSuggestionJob(job: RiskProposalJob): void {
  pending.set(job.assessmentId, { job, at: Date.now() });
  listeners.forEach((notify) => notify());
}

export function takeRiskSuggestionJob(assessmentId: string): RiskProposalJob | null {
  const handed = pending.get(assessmentId);
  pending.delete(assessmentId);
  return handed && Date.now() - handed.at <= HANDOFF_MAX_AGE_MS ? handed.job : null;
}

export function subscribeToRiskSuggestionHandoff(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}
