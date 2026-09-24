import { z } from 'zod';

/*
 * The one web declaration of the reversal-reason contract, shared by the request
 * and questionnaire reversal paths. Strapi enforces the same trimmed 1-500
 * character rule and stays authoritative; this exists so both aggregates present
 * the same limit and the same wording to the person typing the reason.
 */
export const REVERT_REASON_MAX_LENGTH = 500;

export const revertReasonSchema = z
  .string()
  .trim()
  .min(1, 'Enter a reason for reverting this record.')
  .max(REVERT_REASON_MAX_LENGTH, `Reason must be ${REVERT_REASON_MAX_LENGTH} characters or fewer.`);
