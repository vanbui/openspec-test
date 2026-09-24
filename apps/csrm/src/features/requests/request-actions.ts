'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
  | { ok: false; fieldErrors?: Record<string, string[] | undefined>; formError?: string };

function validationFailure(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): RequestActionResult {
  return { ok: false, fieldErrors: error.flatten().fieldErrors };
}

function serviceFailure(status?: number): RequestActionResult {
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
    return { ok: false, formError: 'This request changed while you were editing it. Reload and try again.' };
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
  if (result.error !== null) return serviceFailure(result.error.status);
  revalidateReversalPages(result.data.documentId);
  return { ok: true, data: result.data };
}

export async function createRequestAction(input: unknown): Promise<RequestActionResult> {
  const parsed = requestDraftSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const result = await createRequest(parsed.data);
  if (result.error !== null) return serviceFailure(result.error.status);

  revalidateRequestPages();
  redirect(`/app/requests/${result.data.documentId}`);
}

export async function updateRequestAction(input: unknown): Promise<RequestActionResult> {
  const parsed = requestUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { documentId, ...fields } = parsed.data;
  const result = await updateRequest(documentId, fields);
  if (result.error !== null) return serviceFailure(result.error.status);

  revalidateRequestPages(result.data.documentId);
  redirect(`/app/requests/${result.data.documentId}`);
}

export async function submitRequestAction(input: unknown): Promise<RequestActionResult> {
  const parsed = requestSubmitSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { documentId, ...fields } = parsed.data;
  const result = await submitRequest(documentId, fields);
  if (result.error !== null) return serviceFailure(result.error.status);

  revalidateRequestPages(result.data.documentId);
  return { ok: true, data: result.data };
}
