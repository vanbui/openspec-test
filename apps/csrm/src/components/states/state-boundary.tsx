import type { ReactNode } from 'react';

import type { SafeApiError } from '@/domain/service-result';

import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';

export interface StateBoundaryProps {
  status: 'loading' | 'error' | 'empty' | 'ready';
  error?: SafeApiError;
  onRetry?: () => void;
  children: ReactNode;
}

export function StateBoundary({ children, error, onRetry, status }: StateBoundaryProps) {
  switch (status) {
    case 'loading':
      return <LoadingState />;
    case 'error':
      return <ErrorState error={error} onRetry={onRetry} />;
    case 'empty':
      return <EmptyState />;
    case 'ready':
      return (
        <section aria-label="CSRM content" className="min-w-0 overflow-x-auto" data-slot="state-boundary">
          {children}
        </section>
      );
  }
}
