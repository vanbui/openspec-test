'use client';

import type { SafeApiError } from '@/domain/service-result';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorStateProps {
  error?: SafeApiError;
  onRetry?: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <Card className="w-full min-w-0">
      <CardContent>
        <Alert variant="destructive">
          <AlertTitle>We couldn’t load this page</AlertTitle>
          <AlertDescription>
            Check your connection and try again. If the problem continues, contact your CSRM administrator.
          </AlertDescription>
          <Button className="col-start-2 mt-md w-fit" disabled={!onRetry} onClick={onRetry} type="button">
            Try again
          </Button>
        </Alert>
      </CardContent>
    </Card>
  );
}
