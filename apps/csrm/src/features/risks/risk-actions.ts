'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { AssessmentServerActionResult } from '../assessments/assessment-actions';
import {
  createControlImplementation,
  deleteControlImplementation,
  updateControlImplementation,
  updateRisk,
} from '../assessments/assessment-service';
import {
  controlImplementationCreateInputSchema,
  controlImplementationUpdateInputSchema,
  documentIdSchema,
  riskUpdateInputSchema,
  type ControlImplementation,
  type Risk,
} from '../assessments/assessment-schema';
import { getRiskDetail, listRiskRegisterAssessments, searchRiskRegisterAssets, searchRiskRegisterOwners, searchRiskRegisterSystems } from './risk-service';
import type { RiskDetail, RiskPickerOption } from './risk-schema';

type RiskConflictResult =
  | {
      ok: false;
      conflict: true;
      authoritativeDetail: RiskDetail;
      formError: string;
    }
  | {
      ok: false;
      conflict: true;
      notAvailable: true;
      formError: string;
    };

export type RiskDetailServerActionResult<T> = AssessmentServerActionResult<T> | RiskConflictResult;

const nonEmptyRiskUpdateSchema = riskUpdateInputSchema.refine(
  (values) => Object.keys(values).length > 0,
  { message: 'Submit at least one changed Risk field.' },
);
const nonEmptyControlUpdateSchema = controlImplementationUpdateInputSchema.refine(
  (values) => Object.keys(values).length > 0,
  { message: 'Submit at least one changed mitigation-control field.' },
);
const updateRiskDetailInputSchema = z.object({
  riskId: documentIdSchema,
  values: nonEmptyRiskUpdateSchema,
}).strict();
const createMitigationControlInputSchema = z.object({
  riskId: documentIdSchema,
  values: controlImplementationCreateInputSchema,
}).strict();
const updateMitigationControlInputSchema = z.object({
  riskId: documentIdSchema,
  implementationId: documentIdSchema,
  values: nonEmptyControlUpdateSchema,
}).strict();
const deleteMitigationControlInputSchema = z.object({
  riskId: documentIdSchema,
  implementationId: documentIdSchema,
}).strict();
const relationSearchSchema = z.object({
  kind: z.enum(['owners', 'assessments', 'systems', 'assets']),
  search: z.string().trim().min(1).max(100),
}).strict();

export type RiskRelationSearchResult = { ok: true; data: readonly RiskPickerOption[] } | { ok: false; formError: string };

export async function searchRiskRegisterRelationsAction(input: unknown): Promise<RiskRelationSearchResult> {
  const parsed = relationSearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, formError: 'Enter a valid relation search.' };
  const { kind, search } = parsed.data;
  const result = kind === 'owners' ? await searchRiskRegisterOwners(search)
    : kind === 'assessments' ? await listRiskRegisterAssessments()
      : kind === 'systems' ? await searchRiskRegisterSystems(search)
        : await searchRiskRegisterAssets(search);
  if (result.error) return { ok: false, formError: 'Relation search is unavailable. Try again.' };
  const needle = search.toLocaleLowerCase('en-AU');
  return { ok: true, data: result.data.filter((option) => option.label.toLocaleLowerCase('en-AU').includes(needle)).slice(0, 20) };
}

function submittedValues(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
  const values = (input as { values?: unknown }).values;
  return typeof values === 'object' && values !== null && !Array.isArray(values)
    ? values as Record<string, unknown>
    : undefined;
}

function validationFailure(error: z.ZodError, input: unknown): AssessmentServerActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path[0] === 'values' ? issue.path.slice(1) : issue.path;
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fieldErrors[key] = [...(fieldErrors[key] ?? []), `Unrecognized field: ${key}`];
    } else if (path.length > 0) {
      const key = path.join('.');
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
  }
  const values = submittedValues(input);
  return {
    ok: false,
    ...(values ? { values } : {}),
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    formError: 'Check the Risk details and try again.',
  };
}

function serviceFailure(status: number | undefined, values?: Record<string, unknown>): AssessmentServerActionResult<never> {
  let formError: string;
  if (status === 400) formError = 'The submitted Risk data is invalid. Check the fields and try again.';
  else if (status === 403) formError = 'You do not have permission to change this Risk.';
  else if (status === 404) formError = 'This Risk is no longer available.';
  else formError = 'The Risk service is unavailable. Please try again later.';
  return { ok: false, ...(values ? { values } : {}), formError };
}

function revalidateRiskPages(riskId: string): void {
  revalidatePath('/app/risks');
  revalidatePath(`/app/risks/${encodeURIComponent(riskId)}`);
}

async function refreshRiskDetail(riskId: string): Promise<RiskConflictResult> {
  const refreshed = await getRiskDetail(riskId);
  if (refreshed.error) {
    return {
      ok: false,
      conflict: true,
      notAvailable: true,
      formError: 'This Risk is no longer available.',
    };
  }
  return {
    ok: false,
    conflict: true,
    authoritativeDetail: refreshed.data,
    formError: 'This Risk changed. Your edits were not saved.',
  };
}

export async function updateRiskDetailAction(input: unknown): Promise<RiskDetailServerActionResult<Risk>> {
  const parsed = updateRiskDetailInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateRisk(parsed.data.riskId, parsed.data.values);
  if (result.error?.status === 409) return refreshRiskDetail(parsed.data.riskId);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateRiskPages(parsed.data.riskId);
  return { ok: true, data: result.data };
}

export async function createMitigationControlAction(input: unknown): Promise<RiskDetailServerActionResult<ControlImplementation>> {
  const parsed = createMitigationControlInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await createControlImplementation(parsed.data.riskId, parsed.data.values);
  if (result.error?.status === 409) return refreshRiskDetail(parsed.data.riskId);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateRiskPages(parsed.data.riskId);
  return { ok: true, data: result.data };
}

export async function updateMitigationControlAction(input: unknown): Promise<RiskDetailServerActionResult<ControlImplementation>> {
  const parsed = updateMitigationControlInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateControlImplementation(parsed.data.implementationId, parsed.data.values);
  if (result.error?.status === 409) return refreshRiskDetail(parsed.data.riskId);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateRiskPages(parsed.data.riskId);
  return { ok: true, data: result.data };
}

export async function deleteMitigationControlAction(input: unknown): Promise<RiskDetailServerActionResult<void>> {
  const parsed = deleteMitigationControlInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await deleteControlImplementation(parsed.data.implementationId);
  if (result.error?.status === 409) return refreshRiskDetail(parsed.data.riskId);
  if (result.error) return serviceFailure(result.error.status);
  revalidateRiskPages(parsed.data.riskId);
  return { ok: true, data: undefined };
}
