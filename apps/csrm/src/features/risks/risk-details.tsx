'use client';

import { LockKeyholeIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { DetailSection } from '@/components/csrm/detail-section';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { StatusBadge } from '@/components/csrm/status-badge';
import { PageHeader } from '@/components/shell/app-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RiskDetailServerActionResult } from './risk-actions';
import { RiskDetailEditor, type RiskDetailsOptions, type RiskOwnerSearch } from './risk-detail-editor';
import { MitigationControlList } from './mitigation-control-list';
import type { RiskDetail } from './risk-schema';

export type { RiskDetailsOptions } from './risk-detail-editor';

export type RiskDetailsProps = {
  detail?: RiskDetail;
  options?: RiskDetailsOptions;
  searchOwners?: RiskOwnerSearch;
  state?: 'ready' | 'loading' | 'not-available' | 'error' | 'permission';
};

type Conflict = Extract<RiskDetailServerActionResult<never>, { conflict: true }>;

const safeHeader = <PageHeader title="Risk details" description="View a Risk and the controls that mitigate it." />;

/** Scrolls the element the URL's hash names into view, if it is on the page. */
function scrollToLocationHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  let id: string;
  try {
    id = decodeURIComponent(hash);
  } catch {
    return;
  }
  document.getElementById(id)?.scrollIntoView();
}

export function RiskDetails({ detail, options, searchOwners, state = 'ready' }: RiskDetailsProps) {
  const [current, setCurrent] = useState(detail);
  const [currentState, setCurrentState] = useState(state);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const editRef = useRef<HTMLButtonElement>(null);
  const detailIdentityRef = useRef(detail ? `${detail.documentId}:${detail.parentLock}` : undefined);
  const detailShown = currentState === 'ready' && current !== undefined;

  /*
   * A Control Implementation alert opens this page at #mitigation-controls (UI-SPEC §9 item 5). The
   * detail streams in behind the route's loading boundary, so the router's own hash scroll runs
   * against the skeleton, before the section exists. Once the Risk is on screen, bring the linked
   * section into view; html scroll-padding-top keeps it clear of the sticky header.
   */
  useEffect(() => {
    if (detailShown) scrollToLocationHash();
  }, [detailShown]);

  useEffect(() => {
    const nextIdentity = detail ? `${detail.documentId}:${detail.parentLock}` : undefined;
    setCurrent(detail);
    setCurrentState(state);
    setEditing(false);
    if (state !== 'ready' || detailIdentityRef.current !== nextIdentity) setMessage('');
    detailIdentityRef.current = nextIdentity;
  }, [detail, state]);

  function focusEdit() {
    requestAnimationFrame(() => editRef.current?.focus());
  }

  function handleConflict(result: Conflict) {
    setEditing(false);
    setMessage('');
    if ('notAvailable' in result && result.notAvailable) {
      setCurrent(undefined);
      setCurrentState('not-available');
      return;
    }
    if ('authoritativeDetail' in result) setCurrent(result.authoritativeDetail);
    setCurrentState('ready');
  }

  if (currentState === 'loading') return <RiskDetailsSkeleton />;
  if (currentState === 'permission') return <RiskDetailsState kind="permission" />;
  if (currentState === 'error') return <RiskDetailsState kind="error" />;
  if (currentState === 'not-available' || !current) return <RiskDetailsState kind="not-available" />;

  const mutable = current.parentLock === 'mutable';
  const canEdit = mutable && options && searchOwners;
  const description = excerpt(current.riskStatement);
  const status = (
    <div className="flex flex-wrap items-center gap-2" aria-label="Risk ratings and status">
      <span className="text-sm font-medium">Inherent</span>{current.inherentRating ? <RiskRatingBadge rating={current.inherentRating} /> : <span className="text-sm">Not provided</span>}
      <span className="text-sm font-medium">Residual</span>{current.residualRating ? <RiskRatingBadge rating={current.residualRating} /> : <span className="text-sm">Not provided</span>}
      {/* A locked Risk belongs to a released assessment; the read-only consequence is the Alert's to state. */}
      {!mutable ? <StatusBadge family="assessment" value="approved" /> : null}
    </div>
  );

  return (
    <>
      <PageHeader title={current.riskNumber} description={description} status={status} />
      <p aria-atomic="true" aria-live="polite" role="status" className="sr-only">{message}</p>
      <div className="grid gap-8">
        {/* Inside the section grid, the notice keeps the page's section rhythm above the first section (W-12). */}
        {!mutable ? <Alert><LockKeyholeIcon aria-hidden="true" /><AlertTitle>Released assessment - read only</AlertTitle><AlertDescription>This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed.</AlertDescription></Alert> : null}
        {editing && canEdit ? (
          <DetailSection title="Risk statement and classification" description="Edit this Risk’s details.">
            <RiskDetailEditor detail={current} options={options} searchOwners={searchOwners} onCancel={() => { setEditing(false); setMessage(''); focusEdit(); }} onConflict={handleConflict} onNoChange={() => setMessage('No changes to save.')} onSaved={(updated) => { setCurrent(updated); setEditing(false); setMessage('Risk changes saved.'); focusEdit(); }} />
          </DetailSection>
        ) : (
          <>
            <DetailSection title="Risk statement and classification"><DefinitionList rows={classificationRows(current)} /></DetailSection>
            <DetailSection title="Ratings"><DefinitionList rows={ratingRows(current)} /></DetailSection>
            <DetailSection title="Ownership and treatment">
              <DefinitionList rows={ownershipRows(current)} />
              {canEdit ? <Button ref={editRef} className="mt-6" type="button" onClick={() => { setMessage(''); setEditing(true); }}>Edit risk</Button> : null}
            </DetailSection>
          </>
        )}
        {/* The anchor Control Implementation alerts open at (UI-SPEC §9 item 5). */}
        <DetailSection title="Mitigation controls" description="Controls that mitigate this Risk, from the control library." headingId="mitigation-controls">
          <MitigationControlList implementations={current.controlImplementations} mutable={mutable} options={mutable ? options : undefined} riskId={current.documentId} riskTypeId={current.riskType?.documentId ?? null} searchOwners={mutable ? searchOwners : undefined} onConflict={handleConflict} onChanged={(implementations, nextMessage) => { setCurrent({ ...current, controlImplementations: [...implementations] }); setMessage(nextMessage); }} />
        </DetailSection>
        <DetailSection title="Related records"><DefinitionList rows={relatedRows(current)} /></DetailSection>
      </div>
    </>
  );
}

export function RiskDetailsSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      {safeHeader}
      <section aria-label="Loading Risk details" aria-live="polite" className="grid gap-8" role="status">
        <span className="sr-only">Loading Risk details</span>
        {visible ? <><Skeleton className="h-10 w-full max-w-xl motion-reduce:animate-none" />{Array.from({ length: 5 }, (_, index) => <div className="grid gap-4 rounded-lg border border-border p-6" data-slot="risk-detail-skeleton-section" key={index}><Skeleton className="h-7 w-52 motion-reduce:animate-none" /><Skeleton className="h-24 w-full motion-reduce:animate-none" /></div>)}</> : null}
      </section>
    </>
  );
}

function RiskDetailsState({ kind }: { kind: 'not-available' | 'error' | 'permission' }) {
  const content = kind === 'permission'
    ? { title: 'You don’t have permission to view the Risk Register', body: 'The Risk Register is for Security Analysts. Your workspace shows the work you can open.' }
    : kind === 'error'
      ? { title: 'We couldn’t load this Risk', body: 'Try again. If the problem continues, contact your CSRM administrator.' }
      : { title: 'Risk not available', body: 'This Risk may no longer exist or may not be available to you.' };
  return (
    <>
      {safeHeader}
      <Alert role="alert"><AlertTitle>{content.title}</AlertTitle><AlertDescription>{content.body}</AlertDescription>{kind === 'permission' ? <Button asChild className="mt-4" variant="outline"><Link href="/app">Return to workspace</Link></Button> : null}{kind === 'error' ? <Button className="mt-4" type="button" variant="outline" onClick={() => window.location.reload()}>Try again</Button> : null}</Alert>
    </>
  );
}

type DetailRow = { label: string; value: React.ReactNode; wide?: boolean };

function DefinitionList({ rows }: { rows: readonly DetailRow[] }) {
  return <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">{rows.map((row) => <div className={row.wide ? 'md:col-span-2' : undefined} key={row.label}><dt className="text-sm font-semibold text-foreground">{row.label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.value ?? 'Not provided'}</dd></div>)}</dl>;
}

function classificationRows(detail: RiskDetail): DetailRow[] {
  return [
    { label: 'Issue statement', value: detail.issueStatement, wide: true }, { label: 'Risk statement', value: detail.riskStatement, wide: true },
    { label: 'Risk category', value: detail.riskCategory }, { label: 'Risk sub-category', value: detail.riskSubCategory },
    { label: 'Risk cause', value: detail.riskCause, wide: true }, { label: 'Potential impact', value: detail.potentialImpact, wide: true },
    { label: 'Data classification', value: detail.dataClassification }, { label: 'Risk velocity', value: detail.riskVelocity },
    { label: 'Risk type', value: detail.riskType ? <span><span className="block text-foreground">{detail.riskType.name}</span>{detail.riskType.description ? <span className="block">{detail.riskType.description}</span> : null}</span> : null, wide: true },
  ];
}

function ratingRows(detail: RiskDetail): DetailRow[] {
  return [
    { label: 'Inherent likelihood', value: detail.inherentLikelihood }, { label: 'Highest inherent consequence', value: detail.highestInherentConsequence },
    { label: 'Inherent rating', value: detail.inherentRating ? <RiskRatingBadge rating={detail.inherentRating} /> : null },
    { label: 'Inherent rating rationale', value: detail.inherentRatingRationale, wide: true },
    { label: 'Residual likelihood', value: detail.residualLikelihood }, { label: 'Highest residual consequence', value: detail.highestResidualConsequence },
    { label: 'Residual rating', value: detail.residualRating ? <RiskRatingBadge rating={detail.residualRating} /> : null },
    { label: 'Residual rating rationale', value: detail.residualRatingRationale, wide: true },
    { label: 'Control effectiveness', value: detail.controlEffectiveness },
  ];
}

function ownershipRows(detail: RiskDetail): DetailRow[] {
  return [
    { label: 'Risk owner', value: detail.riskOwner?.displayName }, { label: 'Treatment owner', value: detail.treatmentOwner?.displayName },
    { label: 'Treatment action', value: detail.treatmentAction }, { label: 'Treatment plan', value: detail.treatmentPlan, wide: true },
    { label: 'Treatment status', value: detail.treatmentStatus }, { label: 'Identified date', value: dateValue(detail.identifiedDate) },
    { label: 'Target date', value: dateValue(detail.targetDate) }, { label: 'Treatment resolve date', value: dateValue(detail.treatmentResolveDate) },
    { label: 'Closure date', value: dateValue(detail.closureDate) }, { label: 'Risk communication date', value: dateValue(detail.riskCommunicationDate) },
    { label: 'Exempted', value: detail.isExempted === null ? null : detail.isExempted ? 'Yes' : 'No' },
    { label: 'Exemption review date', value: timestampValue(detail.exemptionReviewDate) },
    { label: 'Escalation details', value: detail.escalationDetails, wide: true }, { label: 'Comments', value: detail.comments, wide: true },
  ];
}

function relatedRows(detail: RiskDetail): DetailRow[] {
  return [
    {
      label: 'Related assessment',
      value: (
        <RecordLink
          className="text-primary underline-offset-4 hover:underline"
          href={`/app/review/assessments/${encodeURIComponent(detail.assessment.documentId)}`}
        >
          {detail.assessment.assessmentNumber} — {detail.assessment.title}
        </RecordLink>
      ),
      wide: true,
    },
    { label: 'Impacted Information system', value: detail.informationSystemImpacted?.name },
    { label: 'Impacted Information asset', value: detail.informationAssetImpacted?.name },
  ];
}

function excerpt(value: string | null): string {
  if (!value) return 'No risk statement recorded';
  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

function dateValue(value: string | null): React.ReactNode {
  if (!value) return null;
  const label = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
  return <time dateTime={value}>{label}</time>;
}

function timestampValue(value: string | null): React.ReactNode {
  if (!value) return null;
  const label = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  return <time dateTime={value}>{label}</time>;
}
