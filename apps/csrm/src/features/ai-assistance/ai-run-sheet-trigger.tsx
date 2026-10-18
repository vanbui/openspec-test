'use client';

import { FileSearch } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import type { AiRunSheetKind } from './ai-provenance-domain';
import type { AiRunSheetBodyProps } from './ai-run-sheet';
import { AiRunSheetFrame, AiRunSheetLoadError, AiRunSheetSkeleton, SKELETON_DELAY_MS } from './ai-run-sheet-frame';

/*
 * D-36: the sheet's body loads only when an analyst asks for it (research Pitfall 7), so the editor's first load
 * carries only this button and the sheet's frame. A plain import() held in state needs no loader runtime, and its
 * failure is caught here rather than thrown to the route's error boundary. Pointer enter or focus starts the load early.
 */
const loadAiRunSheetBody = () => import('./ai-run-sheet').then((module) => module.AiRunSheetBody);

export function AiRunSheetTrigger({ kind, name, riskNumber, runId }: {
  kind: AiRunSheetKind;
  runId: string;
  /** A rewrite run's Risk number, for the sheet's `Assessment` scope (16-UI-SPEC §10.3). */
  riskNumber?: string;
  /** The trigger's name where several show on one page, beginning with its visible text (16-UI-SPEC §3.1, WCAG 2.5.3). */
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [Body, setBody] = useState<ComponentType<AiRunSheetBodyProps> | null>(null);
  const [failed, setFailed] = useState(false);
  /* Whether the body's code has taken longer than the skeleton delay since the sheet opened (12-UI-SPEC §2.4). */
  const [slow, setSlow] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const loading = useRef<Promise<void> | null>(null);
  const waiting = open && !Body && !failed;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  function load(): Promise<void> {
    loading.current ??= loadAiRunSheetBody().then(
      (component) => { setBody(() => component); },
      // WR-307: a failed load says so in the sheet, with Try again; the next attempt imports again.
      () => { loading.current = null; setFailed(true); },
    );
    return loading.current;
  }

  function show() {
    setFailed(false);
    setSlow(false);
    setOpen(true);
    void load();
  }

  /* §2.4: Try again keeps focus on the title. */
  function retry() {
    setFailed(false);
    setSlow(false);
    void load();
    title.current?.focus();
  }

  return (
    <>
      <Button
        aria-label={name}
        className="h-11 w-full md:h-8 md:w-auto"
        data-print="hidden"
        onClick={show}
        onFocus={() => { void load(); }}
        onPointerEnter={() => { void load(); }}
        ref={trigger}
        size="sm"
        type="button"
        variant="outline"
      >
        <FileSearch aria-hidden="true" />Show what the AI used
      </Button>
      <AiRunSheetFrame kind={kind} onOpenChange={setOpen} open={open} returnFocusTo={trigger} titleRef={title}>
        {Body
          ? <Body open={open} riskNumber={riskNumber} runId={runId} skeletonAtOnce={slow} titleRef={title} />
          : failed ? <AiRunSheetLoadError onRetry={retry} /> : slow ? <AiRunSheetSkeleton /> : null}
      </AiRunSheetFrame>
    </>
  );
}
