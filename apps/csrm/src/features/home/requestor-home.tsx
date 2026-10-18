import { ChevronRightIcon, CircleDashedIcon, MessageSquareDotIcon } from 'lucide-react';
import Link from 'next/link';

import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { EmptyState, PermissionDeniedState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { E2eUiStateBoundary, resolveE2eRequestorHomePartial, resolveE2eUiState, type E2eUiState } from '@/lib/testing/e2e-ui-state';
import { homeGridClassName, homeRowClassName, HomeSection, HomeSectionFooter, HomeSectionSkeleton } from './home-section';
import {
  emptyRequestorHome,
  isFirstUse,
  needsActionItemView,
  newNotesRow,
  ratingChipLinks,
  releasedItemView,
  requestorHomeCopy,
  sectionFooter,
  withAnalystItemView,
  type NeedsActionItemView,
  type RatingChip,
  type ReleasedItemView,
  type RequestorHomeData,
  type RequestorHomeSectionCopy,
  type RequestorHomeState,
  type UnreadMarker,
  type WithAnalystItemView,
} from './requestor-home-presentation';
import { getRequestorHome } from './requestor-home-service';

/*
 * The Requestor Home (UX-08; D-19 to D-24; UI-SPEC §5.2). Its sections come from GET /v1/my_requests's holder,
 * never from the stored status: Needs your action, With the Security Analyst, then Released assessments. Needs
 * your action is the first content after the page header at every width, beside With the Security Analyst from
 * lg, with Released assessments across both; DOM order equals visual order (D-22). Each section fails, empties
 * and bounds on its own, and every word and destination comes from the presentation module.
 */

/* A text link inside a row: ink with its at-rest underline, and the touch-target height below md. */
const rowLinkClassName =
  'inline-flex min-h-11 items-center text-sm text-foreground underline decoration-muted-foreground underline-offset-3 '
  + 'transition-colors duration-(--duration-micro) ease-standard hover:decoration-foreground md:min-h-6';

/* A record link in a row: the body size, wrapping within the card, at the touch-target height below md. */
const recordLinkClassName = 'inline-flex min-h-11 items-center break-words text-sm md:min-h-6';

/* A rating chip: the badge and its count in a quiet tile; a count above zero makes the whole chip one link (X-10). */
const chipClassName = 'flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-muted p-3';
const chipLinkClassName = 'transition-colors duration-(--duration-micro) ease-standard hover:bg-surface-hover';

/*
 * The new-notes row (13-UI-SPEC §12.3; X-10 block link): one card that is one link, with no underline, so its
 * trailing chevron is the at-rest cue. Hover darkens the hairline to ink and lifts the card only when motion is
 * welcome (direction §4 Cards). Unread is ink, never a status hue (direction, Unread).
 */
const newNotesRowClassName =
  'flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground '
  + 'transition-[border-color,transform] duration-(--duration-fast) ease-out-expo hover:border-line-ink-20 motion-safe:hover:-translate-y-px';

function NewNotesRow({ count }: { count: number }) {
  const row = newNotesRow(count);
  if (!row) return null;
  return (
    <Link className={newNotesRowClassName} href={row.href}>
      <MessageSquareDotIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{row.label}</span>
      <ChevronRightIcon aria-hidden="true" className="ml-auto size-4 shrink-0 text-foreground-secondary" />
    </Link>
  );
}

/* The X-17 marker below an item's last line: the notes new to the Requestor, a link to the request's thread. */
function UnreadMarkerLine({ marker }: { marker: UnreadMarker | null }) {
  if (!marker) return null;
  return (
    <p className="mt-2">
      <RecordLink aria-label={marker.label} className="inline-flex min-h-6 items-center gap-1 text-xs font-medium tabular-nums text-foreground" href={marker.href}>
        <MessageSquareDotIcon aria-hidden="true" className="size-3 shrink-0" />
        {marker.text}
      </RecordLink>
    </p>
  );
}

/** A section whose own read failed: its compact error and Try again, with no count and no record link. */
function SectionError({ copy }: { copy: RequestorHomeSectionCopy }) {
  return <HomeSection copy={copy}><RetryableErrorState density="compact" headingLevel="h3" noun={copy.errorNoun} /></HomeSection>;
}

/** A populated section's truncation note and its list link, whose total equals the section's (D-35). */
function SectionFooter({ copy, shown, total }: { copy: RequestorHomeSectionCopy; shown: number; total: number }) {
  const footer = sectionFooter(copy, shown, total);
  return <HomeSectionFooter links={footer.links} note={footer.note} />;
}

/* ---------------------------------------------------------------- Needs your action */

function NeedsActionRow({ item }: { item: NeedsActionItemView }) {
  return (
    <li className={homeRowClassName}>
      <RecordLink className={recordLinkClassName} href={item.href}>{item.title}</RecordLink>
      <p className="mt-1 text-xs tabular-nums text-foreground-secondary">{item.caption}</p>
      {item.returned ? (
        <p className="mt-1 break-words text-xs text-foreground-secondary">
          {requestorHomeCopy.returnedLead} <LocalInstant style="date" value={item.returned.at} />.
          {item.returned.reasonText ? ` ${item.returned.reasonText}` : null}
        </p>
      ) : null}
      {item.nextStep ? (
        <p className="mt-2 break-words text-sm text-foreground">
          {item.nextStep.href ? <Link className={rowLinkClassName} href={item.nextStep.href}>{item.nextStep.summary}</Link> : item.nextStep.summary}
        </p>
      ) : null}
      {item.progress ? (
        <div className="mt-2 flex flex-col gap-1">
          <span className="text-xs font-medium tabular-nums text-foreground">{item.progress.text}</span>
          <Progress aria-label={item.progress.label} value={item.progress.percent} />
        </div>
      ) : null}
      <UnreadMarkerLine marker={item.unread} />
    </li>
  );
}

function NeedsActionSection({ home, canCreate }: { home: RequestorHomeData; canCreate: boolean }) {
  const copy = requestorHomeCopy.needsAction;
  const section = home.needsAction;
  if (section.status === 'unavailable') return <SectionError copy={copy} />;

  const items = section.data.items.slice(0, copy.bound).map(needsActionItemView);
  if (items.length === 0) {
    return (
      <HomeSection copy={copy}>
        {isFirstUse(home)
          ? <EmptyState action={canCreate ? copy.firstUse.action : undefined} density="compact" description={canCreate ? copy.firstUse.description : 'Requests you raise will appear here when they need your action.'} headingLevel="h3" noun={copy.firstUse.noun} />
          : <EmptyState density="compact" description={copy.cleared.description} headingLevel="h3" kind="cleared" noun={copy.cleared.noun} />}
      </HomeSection>
    );
  }

  return (
    <HomeSection copy={copy} footer={<SectionFooter copy={copy} shown={items.length} total={section.data.pagination.total} />}>
      <ul role="list">{items.map((item) => <NeedsActionRow item={item} key={item.key} />)}</ul>
    </HomeSection>
  );
}

/* ------------------------------------------------------- With the Security Analyst */

function WithAnalystRow({ item }: { item: WithAnalystItemView }) {
  return (
    <li className={homeRowClassName}>
      <RecordLink className={recordLinkClassName} href={item.href}>{item.title}</RecordLink>
      <p className="mt-1 text-xs tabular-nums text-foreground-secondary">{item.caption}</p>
      {item.sentence ? <p className="mt-1 break-words text-sm text-foreground-secondary">{item.sentence}</p> : null}
      <UnreadMarkerLine marker={item.unread} />
    </li>
  );
}

function WithAnalystSection({ home, failed }: { home: RequestorHomeData; failed: boolean }) {
  const copy = requestorHomeCopy.withAnalyst;
  const section = home.withAnalyst;
  if (failed || section.status === 'unavailable') return <SectionError copy={copy} />;

  const items = section.data.items.slice(0, copy.bound).map(withAnalystItemView);
  if (items.length === 0) {
    return (
      <HomeSection copy={copy}>
        <EmptyState density="compact" description={copy.cleared.description} headingLevel="h3" kind="cleared" noun={copy.cleared.noun} />
      </HomeSection>
    );
  }

  return (
    <HomeSection copy={copy} footer={<SectionFooter copy={copy} shown={items.length} total={section.data.pagination.total} />}>
      <ul role="list">{items.map((item) => <WithAnalystRow item={item} key={item.key} />)}</ul>
    </HomeSection>
  );
}

/* ------------------------------------------------------------ Released assessments */

function RatingChipView({ chip }: { chip: RatingChip }) {
  // The badge does not name itself: the chip's own name, or its visible rating and count, already say it (SC 2.5.3).
  const content = (
    <>
      <RiskRatingBadge labelled={false} rating={chip.rating} />
      {/* A word break the flex row does not draw: the visible text reads as the link's name begins (SC 2.5.3). */}
      {' '}
      <span className="ml-auto text-sm font-medium tabular-nums text-foreground" data-slot="rating-count">{chip.countText}</span>
    </>
  );

  return chip.href ? (
    <Link aria-label={chip.accessibleName} className={cn(chipClassName, chipLinkClassName)} href={chip.href}>
      {content}
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  ) : <div className={chipClassName}>{content}</div>;
}

function ReleasedRow({ item }: { item: ReleasedItemView }) {
  const copy = requestorHomeCopy.released;
  return (
    <li className={homeRowClassName}>
      <div className="flex min-w-0 flex-col gap-2 @md:flex-row @md:items-start @md:justify-between">
        <div className="min-w-0">
          <RecordLink className={cn(recordLinkClassName, 'tabular-nums')} href={item.href}>{item.assessmentNumber}</RecordLink>
          {item.requestTitle ? <p className="mt-1 break-words text-sm text-foreground">{item.requestTitle}</p> : null}
          <p className="mt-1 text-xs tabular-nums text-foreground-secondary">
            {copy.releasedLead} <LocalInstant style="date" value={item.approvalDate} />
          </p>
        </div>
        {item.rating ? <RiskRatingBadge rating={item.rating} /> : (
          <Badge className="w-fit border-border bg-surface-muted text-foreground-secondary" variant="outline">
            <CircleDashedIcon aria-hidden="true" />
            {copy.notRated}
          </Badge>
        )}
      </div>
    </li>
  );
}

function ReleasedSection({ home }: { home: RequestorHomeData }) {
  const copy = requestorHomeCopy.released;
  const section = home.released;
  const className = 'lg:col-span-2';
  if (section.status === 'unavailable') return <HomeSection className={className} copy={copy}><RetryableErrorState density="compact" headingLevel="h3" noun={copy.errorNoun} /></HomeSection>;

  const items = section.data.records.slice(0, copy.bound).map(releasedItemView);
  const chips = (
    <ul aria-label={copy.chipsLabel} className="grid grid-cols-2 gap-2 @lg:grid-cols-4" role="list">
      {ratingChipLinks(section.data.ratings).map((chip) => <li className="min-w-0" key={chip.rating}><RatingChipView chip={chip} /></li>)}
    </ul>
  );

  return (
    <HomeSection
      className={className}
      copy={copy}
      footer={items.length > 0 ? <SectionFooter copy={copy} shown={items.length} total={section.data.total} /> : undefined}
    >
      {chips}
      <div className="mt-4">
        {items.length > 0
          ? <ul aria-label={copy.itemsLabel} role="list">{items.map((item) => <ReleasedRow item={item} key={item.key} />)}</ul>
          : <EmptyState density="compact" description={copy.firstUse.description} headingLevel="h3" noun={copy.firstUse.noun} />}
      </div>
    </HomeSection>
  );
}

/* ---------------------------------------------------------------------- The Home */

/** A section the guarded partial fixture fails while its siblings render (D-23). */
export type RequestorHomeFailedSection = 'withAnalyst';

/**
 * The Requestor Home for a composed state. A refused read shows the permission state, every read failing the
 * page error; otherwise each section renders its own items, empty state or compact error.
 */
export function RequestorHome({ state, failedSection, canCreate = true }: { state: RequestorHomeState; failedSection?: RequestorHomeFailedSection; canCreate?: boolean }) {
  if (state.kind === 'permission-denied') return <PermissionDeniedState action={requestorHomeCopy.permission.action} area={requestorHomeCopy.permission.area} />;
  if (state.kind === 'error') return <RetryableErrorState noun={requestorHomeCopy.pageErrorNoun} />;

  const grid = (
    <div className={homeGridClassName} data-slot="requestor-home">
      <NeedsActionSection canCreate={canCreate} home={state.home} />
      <WithAnalystSection failed={failedSection === 'withAnalyst'} home={state.home} />
      <ReleasedSection home={state.home} />
    </div>
  );
  // 13-UI-SPEC §12.3: the new-notes row spans the content width directly under the page header, above the grid.
  return newNotesRow(state.home.withUnreadNotes) ? (
    <div className="flex min-w-0 flex-col gap-gutter-xs sm:gap-gutter-sm">
      <NewNotesRow count={state.home.withUnreadNotes} />
      {grid}
    </div>
  ) : grid;
}

type RequestorHomeContentProps = { searchParams: Promise<Record<string, string | string[] | undefined>>; canCreate?: boolean };

/** A presentation fixture's state: the real Home for populated, safe empty data, or a page state. */
function fixtureView(fixture: E2eUiState, state: Extract<RequestorHomeState, { kind: 'ready' }>, failedSection: RequestorHomeFailedSection | undefined, canCreate: boolean) {
  if (fixture === 'loading') return <RequestorHomeSkeleton />;
  if (fixture === 'empty') return <RequestorHome canCreate={canCreate} state={{ kind: 'ready', home: emptyRequestorHome }} />;
  if (fixture === 'error') return <RequestorHome state={{ kind: 'error' }} />;
  if (fixture === 'permission') return <RequestorHome state={{ kind: 'permission-denied' }} />;
  return <RequestorHome canCreate={canCreate} failedSection={failedSection} state={state} />;
}

/**
 * The Requestor Home's body (D-16). Home chooses it for everyone without `assessment:review`, so it issues no
 * analyst read, fixture or partial. Its guarded presentation fixtures, and its own partial selector that fails With
 * the Security Analyst alone, resolve only after the real, owner-scoped reads succeed; a refused or failed read is
 * authoritative (D-23, T-11-31).
 */
export async function RequestorHomeContent({ searchParams, canCreate = true }: RequestorHomeContentProps) {
  const state = await getRequestorHome();
  if (state.kind !== 'ready') return <RequestorHome state={state} />;

  const params = await searchParams;
  const fixture = resolveE2eUiState(params);
  const failedSection: RequestorHomeFailedSection | undefined = resolveE2eRequestorHomePartial(params) ? 'withAnalyst' : undefined;
  return fixture
    ? <E2eUiStateBoundary state={fixture}>{fixtureView(fixture, state, failedSection, canCreate)}</E2eUiStateBoundary>
    : <RequestorHome canCreate={canCreate} failedSection={failedSection} state={state} />;
}

/** The Requestor Home's loading body, the page's Suspense fallback: three section skeletons in the final grid (§5.4). */
export function RequestorHomeSkeleton() {
  return (
    <div aria-label={requestorHomeCopy.loadingLabel} aria-live="polite" role="status">
      <span className="sr-only">{requestorHomeCopy.loadingLabel}</span>
      <div className={homeGridClassName}>
        <HomeSectionSkeleton withFooter />
        <HomeSectionSkeleton withFooter />
        <HomeSectionSkeleton className="lg:col-span-2" withFooter />
      </div>
    </div>
  );
}
