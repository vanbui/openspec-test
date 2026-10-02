import { useId, type ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export interface DetailSectionProps {
  title: string;
  description?: string;
  headingId?: string;
  /** Makes the heading an in-page link destination, so following a link to it moves focus there (UI-D27). */
  headingFocusable?: boolean;
  children: ReactNode;
}

export function DetailSection({ title, description, headingId, headingFocusable = false, children }: DetailSectionProps) {
  const generatedId = useId();
  const resolvedHeadingId = headingId ?? `${generatedId}-heading`;
  const descriptionId = description ? `${resolvedHeadingId}-description` : undefined;

  return (
    <section
      aria-describedby={descriptionId}
      aria-labelledby={resolvedHeadingId}
      className="w-full"
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-heading-md" id={resolvedHeadingId} tabIndex={headingFocusable ? -1 : undefined}>{title}</h2>
          </CardTitle>
          {description ? <CardDescription id={descriptionId}>{description}</CardDescription> : null}
        </CardHeader>
        <Separator />
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
