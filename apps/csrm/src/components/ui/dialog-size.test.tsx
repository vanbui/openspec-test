import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

/* Each top-level block of a stylesheet, without comments: its prelude (a selector list or an at-rule) and its body. */
function topLevelBlocks(css: string): { prelude: string; body: string }[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '{') {
      if (depth === 0) open = index;
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ prelude: source.slice(start, open).split(';').pop()?.trim() ?? '', body: source.slice(open + 1, index) });
        start = index + 1;
      }
    }
  }
  return blocks;
}

/*
 * Phase 12 UI review, UI-01: the shared dialogs open at the direction's confirm size, 480px (§4 Dialogs), from the 640px
 * breakpoint at which the shipped default applies, and at the viewport less the 16px gutters below it. A dialog of another
 * size names its own; ConfirmDialog and quick find keep theirs.
 */
describe('the shared dialog sizes (direction §4 Dialogs, UI-01)', () => {
  it('opens a DialogContent at the 480px confirm size unless it names another', () => {
    render(<Dialog open><DialogContent><DialogTitle>Rename view</DialogTitle><DialogDescription>Give the view a new name.</DialogDescription></DialogContent></Dialog>);
    const dialog = screen.getByRole('dialog', { name: 'Rename view' });
    expect(dialog).toHaveClass('max-w-[calc(100%-2rem)]', 'sm:max-w-[480px]');
    expect(dialog).not.toHaveClass('sm:max-w-lg');
  });

  it('opens an AlertDialogContent at the 480px confirm size unless it names another', () => {
    render(<AlertDialog open><AlertDialogContent><AlertDialogTitle>Delete this view?</AlertDialogTitle><AlertDialogDescription>The view is removed for everyone.</AlertDialogDescription></AlertDialogContent></AlertDialog>);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this view?' });
    expect(dialog).toHaveClass('max-w-[calc(100%-2rem)]', 'data-[size=default]:sm:max-w-[480px]');
    expect(dialog).not.toHaveClass('data-[size=default]:sm:max-w-lg');
  });

  it('leaves ConfirmDialog at its own 480px width, which the default cap equals, so it never narrows it', () => {
    render(<ConfirmDialog confirmLabel="Delete view" confirmVariant="destructive" description="The view is removed for everyone." onConfirm={vi.fn()} onOpenChange={vi.fn()} open pendingLabel="Deleting view…" title="Delete this view?" />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this view?' });
    expect(dialog).toHaveClass('w-[min(480px,calc(100vw-32px))]', 'max-w-none', 'data-[size=default]:sm:max-w-[480px]');
  });

  it('leaves quick find at 640px from 768px and the full screen below, from its own rule outside every layer', () => {
    const quickFind = readFileSync(resolve(process.cwd(), 'src/features/quick-find/quick-find-dialog.tsx'), 'utf8');
    expect(quickFind).toMatch(/<DialogContent\s+className="quick-find-content"/);

    // Unlayered rules outrank every utility in @layer utilities, so no DialogContent default reaches quick find's width.
    const blocks = topLevelBlocks(readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8'));
    expect(blocks.filter((block) => block.prelude.startsWith('@layer')).some((block) => block.body.includes('.quick-find-content'))).toBe(false);
    const rule = (prelude: string) => /\.quick-find-content \{([^}]*)\}/.exec(blocks.find((block) => block.prelude === prelude && /\.quick-find-content \{/.test(block.body))?.body ?? '')?.[1] ?? '';
    expect(rule('@media (min-width: 48rem)')).toMatch(/max-width:\s*640px;/);
    expect(rule('@media (max-width: 767px)')).toMatch(/max-width:\s*none;/);
  });
});
