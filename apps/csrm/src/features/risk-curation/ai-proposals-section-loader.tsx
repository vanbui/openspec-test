'use client';

import { AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AiProposalsSectionClientProps } from './ai-proposals-section-client';
import { PROPOSALS_LOAD_FAILED } from './risk-curation-domain';

/*
 * D-48: the `AI proposals` section's body loads on demand from this Client Component, so the assessment editor's first
 * load carries only the frame and this loader. 16-UI-SPEC §2.7: nothing for 300ms, then a skeleton of a field (a label
 * line, a three-row block and a button block) and two item cards (an eyebrow, a title, a facts line, two badge blocks and
 * an action row).
 */
export const SECTION_SKELETON_DELAY_MS = 300;

function SectionSkeleton() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SECTION_SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <div aria-label="Loading AI proposals" className="grid gap-4" role="status">
      <div className="grid gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-20 w-full max-w-[640px]" /><Skeleton className="h-9 w-44" /></div>
      {[0, 1].map((card) => (
        <div className="grid gap-2 rounded-lg border border-border p-4" key={card}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-20" /></div>
          <Skeleton className="h-8 w-56" />
        </div>
      ))}
    </div>
  );
}

const AiProposalsSectionClient = dynamic(() => import('./ai-proposals-section-client').then((module) => module.AiProposalsSectionClient), {
  loading: () => <SectionSkeleton />,
});

export function AiProposalsSectionLoader(props: AiProposalsSectionClientProps) {
  return <AiProposalsSectionClient {...props} />;
}

/* §2.7 and §14: a failed proposals read, compact, with Try again reading the page again in place. */

export function ProposalsReadError({ onRetry }: { onRetry?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="flex items-center gap-2 text-sm text-foreground"><AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />{PROPOSALS_LOAD_FAILED}</p>
      <Button className="max-md:min-h-11" data-print="hidden" onClick={() => (onRetry ? onRetry() : router.refresh())} size="sm" type="button" variant="outline">Try again</Button>
    </div>
  );
}
