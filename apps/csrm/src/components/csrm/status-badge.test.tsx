import { render, screen } from '@testing-library/react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClockIcon,
  CalendarX2Icon,
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleGaugeIcon,
  CircleIcon,
  CircleQuestionMarkIcon,
  CircleXIcon,
  ClipboardListIcon,
  ClipboardPenLineIcon,
  Clock3Icon,
  ClockAlertIcon,
  FileCheck2Icon,
  FilePenLineIcon,
  FileWarningIcon,
  FlagIcon,
  LockKeyholeIcon,
  OctagonAlertIcon,
  RefreshCwIcon,
  SearchCheckIcon,
  SendIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { badgeVariants } from '@/components/ui/badge';
import { csvRowStates } from '@/features/administration/csv-import-schema';
import { assessmentStatuses } from '@/features/assessments/assessment-schema';
import { requestStatuses, type RequestStatus } from '@/features/requests/request-domain';
import { riskRegisterTreatmentStatuses } from '@/features/risks/risk-schema';
import { cn } from '@/lib/utils';

import {
  deriveQuestionnaireStatus,
  StatusBadge,
  statusLabel,
  statusPresentation,
  type StatusTone,
} from './status-badge';

type Row = readonly [value: string, label: string, tone: StatusTone, icon: LucideIcon];

/*
 * UI-SPEC section 3.3, verbatim as amended after the phase code review (WR-03), and the CSV import rows the
 * direction records (section 4, CSV import rows; WR-08): one row per status value, 24 in all. The request
 * draft is work in progress with the Requestor (info) and a submitted request is submitted (success), the
 * tones the direction's vocabulary gives them and the questionnaire family uses. An import row that is or
 * will be written is success, an unchanged row neutral, and a row the Security Analyst must correct warning.
 */
const families = {
  request: [
    ['draft', 'Draft', 'info', FilePenLineIcon],
    ['submitted', 'Submitted', 'success', SendIcon],
    ['questionnaire-in-progress', 'Questionnaire in progress', 'info', ClipboardListIcon],
    ['risk-assessment-drafted', 'Risk assessment drafted', 'warning', FileWarningIcon],
    ['under-review', 'Under review', 'warning', SearchCheckIcon],
    ['approved', 'Released', 'success', CircleCheckIcon],
    ['closed', 'Closed', 'neutral', LockKeyholeIcon],
  ],
  assessment: [
    ['draft', 'Draft', 'warning', CircleDashedIcon],
    ['in-review', 'In review', 'warning', CircleDotIcon],
    ['approved', 'Released', 'success', CircleCheckIcon],
    ['closed', 'Closed', 'neutral', LockKeyholeIcon],
  ],
  questionnaire: [
    ['analyst-review', 'Analyst review', 'warning', ClipboardPenLineIcon],
    ['not-started', 'Not started', 'neutral', CircleDashedIcon],
    ['draft', 'Draft', 'info', FilePenLineIcon],
    ['submitted', 'Submitted', 'success', CircleCheckIcon],
  ],
  treatment: [
    ['Not Started', 'Not Started', 'neutral', CircleDashedIcon],
    ['In Progress', 'In Progress', 'info', Clock3Icon],
    ['Overdue', 'Overdue', 'danger', ClockAlertIcon],
    ['Complete', 'Complete', 'success', CircleCheckIcon],
  ],
  importRow: [
    ['create', 'Create', 'success', CheckIcon],
    ['update', 'Update', 'success', RefreshCwIcon],
    ['unchanged', 'Unchanged', 'neutral', FileCheck2Icon],
    ['rejected', 'Rejected', 'warning', CircleXIcon],
    ['ambiguous', 'Ambiguous', 'warning', CircleQuestionMarkIcon],
  ],
} as const satisfies Record<keyof typeof statusPresentation, readonly Row[]>;

type Family = keyof typeof families;

const vocabularies: Record<Family, readonly string[]> = {
  request: requestStatuses,
  assessment: assessmentStatuses,
  questionnaire: ['analyst-review', 'not-started', 'draft', 'submitted'],
  treatment: riskRegisterTreatmentStatuses,
  importRow: csvRowStates,
};

/* Severity (direction section 3.6) and urgency (section 4 Urgency) shapes: never a status icon. */
const forbiddenIcons = {
  TriangleAlert: TriangleAlertIcon,
  OctagonAlert: OctagonAlertIcon,
  CircleGauge: CircleGaugeIcon,
  CalendarX2: CalendarX2Icon,
  CalendarClock: CalendarClockIcon,
  Flag: FlagIcon,
} as const;

const neutralTint = ['border-border', 'bg-surface-muted', 'text-foreground-secondary'];

function renderFamilyBadge(family: Family, value: string, live = false) {
  // The request family keeps its original `status` prop; every other family passes family and value.
  const element = family === 'request'
    ? <StatusBadge live={live} status={value as (typeof requestStatuses)[number]} />
    : <StatusBadge family={family} live={live} value={value as never} />;
  return render(element);
}

function iconMarkup(Icon: LucideIcon) {
  return renderToStaticMarkup(<Icon aria-hidden="true" />);
}

const allRows = (Object.keys(families) as Family[]).flatMap((family) =>
  families[family].map((row) => [family, ...row] as const),
);

describe('statusPresentation', () => {
  it('owns exactly the 24 status values of the four workflow families and the CSV import rows', () => {
    expect(allRows).toHaveLength(24);
    for (const family of Object.keys(families) as Family[]) {
      expect(Object.keys(statusPresentation[family]).sort(), family).toEqual([...vocabularies[family]].sort());
    }
  });

  it.each(allRows)('maps %s %s to %s, the %s tone and its icon', (family, value, label, tone, icon) => {
    const presentation = (statusPresentation[family] as Record<string, unknown>)[value];
    expect(presentation).toEqual({ icon, label, tone });
    expect(statusLabel(family, value as never)).toBe(label);
  });

  it('never gives a status a severity or urgency icon', () => {
    const icons = allRows.map(([family, value]) => (statusPresentation[family] as Record<string, { icon: LucideIcon }>)[value].icon);
    for (const [name, forbidden] of Object.entries(forbiddenIcons)) {
      expect(icons, name).not.toContain(forbidden);
    }
    // Overdue is a clock, never the High severity triangle it used to share.
    expect(statusPresentation.treatment.Overdue.icon).toBe(ClockAlertIcon);
    // An ambiguous import row is a question, never the High severity triangle it used to share (WR-08).
    expect(statusPresentation.importRow.ambiguous.icon).toBe(CircleQuestionMarkIcon);
  });
});

/*
 * D-46 (UAT-065): a released request reads Released, as its assessment does; only the label changes, so the stored
 * value stays approved. Every request and assessment status has its own entry in the one mapping, and a value
 * added to a vocabulary before its label renders through a safe fallback instead of throwing (the G-13 seam).
 */
describe('the request and assessment labels', () => {
  it('labels a released request Released, as a released assessment, and keeps Closed', () => {
    expect(statusLabel('request', 'approved')).toBe('Released');
    expect(statusLabel('assessment', 'approved')).toBe('Released');
    expect(statusLabel('request', 'closed')).toBe('Closed');
  });

  it('gives every request and assessment status its own entry, in vocabulary order', () => {
    expect(Object.keys(statusPresentation.request)).toEqual([...requestStatuses]);
    for (const value of requestStatuses) expect(Object.hasOwn(statusPresentation.request, value), value).toBe(true);
    for (const value of assessmentStatuses) expect(Object.hasOwn(statusPresentation.assessment, value), value).toBe(true);
  });

  it('labels a status outside the vocabulary in sentence case instead of throwing', () => {
    const unknown = 'awaiting-acceptance' as RequestStatus;
    expect(() => statusLabel('request', unknown)).not.toThrow();
    expect(statusLabel('request', unknown)).toBe('Awaiting acceptance');
  });

  it('renders a status outside the vocabulary as the neutral badge with an icon and its label', () => {
    expect(() => render(<StatusBadge status={'awaiting-acceptance' as RequestStatus} />)).not.toThrow();

    const badge = screen.getByText('Awaiting acceptance', { exact: true });
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(badge).toHaveAttribute('data-variant', 'outline');
    for (const tint of neutralTint) expect(badge.className).toContain(tint);
    expect(badge.innerHTML).toBe(`${iconMarkup(CircleIcon)}Awaiting acceptance`);
  });
});

describe('deriveQuestionnaireStatus', () => {
  const release = { releasedAt: '2026-09-25T09:00:00.000Z', releasedBy: { documentId: 'analyst-1', displayName: 'Bob Doe' } };

  it('reads an explicitly unreleased questionnaire as analyst review', () => {
    expect(deriveQuestionnaireStatus('draft', null)).toBe('analyst-review');
    expect(deriveQuestionnaireStatus('not-started', null)).toBe('analyst-review');
  });

  it('reads a released questionnaire as its served state', () => {
    expect(deriveQuestionnaireStatus('draft', release)).toBe('draft');
    expect(deriveQuestionnaireStatus('not-started', release)).toBe('not-started');
    expect(deriveQuestionnaireStatus('submitted', release)).toBe('submitted');
  });

  it('never reads an absent release field as unreleased', () => {
    expect(deriveQuestionnaireStatus('submitted', undefined)).toBe('submitted');
    expect(deriveQuestionnaireStatus('not-started', undefined)).toBe('not-started');
  });
});

describe('StatusBadge', () => {
  it.each(allRows)('renders %s %s as the tinted %s badge with icon and label', (family, value, label, tone, icon) => {
    renderFamilyBadge(family, value);

    const badge = screen.getByText(label, { exact: true });
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge).toHaveAttribute('data-tone', tone);
    expect(badge).toHaveAttribute('data-variant', tone === 'neutral' ? 'outline' : tone);
    expect(badge).not.toHaveAttribute('aria-label');
    expect(badge).not.toHaveAttribute('aria-live');

    const icons = badge.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0].outerHTML).toBe(iconMarkup(icon));
  });

  it('renders a request draft exactly as a questionnaire draft: one word, one icon, one tint', () => {
    const request = render(<StatusBadge status="draft" />);
    const requestBadge = screen.getByText('Draft', { exact: true });
    expect(requestBadge.tagName).toBe('SPAN');
    expect(requestBadge.getAttributeNames().sort()).toEqual(['class', 'data-slot', 'data-tone', 'data-variant']);
    expect(requestBadge).toHaveAttribute('data-variant', 'info');
    expect(requestBadge).toHaveAttribute('data-tone', 'info');
    expect(requestBadge.className).toBe(cn(badgeVariants({ variant: 'info' })));
    expect(requestBadge.innerHTML).toBe(`${iconMarkup(FilePenLineIcon)}Draft`);
    const requestMarkup = requestBadge.outerHTML;
    request.unmount();

    render(<StatusBadge family="questionnaire" value="draft" />);
    expect(screen.getByText('Draft', { exact: true }).outerHTML).toBe(requestMarkup);
  });

  it('renders a submitted request as the success badge a submitted questionnaire carries, keeping its own icon', () => {
    render(<StatusBadge status="submitted" />);

    const badge = screen.getByText('Submitted', { exact: true });
    expect(badge).toHaveAttribute('data-tone', 'success');
    expect(badge).toHaveAttribute('data-variant', 'success');
    expect(badge.innerHTML).toBe(`${iconMarkup(SendIcon)}Submitted`);
  });

  it('renders Overdue as the danger badge with one clock icon and no triangle', () => {
    render(<StatusBadge family="treatment" value="Overdue" />);

    const badge = screen.getByText('Overdue', { exact: true });
    expect(badge).toHaveAttribute('data-tone', 'danger');
    expect(badge).toHaveAttribute('data-variant', 'danger');
    expect(badge.querySelectorAll('svg')).toHaveLength(1);
    expect(badge.querySelector('svg')?.outerHTML).toBe(iconMarkup(ClockAlertIcon));
    expect(badge.querySelector('svg')?.outerHTML).not.toBe(iconMarkup(TriangleAlertIcon));
  });

  it('labels the released assessment Released and announces live changes politely', () => {
    render(<StatusBadge family="assessment" live value="approved" />);

    const badge = screen.getByText('Released', { exact: true });
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveAttribute('data-tone', 'success');
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });

  it('never renders an untinted outline chip or a severity or urgency icon, in any family', () => {
    const { container } = render(
      <>
        {allRows.map(([family, value]) =>
          family === 'request'
            ? <StatusBadge key={`${family}-${value}`} status={value as (typeof requestStatuses)[number]} />
            : <StatusBadge family={family} key={`${family}-${value}`} value={value as never} />,
        )}
      </>,
    );

    const badges = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="badge"]'));
    expect(badges).toHaveLength(24);
    for (const badge of badges) {
      expect(badge.dataset.tone, badge.textContent ?? '').toMatch(/^(neutral|info|warning|success|danger)$/);
      if (badge.dataset.variant === 'outline') {
        expect(badge.dataset.tone).toBe('neutral');
        for (const tint of neutralTint) expect(badge.className, badge.textContent ?? '').toContain(tint);
      }
    }

    const rendered = badges.map((badge) => badge.querySelector('svg')?.outerHTML);
    for (const [name, forbidden] of Object.entries(forbiddenIcons)) {
      expect(rendered, name).not.toContain(iconMarkup(forbidden));
    }
  });
});
