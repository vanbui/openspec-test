import {
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardListIcon,
  FilePenLineIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { assessmentRatings } from '../assessments/assessment-schema';
import type {
  DashboardActionItem,
  DashboardActionProjection,
  ReleasedAssessmentProjection,
  RequestorDashboardProjection,
  RequestorDashboardState,
} from './requestor-dashboard-service';

type QuestionnaireStatePresentation = {
  className: string;
  icon: LucideIcon;
  label: string;
};

const questionnaireStatePresentations = {
  'not-started': {
    className: 'border-border bg-surface-muted text-foreground-secondary',
    icon: CircleDashedIcon,
    label: 'Not started',
  },
  draft: {
    className: 'border-info-border bg-info-subtle text-info',
    icon: FilePenLineIcon,
    label: 'Draft',
  },
  submitted: {
    className: 'border-success-border bg-success-subtle text-success',
    icon: CheckCircle2Icon,
    label: 'Submitted',
  },
} satisfies Record<'not-started' | 'draft' | 'submitted', QuestionnaireStatePresentation>;

function QuestionnaireStateBadge({ item }: { item: Extract<DashboardActionItem, { kind: 'questionnaire' }> }) {
  const presentation = questionnaireStatePresentations[item.state];
  const Icon = presentation.icon;

  return (
    <Badge className={presentation.className} variant="outline">
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}

function DashboardItem({ item }: { item: DashboardActionItem }) {
  return (
    <li className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <RecordLink
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={item.href}
          >
            {item.title}
          </RecordLink>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {item.context ?? 'Open request details'}
            {item.updatedDateLabel ? ` · Updated ${item.updatedDateLabel}` : ''}
          </p>
        </div>
        {item.kind === 'request' ? (
          <StatusBadge className="w-fit shrink-0" status={item.status} />
        ) : (
          <QuestionnaireStateBadge item={item} />
        )}
      </div>
      {item.kind === 'questionnaire' ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-foreground">
              {item.progress.answered} of {item.progress.total} answered
            </span>
            <span className="text-muted-foreground">{item.progress.unanswered} unanswered</span>
          </div>
          <Progress
            aria-label={`${item.title} progress`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={item.progress.percent}
            value={item.progress.percent}
          />
        </div>
      ) : null}
    </li>
  );
}

interface ActionWidgetProps {
  description: string;
  emptyNoun: string;
  heading: string;
  headingId: string;
  icon: typeof FilePenLineIcon;
  projection: DashboardActionProjection;
  failed?: boolean;
}

function ActionWidget({ description, emptyNoun, heading, headingId, icon: Icon, projection, failed }: ActionWidgetProps) {
  return (
    <Card className="min-w-0 gap-4 py-5">
      <section aria-labelledby={headingId}>
        <CardHeader className="grid grid-cols-[1fr_auto] gap-4 px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
              <h2 className="text-heading-sm text-foreground" id={headingId}>{heading}</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <span
            aria-label={`${projection.count} items`}
            className="text-display tabular-nums text-foreground"
          >
            {projection.count}
          </span>
        </CardHeader>
        <CardContent className="px-5">
          {failed ? (
            <ErrorState density="compact" noun={heading.toLowerCase()} />
          ) : projection.items.length > 0 ? (
            <ul>{projection.items.map((item) => <DashboardItem item={item} key={item.documentId} />)}</ul>
          ) : (
            <EmptyState density="compact" headingLevel="h3" noun={emptyNoun} />
          )}
        </CardContent>
      </section>
    </Card>
  );
}

function ReleasedAssessmentWidget({ projection }: { projection: ReleasedAssessmentProjection }) {
  const headingId = 'recently-released-assessments-heading';
  return (
    <Card className="min-w-0 gap-4 py-5 lg:col-span-2">
      <section aria-labelledby={headingId}>
        <CardHeader className="grid grid-cols-[1fr_auto] gap-4 px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              <h2 className="text-heading-sm text-foreground" id={headingId}>Recently released assessments</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Assessments made available to you after release.</p>
          </div>
          <span
            aria-label={`${projection.count} items`}
            className="text-display tabular-nums text-foreground"
          >
            {projection.count}
          </span>
        </CardHeader>
        <CardContent className="space-y-5 px-5">
          <ul
            aria-label="Released assessments by rating"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {assessmentRatings.map((rating) => (
              <li
                aria-label={`${rating} released assessments: ${projection.ratingSummary[rating]}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted p-3"
                key={rating}
              >
                <RiskRatingBadge rating={rating} />
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {projection.ratingSummary[rating]}
                </span>
              </li>
            ))}
          </ul>

          {projection.kind === 'empty' ? (
            <EmptyState
              density="compact"
              description="Assessments appear here after an authorised Security Analyst releases them."
              headingLevel="h3"
              noun="released risk assessments"
            />
          ) : (
            <ul aria-label="Recently released risk assessments">
              {projection.items.map((item) => (
                <li className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0" key={item.documentId}>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <RecordLink
                        className="font-medium text-text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        href={`/app/assessments/${encodeURIComponent(item.documentId)}`}
                      >
                        {item.assessmentNumber}
                      </RecordLink>
                      <p className="mt-1 break-words text-sm text-foreground-secondary">
                        {item.summary ?? 'No assessment summary was supplied.'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Released {item.approvalDateLabel}</p>
                    </div>
                    {item.overallRating ? (
                      <RiskRatingBadge rating={item.overallRating} />
                    ) : (
                      <Badge className="w-fit border-border bg-surface-muted text-foreground-secondary" variant="outline">
                        <CircleDashedIcon aria-hidden="true" />
                        Not rated
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </section>
    </Card>
  );
}

function RequestLifecycleWidget({ counts }: { counts: RequestorDashboardProjection['requestLifecycleCounts'] }) {
  const headingId = 'my-assessment-requests-heading';
  return (
    <Card className="min-w-0 gap-4 py-5 lg:col-span-2">
      <section aria-labelledby={headingId}>
        <CardHeader className="px-5">
          <h2 className="text-heading-sm text-foreground" id={headingId}>My Assessment Requests</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your requests by lifecycle state.</p>
        </CardHeader>
        <CardContent className="px-5">
          {counts === null ? (
            <p className="text-sm text-foreground-secondary">
              These counts are unavailable right now. Your requests are still listed in My Requests.
            </p>
          ) : (
          <ul aria-label="My Assessment Requests by lifecycle state" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {counts.map((entry) => (
              <li className="min-w-0" key={entry.status}>
                <Link className="block min-w-0 rounded-lg border border-border bg-surface-muted p-4 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/app/requests?status=${encodeURIComponent(entry.status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="break-words font-medium">{entry.label}</span>
                    <span aria-label={`${entry.count} ${entry.count === 1 ? 'request' : 'requests'}`} className="text-display tabular-nums">{entry.count}</span>
                  </div>
                  {entry.count === 0 ? <p className="mt-2 text-sm text-foreground-secondary">There are none in this state.</p> : null}
                </Link>
              </li>
            ))}
          </ul>
          )}
        </CardContent>
      </section>
    </Card>
  );
}

export function RequestorDashboard({ state, failedWidget }: {
  state: RequestorDashboardState;
  failedWidget?: 'draft-requests';
}) {
  if (state.kind === 'loading') {
    return <LoadingState />;
  }
  if (state.kind === 'permission-denied') {
    return (
      <PermissionDeniedState
        action={{ label: 'Return to sign in', href: '/sign-in' }}
        area="your dashboard"
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <ErrorState
        action={{ label: 'View My Requests', href: '/app/requests' }}
        noun="your dashboard"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <RequestLifecycleWidget counts={state.dashboard.requestLifecycleCounts} />
      <ActionWidget
        description="Draft requests that you can resume and edit."
        emptyNoun="draft requests"
        heading="Draft requests"
        headingId="draft-requests-heading"
        icon={FilePenLineIcon}
        projection={state.dashboard.draftRequests}
        failed={failedWidget === 'draft-requests'}
      />
      <ActionWidget
        description="Questionnaires linked to requests that need your input."
        emptyNoun="active questionnaires"
        heading="Questionnaires in progress"
        headingId="questionnaires-in-progress-heading"
        icon={ClipboardListIcon}
        projection={state.dashboard.questionnaires}
      />
      <ReleasedAssessmentWidget projection={state.dashboard.releasedAssessments} />
    </div>
  );
}
