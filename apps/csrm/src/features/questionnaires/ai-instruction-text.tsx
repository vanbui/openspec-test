'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * An analyst's instruction to the AI wherever it is shown after the AI was asked (X-25; 15-UI-SPEC §10): labelled
 * `Instruction`, plain React text in typographic quotes with its line breaks kept (never HTML), clamped to three lines
 * with a `Show full instruction` toggle while the clamp hides some of it. The whole text stays in the DOM and prints
 * whole. Plans 15-11 to 15-13 reuse it for the AI proposals panel and the run facts.
 */
export const aiInstructionCopy = {
  showFull: 'Show full instruction',
  showLess: 'Show less',
} as const;

/** Whether the clamped text hides some of itself, measured after layout and again when its box changes. */
function useClampOverflow(text: string, expanded: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = ref.current;
    /* Expanded, the clamp is off and nothing overflows: the toggle stays so the text can be clamped again. */
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  return { ref, overflows };
}

export function AiInstructionText({ instruction }: { instruction: string }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const { ref, overflows } = useClampOverflow(instruction, expanded);
  return <div className="grid min-w-0 justify-items-start gap-1">
    <p
      className={cn('min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-foreground print:line-clamp-none', !expanded && 'line-clamp-3')}
      data-instruction-text=""
      id={id}
      ref={ref}
    ><span className="font-medium">Instruction: </span>“{instruction}”</p>
    {overflows || expanded ? (
      <Button aria-controls={id} aria-expanded={expanded} className="w-fit" data-print="hidden" onClick={() => setExpanded((open) => !open)} size="sm" type="button" variant="ghost">
        {expanded ? aiInstructionCopy.showLess : aiInstructionCopy.showFull}
      </Button>
    ) : null}
  </div>;
}
