import type { LucideIcon } from 'lucide-react';
import { CalendarClockIcon, CalendarX2Icon, FlagIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { alertUrgencyLabels } from '@/features/alerts/alert-presentation';
import type { AlertUrgency } from '@/features/alerts/alert-schema';
import { cn } from '@/lib/utils';

type UrgencyPresentation = {
  /** The status recipe (direction §3.5); urgency is a status, never a severity. */
  badgeVariant: 'danger' | 'warning' | 'info';
  /** The same status fg token, for the chipless dense form. */
  denseClassName: string;
  /** Disjoint from the severity and request-status icons, so urgency never reads as either. */
  icon: LucideIcon;
  label: string;
};

/* The labels are the alert vocabulary's, so the badge, the urgency filter and its chip always agree. */
const urgencyPresentations = {
  overdue: { badgeVariant: 'danger', denseClassName: 'text-destructive', icon: CalendarX2Icon, label: alertUrgencyLabels.overdue },
  'due-soon': { badgeVariant: 'warning', denseClassName: 'text-warning', icon: CalendarClockIcon, label: alertUrgencyLabels['due-soon'] },
  attention: { badgeVariant: 'info', denseClassName: 'text-info', icon: FlagIcon, label: alertUrgencyLabels.attention },
} satisfies Record<AlertUrgency, UrgencyPresentation>;

export type AlertUrgencyBadgeProps = {
  urgency: AlertUrgency;
  /** `dense` drops the chip for dense table cells: icon and label in the urgency colour. */
  density?: 'badge' | 'dense';
};

/**
 * How urgent time-bound work is (direction §4 Status & risk badges, Urgency). Icon and word carry the
 * meaning and colour only reinforces it. A visually hidden "Urgency:" prefix names the vocabulary
 * wherever no column header does. A Risk's own rating badge sits beside this one and is never merged
 * into it.
 */
export function AlertUrgencyBadge({ density = 'badge', urgency }: AlertUrgencyBadgeProps) {
  const { badgeVariant, denseClassName, icon: Icon, label } = urgencyPresentations[urgency];

  if (density === 'dense') {
    // The label element holds the icon and exactly the word, so a locator by exact text finds the
    // marker and its one icon. The hidden prefix sits outside it.
    return (
      <span className="inline-flex" data-slot="alert-urgency" data-urgency={urgency}>
        <span className="sr-only">Urgency: </span>
        <span className={cn('inline-flex items-center gap-1', denseClassName)}>
          <Icon aria-hidden="true" className="size-3 shrink-0" />
          {label}
        </span>
      </span>
    );
  }

  return (
    <Badge data-urgency={urgency} variant={badgeVariant}>
      <Icon aria-hidden="true" />
      <span className="sr-only">Urgency: </span>
      {label}
    </Badge>
  );
}
