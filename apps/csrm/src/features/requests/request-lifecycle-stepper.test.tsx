import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    nextAction: terminal ? null : { actor: 'requestor', holder: 'requestor', summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/q-1' },
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

/*
 * The compact block is the stepper's phone presentation (X-9): it carries `md:hidden`, so jsdom, which applies
 * no media queries, renders it at every width. Phone width therefore means this block.
 */
function compactBlock(): HTMLElement {
  const stepper = screen.getByRole('region', { name: /^Current lifecycle state:/ });
  const block = stepper.querySelector<HTMLElement>('.md\\:hidden');
  expect(block, 'the stepper’s compact block').not.toBeNull();
  return block!;
}

function compactNextActionLine(): HTMLElement {
  return within(compactBlock()).getByText('Next action:').closest('p') as HTMLElement;
}

describe('RequestLifecycleStepper', () => {
  it('renders the current state and the accessible ordered lifecycle', () => {
    const view = render(<RequestLifecycleStepper lifecycle={lifecycle()} />);
    expect(screen.getByRole('heading', { name: /Current lifecycle state: Questionnaire released/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Assessment request lifecycle' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Questionnaire released');
    expect(stateLabels()).toEqual(['Completed', 'Completed', 'Completed', 'Current', 'Future', 'Future', 'Future', 'Future']);
    expect(within(screen.getByRole('list', { name: 'Assessment request lifecycle' })).getAllByRole('listitem').map((item) => item.querySelectorAll('svg').length)).toEqual(Array.from({ length: 8 }, () => 1));
    // UI-D23: the stepper holds the phone's one next action, hidden from 768px, where the hub's line shows instead.
    expect(compactNextActionLine()).toHaveTextContent('Next action: Answer and submit the questionnaire.');
    expect(within(compactNextActionLine()).getByRole('link', { name: 'Answer and submit the questionnaire.' })).toHaveAttribute('href', '/app/questionnaires/q-1');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(view.container.querySelector('form')).toBeNull();
  });

  it('reads Step n of m, then the next action, then the disclosure below 768px (X-9, UI-SPEC §6.3)', () => {
    render(<RequestLifecycleStepper lifecycle={{ ...lifecycle('submitted'), nextAction: { actor: 'requestor', holder: 'analyst', summary: 'The Security Analyst is reviewing your request and will send you a questionnaire to answer.' } }} />);
    const block = compactBlock();
    expect(block).toHaveClass('md:hidden');
    const stepLine = within(block).getByText('Step 2 of 8');
    expect(stepLine).toHaveClass('tabular-nums', 'font-medium');
    const toggle = within(block).getByRole('button', { name: 'Show all steps' });
    // In order: the step line, the next action, then the disclosure.
    const order = [stepLine, compactNextActionLine(), toggle];
    for (const [index, element] of order.slice(1).entries()) {
      expect(order[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // The viewer does not hold the step: plain text, decided from holder, never from the words (D-27).
    expect(compactNextActionLine()).toHaveTextContent('Next action: The Security Analyst is reviewing your request and will send you a questionnaire to answer.');
    expect(within(compactNextActionLine()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('reveals the full ordered list from the disclosure and keeps focus on it (D-26)', async () => {
    const user = userEvent.setup();
    render(<RequestLifecycleStepper lifecycle={lifecycle('submitted')} />);
    const list = screen.getByRole('list', { name: 'Assessment request lifecycle' });
    const toggle = within(compactBlock()).getByRole('button', { name: 'Show all steps' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', list.id);
    expect(list.id).not.toBe('');
    // Below 768px the list is not displayed until expanded; from 768px it shows as today.
    expect(list).toHaveClass('hidden', 'md:grid');

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName('Hide all steps');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    expect(list).not.toHaveClass('hidden');
    // Expanded on a phone, the list is one column: every column count applies from 768px only.
    for (const className of list.className.split(/\s+/).filter((name) => name.includes('grid-cols-'))) {
      expect(className).toMatch(/^(md|lg|xl):grid-cols-/);
    }
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName('Show all steps');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(list).toHaveClass('hidden');
  });

  it('replaces the summary with the page’s override, as plain text (D-28)', () => {
    render(<RequestLifecycleStepper lifecycle={{ ...lifecycle('submitted'), nextAction: { actor: 'analyst', holder: 'analyst', summary: 'Generate the questionnaire.', href: '/app/review/requests/request-1' } }} nextActionOverride="Questionnaire generation is in progress. Review the questionnaire when it’s ready." />);
    expect(compactNextActionLine()).toHaveTextContent('Next action: Questionnaire generation is in progress. Review the questionnaire when it’s ready.');
    expect(within(compactNextActionLine()).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate the questionnaire.')).not.toBeInTheDocument();
  });

  it('shows terminal text only when closed, with no next action', () => {
    const view = render(<RequestLifecycleStepper lifecycle={{ ...lifecycle(), nextAction: { actor: 'analyst', holder: 'requestor', summary: 'The Requestor is answering the questionnaire.' } }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(compactNextActionLine()).toHaveTextContent('Next action: The Requestor is answering the questionnaire.');
    expect(screen.queryByText(/This request is closed/)).not.toBeInTheDocument();
    // The disclosure is the stepper's only control: it changes nothing but what is shown.
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Show all steps']);
    expect(view.container.querySelector('form')).toBeNull();
    view.rerender(<RequestLifecycleStepper lifecycle={lifecycle('assessment-released', true)} />);
    expect(screen.getByText(/This request is closed/)).toBeInTheDocument();
    expect(screen.queryByText('Next action:')).not.toBeInTheDocument();
    expect(stateLabels()).toEqual(Array.from({ length: 8 }, () => 'Completed'));
  });

  it('omits the step line when the current step is not among the served steps', () => {
    render(<RequestLifecycleStepper lifecycle={{ ...lifecycle('submitted'), steps: [] }} />);
    expect(within(compactBlock()).queryByText(/^Step \d+ of \d+$/)).not.toBeInTheDocument();
    expect(compactNextActionLine()).toHaveTextContent('Next action: Answer and submit the questionnaire.');
    expect(within(compactBlock()).getByRole('button', { name: 'Show all steps' })).toBeInTheDocument();
  });

  it('sets the heading at the panel title size at every width and each step label as a caption at 500 (UI-D24)', () => {
    render(<RequestLifecycleStepper lifecycle={lifecycle()} />);
    expect(screen.getByRole('heading', { name: /^Current lifecycle state:/ })).toHaveClass('text-heading-sm');
    const list = screen.getByRole('list', { name: 'Assessment request lifecycle' });
    for (const label of within(list).getAllByText(/^Step \d$/)) expect(label).toHaveClass('text-xs', 'font-medium');
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
