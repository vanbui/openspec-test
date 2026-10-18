import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { assessmentStateLine, type ProposalsAssessmentState } from './risk-curation-domain';

/*
 * The `AI proposals` section's frame (16-UI-SPEC §2.1, §2.4, §12.3; D-45, UI-D2): rendered on the server with the
 * assessment editor, so the page carries only the frame while its body (`AiProposalsSectionLoader`'s client) loads on
 * demand (D-48). The region is the target of every link to it, so it takes focus when one is followed. The analyst who
 * raised the request sees the h2 and one line, and no proposal content, start, job or decision anywhere (the settled
 * confirmation narrowing D-44); Strapi refuses them every such operation with OWN_REQUEST, so this is a courtesy.
 */
export const AI_PROPOSALS_REGION_ID = 'ai-proposals';

export const AI_PROPOSALS_DESCRIPTION = 'Ask the AI for risks this assessment is missing. Nothing changes until you add a proposed risk or confirm a change, and every proposal needs your decision before release.';

export function AiProposalsSection({ assessmentId, children, state, viewerRaisedRequest = false }: {
  assessmentId: string;
  state: ProposalsAssessmentState;
  /** The page passes it when the proposals read answers OWN_REQUEST (§12.3). */
  viewerRaisedRequest?: boolean;
  /** The body: `AiProposalsSectionLoader`, or the compact read error. Not rendered for the analyst who raised the request. */
  children?: ReactNode;
}) {
  const headingId = `${AI_PROPOSALS_REGION_ID}-heading`;
  /* §2.4: the requesting analyst's row takes precedence until release; once released the released row applies to them. */
  const lineState: ProposalsAssessmentState = viewerRaisedRequest && state !== 'released' ? 'own-request' : state;
  const line = assessmentStateLine(lineState);
  return (
    <section
      aria-describedby={viewerRaisedRequest ? undefined : `${headingId}-description`}
      aria-labelledby={headingId}
      className="w-full scroll-mt-20 focus-visible:outline-none"
      data-assessment={assessmentId}
      id={AI_PROPOSALS_REGION_ID}
      tabIndex={-1}
    >
      <Card>
        <CardHeader>
          <CardTitle><h2 className="text-heading-sm" id={headingId}>AI proposals</h2></CardTitle>
          {viewerRaisedRequest ? null : <CardDescription className="hidden md:block" id={`${headingId}-description`}>{AI_PROPOSALS_DESCRIPTION}</CardDescription>}
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4">
          {line ? <p className="flex items-start gap-2 text-sm text-foreground-secondary"><Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{line}</p> : null}
          {viewerRaisedRequest ? null : children}
        </CardContent>
      </Card>
    </section>
  );
}
