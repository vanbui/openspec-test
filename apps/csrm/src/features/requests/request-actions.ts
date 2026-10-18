'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ConflictReason } from '@/lib/api/conflict-reasons';
import { refusalMessage, requestConflictMessage } from '@/lib/api/refusal-copy';
import {
  requestDraftSchema,
  requestSubmitSchema,
  requestUpdateSchema,
  requestRevertSchema,
  type RequestMutationResult,
} from './request-schema';
import { createRequest, revertRequestToDraft, submitRequest, updateRequest, type RequestRevertResult } from './request-service';
import { searchInformationAssets, searchInformationSystems } from './request-service';

export type RequestActionResult =
  | { ok: true; data: RequestMutationResult }
  | {
      ok: false;
      fieldErrors?: Record<string, string[] | undefined>;
      formError?: string;
      /** The closed-list rule a refused workflow action named; never Strapi's message (T-10-17). */
      reason?: ConflictReason;
    };

function validationFailure(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): RequestActionResult {
  return { ok: false, fieldErrors: error.flatten().fieldErrors };
}

/**
 * A request conflict (409) reads its family's sentence for a revert (UI-SPEC §10.2 A) and the §10.3 sentence
 * for a create, edit or submit, which also saves the request's fields. Other statuses keep their messages.
 */
function serviceFailure(error: { status?: number; reason?: ConflictReason }, operation: 'save' | 'revert' = 'save'): RequestActionResult {
  const { status, reason } = error;
  if (status === 400) {
    return { ok: false, formError: 'The request could not be saved. Check the fields and try again.' };
  }
  if (status === 403) {
    return { ok: false, formError: 'You do not have permission to save this request.' };
  }
  if (status === 404) {
    return { ok: false, formError: 'This request is no longer available.' };
  }
  if (status === 409) {
    if (operation === 'save') return { ok: false, formError: requestConflictMessage };
    return { ok: false, formError: refusalMessage('requestRevert', reason), ...(reason ? { reason } : {}) };
  }
  return { ok: false, formError: 'The request service is unavailable. Please try again later.' };
}

function revalidateRequestPages(documentId?: string): void {
  revalidatePath('/app');
  revalidatePath('/app/requests');
  if (documentId) revalidatePath(`/app/requests/${encodeURIComponent(documentId)}`);
}

function revalidateReversalPages(documentId: string): void {
  revalidateRequestPages(documentId);
  const encodedId = encodeURIComponent(documentId);
  revalidatePath('/app/review/requests');
  revalidatePath(`/app/review/requests/${encodedId}`);
  revalidatePath('/app/questionnaires');
  revalidatePath('/app/review/questionnaires');
}

export type RequestRevertActionResult = RequestActionResult | { ok: true; data: RequestRevertResult };
export type RequestRelationSearchActionResult =
  | { ok: true; data: readonly { documentId: string; name: string }[] }
  | { ok: false; formError: string };

async function relationSearchAction(
  search: (input: unknown) => ReturnType<typeof searchInformationSystems>,
  input: unknown,
): Promise<RequestRelationSearchActionResult> {
  const result = await search(input);
  return result.error === null
    ? { ok: true, data: result.data }
    : { ok: false, formError: result.error.status === 403 ? 'You do not have permission to search these records.' : 'The selection service is unavailable. Please try again later.' };
}

export async function searchInformationSystemsAction(input: unknown): Promise<RequestRelationSearchActionResult> {
  return relationSearchAction(searchInformationSystems, input);
}

export async function searchInformationAssetsAction(input: unknown): Promise<RequestRelationSearchActionResult> {
  return relationSearchAction(searchInformationAssets, input);
}

export async function revertRequestToDraftAction(input: unknown): Promise<RequestRevertActionResult> {
  const parsed = requestRevertSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const result = await revertRequestToDraft(parsed.data.documentId, parsed.data.reason);
  if (result.error !== null) return serviceFailure(result.error, 'revert');
  revalidateReversalPages(result.data.documentId);
  return { ok: true, data: result.data };
}

/**
 * How a save ends (14-UI-SPEC §2.2; D-26; UI-D3). Without options it revalidates the request pages and redirects to the
 * draft, as it always has. With `stayOnPage` the form is about to send its files to the draft: the action returns the
 * draft and neither revalidates nor redirects, because either would re-render the route for the address the form has
 * just replaced and unmount the queue (RESEARCH Pitfall 18). The form moves on itself once every file has settled. The
 * option only changes where the person goes next; Strapi authorises the save the same way either way.
 */
export type RequestSaveOptions = { stayOnPage?: boolean };

const staysOnPage = (options: unknown): boolean => typeof options === 'object' && options !== null && (options as RequestSaveOptions).stayOnPage === true;

export async function createRequestAction(input: unknown, options?: RequestSaveOptions): Promise<RequestActionResult> {
  const parsed = requestDraftSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const result = await createRequest(parsed.data);
  if (result.error !== null) return serviceFailure(result.error);
  if (staysOnPage(options)) return { ok: true, data: result.data };

  revalidateRequestPages();
  redirect(`/app/requests/${result.data.documentId}`);
}

export async function updateRequestAction(input: unknown, options?: RequestSaveOptions): Promise<RequestActionResult> {
  const parsed = requestUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { documentId, ...fields } = parsed.data;
  const result = await updateRequest(documentId, fields);
  if (result.error !== null) return serviceFailure(result.error);
  if (staysOnPage(options)) return { ok: true, data: result.data };

  revalidateRequestPages(result.data.documentId);
  redirect(`/app/requests/${result.data.documentId}`);
}

export async function submitRequestAction(input: unknown): Promise<RequestActionResult> {
  const parsed = requestSubmitSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { documentId, ...fields } = parsed.data;
  const result = await submitRequest(documentId, fields);
  if (result.error !== null) return serviceFailure(result.error);

  revalidateRequestPages(result.data.documentId);
  return { ok: true, data: result.data };
}
