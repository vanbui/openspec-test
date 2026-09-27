import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description: string;
  /** Controls beside the title: links and buttons. They are interaction-only, so they do not print. */
  action?: ReactNode;
  /** Facts beside the title, such as a status badge or ratings. They are content, so they print. */
  status?: ReactNode;
}

/*
 * The controls' wrapper is display: contents, so on screen the control stays the header's flex
 * item exactly as before, and in print the marker removes it (direction section 4 Print, X-4).
 * Below 768px the header stacks and `.page-header-actions > *` spans it (section 4 Page header).
 */
export function PageHeader({ title, description, action, status }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="text-heading-lg font-display">{title}</h1>
        <p>{description}</p>
      </div>
      {status}
      {action ? <div className="page-header-actions contents" data-print="hidden">{action}</div> : null}
    </div>
  );
}
