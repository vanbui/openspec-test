import type { LucideIcon } from 'lucide-react';
import {
  CircleCheckIcon,
  CircleGaugeIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { AssessmentRating } from '@/features/assessments/assessment-schema';

type RiskRatingPresentation = {
  className: string;
  icon: LucideIcon;
  label: string;
  position: number;
};

const riskRatingPresentations = {
  Low: {
    className: 'border-risk-low bg-risk-low-subtle text-risk-low',
    icon: CircleCheckIcon,
    label: 'Low',
    position: 1,
  },
  Moderate: {
    className: 'border-risk-medium bg-risk-medium-subtle text-risk-medium',
    icon: CircleGaugeIcon,
    label: 'Moderate',
    position: 2,
  },
  High: {
    className: 'border-risk-high bg-risk-high-subtle text-risk-high',
    icon: TriangleAlertIcon,
    label: 'High',
    position: 3,
  },
  Critical: {
    className: 'border-risk-critical bg-risk-critical-subtle text-risk-critical',
    icon: OctagonAlertIcon,
    label: 'Critical',
    position: 4,
  },
} satisfies Record<AssessmentRating, RiskRatingPresentation>;

/*
 * `labelled` (default true) gives the badge its own name, `Severity: {rating} ({n} of 4)`. Inside a link
 * or button whose own name already carries the rating (a bar chart row), set it false: the control
 * names the row, and the badge's visible word stays the control's visible text (WCAG 2.5.3).
 */
export function RiskRatingBadge({ labelled = true, rating }: { labelled?: boolean; rating: AssessmentRating }) {
  const presentation = riskRatingPresentations[rating];
  const Icon = presentation.icon;

  return (
    <Badge aria-label={labelled ? `Severity: ${presentation.label.toLowerCase()} (${presentation.position} of 4)` : undefined} className={presentation.className} variant="outline">
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}
