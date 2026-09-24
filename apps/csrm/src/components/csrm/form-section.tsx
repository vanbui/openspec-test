import { useId, type ReactNode } from 'react';

import { Separator } from '@/components/ui/separator';

export interface FormSectionProps {
  title: string;
  description?: string;
  headingId?: string;
  children: ReactNode;
}

export function FormSection({ title, description, headingId, children }: FormSectionProps) {
  const generatedId = useId();
  const resolvedHeadingId = headingId ?? `${generatedId}-heading`;
  const descriptionId = description ? `${resolvedHeadingId}-description` : undefined;

  return (
    <section
      aria-describedby={descriptionId}
      aria-labelledby={resolvedHeadingId}
      className="grid w-full max-w-2xl grid-cols-1 gap-6"
      role="group"
    >
      <div className="grid grid-cols-1 gap-2">
        <h2 className="text-heading-sm text-foreground" id={resolvedHeadingId}>
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground" id={descriptionId}>
            {description}
          </p>
        ) : null}
      </div>
      <Separator />
      <div className="grid grid-cols-1 gap-6">{children}</div>
    </section>
  );
}
