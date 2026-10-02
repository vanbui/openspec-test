'use client';

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { useId } from 'react';

import { selectAdjacentRadio } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type SegmentedControlOption<TValue extends string> = {
  value: TValue;
  label: string;
};

export type SegmentedControlProps<TValue extends string> = {
  /** Visible label that names the group. */
  label: string;
  options: readonly SegmentedControlOption<TValue>[];
  /** The checked option. The control is always controlled, usually by URL state. */
  value: TValue;
  onValueChange: (value: TValue) => void;
  className?: string;
};

/**
 * A short single choice drawn as a pill group (direction §4 Forms, segmented control). It is a
 * radio group: arrow keys move focus and check, and Tab enters and leaves the group once. The
 * boundary uses the strong border because it is the only cue that the segments belong together.
 */
export function SegmentedControl<TValue extends string>({
  className,
  label,
  onValueChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  const labelId = useId();

  return (
    <div className={cn('flex w-full flex-col gap-1.5 md:w-auto md:flex-row md:items-center md:gap-3', className)}>
      <span className="text-sm font-medium text-foreground" id={labelId}>
        {label}
      </span>
      {/* Unchecked segments inherit the group's text colour. A colour utility beside `text-button`
          in one `cn()` call would make tailwind-merge drop the type token. */}
      <RadioGroupPrimitive.Root
        aria-labelledby={labelId}
        className="grid w-full auto-cols-fr grid-flow-col rounded-full border border-border-strong bg-surface p-1 text-foreground md:inline-grid md:w-auto"
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.value === next);
          if (option) onValueChange(option.value);
        }}
        value={value}
      >
        {options.map((option) => (
          <RadioGroupPrimitive.Item
            className={cn(
              'h-11 cursor-pointer whitespace-nowrap rounded-full px-3 text-button md:h-8',
              'transition-colors duration-(--duration-micro) ease-standard',
              'data-[state=unchecked]:hover:bg-surface-hover data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
            )}
            key={option.value}
            onKeyDown={selectAdjacentRadio}
            value={option.value}
          >
            {option.label}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
