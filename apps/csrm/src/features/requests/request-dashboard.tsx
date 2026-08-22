"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { RequestStatusBadge, requestStatusLabel } from "./request-status-badge";

type DashboardRequest = {
  documentId: string;
  requestNumber: string;
  title: string | null;
  requestStatus: string;
  submittedDate?: string | null;
};

export type RequestDashboardModel = {
  statusCounts: Record<string, number>;
  needsAttention: readonly DashboardRequest[];
  recentSubmissions: readonly DashboardRequest[];
  notices: readonly { message: string; documentId: string }[];
};

type RequestDashboardProps = {
  dashboard: RequestDashboardModel;
  failedWidgets?: readonly ("attention" | "recent" | "status" | "notifications")[];
  loading?: boolean;
};

function requestTitle(request: DashboardRequest): string {
  return request.title?.trim() || "Untitled request";
}

function submittedDate(value: string | null | undefined): string {
  if (!value) return "Submission date not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Submission date not available" : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function nextStep(status: string): string {
  const copy: Record<string, string> = {
    draft: "Continue editing before you submit this request.",
    submitted: "Awaiting Security Analyst review.",
    "questionnaire-in-progress": "A questionnaire is being prepared.",
    "risk-assessment-drafted": "A risk assessment draft is being prepared.",
    "under-review": "A Security Analyst is reviewing this request.",
    approved: "This request has been approved.",
    closed: "This request is closed.",
  };
  return copy[status] ?? "Review this request for the next step.";
}

function DashboardCard({ children, className = "", title }: { children: React.ReactNode; className?: string; title: string }) {
  return <section className={className}><Card className="h-full"><CardHeader><h2 className="text-heading font-semibold text-foreground">{title}</h2></CardHeader><CardContent className="pt-0">{children}</CardContent></Card></section>;
}

function WidgetError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert"><p className="text-body text-destructive">We couldn’t load this widget.</p><Button className="mt-md" onClick={onRetry} type="button" variant="secondary">Try again</Button></div>;
}

function RequestRows({ requests, recent = false }: { requests: readonly DashboardRequest[]; recent?: boolean }) {
  return <ul className="grid gap-md" aria-label={recent ? "Recently submitted requests" : "Requests needing your attention"}>{requests.map((request) => <li className="min-w-0 border-t border-border-subtle pt-md first:border-t-0 first:pt-0" key={request.documentId}><Link aria-label={`${requestTitle(request)} ${request.requestNumber}`} className="block break-words font-semibold text-primary underline-offset-4 hover:underline" href={`/requests/${request.documentId}`}>{requestTitle(request)}</Link><p className="mt-xs break-all text-label text-muted-foreground">{request.requestNumber}</p><div className="mt-sm flex flex-wrap items-center gap-sm"><RequestStatusBadge status={request.requestStatus} />{recent ? <span className="text-label text-muted-foreground">Submitted {submittedDate(request.submittedDate)}</span> : <span className="text-label text-muted-foreground">{nextStep(request.requestStatus)}</span>}</div></li>)}</ul>;
}

function DashboardSkeleton() {
  return <div aria-hidden="true" className="grid grid-cols-1 gap-lg md:grid-cols-2 xl:grid-cols-3"><Card className="md:col-span-2 xl:col-span-3"><CardContent className="grid gap-md p-lg"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></CardContent></Card>{Array.from({ length: 3 }, (_, index) => <Card key={index}><CardContent className="grid gap-md p-lg"><Skeleton className="h-6 w-40" /><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>;
}

export function RequestDashboard({ dashboard, failedWidgets = [], loading = false }: RequestDashboardProps) {
  const router = useRouter();
  const failed = new Set(failedWidgets);
  if (loading) return <><p className="sr-only" role="status">Loading dashboard.</p><DashboardSkeleton /></>;

  return (
    <div className="mt-2xl grid min-w-0 grid-cols-1 gap-lg md:grid-cols-2 xl:grid-cols-3" data-dashboard-grid>
      <DashboardCard className="md:col-span-2 xl:col-span-3" title="Needs your attention">
        {failed.has("attention") ? <WidgetError onRetry={() => router.refresh()} /> : dashboard.needsAttention.length > 0 ? <RequestRows requests={dashboard.needsAttention} /> : <p className="text-body text-muted-foreground">You have no requests requiring action.</p>}
      </DashboardCard>
      <DashboardCard title="Recently submitted">
        {failed.has("recent") ? <WidgetError onRetry={() => router.refresh()} /> : dashboard.recentSubmissions.length > 0 ? <RequestRows recent requests={dashboard.recentSubmissions} /> : <p className="text-body text-muted-foreground">You have not submitted any requests yet.</p>}
      </DashboardCard>
      <DashboardCard title="Request status">
        {failed.has("status") ? <WidgetError onRetry={() => router.refresh()} /> : <ul className="grid gap-sm" aria-label="Request status summary">{Object.entries(dashboard.statusCounts).map(([status, count]) => { const label = requestStatusLabel(status); const requestLabel = count === 1 ? "request" : "requests"; return <li key={status}><Link aria-label={`${count} ${label} ${requestLabel}`} className="flex min-h-11 items-center justify-between gap-md rounded-[var(--radius-card)] border border-border-subtle px-md text-body hover:bg-surface-muted" href={`/requests?status=${encodeURIComponent(status)}`}><span className="min-w-0 break-words">{label}</span><span className="shrink-0 font-semibold">{count}</span></Link></li>; })}</ul>}
      </DashboardCard>
      <DashboardCard title="Notifications">
        {failed.has("notifications") ? <WidgetError onRetry={() => router.refresh()} /> : dashboard.notices.length > 0 ? <ul className="grid gap-sm" aria-label="Request notifications">{dashboard.notices.map((notice) => <li className="break-words text-body" key={notice.documentId}><Link className="text-primary underline-offset-4 hover:underline" href={`/requests/${notice.documentId}`}>{notice.message}</Link></li>)}</ul> : <p className="text-body text-muted-foreground">No new notifications.</p>}
      </DashboardCard>
    </div>
  );
}
