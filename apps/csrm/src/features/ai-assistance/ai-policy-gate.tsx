import { ShieldBan } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { aiPolicyCaption, aiPolicyRefusal, type AiPolicyStatus } from './ai-assistance-domain';

/*
 * 12-UI-SPEC §11.1: a generation action as the AI data policy allows it. Allowed, the action stays and the
 * request's classification is captioned under it; refused, a warning alert replaces it, so the hub never offers
 * a generation the server would refuse (D-29, UX-06). Without a served policy (the jobs read failed) the action
 * shows as Phase 10 §12.5 has it, and a refused enqueue then explains itself.
 *
 * WR-308: a failed job's Retry, and the failed state's Replace, are generations too, so they pass through the same
 * gate. They are not idle states, so they take no caption (`caption={false}`): §11.1 shows the policy status only
 * where Generate or Replace would show.
 */
export function AiPolicyGate({ action, caption = true, policy }: { action: ReactNode; caption?: boolean; policy?: AiPolicyStatus | null }) {
  if (!action || !policy) return action ?? null;
  const refusal = aiPolicyRefusal(policy);
  if (refusal) {
    return <Alert role="note" variant="warning">
      <ShieldBan aria-hidden="true" />
      <AlertTitle>{refusal.title}</AlertTitle>
      <AlertDescription>{refusal.description}</AlertDescription>
    </Alert>;
  }
  const classification = caption ? aiPolicyCaption(policy) : null;
  if (!classification) return action;
  return <div className="grid justify-items-start gap-2">
    {action}
    <p className="text-xs text-foreground-secondary">{classification}</p>
  </div>;
}
