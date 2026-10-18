'use client';

import { CheckCircle2, ChevronDown, ChevronUp, Circle, CircleDot, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { RecordLink } from '@/components/csrm/record-link';
import { Button } from '@/components/ui/button';

import { nextActionPresentation, type RequestLifecycle, type RequestLifecycleStepState } from './request-domain';

const statePresentation: Record<RequestLifecycleStepState, { label: string; icon: LucideIcon; className: string; indexClassName: string }> = {
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'rounded-xl border border-success-border bg-success-subtle',
    indexClassName: 'text-success',
  },
  current: {
    label: 'Current',
    icon: CircleDot,
    className: 'rounded-xl border-2 border-primary bg-primary-subtle',
    indexClassName: 'text-primary',
  },
  future: {
    label: 'Future',
    icon: Circle,
    className: 'rounded-xl border border-dashed border-border bg-surface-muted',
    indexClassName: 'text-foreground-secondary',
  },
};

const stepsId = 'request-lifecycle-steps';

/*
 * One next action per width (UI-D23, D-26). Below 768px the stepper is compact: its heading, `Step {n} of {m}`,
 * the next action and a disclosure for the full list, so a phone's first screen says where the request stands and
 * what happens next (X-9). From 768px the full stepper shows with no next action, and the hub's line beneath it
 * carries the one next action. Both lines stay in the DOM, read the same presentation from the same lifecycle and
 * override (D-28), and only one is displayed at any width. The stepper derives nothing: it renders served facts.
 */
export function RequestLifecycleStepper({ lifecycle, nextActionOverride }: { lifecycle: RequestLifecycle | undefined; nextActionOverride?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!lifecycle) return null;
  const currentIndex = lifecycle.steps.findIndex((step) => step.key === lifecycle.currentKey);
  const nextAction = nextActionPresentation(lifecycle.nextAction, nextActionOverride);
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <section aria-labelledby="request-lifecycle-heading" className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm text-foreground" id="request-lifecycle-heading">
        Current lifecycle state: {lifecycle.currentLabel}
      </h2>
      <div className="mt-2 grid gap-2 md:hidden">
        {currentIndex >= 0 ? <p className="text-sm font-medium tabular-nums text-foreground">Step {currentIndex + 1} of {lifecycle.steps.length}</p> : null}
        {nextAction ? (
          <p className="text-sm break-words text-foreground">
            <span className="font-medium">Next action: </span>
            {nextAction.href ? <RecordLink className="text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={nextAction.href}>{nextAction.summary}</RecordLink> : nextAction.summary}
          </p>
        ) : null}
        <div className="mt-2">
          <Button aria-controls={stepsId} aria-expanded={expanded} className="h-11" onClick={() => setExpanded((open) => !open)} type="button" variant="outline">
            <Chevron aria-hidden="true" />
            {expanded ? 'Hide all steps' : 'Show all steps'}
          </Button>
        </div>
      </div>
      {/*
        * At most four steps a row (walk D13(b)): eight to a row left each step about 95px of text at 1440, narrower than
        * "Questionnaire", which then broke inside the word. Four to a row leaves at least 120px from 1024px.
        */}
      <ol aria-label="Assessment request lifecycle" className={`mt-4 gap-3 md:grid md:grid-cols-2 lg:grid-cols-4 ${expanded ? 'grid' : 'hidden'}`} id={stepsId}>
        {lifecycle.steps.map((step, index) => {
          const presentation = statePresentation[step.state];
          const Icon = presentation.icon;
          return (
            <li
              aria-current={step.state === 'current' ? 'step' : undefined}
              className={`min-w-0 p-3 transition-colors motion-reduce:transition-none ${presentation.className}`}
              key={step.key}
            >
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={`text-xs font-medium tabular-nums ${presentation.indexClassName}`}>Step {index + 1}</span>
              </div>
              <p className="mt-2 text-sm font-medium break-words text-foreground">{step.label}</p>
              <p className="mt-1 text-xs text-foreground-secondary" data-testid="lifecycle-step-state">{presentation.label}</p>
            </li>
          );
        })}
      </ol>
      {lifecycle.terminal ? (
        <p className="mt-3 text-sm text-muted-foreground">This request is closed. All lifecycle steps are complete.</p>
      ) : null}
    </section>
  );
}
