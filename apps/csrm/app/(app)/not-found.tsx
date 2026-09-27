import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/csrm/page-header';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found | IdamBox CSRM' };

/*
 * A notFound() raised under the signed-in shell renders here, inside the shell's main landmark,
 * rather than on the root card: Next places a segment's not-found inside that segment's layout,
 * and once app/not-found.tsx exists it no longer injects its default here. The copy is the root
 * not-found's (UI-SPEC section 9.3), under the page's one level-one heading, and it carries no
 * record data: a Requestor who reaches another Requestor's assessment learns nothing about it.
 */
export default function ShellNotFound() {
  return (
    <PageHeader
      action={<Link className={buttonVariants()} href="/app">Return to workspace</Link>}
      description="The page you asked for doesn’t exist or has moved."
      title="Page not found"
    />
  );
}
