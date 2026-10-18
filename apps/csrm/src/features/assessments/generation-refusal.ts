import type { ConflictReason } from '@/lib/api/conflict-reasons';
import { aiPolicyRefusalCopy } from '@/lib/api/refusal-copy';
import type { AiPolicyStatus } from '../ai-assistance/ai-assistance-domain';
import { getRequestGenerationJobsAction } from './assessment-actions';
import { settleGenerationAction } from './generation-failure-copy';

const aiPolicyReasons: ReadonlySet<ConflictReason> = new Set(['AI_CLASSIFICATION_ABOVE_CEILING', 'AI_POLICY_NOT_CONFIGURED']);

/**
 * What a refused generation start, replacement or retry tells the analyst (WR-408, IN-303; 12-UI-SPEC §11.3, D-28,
 * G-20). A refusal by the AI data policy reads §11.1's description, which names the request's classification and the
 * approved limit. The served policy names them only when it is that same refusal: one that allowed generation is out
 * of date by definition, so the request's policy is read again. When it can't be read, or no longer refuses for that
 * reason, the refusal keeps the action's own sentence. Any other refusal keeps it too.
 */
export async function generationRefusalMessage(input: {
  requestId: string;
  formError: string;
  reason?: ConflictReason;
  servedPolicy?: AiPolicyStatus | null;
}): Promise<string> {
  const { reason, servedPolicy } = input;
  if (!reason || !aiPolicyReasons.has(reason)) return input.formError;
  const policy = servedPolicy?.status === 'refused' && servedPolicy.reason === reason ? servedPolicy : await currentPolicy(input.requestId);
  if (policy?.status !== 'refused' || policy.reason !== reason) return input.formError;
  return aiPolicyRefusalCopy(reason, policy) ?? input.formError;
}

async function currentPolicy(requestId: string): Promise<AiPolicyStatus | null> {
  const result = await settleGenerationAction('generationJobs', () => getRequestGenerationJobsAction({ requestId }));
  return result.ok ? result.data.aiPolicy : null;
}

/** The served reason of a failed generation action, when it named one. */
export function servedReason(result: { ok: false; formError: string; reason?: ConflictReason } | { ok: false; formError: string }): ConflictReason | undefined {
  return 'reason' in result ? result.reason : undefined;
}
