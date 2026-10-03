import Link from 'next/link';

import { PageHeader } from '@/components/csrm/page-header';
import { buttonVariants } from '@/components/ui/button';

/** Home's heading and description, the same for every actor (UI-SPEC §2.1, §5.1; UI-D3). */
export const homePageCopy = {
  title: 'Home',
  description: 'What needs your action, and where your work stands.',
} as const;

export type HomeVariant = 'analyst' | 'requestor';

/**
 * The Home header, shared by the page, its loading boundary and its error boundary. The Requestor
 * Home carries New request at every width (below 768px the header stacks and the action spans it);
 * the analyst Home has no action, because its tiles are the entry points (D-24). The boundaries pass
 * `withAction={false}`: they render before the page knows which Home it is.
 */
export function HomePageHeader({ variant, withAction = true }: { variant?: HomeVariant; withAction?: boolean }) {
  const action = variant === 'requestor' && withAction
    ? <Link className={buttonVariants({ className: '!text-primary-foreground' })} href="/app/requests/new">New request</Link>
    : undefined;

  return <PageHeader action={action} description={homePageCopy.description} title={homePageCopy.title} />;
}
