import { cn } from "@/lib/utils";

const statusLabels = {
  draft: "Draft",
  submitted: "Submitted",
  "questionnaire-in-progress": "Questionnaire in progress",
  "risk-assessment-drafted": "Risk assessment drafted",
  "under-review": "Under review",
  approved: "Approved",
  closed: "Closed",
} as const;

const statusStyles: Readonly<Record<keyof typeof statusLabels, string>> = {
  draft: "border-info/30 bg-primary-soft text-info",
  submitted: "border-info/30 bg-primary-soft text-info",
  "questionnaire-in-progress": "border-warning/30 bg-warning/10 text-warning",
  "risk-assessment-drafted": "border-warning/30 bg-warning/10 text-warning",
  "under-review": "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  closed: "border-border-subtle bg-surface-muted text-muted-foreground",
};

export type RequestStatus = keyof typeof statusLabels;

export function requestStatusLabel(status: string): string {
  return statusLabels[status as RequestStatus] ?? status;
}

export function RequestStatusBadge({ status }: { status: string }) {
  const knownStatus = status as RequestStatus;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-sm py-xs text-label font-semibold",
        statusStyles[knownStatus] ?? "border-border-subtle bg-surface-muted text-muted-foreground",
      )}
    >
      {requestStatusLabel(status)}
    </span>
  );
}
