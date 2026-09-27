import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Wordmark } from './wordmark';

describe('the sidebar wordmark link', () => {
  it('is named by the word it shows, then by where it goes (WCAG 2.5.3 Label in Name)', () => {
    render(<Wordmark />);

    const link = screen.getByRole('link', { name: 'BProton, IdamBox CSRM home' });
    expect(link).toHaveAttribute('href', '/app');
    expect(link).toHaveTextContent('BProton');
    // The visible word opens the name, so a speech-input user who says what they see reaches the link.
    expect(link.getAttribute('aria-label')?.startsWith(link.textContent?.trim() ?? '')).toBe(true);
  });

  /*
   * WR-09: Next 16 deprecated next/image's priority prop in favour of preload (02-components/image.md). The
   * lockup's mark is above the fold on every page, so it keeps loading eagerly through preload.
   */
  it('loads its decorative mark eagerly through preload, not the deprecated priority prop', () => {
    const { container } = render(<Wordmark />);

    const mark = container.querySelector('img');
    expect(mark).toHaveAttribute('alt', '');
    expect(mark).not.toHaveAttribute('loading', 'lazy');
    const source = readFileSync(resolve(process.cwd(), 'src/components/shell/wordmark.tsx'), 'utf8');
    expect(source).toMatch(/<Image\b[^>]*\spreload[\s/>]/);
    expect(source).not.toMatch(/\bpriority\b/);
  });
});
