"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RequestFormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border-subtle pt-xl first:border-t-0 first:pt-0", className)}>
      <h2 className="text-heading font-semibold text-foreground">{title}</h2>
      <div className="mt-lg space-y-lg">{children}</div>
    </section>
  );
}

export function RequestFormField({
  id,
  label,
  error,
  helper,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  helper?: string;
  children: ReactNode;
}) {
  const describedBy = [helper ? `${id}-helper` : undefined, error ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0 space-y-xs">
      <label className="block text-label font-semibold text-foreground" htmlFor={id}>
        {label}
      </label>
      {helper ? <p className="text-label text-muted-foreground" id={`${id}-helper`}>{helper}</p> : null}
      <div data-describedby={describedBy}>{children}</div>
      {error ? <p className="text-label font-medium text-destructive" id={`${id}-error`}>{error} Required</p> : null}
    </div>
  );
}

export function RequestConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmVariant = "primary",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "destructive";
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border-subtle bg-surface p-xl shadow-[var(--shadow-floating)] focus:outline-none">
          <DialogPrimitive.Title className="text-heading font-semibold text-foreground">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-sm text-body text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
          <div className="mt-xl flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button autoFocus type="button" variant="secondary">
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>
            <Button disabled={pending} onClick={onConfirm} type="button" variant={confirmVariant}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
