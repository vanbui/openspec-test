import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function AccessDeniedState() {
  return (
    <Card className="w-full min-w-0">
      <CardHeader>
        <h2 className="text-heading font-semibold">You don’t have access to this area</h2>
      </CardHeader>
      <CardContent className="pt-0 text-body text-muted-foreground">
        Your current CSRM access does not include this page. Return to a page available to you or switch the development identity.
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
