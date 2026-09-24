import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssessmentLifecycleStepper } from './assessment-lifecycle-stepper';
import type { AssessmentStatus } from './assessment-schema';

function lifecycleFixture(status: AssessmentStatus) {
  return { status };
}

describe('assessment lifecycle stepper', () => {
  it.each([
    ['draft', 'Drafted'],
    ['in-review', 'In review'],
    ['approved', 'Released'],
    ['closed', 'Closed'],
  ] as const)('derives the %s lifecycle state as %s', (status, label) => {
    render(<AssessmentLifecycleStepper {...lifecycleFixture(status)} />);

    expect(screen.getByRole('heading', { name: `Current lifecycle state: ${label}` })).toBeInTheDocument();
  });

  it('renders ordered, text-labelled state semantics with icons and no actions in a narrow container', () => {
    const { container } = render(<div className="max-w-sm"><AssessmentLifecycleStepper {...lifecycleFixture('in-review')} /></div>);
    const steps = within(screen.getByRole('list', { name: 'Risk assessment lifecycle' })).getAllByRole('listitem');

    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Step 1DraftedCompleted'),
      expect.stringContaining('Step 2In reviewCurrent'),
      expect.stringContaining('Step 3ReleasedFuture'),
      expect.stringContaining('Step 4ClosedFuture'),
    ]);
    expect(steps.every((step) => step.querySelector('svg[aria-hidden="true"]') !== null)).toBe(true);
    expect(steps.map((step) => within(step).getByTestId('lifecycle-step-state').textContent)).toEqual(['Completed', 'Current', 'Future', 'Future']);
    expect(container.querySelector('.max-w-sm')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
