import { AlertTriangle, Inbox, LockKeyhole, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '../ui/button';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
type StateDensity = 'default' | 'compact';
type StateAction = { label: string; href: string };

type StateFrameProps = {
  children: ReactNode;
  density?: StateDensity;
  heading: string;
  headingLevel?: HeadingLevel;
  icon: ElementType<{ 'aria-hidden'?: boolean; className?: string }>;
  kind: 'loading' | 'empty' | 'error' | 'permission';
  role?: 'alert' | 'status';
};

function StateFrame({ children, density = 'default', heading, headingLevel = 'h2', icon: Icon, kind, role }: StateFrameProps) {
  const Heading = headingLevel;

  return (
    <section
      data-slot="state"
      data-state-kind={kind}
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
      className={density === 'compact'
        ? 'space-y-2 rounded-lg border border-border bg-surface p-4 text-left'
        : 'space-y-3 rounded-lg border border-border bg-surface px-6 py-12 text-center [&>p]:mx-auto [&>p]:max-w-prose'}
    >
      <Icon
        aria-hidden={true}
        className={cn(
          density === 'compact' ? 'size-4' : 'mx-auto size-5',
          kind === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
      />
      <Heading className="text-heading-sm text-foreground">{heading}</Heading>
      {children}
    </section>
  );
}

function StateActionLink({ action }: { action: StateAction }) {
  return <Link className={buttonVariants({ variant: 'outline' })} href={action.href}>{action.label}</Link>;
}

export function LoadingState({ density, headingLevel }: { density?: StateDensity; headingLevel?: HeadingLevel } = {}) {
  return (
    <StateFrame density={density} heading="Loading workspace…" headingLevel={headingLevel} icon={LoaderCircle} kind="loading" role="status">
      <p className="text-sm text-foreground-secondary">Preparing your authorised workspace.</p>
    </StateFrame>
  );
}

export function EmptyState({ action, clearFiltersHref, density, description, filtered = false, headingLevel, noun, onClearFilters }: {
  action?: StateAction;
  clearFiltersHref?: string;
  density?: StateDensity;
  description?: string;
  filtered?: boolean;
  headingLevel?: HeadingLevel;
  noun?: string;
  onClearFilters?: () => void;
} = {}) {
  const defaultCopy = !noun && !filtered && !description && !action && !clearFiltersHref && !onClearFilters;
  const heading = noun ? (filtered ? `No ${noun} match these filters` : `No ${noun} yet`) : 'Nothing to show yet';
  const detail = description ?? (defaultCopy ? 'Items available to you will appear here. Try changing your filters or return when work has been assigned.' : undefined);

  return (
    <StateFrame density={density} heading={heading} headingLevel={headingLevel} icon={Inbox} kind="empty">
      {detail ? <p className="text-sm text-foreground-secondary">{detail}</p> : null}
      {filtered && onClearFilters ? <Button type="button" variant="outline" onClick={onClearFilters}>Clear filters</Button> : null}
      {filtered && !onClearFilters && clearFiltersHref ? <StateActionLink action={{ label: 'Clear filters', href: clearFiltersHref }} /> : null}
      {!filtered && action ? <StateActionLink action={action} /> : null}
    </StateFrame>
  );
}

export function ErrorState({ action, density, description, headingLevel, noun, retry }: {
  action?: StateAction;
  density?: StateDensity;
  description?: string;
  headingLevel?: HeadingLevel;
  noun?: string;
  retry?: () => void;
} = {}) {
  const heading = noun ? `We couldn’t load ${noun}` : 'We couldn’t load this workspace';
  const detail = description ?? 'Please try again. If the problem continues, contact your administrator.';

  return (
    <StateFrame density={density} heading={heading} headingLevel={headingLevel} icon={AlertTriangle} kind="error" role="alert">
      <p className="text-sm text-foreground-secondary">{detail}</p>
      {action ? <StateActionLink action={action} /> : retry ? <Button type="button" variant="outline" onClick={retry}>Try again</Button> : null}
    </StateFrame>
  );
}

export function PermissionDeniedState({ action, area, density, headingLevel }: {
  action?: StateAction;
  area?: string;
  density?: StateDensity;
  headingLevel?: HeadingLevel;
} = {}) {
  const heading = area ? `You don’t have access to ${area}` : 'You don’t have access to this area';

  return (
    <StateFrame density={density} heading={heading} headingLevel={headingLevel} icon={LockKeyhole} kind="permission" role="alert">
      <p className="text-sm text-foreground-secondary">Access is determined by your effective CSRM capabilities. Navigation visibility is not an authorization control.</p>
      {action ? <StateActionLink action={action} /> : (
        <Link className={buttonVariants({ variant: 'outline' })} href="/app">
          Return to workspace
        </Link>
      )}
    </StateFrame>
  );
}
