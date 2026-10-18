import { z } from 'zod';
import type { AiInputsChanged } from './ai-assistance-domain';

/*
 * D-23 and D-25: who generated a record through an AI provider, when, with which provider, and the run
 * behind the latest generation (null for one generated before run records existed), and which notes and files changed
 * its AI inputs since (D-29, Phase 14 D-36). Analyst reads only; the questionnaire header and the assessment detail
 * share it.
 */
/*
 * Phase 13 D-29 and Phase 14 D-36 (14-PLAN-CHECK iteration 2, S-1): the notes whose AI-input mark changed, and the files
 * whose inclusion changed, since a record was last generated, closed, so a note's or file's text or any other key fails
 * the read (G-3). One value: either list may be empty, never both. The analyst questionnaire and assessment reads carry it
 * in their generation facts, and the request read once per target.
 */
export const aiInputsChangedNoteSchema = z.object({
  documentId: z.string().min(1),
  part: z.enum(['requestor', 'security-analyst']),
  sequence: z.number().int().min(1),
  postedAt: z.iso.datetime({ offset: true }),
  change: z.enum(['marked', 'unmarked']),
}).strict();
export const aiInputsChangedFileSchema = z.object({
  documentId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  change: z.enum(['included', 'excluded', 'removed']),
}).strict();
export const aiInputsChangedSchema = z.object({
  count: z.number().int().min(1),
  notes: z.array(aiInputsChangedNoteSchema).max(500),
  files: z.array(aiInputsChangedFileSchema).max(500),
}).strict().refine((signal) => signal.notes.length + signal.files.length > 0, { message: 'An AI-inputs signal lists at least one changed input.' });

/** True only when two types are mutually assignable. */
type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const signalParserMatchesTheDomainType = true satisfies SameType<z.infer<typeof aiInputsChangedSchema>, AiInputsChanged>;
void signalParserMatchesTheDomainType;

export const aiGenerationFactsSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }).nullable(),
  generatedBy: z.object({ documentId: z.string().trim().min(1).max(255), displayName: z.string().max(255) }).strict().nullable(),
  providerName: z.string().max(255).nullable(),
  providerVersion: z.string().max(255).nullable(),
  runId: z.string().trim().min(1).max(255).nullable(),
  aiInputsChanged: aiInputsChangedSchema.nullable(),
  // Phase 15 D-28, D-32: questionnaire reads only; null for a requesting analyst.
  openProposals: z.number().int().min(0).nullable().optional(),
}).strict();
export type AiGenerationFacts = z.infer<typeof aiGenerationFactsSchema>;
