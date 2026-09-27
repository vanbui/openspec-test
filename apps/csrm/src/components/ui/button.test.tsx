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
});
