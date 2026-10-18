'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import { RecordLink } from '@/components/csrm/record-link';
import { readAiSourceAction, type AiSourceView } from './ai-assistance-actions';
import type { AiCitationView } from './ai-provenance-domain';
import { AiSourceLoadError, AiSourceSkeleton, SKELETON_DELAY_MS } from './ai-source-frame';

type SourceState = { kind: 'loading' } | { kind: 'ready'; source: AiSourceView } | { kind: 'permission' | 'error' };

export type AiSourceBodyProps = {
  citation: AiCitationView;
  open: boolean;
  requestId: string;
  /** Whether the frame was already showing the skeleton while this code loaded, so the first read keeps it (WR-307). */
  skeletonAtOnce?: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
};

/*
 * The source a citation names, read when it opens (12-UI-SPEC §4.2; D-03): the body of `AiSourceFrame`, whose code
 * loads the first time an analyst opens a citation (D-36).
 */
export function AiSourceBody({ citation, open, requestId, skeletonAtOnce = false, titleRef }: AiSourceBodyProps) {
  const [state, setState] = useState<SourceState>({ kind: 'loading' });
  const [showSkeleton, setShowSkeleton] = useState(skeletonAtOnce);
  const attempt = useRef(0);
  const skeletonShown = useRef(skeletonAtOnce);

  const load = useCallback(async () => {
    const current = ++attempt.current;
    // A skeleton the frame already showed while this code loaded stays for the first read, so it never flickers off and on.
    const atOnce = skeletonShown.current;
    skeletonShown.current = false;
    setState({ kind: 'loading' });
    setShowSkeleton(atOnce);
    const timer = atOnce ? undefined : setTimeout(() => { if (attempt.current === current) setShowSkeleton(true); }, SKELETON_DELAY_MS);
    let next: SourceState;
    try {
      const result = await readAiSourceAction({ requestId, sourceKey: citation.key });
      next = result.ok ? { kind: 'ready', source: result.data } : { kind: result.failure };
    } catch {
      next = { kind: 'error' };
    }
    clearTimeout(timer);
    if (attempt.current === current) setState(next);
  }, [citation.key, requestId]);

  useEffect(() => {
    if (open) void load();
    else attempt.current += 1;
  }, [load, open]);

  if (state.kind === 'loading') return showSkeleton ? <AiSourceSkeleton /> : null;
  if (state.kind === 'permission') return <Message>You can’t open this source.</Message>;
  if (state.kind === 'error') return <AiSourceLoadError onRetry={() => { void load(); titleRef.current?.focus(); }} />;
  if (state.kind !== 'ready') return null;
  const source = state.source;
  if (source.kind === 'missing') return <Message>This source is no longer available.</Message>;
  if (source.kind === 'request') {
    return (
      <div className="grid gap-2">
        <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{source.value ?? 'Not provided'}</p>
        <RecordLink className="justify-self-start text-sm" href={source.href}>{`Open request ${source.requestNumber}`}</RecordLink>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <p className="text-xs text-foreground-secondary">{source.section}</p>
      {source.helpText ? <p className="text-xs text-foreground-secondary">{source.helpText}</p> : null}
      <p className="micro-label mt-1 text-foreground-secondary">Requestor’s answer</p>
      <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{source.answer}</p>
      <RecordLink className="justify-self-start text-sm" href={source.href}>Open the questionnaire</RecordLink>
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return <p className="text-sm text-foreground-secondary">{children}</p>;
}
