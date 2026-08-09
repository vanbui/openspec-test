import type { ReactNode } from "react";

import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
}: {
  title: string;
  description?: string;
  breadcrumbs?: readonly BreadcrumbItem[];
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex min-w-0 items-start justify-between gap-lg">
        <div className="min-w-0">
          <h1 className="text-display font-semibold text-foreground">{title}</h1>
          {description ? (
            <p className="mt-md max-w-2xl text-body text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
