import { CheckCircle2, Circle, CircleDot, type LucideIcon } from 'lucide-react';

import type { RequestLifecycle, RequestLifecycleStepState } from './request-domain';

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

/*
 * The stepper explains where the request stands and nothing else. The next
 * required action belongs to the hub directly beneath it (D-10); rendering it
 * in both places said the same thing twice and edged the stepper towards
 * being a second workflow-control surface.
 */
export function RequestLifecycleStepper({ lifecycle }: { lifecycle: RequestLifecycle | undefined }) {
  if (!lifecycle) return null;
  return (
    <section aria-labelledby="request-lifecycle-heading" className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-foreground" id="request-lifecycle-heading">
        Current lifecycle state: {lifecycle.currentLabel}
      </h2>
      <ol aria-label="Assessment request lifecycle" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
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
                <span className={`text-xs font-semibold tabular-nums ${presentation.indexClassName}`}>Step {index + 1}</span>
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
