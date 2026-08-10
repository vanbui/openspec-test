import Link from "next/link";

export interface BreadcrumbItem {
  href?: string;
  label: string;
}

export function Breadcrumbs({ items }: { items?: readonly BreadcrumbItem[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-lg">
      <ol className="flex min-w-0 items-center gap-sm text-label font-semibold text-muted-foreground">
        {items.map((item, index) => (
          <li className="flex min-w-0 items-center gap-sm" key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link className="truncate" href={item.href} title={item.label}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate" title={item.label}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
