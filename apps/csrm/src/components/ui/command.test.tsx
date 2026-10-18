import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

import { Command, CommandInput, CommandList } from './command';

/*
 * D4 (the pilot's walk, W15 and W16): the command search's focus ring was clipped at the top. The input (40px) sat in a
 * 36px row inside the overflow-hidden command, and drew the global `:focus-visible` outline 2px outside itself; that
 * rule is unlayered, so it beat the input's layered `outline-hidden`. The row now draws the ring inside its own box on
 * focus-within, and the input fills the row and keeps no outline of its own (an important utility, which an unlayered
 * rule cannot beat). Quick find draws its own ring around the whole input row, so its command row draws none.
 * jsdom applies no stylesheet: these pin the classes and rules; the browser checks the drawn ring.
 */
beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
});

function classes(element: Element): string[] {
  return element.getAttribute('class')?.split(/\s+/) ?? [];
}

describe('the command search’s focus ring (D4)', () => {
  it('is drawn inside the search row on focus, and the input fills the row with no outline of its own', () => {
    render(
      <Command label="Search Security Analysts">
        <CommandInput placeholder="Search Security Analysts" />
        <CommandList />
      </Command>,
    );
    const input = screen.getByRole('combobox', { name: 'Search Security Analysts' });
    const row = input.closest('[data-slot="command-input-wrapper"]');
    expect(row).not.toBeNull();

    expect(classes(row!)).toEqual(expect.arrayContaining(['focus-within:outline-2', 'focus-within:-outline-offset-2', 'focus-within:outline-ring']));
    expect(classes(input)).toEqual(expect.arrayContaining(['h-full', 'outline-hidden!']));
    expect(classes(input)).not.toContain('h-10');
  });

  it('leaves quick find one ring, around its whole input row', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.quick-find-input-row \[data-slot='command-input-wrapper'\]\s*\{([^}]*)\}/.exec(css);
    expect(rule?.[1]).toMatch(/outline:\s*none/);
    expect(css).toMatch(/\.quick-find-input-row:focus-within\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/);
  });
});
