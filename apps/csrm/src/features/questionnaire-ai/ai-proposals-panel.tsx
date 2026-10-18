import { AlertCircle, Lock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AiProposalsPanelLoader, RetryProposalsRead } from './ai-proposals-panel-loader';
import type { SectionChoice } from '../questionnaires/questionnaire-placement';
import { PROPOSALS_LOAD_FAILED, type QuestionnaireAiProposalsView } from './questionnaire-ai-domain';

/*
 * The AI proposals panel's frame (15-UI-SPEC §1, §2.1, §12, §14; D-33): rendered on the server by the questionnaire page
 * and handed to the review as a slot, directly after the provenance header, in every state before the draft and read-only
 * after it. No directive: it holds no state, and its interactive body loads on demand (D-35). The region is the target of
 * every link to the panel, so it takes focus when one is followed.
 */
export type AiProposalsOutcome =
  | { kind: 'view'; view: QuestionnaireAiProposalsView }
  /* D-32: a Security Analyst on a request they raised; Strapi refuses them every proposal operation. */
  | { kind: 'requesting-analyst' }
  | { kind: 'error' };

export const AI_PROPOSALS_REGION_ID = 'ai-proposals';

const DESCRIPTION = 'Ask the AI to suggest questions, or to change or remove unanswered ones. Nothing changes until you confirm it, and the Requestor sees changes only when you release the questionnaire.';
const REQUESTING_ANALYST_LINE = 'You raised this request, so another Security Analyst handles the AI for it.';

export function AiProposalsPanel({ outcome, ownerKey, requestId, sections = [] }: { outcome: AiProposalsOutcome; ownerKey: string | null; requestId: string | null; sections?: readonly SectionChoice[] }) {
  const headingId = `${AI_PROPOSALS_REGION_ID}-heading`;
  const describe = outcome.kind !== 'requesting-analyst';
  return (
    <section aria-describedby={describe ? `${headingId}-description` : undefined} aria-labelledby={headingId} className="mb-6 w-full scroll-mt-20 focus-visible:outline-none" id={AI_PROPOSALS_REGION_ID} tabIndex={-1}>
      <Card>
        <CardHeader>
          <CardTitle><h2 className="text-heading-sm" id={headingId}>AI proposals</h2></CardTitle>
          {describe ? <CardDescription id={`${headingId}-description`}>{DESCRIPTION}</CardDescription> : null}
        </CardHeader>
        <Separator />
        <CardContent>
          {outcome.kind === 'requesting-analyst'
            ? <p className="flex items-start gap-2 text-sm text-foreground-secondary"><Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{REQUESTING_ANALYST_LINE}</p>
            : outcome.kind === 'error'
              ? <div className="flex flex-wrap items-center gap-3" role="alert"><p className="flex items-center gap-2 text-sm text-foreground"><AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />{PROPOSALS_LOAD_FAILED}</p><RetryProposalsRead /></div>
              : <AiProposalsPanelLoader ownerKey={ownerKey} requestId={requestId} sections={sections} view={outcome.view} />}
        </CardContent>
      </Card>
    </section>
  );
}
