import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function UnavailableState() {
  return (
    <Card className="w-full min-w-0">
      <CardHeader>
        <h2 className="text-heading font-semibold">This area isn’t available yet</h2>
      </CardHeader>
      <CardContent className="pt-0 text-body text-muted-foreground">
        This CSRM capability will be available in a later release.
      </CardContent>
      <CardFooter>
        <Link
          className={cn(
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            buttonVariants({ variant: 'primary', size: 'md' }),
          )}
          href="/"
        >
          Go to CSRM home
        </Link>
      </CardFooter>
    </Card>
  );
}
