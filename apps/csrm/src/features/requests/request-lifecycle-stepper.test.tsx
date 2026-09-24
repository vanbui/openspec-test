import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { requestLifecycleStepKeys, type RequestLifecycle } from './request-domain';
import { RequestLifecycleStepper } from './request-lifecycle-stepper';

function labelFor(key: string): string {
  const words = key.replaceAll('-', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function lifecycle(currentKey: RequestLifecycle['currentKey'] = 'questionnaire-released', terminal = false): RequestLifecycle {
  const currentIndex = requestLifecycleStepKeys.indexOf(currentKey);
  return {
    currentKey,
    currentLabel: labelFor(currentKey),
    terminal,
    nextAction: { actor: 'requestor', summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/q-1' },
    steps: requestLifecycleStepKeys.map((key, index) => ({
      key,
      label: labelFor(key),
      state: terminal || index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'future',
    })),
  };
}

function stateLabels(): string[] {
  const list = screen.getByRole('list', { name: 'Assessment request lifecycle' });
  return within(list).getAllByTestId('lifecycle-step-state').map((element) => element.textContent ?? '');
}

describe('RequestLifecycleStepper', () => {
  it('renders the current state and the accessible ordered lifecycle', () => {
    const view = render(<RequestLifecycleStepper lifecycle={lifecycle()} />);
    expect(screen.getByRole('heading', { name: /Current lifecycle state: Questionnaire released/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Assessment request lifecycle' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Questionnaire released');
    expect(stateLabels()).toEqual(['Completed', 'Completed', 'Completed', 'Current', 'Future', 'Future', 'Future', 'Future']);
    expect(view.container.querySelectorAll('svg')).toHaveLength(8);
    // The next action belongs to the hub beneath the stepper, not to both.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next action/)).not.toBeInTheDocument();
  });

  it('shows terminal text only when closed and renders no control', () => {
    const view = render(<RequestLifecycleStepper lifecycle={{ ...lifecycle(), nextAction: { actor: 'analyst', summary: 'The work is waiting with the other party.' } }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/This request is closed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(view.container.querySelector('form')).toBeNull();
    view.rerender(<RequestLifecycleStepper lifecycle={lifecycle('assessment-released', true)} />);
    expect(screen.getByText(/This request is closed/)).toBeInTheDocument();
    expect(stateLabels()).toEqual(Array.from({ length: 8 }, () => 'Completed'));
  });

  it('remains readable from text after colour-bearing classes are removed and tolerates no lifecycle', () => {
    const view = render(<RequestLifecycleStepper lifecycle={lifecycle()} />);
    for (const element of view.container.querySelectorAll('[class]')) {
      element.setAttribute('class', (element.getAttribute('class') ?? '').replaceAll(/(?:bg|text|border|ring)-[\w-]+/g, ''));
    }
    expect(stateLabels()).toEqual(['Completed', 'Completed', 'Completed', 'Current', 'Future', 'Future', 'Future', 'Future']);
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Questionnaire released');
    view.rerender(<RequestLifecycleStepper lifecycle={undefined} />);
    expect(view.container).toBeEmptyDOMElement();
  });
});
