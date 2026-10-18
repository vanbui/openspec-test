import { render, screen } from '@testing-library/react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClockIcon,
  CalendarX2Icon,
  CaseSensitiveIcon,
  CheckIcon,
  CircleGaugeIcon,
  CircleQuestionMarkIcon,
  CircleXIcon,
  FileCheck2Icon,
  FlagIcon,
  OctagonAlertIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { csvRowStates, type CsvRowState } from './csv-import-schema';
import { ImportRowBadge, importRowLabel, importRowPresentation } from './import-row-status';

/*
 * Phase 19 (19-13; 19-UI-SPEC §5.6, UI-D16, X-32; B4, B5): the six import row states and their badges, in a module only
 * the Administration import route loads, so the sixth state adds nothing to the shared first-load badge map. The five
 * states keep their Phase 6 label, tone and icon; `similar` is "Matched by similar name", warning, CaseSensitive.
 */
const rows: ReadonlyArray<readonly [CsvRowState, string, string, LucideIcon]> = [
  ['create', 'Create', 'success', CheckIcon],
  ['update', 'Update', 'success', RefreshCwIcon],
  ['unchanged', 'Unchanged', 'neutral', FileCheck2Icon],
  ['rejected', 'Rejected', 'warning', CircleXIcon],
  ['ambiguous', 'Ambiguous', 'warning', CircleQuestionMarkIcon],
  ['similar', 'Matched by similar name', 'warning', CaseSensitiveIcon],
];

/* Severity (direction section 3.6) and urgency (section 4 Urgency) shapes: never a status icon. */
const forbiddenIcons = [TriangleAlertIcon, OctagonAlertIcon, CircleGaugeIcon, CalendarX2Icon, CalendarClockIcon, FlagIcon];

describe('the import row states', () => {
  it('presents exactly the six row states', () => {
    expect(Object.keys(importRowPresentation)).toEqual([...csvRowStates]);
  });

  it.each(rows)('presents %s as %s, the %s tone and its icon', (state, label, tone, icon) => {
    expect(importRowPresentation[state]).toEqual({ icon, label, tone });
    expect(importRowLabel(state)).toBe(label);
  });

  it('never gives a row state a severity or urgency icon, and keeps an ambiguous row a question', () => {
    for (const state of csvRowStates) {
      for (const forbidden of forbiddenIcons) expect(importRowPresentation[state].icon, state).not.toBe(forbidden);
    }
    expect(importRowPresentation.ambiguous.icon).toBe(CircleQuestionMarkIcon);
  });

  it('labels a state outside the vocabulary in sentence case instead of throwing (the G-13 seam)', () => {
    expect(importRowLabel('needs-review' as CsvRowState)).toBe('Needs review');
    render(<ImportRowBadge state={'needs-review' as CsvRowState} />);
    expect(screen.getByText('Needs review').closest('[data-tone]')).toHaveAttribute('data-tone', 'neutral');
  });

  it('renders the similar badge with its label and warning tone', () => {
    render(<ImportRowBadge className="extra" state="similar" />);
    const badge = screen.getByText('Matched by similar name').closest('[data-tone]');
    expect(badge).toHaveAttribute('data-tone', 'warning');
    expect(badge).toHaveClass('extra');
    expect(badge?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
