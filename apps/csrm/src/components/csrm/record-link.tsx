import Link from 'next/link';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

type RecordLinkProps = ComponentProps<typeof Link>;

/** Shared navigation treatment for record identifiers and titles. */
export function RecordLink({ className, ...props }: RecordLinkProps) {
  return <Link {...props} className={cn(className, 'record-link')} />;
}
