'use client';

import { useEffect, useId, useRef, useState, type ComponentType } from 'react';

import { StatusBadge } from '@/components/csrm/status-badge';
import { citationOpensSource, citationText, type AiCitationView } from './ai-provenance-domain';
import type { AiSourceBodyProps } from './ai-source-popover';
import { AiSourceFrame, AiSourceLoadError, AiSourceSkeleton, SKELETON_DELAY_MS } from './ai-source-frame';

/*
 * D-36: the source view's code loads the first time an analyst opens or points at a citation. A plain import() held in
 * state, so a failed load shows its error and Try again in the source's own frame instead of reaching the route's
 * error boundary, which would replace the editor and its unsaved forms (WR-307).
 */
const loadAiSourceBody = () => import('./ai-source-popover').then((module) => module.AiSourceBody);

/*
 * Where an AI statement came from (12-UI-SPEC §4.1, X-12; D-14). Answer and request citations open their source in
 * place; system and asset citations are plain text. A statement that cites nothing is flagged instead.
 *
 * A citation keeps one line and ends in an ellipsis beyond 28rem (X-12): `max-w-md`, the utility the long-text columns
 * map the same 28rem to (X-3; UI-06). A list item never outgrows the list. A citation button fills its item: on its own,
 * a button on one line takes its text's width up to 28rem, wider than the field at 375.
 */
export function AiCitations({ fieldLabel, requestId, sources }: { fieldLabel: string; requestId: string; sources: readonly AiCitationView[] }) {
  const labelId = useId();
  const [active, setActive] = useState<AiCitationView | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [Body, setBody] = useState<ComponentType<AiSourceBodyProps> | null>(null);
  const [failed, setFailed] = useState(false);
  /* Whether the source view's code has taken longer than the skeleton delay since the source opened (§4.2). */
  const [slow, setSlow] = useState(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const anchor = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const loading = useRef<Promise<void> | null>(null);
  const waiting = isOpen && !Body && !failed;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (sources.length === 0) {
    return (
      <div className="grid justify-items-start gap-1">
        <StatusBadge family="aiReview" value="uncited" />
        <p className="text-xs text-foreground-secondary">Check this statement against the request and answers.</p>
      </div>
    );
  }

  function load(): Promise<void> {
    loading.current ??= loadAiSourceBody().then(
      (component) => { setBody(() => component); },
      () => { loading.current = null; setFailed(true); },
    );
    return loading.current;
  }

  function show(citation: AiCitationView) {
    anchor.current = buttons.current.get(citation.key) ?? null;
    setActive(citation);
    setFailed(false);
    setSlow(false);
    setIsOpen(true);
    void load();
  }

  /* §4.2: Try again loads the source view again; focus stays on the title. */
  function retry() {
    setFailed(false);
    setSlow(false);
    void load();
    title.current?.focus();
  }

  return (
    <div className="grid gap-1">
      <p className="micro-label text-foreground-secondary" id={labelId}>Sources</p>
      <ul aria-label={`Sources for ${fieldLabel}`} className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
        {sources.map((citation) => {
          const text = citationText(citation);
          return (
            <li className="min-w-0 max-w-full" key={citation.key}>
              {citationOpensSource(citation) ? (
                <button
                  aria-expanded={isOpen && active?.key === citation.key}
                  aria-haspopup="dialog"
                  className="record-link block w-full max-w-md truncate py-1 text-left text-xs font-medium"
                  onClick={() => show(citation)}
                  onFocus={() => { void load(); }}
                  onPointerEnter={() => { void load(); }}
                  ref={(element) => {
                    if (element) buttons.current.set(citation.key, element);
                    else buttons.current.delete(citation.key);
                  }}
                  type="button"
                >
                  {text}
                </button>
              ) : <span className="block max-w-md truncate py-1 text-xs text-foreground-secondary">{text}</span>}
            </li>
          );
        })}
      </ul>
      {active ? (
        <AiSourceFrame anchor={anchor} citation={active} onOpenChange={setIsOpen} open={isOpen} titleRef={title}>
          {Body
            ? <Body citation={active} open={isOpen} requestId={requestId} skeletonAtOnce={slow} titleRef={title} />
            : failed ? <AiSourceLoadError onRetry={retry} /> : slow ? <AiSourceSkeleton /> : null}
        </AiSourceFrame>
      ) : null}
    </div>
  );
}
