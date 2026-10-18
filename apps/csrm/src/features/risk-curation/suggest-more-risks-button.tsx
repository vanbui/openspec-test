'use client';

import { AlertCircle, LoaderCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { landOn } from '@/components/csrm/use-hash-landing';
import { Button } from '@/components/ui/button';
import { startRiskSuggestionsAction } from './risk-curation-actions';
import { ASK_AI_RETRY_LINE } from './risk-curation-domain';
import { handoffRiskSuggestionJob } from './risk-proposal-job-handoff';

/*
 * Suggest more risks from the AI inputs signal (16-UI-SPEC §10.2; D-28, D-30): the default request, with no instruction,
 * offered only where the proposals read allows a start and never to the analyst who raised the request (the page decides
 * through `assessmentSignalProps`). The job is handed to the `AI proposals` section, which follows it, and focus moves to
 * the section's job status line once it shows. A refusal says R2's sentence, which the action returns. It ships with the
 * editor's first load, so it reads no family R module: its one fallback line lives in the domain.
 */
/* How long the job status line is waited for once the job is handed over. */
const STATUS_WAIT_MS = 10_000;

export function SuggestMoreRisksButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingStatus, setAwaitingStatus] = useState(false);

  /* FE4-02: the status line may never show (the job ends first, or the section is not on the page), so the wait is bounded. */
  useEffect(() => {
    if (!awaitingStatus) return undefined;
    const land = () => {
      const status = document.querySelector<HTMLElement>('[data-ai-proposals-job-status]');
      if (!status?.textContent?.trim()) return;
      landOn(status);
      setAwaitingStatus(false);
    };
    const observer = new MutationObserver(land);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setTimeout(() => setAwaitingStatus(false), STATUS_WAIT_MS);
    land();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [awaitingStatus]);

  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await startRiskSuggestionsAction({ assessmentId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      handoffRiskSuggestionJob(result.data);
      router.refresh();
      setAwaitingStatus(true);
    } catch {
      setError(ASK_AI_RETRY_LINE);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1" data-print="hidden">
      <Button aria-disabled={pending ? true : undefined} className="w-fit max-md:min-h-11" onClick={() => void start()} size="sm" type="button" variant="outline">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}{pending ? 'Asking the AI…' : 'Suggest more risks'}
      </Button>
      {error ? <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{error}</p> : null}
    </div>
  );
}
