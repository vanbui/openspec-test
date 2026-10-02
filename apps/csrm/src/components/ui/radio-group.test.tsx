import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type KeyboardEvent, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from '@/components/csrm/segmented-control';

import { RadioGroup, RadioGroupItem } from './radio-group';

const answerOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
] as const;

type Answer = (typeof answerOptions)[number]['value'];

type AnswerHarnessProps = {
  initial?: Answer;
  disabledValue?: Answer;
  onItemKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onValueChange: (value: string) => void;
};

/** A controlled Yes / No / Unsure group between two buttons, as the questionnaire renders one. */
function AnswerHarness({ disabledValue, initial = 'yes', onItemKeyDown, onValueChange }: AnswerHarnessProps) {
  const [answer, setAnswer] = useState<string>(initial);

  return (
    <>
      <button type="button">Before</button>
      <RadioGroup
        aria-label="Answer"
        onValueChange={(next) => {
          onValueChange(next);
          setAnswer(next);
        }}
        value={answer}
      >
        {answerOptions.map((option) => (
          <label key={option.value}>
            <RadioGroupItem disabled={option.value === disabledValue} onKeyDown={onItemKeyDown} value={option.value} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
      <button type="button">After</button>
    </>
  );
}

function radio(name: string) {
  return screen.getByRole('radio', { name });
}

/** Tab into the group from the button before it, which lands on the checked option. */
async function enterGroup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Before' }));
  await user.tab();
}

describe('RadioGroup arrow keys', () => {
  it('checks the next option on one quick ArrowDown press and reports one change', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness onValueChange={onValueChange} />);

    await enterGroup(user);
    expect(radio('Yes')).toHaveFocus();

    // Pressed and released at once, as Playwright's press() and a quick typist do.
    await user.keyboard('{ArrowDown}');

    expect(radio('No')).toHaveFocus();
    expect(radio('No')).toBeChecked();
    expect(radio('Yes')).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('no');
  });

  it('treats ArrowRight as next and ArrowLeft as previous', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness onValueChange={onValueChange} />);

    await enterGroup(user);
    await user.keyboard('{ArrowRight}');
    expect(radio('No')).toHaveFocus();
    expect(radio('No')).toBeChecked();

    await user.keyboard('{ArrowLeft}');
    expect(radio('Yes')).toHaveFocus();
    expect(radio('Yes')).toBeChecked();
    expect(onValueChange.mock.calls).toEqual([['no'], ['yes']]);
  });

  it('wraps from the last option to the first and from the first to the last', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness initial="unsure" onValueChange={onValueChange} />);

    await enterGroup(user);
    expect(radio('Unsure')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(radio('Yes')).toHaveFocus();
    expect(radio('Yes')).toBeChecked();

    await user.keyboard('{ArrowUp}');
    expect(radio('Unsure')).toHaveFocus();
    expect(radio('Unsure')).toBeChecked();
    expect(onValueChange.mock.calls).toEqual([['yes'], ['unsure']]);
  });

  it('skips a disabled option in both directions', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness disabledValue="unsure" initial="no" onValueChange={onValueChange} />);

    await enterGroup(user);
    expect(radio('No')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(radio('Yes')).toHaveFocus();
    expect(radio('Yes')).toBeChecked();

    await user.keyboard('{ArrowUp}');
    expect(radio('No')).toHaveFocus();
    expect(radio('No')).toBeChecked();
    expect(radio('Unsure')).not.toBeChecked();
    expect(onValueChange.mock.calls).toEqual([['yes'], ['no']]);
  });

  it.each(['Shift', 'Control', 'Alt', 'Meta'])('leaves focus and value alone for an arrow pressed with %s', async (modifier) => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness onValueChange={onValueChange} />);

    await enterGroup(user);
    await user.keyboard(`{${modifier}>}{ArrowDown}{/${modifier}}`);
    // Give a deferred focus move the chance to happen before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(radio('Yes')).toHaveFocus();
    expect(radio('Yes')).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('checks exactly one option and reports one change while the key is held', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness onValueChange={onValueChange} />);

    await enterGroup(user);
    await user.keyboard('{ArrowDown>}');
    await waitFor(() => expect(radio('No')).toHaveFocus());
    await user.keyboard('{/ArrowDown}');

    expect(radio('No')).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('no');
  });

  it('checks one option per auto-repeated press while the key stays down', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness onValueChange={onValueChange} />);

    await enterGroup(user);
    // Two keydowns before one keyup, as a held key repeats.
    await user.keyboard('{ArrowDown>2/}');

    expect(radio('Unsure')).toHaveFocus();
    expect(radio('Unsure')).toBeChecked();
    expect(onValueChange.mock.calls).toEqual([['no'], ['unsure']]);
  });

  it('is a single tab stop that enters on the checked option', async () => {
    const user = userEvent.setup();
    render(<AnswerHarness initial="no" onValueChange={vi.fn()} />);

    await enterGroup(user);
    expect(radio('No')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(radio('No')).toHaveFocus();
  });

  it('moves focus without checking on Home, and Space checks the focused option', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<AnswerHarness initial="no" onValueChange={onValueChange} />);

    await enterGroup(user);
    await user.keyboard('{Home}');
    await waitFor(() => expect(radio('Yes')).toHaveFocus());
    expect(radio('No')).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();

    await user.keyboard(' ');
    expect(radio('Yes')).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('yes');
  });

  it("runs the caller's key handler first, and a handler that prevents default keeps the arrow from moving", async () => {
    const onValueChange = vi.fn();
    const onItemKeyDown = vi.fn((event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowDown') event.preventDefault();
    });
    const user = userEvent.setup();
    render(<AnswerHarness onItemKeyDown={onItemKeyDown} onValueChange={onValueChange} />);

    await enterGroup(user);
    await user.keyboard('{ArrowDown}');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onItemKeyDown).toHaveBeenCalled();
    expect(radio('Yes')).toHaveFocus();
    expect(radio('Yes')).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

const periodOptions = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
] as const;

type Period = (typeof periodOptions)[number]['value'];

/** A controlled two-segment control between two buttons, as the report header renders one. */
function PeriodHarness({ onValueChange }: { onValueChange: (value: Period) => void }) {
  const [period, setPeriod] = useState<Period>('6');

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

describe('SegmentedControl arrow keys', () => {
  it('checks the next segment on one quick ArrowRight press, then wraps to the first', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<PeriodHarness onValueChange={onValueChange} />);

    await enterGroup(user);
    expect(radio('6 months')).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(radio('12 months')).toHaveFocus();
    expect(radio('12 months')).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('12');

    await user.keyboard('{ArrowRight}');
    expect(radio('6 months')).toHaveFocus();
    expect(radio('6 months')).toBeChecked();
    expect(onValueChange.mock.calls).toEqual([['12'], ['6']]);
  });
});
