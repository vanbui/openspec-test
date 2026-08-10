import type { ReactNode } from 'react';

interface OptionalValueProps {
  value: ReactNode;
}

export function OptionalValue({ value }: OptionalValueProps) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">Not provided</span>;
  }

  return <>{typeof value === 'boolean' ? String(value) : value}</>;
}
