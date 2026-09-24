import { CheckCircle2, Circle, CircleDot, type LucideIcon } from 'lucide-react';

import { deriveAssessmentLifecycle, type AssessmentLifecycleStepState } from './assessment-domain';
import type { AssessmentStatus } from './assessment-schema';

const statePresentation: Record<AssessmentLifecycleStepState, { label: string; icon: LucideIcon; className: string; indexClassName: string }> = {
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

/** Read-only lifecycle context; assessment workflow actions remain on their owning surfaces. */
export function AssessmentLifecycleStepper({ status }: { status: AssessmentStatus }) {
  const lifecycle = deriveAssessmentLifecycle(status);

  return (
    <section aria-labelledby="assessment-lifecycle-heading" className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-foreground" id="assessment-lifecycle-heading">
        Current lifecycle state: {lifecycle.currentLabel}
      </h2>
      <ol aria-label="Risk assessment lifecycle" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lifecycle.steps.map((step, index) => {
          const presentation = statePresentation[step.state];
          const Icon = presentation.icon;
          return (
            <li
              aria-current={step.state === 'current' ? 'step' : undefined}
              className={`min-w-0 p-3 transition-opacity motion-reduce:transition-none ${presentation.className}`}
              key={step.key}
            >
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={`text-xs font-semibold tabular-nums ${presentation.indexClassName}`}>Step {index + 1}</span>
              </div>
              <p className="mt-2 break-words text-sm font-medium text-foreground">{step.label}</p>
              <p className="mt-1 text-xs text-foreground-secondary" data-testid="lifecycle-step-state">{presentation.label}</p>
            </li>
          );
        })}
      </ol>
      {lifecycle.terminal ? <p className="mt-3 text-sm text-foreground-secondary">This assessment is closed. All lifecycle steps are complete.</p> : null}
    </section>
  );
}
