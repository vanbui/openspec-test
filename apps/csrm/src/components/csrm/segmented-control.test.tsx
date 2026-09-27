import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './segmented-control';

const periodOptions = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
] as const;

type Period = (typeof periodOptions)[number]['value'];

function PeriodHarness({ initial = '6', onValueChange }: { initial?: Period; onValueChange: (value: Period) => void }) {
  const [period, setPeriod] = useState<Period>(initial);

  return (
    <>
      <button type="button">Before</button>
      <SegmentedControl
        label="Period"
        onValueChange={(next) => {
          onValueChange(next);
          setPeriod(next);
        }}
        options={periodOptions}
        value={period}
      />
      <button type="button">After</button>
    </>
  );
}

describe('SegmentedControl', () => {
  it('is a radio group named by its visible label, with one radio per option', () => {
    render(<SegmentedControl label="Period" onValueChange={vi.fn()} options={periodOptions} value="6" />);

    const label = screen.getByText('Period');
    const group = screen.getByRole('radiogroup', { name: 'Period' });
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(label).toHaveClass('text-sm', 'font-medium');

    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(['6 months', '12 months']);
  });

  it('checks the radio whose value matches', () => {
    render(<SegmentedControl label="Period" onValueChange={vi.fn()} options={periodOptions} value="12" />);

    expect(screen.getByRole('radio', { name: '12 months' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '6 months' })).not.toBeChecked();
  });

  it('moves focus to the next option with ArrowRight, checks it and reports its value', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<PeriodHarness onValueChange={onValueChange} />);

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('radio', { name: '6 months' })).toHaveFocus();

    // A physical key press is released after roving focus has moved, and the move is what checks the
    // radio. Hold the key until focus lands, as a person does, then release it.
    await user.keyboard('{ArrowRight>}');
    const twelve = screen.getByRole('radio', { name: '12 months' });
    await waitFor(() => expect(twelve).toHaveFocus());
    await user.keyboard('{/ArrowRight}');

    expect(twelve).toHaveFocus();
    expect(twelve).toBeChecked();
    expect(screen.getByRole('radio', { name: '6 months' })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('12');
  });

  it('is a single tab stop that enters on the checked option', async () => {
    const user = userEvent.setup();
    render(<PeriodHarness initial="12" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('radio', { name: '12 months' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('radio', { name: '12 months' })).toHaveFocus();
  });

  it('draws a pill group whose segments meet the touch target below md and the small button height from md', () => {
    render(<SegmentedControl label="Period" onValueChange={vi.fn()} options={periodOptions} value="6" />);

    expect(screen.getByRole('radiogroup')).toHaveClass('rounded-full', 'border', 'border-border-strong', 'bg-surface');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveClass('rounded-full', 'text-button', 'h-11', 'md:h-8', 'data-[state=checked]:bg-primary');
    }
  });
});
