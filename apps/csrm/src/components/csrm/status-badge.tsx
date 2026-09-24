import type { LucideIcon } from 'lucide-react';
import {
  CircleCheckIcon,
  ClipboardListIcon,
  FilePenLineIcon,
  FileWarningIcon,
  LockKeyholeIcon,
  SearchCheckIcon,
  SendIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'questionnaire-in-progress'
  | 'risk-assessment-drafted'
  | 'under-review'
  | 'approved'
  | 'closed';

type StatusPresentation = {
  className: string;
  icon: LucideIcon;
  label: string;
};

const statusPresentations = {
  draft: {
    className: 'border-border bg-surface-muted text-foreground-secondary',
    icon: FilePenLineIcon,
    label: 'Draft',
  },
  submitted: {
    className: 'border-info-border bg-info-subtle text-info',
    icon: SendIcon,
    label: 'Submitted',
  },
  'questionnaire-in-progress': {
    className: 'border-info-border bg-info-subtle text-info',
    icon: ClipboardListIcon,
    label: 'Questionnaire in progress',
  },
  'risk-assessment-drafted': {
    className: 'border-warning-border bg-warning-subtle text-warning',
    icon: FileWarningIcon,
    label: 'Risk assessment drafted',
  },
  'under-review': {
    className: 'border-warning-border bg-warning-subtle text-warning',
    icon: SearchCheckIcon,
    label: 'Under review',
  },
  approved: {
    className: 'border-success-border bg-success-subtle text-success',
    icon: CircleCheckIcon,
    label: 'Approved',
  },
  closed: {
    className: 'border-border bg-surface-muted text-foreground-secondary',
    icon: LockKeyholeIcon,
    label: 'Closed',
  },
} satisfies Record<RequestStatus, StatusPresentation>;

export type StatusBadgeProps = {
  className?: string;
  live?: boolean;
  status: RequestStatus;
};

export function StatusBadge({ className, live = false, status }: StatusBadgeProps) {
  const presentation = statusPresentations[status];
  const Icon = presentation.icon;

  return (
    <Badge
      aria-live={live ? 'polite' : undefined}
      className={cn('border', presentation.className, className)}
      variant="outline"
    >
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}
