import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('draws the outline label in ink whatever text colour surrounds it (B-1)', () => {
    /*
     * The outline variant sets a surface fill, so its label must set its own ink rather than inherit:
     * inside the navigation sheet it inherited the sidebar's light text, 1.09:1 on white (direction
     * section 4 Buttons: Outline is --color-text-primary text). The ink is important so tailwind-merge
     * keeps the text-button type scale beside it, as the primary variant's important ink does.
     */
    render(<div className="text-sidebar-foreground"><Button variant="outline">Close</Button></div>);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveClass('!text-foreground', 'text-button', 'bg-surface', 'border-border');
    expect(buttonVariants({ variant: 'outline' })).toContain('!text-foreground');
  });

  it('keeps the type scale when a caller adds its own classes', () => {
    render(<Button className="w-fit" variant="outline">Check again</Button>);
    expect(screen.getByRole('button', { name: 'Check again' })).toHaveClass('text-button', '!text-foreground', 'w-fit');
  });

  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
  const sizes = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const;

  it('keeps the text-button type scale on every variant at every size', () => {
    /*
     * Direction section 3.10 sets every pill label at --text-button. tailwind-merge reads text-button
     * as a text colour, so it drops it beside a plain text-colour utility; every variant's ink is
     * important so the type scale survives.
     */
    const offenders: string[] = [];
    for (const variant of variants) {
      for (const size of sizes) {
        const label = `${variant} ${size}`;
        render(<Button variant={variant} size={size}>{label}</Button>);
        if (!screen.getByRole('button', { name: label }).classList.contains('text-button')) offenders.push(`${variant} at size ${size}`);
      }
    }
    expect(offenders, 'Buttons that lost text-button (variant at size)').toEqual([]);
  });

  it('draws the destructive and link labels in important ink beside the type scale', () => {
    render(<Button variant="destructive">Delete question</Button>);
    expect(screen.getByRole('button', { name: 'Delete question' })).toHaveClass('!text-destructive-foreground', 'text-button');
    render(<Button variant="link">Clear filters</Button>);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toHaveClass('!text-foreground', 'text-button');
  });
});
