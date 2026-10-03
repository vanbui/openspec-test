import type { LucideIcon } from 'lucide-react';
import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
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
  LockKeyholeIcon,
  RefreshCwIcon,
  SearchCheckIcon,
  SendIcon,
} from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';

import { Badge, type badgeVariants } from '@/components/ui/badge';
import type { CsvRowState } from '@/features/administration/csv-import-schema';
import type { AssessmentStatus } from '@/features/assessments/assessment-schema';
import type { QuestionnaireStatus as QuestionnaireServedState } from '@/features/questionnaires/questionnaire-service';
import type { RequestStatus } from '@/features/requests/request-domain';
import type { riskRegisterTreatmentStatuses } from '@/features/risks/risk-schema';
import { cn } from '@/lib/utils';

/**
 * What a status tone means, whatever the record type (direction section 4 Status & risk badges, Tone
 * vocabulary): neutral is not yet started or terminal, info is work in progress with or waiting on the
 * Requestor, warning is work waiting on a Security Analyst, success is submitted, approved or released,
 * danger is a recorded overdue state.
 */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export type { AssessmentStatus, QuestionnaireServedState, RequestStatus };
/** The served questionnaire state plus the release fact: an unreleased questionnaire is in analyst review. */
export type QuestionnaireStatusValue = 'analyst-review' | QuestionnaireServedState;
/** `CsrmTreatmentStatus`, displayed verbatim. */
export type TreatmentStatus = (typeof riskRegisterTreatmentStatuses)[number];

type StatusValues = {
  request: RequestStatus;
  assessment: AssessmentStatus;
  questionnaire: QuestionnaireStatusValue;
  treatment: TreatmentStatus;
  importRow: CsvRowState;
};
export type StatusFamily = keyof StatusValues;
export type StatusValue<F extends StatusFamily> = StatusValues[F];

export type StatusPresentation = {
  icon: LucideIcon;
  label: string;
  tone: StatusTone;
};

/*
 * Icons never repeat a severity shape (direction section 3.6) or an urgency icon (section 4 Urgency). A draft
 * is work in progress with the Requestor and a submitted request is submitted, so the two take the tones the
 * questionnaire's draft and submitted states take.
 */
const requestFamily = {
  draft: { icon: FilePenLineIcon, label: 'Draft', tone: 'info' },
  submitted: { icon: SendIcon, label: 'Submitted', tone: 'success' },
  'questionnaire-in-progress': { icon: ClipboardListIcon, label: 'Questionnaire in progress', tone: 'info' },
  'risk-assessment-drafted': { icon: FileWarningIcon, label: 'Risk assessment drafted', tone: 'warning' },
  'under-review': { icon: SearchCheckIcon, label: 'Under review', tone: 'warning' },
  approved: { icon: CircleCheckIcon, label: 'Released', tone: 'success' },
  closed: { icon: LockKeyholeIcon, label: 'Closed', tone: 'neutral' },
} satisfies Record<RequestStatus, StatusPresentation>;

/*
 * Both families label the stored value approved Released (CONTEXT.md, D-46): only the label changes, so the
 * stored value and the status=approved query value stay approved. Drafted and in review are analyst work.
 */
const assessmentFamily = {
  draft: { icon: CircleDashedIcon, label: 'Draft', tone: 'warning' },
  'in-review': { icon: CircleDotIcon, label: 'In review', tone: 'warning' },
  approved: { icon: CircleCheckIcon, label: 'Released', tone: 'success' },
  closed: { icon: LockKeyholeIcon, label: 'Closed', tone: 'neutral' },
} satisfies Record<AssessmentStatus, StatusPresentation>;

const questionnaireFamily = {
  'analyst-review': { icon: ClipboardPenLineIcon, label: 'Analyst review', tone: 'warning' },
  'not-started': { icon: CircleDashedIcon, label: 'Not started', tone: 'neutral' },
  draft: { icon: FilePenLineIcon, label: 'Draft', tone: 'info' },
  submitted: { icon: CircleCheckIcon, label: 'Submitted', tone: 'success' },
} satisfies Record<QuestionnaireStatusValue, StatusPresentation>;

const treatmentFamily = {
  'Not Started': { icon: CircleDashedIcon, label: 'Not Started', tone: 'neutral' },
  'In Progress': { icon: Clock3Icon, label: 'In Progress', tone: 'info' },
  Overdue: { icon: ClockAlertIcon, label: 'Overdue', tone: 'danger' },
  Complete: { icon: CircleCheckIcon, label: 'Complete', tone: 'success' },
} satisfies Record<TreatmentStatus, StatusPresentation>;

/*
 * A CSV import row's state, in its review and its results (direction section 4, CSV import rows): a row that is
 * or will be written is success, an unchanged row is neutral, and a row the Security Analyst must correct in the
 * file is warning. An ambiguous row is a question, never the High severity triangle.
 */
const importRowFamily = {
  create: { icon: CheckIcon, label: 'Create', tone: 'success' },
  update: { icon: RefreshCwIcon, label: 'Update', tone: 'success' },
  unchanged: { icon: FileCheck2Icon, label: 'Unchanged', tone: 'neutral' },
  rejected: { icon: CircleXIcon, label: 'Rejected', tone: 'warning' },
  ambiguous: { icon: CircleQuestionMarkIcon, label: 'Ambiguous', tone: 'warning' },
} satisfies Record<CsvRowState, StatusPresentation>;

/**
 * The one mapping from a status value to its label, tone and icon: the four workflow families and the CSV
 * import rows. Badges, filter options, chips and cards all read it; feature code passes a family and a value
 * and never chooses any of the three.
 */
export const statusPresentation: {
  readonly [F in StatusFamily]: Readonly<Record<StatusValue<F>, StatusPresentation>>;
} = {
  request: requestFamily,
  assessment: assessmentFamily,
  questionnaire: questionnaireFamily,
  treatment: treatmentFamily,
  importRow: importRowFamily,
};

/*
 * A value a family does not yet label: its words in sentence case, the neutral tone and a plain circle. Closed
 * parsers refuse unknown values at the boundary, so this guards a value added to a vocabulary before its label
 * (the G-13 seam); it never renders anything but the status value itself.
 */
function unknownStatusPresentation(value: string): StatusPresentation {
  const words = value.replaceAll('-', ' ').trim();
  return {
    icon: CircleIcon,
    label: words.charAt(0).toUpperCase() + words.slice(1),
    tone: 'neutral',
  };
}

function presentationOf<F extends StatusFamily>(family: F, value: StatusValue<F>): StatusPresentation {
  const entries: Readonly<Record<string, StatusPresentation>> = statusPresentation[family];
  return Object.hasOwn(entries, value) ? entries[value] : unknownStatusPresentation(String(value));
}

/** The label a status value displays, for filter options and chips that are not badges. */
export function statusLabel<F extends StatusFamily>(family: F, value: StatusValue<F>): string {
  return presentationOf(family, value).label;
}

/**
 * The questionnaire status every surface shows. Only an explicit `null` release reads as unreleased (analyst
 * review); a projection that carries no release field at all is released by construction, so an absent
 * field passes the served state through.
 */
export function deriveQuestionnaireStatus(
  state: QuestionnaireServedState,
  release: { readonly releasedAt: string } | null | undefined,
): QuestionnaireStatusValue {
  return release === null ? 'analyst-review' : state;
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

/* The subtle tier of direction section 4: tinted status variants, and the tinted recipe in neutrals. */
const toneBadges = {
  neutral: { className: 'border border-border bg-surface-muted text-foreground-secondary', variant: 'outline' },
  info: { variant: 'info' },
  warning: { variant: 'warning' },
  success: { variant: 'success' },
  danger: { variant: 'danger' },
} satisfies Record<StatusTone, { className?: string; variant: BadgeVariant }>;

type FamilyBadgeProps = {
  [F in StatusFamily]: { family: F; status?: never; value: StatusValue<F> };
}[StatusFamily];

type RequestBadgeProps = { family?: never; status: RequestStatus; value?: never };

export type StatusBadgeProps = (FamilyBadgeProps | RequestBadgeProps) & {
  className?: string;
  /** Announce status changes politely, for a badge that updates in place. */
  live?: boolean;
};

/**
 * A workflow status: a tinted rounded-rect with a leading icon and its label, never colour alone. The
 * request family keeps its original `status` prop; every other family passes `family` and `value`.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { className, live = false } = props;
  const presentation = props.status === undefined
    ? presentationOf(props.family, props.value)
    : presentationOf('request', props.status);
  const tone: { className?: string; variant: BadgeVariant } = toneBadges[presentation.tone];
  const Icon = presentation.icon;

  return (
    <Badge
      aria-live={live ? 'polite' : undefined}
      className={cn(tone.className, className)}
      data-tone={presentation.tone}
      variant={tone.variant}
    >
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}
