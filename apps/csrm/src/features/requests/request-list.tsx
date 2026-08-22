"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { RequestStatusBadge } from "./request-status-badge";

export const requestStatuses = [
  "draft",
  "submitted",
  "questionnaire-in-progress",
  "risk-assessment-drafted",
  "under-review",
  "approved",
  "closed",
] as const;

export const requestSortOptions = [
  { value: "updated-desc", label: "Updated: newest first" },
  { value: "updated-asc", label: "Updated: oldest first" },
  { value: "title-asc", label: "Title: A–Z" },
] as const;

export type RequestListSort = (typeof requestSortOptions)[number]["value"];
export type RequestListFilters = { q: string; status: string; sort: RequestListSort; page: number };
export type RequestListRecord = {
  documentId: string;
  requestNumber: string;
  title: string | null;
  requestStatus: string;
  assessmentType?: string | null;
  updatedAt?: string | null;
};

type RequestListProps = {
  filters: RequestListFilters;
  requests: readonly RequestListRecord[];
  total: number;
  pageSize?: number;
  canCreateRequest?: boolean;
  failed?: boolean;
};

function displayDate(value: string | null | undefined): string {
  if (!value) return "Not updated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not updated" : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function resultRange(total: number, page: number, pageSize: number, resultLength: number): string {
  if (total === 0) return "0 requests";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + resultLength - 1, total);
  return `${total === 1 ? "1 request" : `${total} requests`}. Showing ${start}–${end}.`;
}

function toHref(filters: RequestListFilters, pathname: string): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort !== "updated-desc") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function requestTitle(request: RequestListRecord): string {
  return request.title?.trim() || "Untitled request";
}

export function RequestList({ canCreateRequest = true, failed = false, filters, pageSize = 20, requests, total }: RequestListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [query, setQuery] = useState(filters.q);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function replace(next: RequestListFilters) {
    router.replace(toHref(next, pathname), { scroll: false });
    headingRef.current?.focus();
  }

  function update(next: Partial<RequestListFilters>, resetPage = true) {
    replace({ ...filters, ...next, page: resetPage ? 1 : next.page ?? filters.page });
  }

  function changeQuery(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update({ q: value.trim() }), 300);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(filters.q || filters.status || filters.sort !== "updated-desc" || filters.page !== 1);
  const activeSortColumn = filters.sort === "title-asc" ? "title" : "updated";

  return (
    <section className="mt-2xl min-w-0" aria-labelledby="request-results-heading">
      <div className="flex min-w-0 flex-col gap-lg sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 gap-md sm:grid-cols-3">
          <label className="grid gap-xs text-label font-semibold text-foreground">
            Search requests
            <input aria-label="Search requests" className="min-h-11 min-w-0 rounded-[var(--radius-card)] border border-border-subtle bg-card px-md text-body" onChange={(event) => changeQuery(event.target.value)} type="search" value={query} />
          </label>
          <label className="grid gap-xs text-label font-semibold text-foreground">
            Status
            <select aria-label="Status" className="min-h-11 rounded-[var(--radius-card)] border border-border-subtle bg-card px-md text-body" onChange={(event) => update({ status: event.target.value })} value={filters.status}>
              <option value="">All statuses</option>
              {requestStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}
            </select>
          </label>
          <label className="grid gap-xs text-label font-semibold text-foreground">
            Sort requests
            <select aria-label="Sort requests" className="min-h-11 rounded-[var(--radius-card)] border border-border-subtle bg-card px-md text-body" onChange={(event) => update({ sort: event.target.value as RequestListSort })} value={filters.sort}>
              {requestSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {canCreateRequest ? <Button asChild type="button"><Link href="/requests/new">New request</Link></Button> : null}
      </div>

      <h2 className="mt-xl text-heading font-semibold text-foreground" id="request-results-heading" ref={headingRef} tabIndex={-1}>Request results</h2>
      <p aria-live="polite" className="mt-xs text-body text-muted-foreground" role="status">{resultRange(total, filters.page, pageSize, requests.length)}</p>

      {failed ? (
        <Card className="mt-xl"><CardContent className="p-lg"><p role="alert">We couldn’t load this page. Check your connection and try again.</p><Button className="mt-md" onClick={() => router.refresh()} type="button">Try again</Button></CardContent></Card>
      ) : total === 0 ? (
        <Card className="mt-xl"><CardContent className="p-lg">
          <h3 className="text-heading font-semibold text-foreground">{filtered ? "No matching requests" : "No risk assessment requests yet"}</h3>
          <p className="mt-sm text-body text-muted-foreground">{filtered ? "Try changing your search or status filter." : "Start a request to provide the context needed for a cyber risk assessment."}</p>
          {filtered ? <Button className="mt-lg" onClick={() => replace({ page: 1, q: "", status: "", sort: "updated-desc" })} type="button" variant="secondary">Clear filters</Button> : canCreateRequest ? <Button asChild className="mt-lg"><Link href="/requests/new">New request</Link></Button> : null}
        </CardContent></Card>
      ) : (
        <>
          <div className="mt-xl hidden overflow-hidden rounded-[var(--radius-card)] border border-border-subtle md:block">
            <table aria-label="My risk assessment requests" className="w-full table-fixed text-left text-body">
              <thead className="bg-surface-muted text-label text-foreground"><tr>
                <th aria-sort={activeSortColumn === "title" ? "ascending" : undefined} className="w-[36%] p-md font-semibold" scope="col"><button onClick={() => update({ sort: "title-asc" })} type="button">Request</button></th>
                <th className="w-[17%] p-md font-semibold" scope="col">Status</th>
                <th className="w-[17%] p-md font-semibold" scope="col">Assessment type</th>
                <th aria-sort={activeSortColumn === "updated" ? filters.sort === "updated-desc" ? "descending" : "ascending" : undefined} className="w-[17%] p-md font-semibold" scope="col"><button onClick={() => update({ sort: filters.sort === "updated-desc" ? "updated-asc" : "updated-desc" })} type="button">Updated</button></th>
                <th className="w-[13%] p-md font-semibold" scope="col">Actions</th>
              </tr></thead>
              <tbody>{requests.map((request) => <tr className="border-t border-border-subtle" key={request.documentId}>
                <td className="p-md align-top"><Link aria-label={`View request ${request.requestNumber}`} className="line-clamp-2 font-semibold text-primary underline-offset-4 hover:underline" href={`/requests/${request.documentId}`} title={requestTitle(request)}>{requestTitle(request)}</Link><p className="mt-xs break-all text-label text-muted-foreground">{request.requestNumber}</p></td>
                <td className="p-md align-top"><RequestStatusBadge status={request.requestStatus} /></td>
                <td className="p-md align-top break-words">{request.assessmentType ?? "Not provided"}</td>
                <td className="p-md align-top break-words">{displayDate(request.updatedAt)}</td>
                <td className="p-md align-top"><Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/requests/${request.documentId}`}>View request</Link></td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul aria-label="My risk assessment requests" className="mt-xl grid gap-md md:hidden">{requests.map((request) => <li key={request.documentId}><Card><CardContent className="grid gap-md p-lg"><div className="min-w-0"><Link aria-label={`View request ${request.requestNumber}`} className="block break-words font-semibold text-primary underline-offset-4 hover:underline" href={`/requests/${request.documentId}`}>{requestTitle(request)}</Link><p className="mt-xs break-all text-label text-muted-foreground">{request.requestNumber}</p></div><RequestStatusBadge status={request.requestStatus} /><dl className="grid gap-sm text-body"><div><dt className="text-label font-semibold">Assessment type</dt><dd>{request.assessmentType ?? "Not provided"}</dd></div><div><dt className="text-label font-semibold">Updated</dt><dd>{displayDate(request.updatedAt)}</dd></div></dl><Link className="inline-flex min-h-11 items-center self-start font-semibold text-primary underline-offset-4 hover:underline" href={`/requests/${request.documentId}`}>View request</Link></CardContent></Card></li>)}</ul>
        </>
      )}

      {total > 0 ? <nav aria-label="Request pagination" className="mt-xl flex items-center justify-between gap-md"><Button disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 }, false)} type="button" variant="secondary">Previous page</Button><span aria-current="page" className="text-label font-semibold">Page {filters.page} of {pageCount}</span><Button disabled={filters.page >= pageCount} onClick={() => update({ page: filters.page + 1 }, false)} type="button" variant="secondary">Next page</Button></nav> : null}
    </section>
  );
}
