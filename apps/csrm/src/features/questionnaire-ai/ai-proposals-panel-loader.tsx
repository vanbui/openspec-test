'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SectionChoice } from '../questionnaires/questionnaire-placement';
import type { QuestionnaireAiProposalsView } from './questionnaire-ai-domain';

/* 15-UI-SPEC §2.5: nothing for 300ms, then the skeleton. */
export const PANEL_SKELETON_DELAY_MS = 300;

/* §2.5: a field (label line, three-row block, button block) and two item cards (eyebrow, title, four rows, actions). */
function PanelSkeleton() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), PANEL_SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <div aria-label="Loading AI proposals" className="grid gap-4" role="status">
      <div className="grid gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-20 w-full max-w-[640px]" /><Skeleton className="h-9 w-44" /></div>
      {[0, 1].map((card) => (
        <div className="grid gap-2 rounded-lg border border-border p-4" key={card}>
          <Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-3/4" />
          {[0, 1, 2, 3].map((row) => <Skeleton className="h-3 w-full" key={row} />)}
          <Skeleton className="h-8 w-56" />
        </div>
      ))}
    </div>
  );
}

/*
 * D-35: the panel's interactive body loads on demand from this Client Component, so the questionnaire page's first load
 * carries only the frame.
 */
const AiProposalsPanelClient = dynamic(() => import('./ai-proposals-panel-client').then((module) => module.AiProposalsPanelClient), {
  loading: () => <PanelSkeleton />,
});

export function AiProposalsPanelLoader(props: { view: QuestionnaireAiProposalsView; ownerKey: string | null; requestId: string | null; sections: readonly SectionChoice[] }) {
  return <AiProposalsPanelClient {...props} />;
}

/* §14: the compact error's Try again reads the page again in place. */
export function RetryProposalsRead() {
  const router = useRouter();
  return <Button data-print="hidden" onClick={() => router.refresh()} size="sm" type="button" variant="outline">Try again</Button>;
}
