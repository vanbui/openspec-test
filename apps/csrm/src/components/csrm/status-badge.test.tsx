import { render, screen } from '@testing-library/react';
import type { LucideIcon } from 'lucide-react';
import {
  ArchiveIcon,
  ArchiveXIcon,
  CalendarClockIcon,
  CalendarX2Icon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleGaugeIcon,
  CircleIcon,
  ClipboardListIcon,
  ClipboardPenLineIcon,
  Clock3Icon,
  ClockAlertIcon,
  FilePenLineIcon,
  FileWarningIcon,
  FileXIcon,
  FlagIcon,
  LockKeyholeIcon,
  OctagonAlertIcon,
  SearchCheckIcon,
  SendIcon,
  ShieldCheckIcon,
  ShieldEllipsisIcon,
  ShieldXIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UnlinkIcon,
  HistoryIcon,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { badgeVariants } from '@/components/ui/badge';
import { attachmentStates } from '@/features/attachments/attachments-schema';
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
 * UI-SPEC section 3.3, verbatim as amended after the phase code review (WR-03), and the file states of 14-UI-SPEC
 * §3.4: one row per status value, 28 in all (the Risk's Withdrawn added by Phase 16). The CSV import rows left this
 * shared map for the import-only features/administration/import-row-status.tsx (19-13; B4, B5), which tests them. The request draft is work in progress with the Requestor (info) and a submitted request is submitted (success), the
 * tones the direction's vocabulary gives them and the questionnaire family uses.
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
  aiReview: [
    ['proposed', 'AI proposed', 'warning', SparklesIcon],
    ['uncited', 'No source cited', 'warning', UnlinkIcon],
    /* 15-UI-SPEC §4.4 (D-20): a proposal whose question or questionnaire has changed since the AI proposed it. */
    ['stale', 'Changed since proposed', 'warning', HistoryIcon],
  ],
  /*
   * 14-UI-SPEC §3.4 (X-21; UI-D14): a file's state. Every value is neutral, because none is work waiting on a person and
   * none is overdue; the icon and the words tell them apart. `Available` is in the mapping but never rendered as a badge.
   */
  /*
   * 16-UI-SPEC §6.4 (X-27; S-14, D-46): a Risk a Security Analyst took out of its assessment without deleting it. Neutral,
   * because it is terminal while it stays withdrawn and waits on nobody; the Archive icon and the word carry it.
   */
  risk: [
    ['withdrawn', 'Withdrawn', 'neutral', ArchiveIcon],
  ],
  attachment: [
    ['available', 'Available', 'neutral', ShieldCheckIcon],
    ['pending', 'Waiting for malware check', 'neutral', ShieldEllipsisIcon],
    ['blocked', 'Blocked', 'neutral', ShieldXIcon],
    ['unavailable', 'File unavailable', 'neutral', FileXIcon],
    ['removed', 'Removed', 'neutral', ArchiveXIcon],
  ],
} as const satisfies Record<keyof typeof statusPresentation, readonly Row[]>;

type Family = keyof typeof families;

const vocabularies: Record<Family, readonly string[]> = {
  request: requestStatuses,
  assessment: assessmentStatuses,
  questionnaire: ['analyst-review', 'not-started', 'draft', 'submitted'],
  treatment: riskRegisterTreatmentStatuses,
  aiReview: ['proposed', 'uncited', 'stale'],
  risk: ['withdrawn'],
  attachment: attachmentStates,
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

/*
 * IN-506: the file family names its icons, and the attachments feature passes the components; here the test passes the
 * icons §3.4 names, as the feature does.
 */
const attachmentIconNames = { available: 'ShieldCheck', pending: 'ShieldEllipsis', blocked: 'ShieldX', unavailable: 'FileX', removed: 'ArchiveX' } as const;
const attachmentIcons = { ShieldCheck: ShieldCheckIcon, ShieldEllipsis: ShieldEllipsisIcon, ShieldX: ShieldXIcon, FileX: FileXIcon, ArchiveX: ArchiveXIcon } as const;

function familyBadge(family: Family, value: string, live = false) {
  // The request family keeps its original `status` prop; every other family passes family and value.
  if (family === 'request') return <StatusBadge key={`${family}-${value}`} live={live} status={value as (typeof requestStatuses)[number]} />;
  if (family === 'attachment') return <StatusBadge family="attachment" icons={attachmentIcons} key={`${family}-${value}`} live={live} value={value as never} />;
  return <StatusBadge family={family} key={`${family}-${value}`} live={live} value={value as never} />;
}

function renderFamilyBadge(family: Family, value: string, live = false) {
  return render(familyBadge(family, value, live));
}

function iconMarkup(Icon: LucideIcon) {
  return renderToStaticMarkup(<Icon aria-hidden="true" />);
}

const allRows = (Object.keys(families) as Family[]).flatMap((family) =>
  families[family].map((row) => [family, ...row] as const),
);

describe('statusPresentation', () => {
  it('owns exactly the 28 status values of the workflow, review, risk and file families, and no import row family', () => {
    expect(allRows).toHaveLength(28);
    expect(Object.keys(statusPresentation)).not.toContain('importRow');
    for (const family of Object.keys(families) as Family[]) {
      expect(Object.keys(statusPresentation[family]).sort(), family).toEqual([...vocabularies[family]].sort());
    }
  });

  it.each(allRows)('maps %s %s to %s, the %s tone and its icon', (family, value, label, tone, icon) => {
    const presentation = (statusPresentation[family] as Record<string, unknown>)[value];
    expect(presentation).toEqual(family === 'attachment' ? { iconName: attachmentIconNames[value as keyof typeof attachmentIconNames], label, tone } : { icon, label, tone });
    expect(statusLabel(family, value as never)).toBe(label);
  });

  /*
   * IN-506 (D-27, R-08-34): the file family holds its icons by name, so StatusBadge's module, which every route with a
   * badge loads (the assessment editor's included), carries none of the five file icons; the attachments feature resolves
   * the names.
   */
  it('names the file states’ icons rather than holding them, so a route with a badge ships no file icon (IN-506)', () => {
    for (const value of attachmentStates) {
      const presentation = statusPresentation.attachment[value] as Record<string, unknown>;
      expect(presentation, value).not.toHaveProperty('icon');
      expect(presentation.iconName, value).toBe(attachmentIconNames[value]);
    }
  });

  it('never gives a status a severity or urgency icon', () => {
    const icons = allRows.map(([family, value]) => {
      const presentation = (statusPresentation[family] as Record<string, { icon?: LucideIcon; iconName?: keyof typeof attachmentIcons }>)[value]!;
      return presentation.iconName ? attachmentIcons[presentation.iconName] : presentation.icon;
    });
    for (const [name, forbidden] of Object.entries(forbiddenIcons)) {
      expect(icons, name).not.toContain(forbidden);
    }
    // Overdue is a clock, never the High severity triangle it used to share.
    expect(statusPresentation.treatment.Overdue.icon).toBe(ClockAlertIcon);
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
        {allRows.map(([family, value]) => familyBadge(family, value))}
      </>,
    );

    const badges = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="badge"]'));
    expect(badges).toHaveLength(28);
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

/* 14-UI-SPEC §3.4 (UI-D14): every file state is neutral and named by its icon and words, never by colour. */
describe('the attachment family (§3.4)', () => {
  it('gives every file state the neutral tone', () => {
    for (const value of attachmentStates) expect(statusPresentation.attachment[value].tone, value).toBe('neutral');
  });

  it('renders Blocked as the neutral badge with its shield, never a danger badge', () => {
    render(<StatusBadge family="attachment" icons={attachmentIcons} value="blocked" />);
    const badge = screen.getByText('Blocked', { exact: true });
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(badge).toHaveAttribute('data-variant', 'outline');
    expect(badge.innerHTML).toBe(`${iconMarkup(ShieldXIcon)}Blocked`);
  });
});

/*
 * 16-UI-SPEC §6.4 (X-27; S-14, D-46): the Risk family's one value. A withdrawn Risk is never shown by colour alone and
 * never styled as a danger: the neutral tint, the Archive icon and the word Withdrawn.
 */
describe('the risk family (X-27)', () => {
  it('renders Withdrawn with the Archive icon and the neutral tone, the other families unchanged', () => {
    render(<StatusBadge family="risk" value="withdrawn" />);
    const badge = screen.getByText('Withdrawn', { exact: true });
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(badge).toHaveAttribute('data-variant', 'outline');
    for (const tint of neutralTint) expect(badge.className).toContain(tint);
    expect(badge.innerHTML).toBe(`${iconMarkup(ArchiveIcon)}Withdrawn`);
    expect(statusLabel('risk', 'withdrawn')).toBe('Withdrawn');
    expect(Object.keys(statusPresentation.risk)).toEqual(['withdrawn']);
  });
});
