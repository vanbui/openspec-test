import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="text-heading-lg font-display">{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
