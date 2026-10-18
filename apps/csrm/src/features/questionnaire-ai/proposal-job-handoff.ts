import type { QuestionnaireProposalJobView } from './questionnaire-ai-domain';

// An acknowledged signal start can precede the lazy panel's mount or the refreshed server read.
// Hold it only until its questionnaire panel consumes it, in this page's memory.
const pending = new Map<string, QuestionnaireProposalJobView>();
const listeners = new Set<() => void>();
const focusRequests = new Set<string>();

export function requestProposalJobFocus(questionnaireId: string): void {
  focusRequests.add(questionnaireId);
}

export function takeProposalJobFocusRequest(questionnaireId: string): boolean {
  const requested = focusRequests.delete(questionnaireId);
  return requested;
}

export function handoffProposalJob(job: QuestionnaireProposalJobView): void {
  pending.set(job.questionnaireId, job);
  listeners.forEach((notify) => notify());
}

export function takeProposalJob(questionnaireId: string): QuestionnaireProposalJobView | null {
  const job = pending.get(questionnaireId) ?? null;
  pending.delete(questionnaireId);
  return job;
}

export function clearProposalJobHandoff(questionnaireId: string): void {
  pending.delete(questionnaireId);
}

export function subscribeToProposalJobHandoff(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}
