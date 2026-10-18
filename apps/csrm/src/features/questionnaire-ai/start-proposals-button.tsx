'use client';

import { AlertCircle, LoaderCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { landOn } from '@/components/csrm/use-hash-landing';

import { Button } from '@/components/ui/button';
import { startQuestionnaireAiProposalsAction } from './questionnaire-ai-actions';
import { ASKING_THE_AI, SUGGEST_FOLLOW_UP } from './questionnaire-ai-domain';
import { aiProposalStartRefusalCopy } from './questionnaire-ai-refusal-copy';
import { handoffProposalJob, requestProposalJobFocus } from './proposal-job-handoff';

/*
 * Suggest follow-up questions (15-UI-SPEC §9.1, §8.4; D-29, UI-D20): the default task, started from the AI inputs signal
 * on the questionnaire page and from the hub (15-13), offered only where the proposals read allows a start. Once the AI is
 * asked, focus moves to the panel's job status line as the page shows it, or to the panel when it is elsewhere.
 */
export function StartProposalsButton({ questionnaireId }: { questionnaireId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingStatus, setAwaitingStatus] = useState(false);
  useEffect(() => {
    if (!awaitingStatus) return undefined;
    const land = () => {
      const status = document.querySelector<HTMLElement>('[data-ai-proposals-job-status]');
      // The live holder exists before a refreshed active job arrives. Wait for its committed text too.
      if (!status?.textContent?.trim()) return;
      landOn(status);
      setAwaitingStatus(false);
    };
    const observer = new MutationObserver(land);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    land();
    return () => observer.disconnect();
  }, [awaitingStatus]);

  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await startQuestionnaireAiProposalsAction({ documentId: questionnaireId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      handoffProposalJob(result.data);
      requestProposalJobFocus(questionnaireId);
      router.refresh();
      setAwaitingStatus(true);
    } catch {
      setError(aiProposalStartRefusalCopy({}).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1" data-print="hidden">
      <Button aria-disabled={pending ? true : undefined} className="w-fit max-md:min-h-11" onClick={() => void start()} size="sm" type="button" variant="outline">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}{pending ? ASKING_THE_AI : SUGGEST_FOLLOW_UP}
      </Button>
      {error ? <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{error}</p> : null}
    </div>
  );
}
