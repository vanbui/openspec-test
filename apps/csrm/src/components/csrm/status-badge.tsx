import type { LucideIcon } from 'lucide-react';
import {
  ArchiveIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  ClipboardListIcon,
  ClipboardPenLineIcon,
  Clock3Icon,
  ClockAlertIcon,
  FilePenLineIcon,
  FileWarningIcon,
  LockKeyholeIcon,
  SearchCheckIcon,
  SendIcon,
  SparklesIcon,
  UnlinkIcon,
  HistoryIcon,
} from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';

import { Badge, type badgeVariants } from '@/components/ui/badge';
import type { AssessmentStatus } from '@/features/assessments/assessment-schema';
import type { RequestAttachment } from '@/features/attachments/attachments-schema';
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
  aiReview: 'proposed' | 'uncited' | 'stale';
  risk: 'withdrawn';
  attachment: RequestAttachment['state'];
};
export type StatusFamily = keyof StatusValues;
export type StatusValue<F extends StatusFamily> = StatusValues[F];

export type StatusPresentation = {
  icon: LucideIcon;
  label: string;
  tone: StatusTone;
};

/** The icons of the file states (14-UI-SPEC §3.4), by name: the attachments feature resolves them (IN-506). */
export type AttachmentStatusIconName = 'ShieldCheck' | 'ShieldEllipsis' | 'ShieldX' | 'FileX' | 'ArchiveX';

/** A presentation whose icon is named rather than held, so this module ships no component for it (IN-506). */
export type NamedIconStatusPresentation = {
  iconName: AttachmentStatusIconName;
  label: string;
  tone: StatusTone;
};

/** The file family names its icons; every other family holds its icon. */
type PresentationOf<F extends StatusFamily> = F extends 'attachment' ? NamedIconStatusPresentation : StatusPresentation;

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
 * A CSV import row's state lives in an import-only module of the Administration import feature (19-13; B4, B5), so
 * its six states and their icons never ship on a route that renders no import; it renders through PresentedStatusBadge.
 */

const aiReviewFamily = {
  proposed: { icon: SparklesIcon, label: 'AI proposed', tone: 'warning' },
  uncited: { icon: UnlinkIcon, label: 'No source cited', tone: 'warning' },
  /* Phase 15 (15-UI-SPEC §4.4; D-20): a proposal its question or questionnaire has moved past; Reject only. */
  stale: { icon: HistoryIcon, label: 'Changed since proposed', tone: 'warning' },
} satisfies Record<StatusValues['aiReview'], StatusPresentation>;

/*
 * A Risk's own state (16-UI-SPEC §6.4; X-27; S-14, D-46): a Risk a Security Analyst took out of its assessment without
 * deleting it. Neutral, because it waits on nobody while it stays withdrawn; the Archive icon and the word carry it. An
 * active Risk shows no badge.
 */
const riskFamily = {
  withdrawn: { icon: ArchiveIcon, label: 'Withdrawn', tone: 'neutral' },
} satisfies Record<StatusValues['risk'], StatusPresentation>;

/*
 * A file's state (14-UI-SPEC §3.4; X-21). Every value is neutral, because none is work waiting on a person and none is
 * overdue (UI-D14): the icon and the words tell Blocked from Waiting for malware check, never a colour. `Available` is
 * in the mapping for completeness; an available file shows no badge.
 *
 * IN-506 (D-27, R-08-34): the labels and tones stay in this one mapping, but the icons are named, and the attachments
 * feature resolves them (AttachmentStatusBadge), so a route that renders a badge but no file, the assessment editor's
 * included, ships none of the five file icons.
 */
const attachmentFamily = {
  available: { iconName: 'ShieldCheck', label: 'Available', tone: 'neutral' },
  pending: { iconName: 'ShieldEllipsis', label: 'Waiting for malware check', tone: 'neutral' },
  blocked: { iconName: 'ShieldX', label: 'Blocked', tone: 'neutral' },
  unavailable: { iconName: 'FileX', label: 'File unavailable', tone: 'neutral' },
  removed: { iconName: 'ArchiveX', label: 'Removed', tone: 'neutral' },
} satisfies Record<StatusValues['attachment'], NamedIconStatusPresentation>;

/**
 * The one mapping from a status value to its label, tone and icon: the workflow, review, risk and file families.
 * Badges, filter options, chips and cards all read it; feature code passes a family and a value
 * and never chooses any of the three.
 */
export const statusPresentation: {
  readonly [F in StatusFamily]: Readonly<Record<StatusValue<F>, PresentationOf<F>>>;
} = {
  request: requestFamily,
  assessment: assessmentFamily,
  questionnaire: questionnaireFamily,
  treatment: treatmentFamily,
  aiReview: aiReviewFamily,
  risk: riskFamily,
  attachment: attachmentFamily,
};

/*
 * A value a family does not yet label: its words in sentence case, the neutral tone and a plain circle. Closed
 * parsers refuse unknown values at the boundary, so this guards a value added to a vocabulary before its label
 * (the G-13 seam); it never renders anything but the status value itself.
 */
export function unknownStatusPresentation(value: string): StatusPresentation {
  const words = value.replaceAll('-', ' ').trim();
  return {
    icon: CircleIcon,
    label: words.charAt(0).toUpperCase() + words.slice(1),
    tone: 'neutral',
  };
}

function presentationOf<F extends StatusFamily>(family: F, value: StatusValue<F>): StatusPresentation | NamedIconStatusPresentation {
  const entries: Readonly<Record<string, StatusPresentation | NamedIconStatusPresentation>> = statusPresentation[family];
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

type HeldIconFamily = Exclude<StatusFamily, 'attachment'>;

type FamilyBadgeProps = {
  [F in HeldIconFamily]: { family: F; status?: never; value: StatusValue<F>; icons?: never };
}[HeldIconFamily];

/** The file family names its icons, so its caller passes the components (the attachments feature; IN-506). */
type AttachmentBadgeProps = {
  family: 'attachment';
  status?: never;
  value: StatusValue<'attachment'>;
  icons: Readonly<Record<AttachmentStatusIconName, LucideIcon>>;
};

type RequestBadgeProps = { family?: never; status: RequestStatus; value?: never; icons?: never };

export type StatusBadgeProps = (FamilyBadgeProps | AttachmentBadgeProps | RequestBadgeProps) & {
  className?: string;
  /** Announce status changes politely, for a badge that updates in place. */
  live?: boolean;
};

/**
 * A presented status: a tinted rounded-rect with a leading icon and its label, never colour alone. The one tone
 * rendering, which StatusBadge and a feature's own presentation map (the import rows, 19-13) both render through.
 */
export function PresentedStatusBadge({ presentation, className, live = false }: {
  presentation: StatusPresentation;
  className?: string;
  /** Announce status changes politely, for a badge that updates in place. */
  live?: boolean;
}) {
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

/**
 * A workflow status, presented from the one mapping. The request family keeps its original `status` prop; every
 * other family passes `family` and `value`.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { className, live = false } = props;
  const presentation = props.status === undefined
    ? presentationOf(props.family, props.value)
    : presentationOf('request', props.status);
  const icon = 'icon' in presentation
    ? presentation.icon
    : props.family === 'attachment' ? props.icons[presentation.iconName] : CircleIcon;

  return <PresentedStatusBadge className={className} live={live} presentation={{ icon, label: presentation.label, tone: presentation.tone }} />;
}
