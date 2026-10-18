import { z } from 'zod';
import type { RequestAttachmentSummary } from '@/features/requests/request-domain';
import { ATTACHMENT_DETECTION_PATTERN } from '@/lib/api/conflict-reasons';

/*
 * The closed parsers of the request attachments contract (Phase 14 D-03, D-04): exactly `RequestAttachmentListResponse`
 * and `RequestAttachmentResponse`, and the inputs the service checks before it calls Strapi. Each bound is the
 * contract's own. A person mirrors `ActiveUserSummary`, which declares no bound, so the person parser declares none.
 */

export const attachmentTypes = ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'] as const;
export const attachmentStates = ['available', 'pending', 'blocked', 'removed', 'unavailable'] as const;
export const attachmentParts = ['requestor', 'security-analyst'] as const;
export const attachmentWindows = ['intake', 'after-submission', 'closed'] as const;
export const attachmentAddRefusals = [
  'ATTACHMENTS_NOT_CONFIGURED',
  'ATTACHMENTS_CLOSED',
  'REQUEST_NOT_SUBMITTED',
  'ATTACHMENT_LIMIT_REACHED',
  'ATTACHMENT_LIFETIME_LIMIT_REACHED',
] as const;

/** The most files one list carries (`RequestAttachmentListResponse.data`, maxItems 60). */
export const attachmentsListMax = 60;
/** The largest file the contract admits (`RequestAttachment.byteSize`, maximum 26,214,400). */
export const attachmentMaxBytes = 26_214_400;

export const attachmentPersonSchema = z.object({ documentId: z.string(), displayName: z.string() }).strict();

/** Why a file's text can never be included: an image carries no text the AI can read, a quarantined file is never read. */
export const attachmentAiUnavailableReasons = ['ATTACHMENT_NOT_TEXT_BEARING', 'ATTACHMENT_QUARANTINED'] as const;
/** The characters kept per included file (`RequestAttachmentAiFacts.kept`, maximum 20,000; D-33). */
export const attachmentAiTextCap = 20_000;

/** The size of an included file's stored text (`RequestAttachmentAiFacts`): never the text itself. */
export const requestAttachmentAiFactsSchema = z.object({
  available: z.number().int().min(1),
  kept: z.number().int().min(1).max(attachmentAiTextCap),
  truncated: z.boolean(),
}).strict();

/** A file's AI inclusion (`RequestAttachmentAi`), served to a human Security Analyst only (D-28, D-30). */
export const requestAttachmentAiSchema = z.object({
  included: z.boolean(),
  facts: requestAttachmentAiFactsSchema.nullable(),
  unavailableReason: z.enum(attachmentAiUnavailableReasons).nullable(),
  canChange: z.boolean(),
}).strict();

export const requestAttachmentSchema = z.object({
  documentId: z.string(),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(attachmentTypes),
  byteSize: z.number().int().min(1).max(attachmentMaxBytes),
  state: z.enum(attachmentStates),
  uploadedBy: attachmentPersonSchema.nullable(),
  uploaderPart: z.enum(attachmentParts),
  uploadedAt: z.iso.datetime({ offset: true }),
  note: z.object({ documentId: z.string(), postedAt: z.iso.datetime({ offset: true }) }).strict().nullable(),
  removedBy: attachmentPersonSchema.nullable(),
  removedAt: z.iso.datetime({ offset: true }).nullable(),
  /* The contract's one detection pattern (the stage B amendment, contract item 4; WR-501, IN-704). */
  detection: z.string().max(128).regex(ATTACHMENT_DETECTION_PATTERN).nullable(),
  actions: z.object({ download: z.boolean(), remove: z.boolean(), restore: z.boolean() }).strict(),
  /** Absent for a Requestor: only a human Security Analyst is served a file's AI facts. */
  ai: requestAttachmentAiSchema.optional(),
}).strict();

export const requestAttachmentAddFactsSchema = z.object({
  canAdd: z.boolean(),
  refusal: z.enum(attachmentAddRefusals).nullable(),
  window: z.enum(attachmentWindows),
  needsNote: z.boolean(),
  remaining: z.number().int().min(0).max(20),
  activeCount: z.number().int().min(0),
  storedCount: z.number().int().min(0),
  limits: z.object({
    maxBytes: z.number().int().min(1),
    maxActive: z.number().int().min(1),
    maxStored: z.number().int().min(1),
  }).strict(),
  allowedTypes: z.array(z.enum(attachmentTypes)).max(attachmentTypes.length),
}).strict();

/**
 * The request read's file summary (`RequestAttachmentSummary`, D-04 item 7): the count of files not removed, then the
 * add facts. Closed, so nothing of the files themselves can cross on the request read.
 */
export const requestAttachmentSummarySchema = z.object({
  count: z.number().int().min(0).max(attachmentsListMax),
  ...requestAttachmentAddFactsSchema.shape,
}).strict();

/*
 * IN-505: the domain type `RequestAttachmentSummary` (request-domain.ts) is written by hand, so the compiler holds it to
 * this parser, as request-summary-schema.ts holds `RequestSummaryFiles` to its own: a contract change that updates one
 * and not the other fails the build. The parser's array is compared read-only, as the domain type declares it.
 */
type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type ParsedAttachmentSummary = z.output<typeof requestAttachmentSummarySchema>;
type ReadonlyParsedAttachmentSummary = Omit<ParsedAttachmentSummary, 'allowedTypes'> & { allowedTypes: readonly ParsedAttachmentSummary['allowedTypes'][number][] };
const summaryParserMatchesTheDomainType = true satisfies SameType<ReadonlyParsedAttachmentSummary, RequestAttachmentSummary>;
void summaryParserMatchesTheDomainType;

export const dataClassifications = ['Public', 'Internal', 'Restricted', 'Critical Infrastructure Sensitive'] as const;
export const attachmentAiPolicyRefusals = [
  'OWN_REQUEST',
  'REQUEST_NOT_SUBMITTED',
  'ATTACHMENTS_CLOSED',
  'AI_CLASSIFICATION_ABOVE_CEILING',
  'AI_POLICY_NOT_CONFIGURED',
] as const;

/** The section's AI policy (`RequestAttachmentAiPolicy`), served to a human Security Analyst only (D-28, D-30). */
export const requestAttachmentAiPolicySchema = z.object({
  canChange: z.boolean(),
  refusal: z.enum(attachmentAiPolicyRefusals).nullable(),
  classification: z.enum(dataClassifications),
  ceiling: z.enum(dataClassifications).nullable(),
}).strict();

export const requestAttachmentListMetaSchema = z.object({
  total: z.number().int().min(0),
  removed: z.number().int().min(0),
  add: requestAttachmentAddFactsSchema,
  /** Absent for a Requestor: only a human Security Analyst is served the section's AI policy. */
  aiPolicy: requestAttachmentAiPolicySchema.optional(),
}).strict();

export const requestAttachmentListResponseSchema = z.object({
  data: z.array(requestAttachmentSchema).max(attachmentsListMax),
  meta: requestAttachmentListMetaSchema,
}).strict();

export const requestAttachmentResponseSchema = z.object({ data: requestAttachmentSchema }).strict();

/** The preview (`RequestAttachmentAiTextResponse`, D-31): the stored text exactly as the AI would read it, with its facts. */
export const requestAttachmentAiTextResponseSchema = z.object({
  data: z.object({
    text: z.string().min(1).max(attachmentAiTextCap),
    facts: z.object({
      available: z.number().int().min(1),
      kept: z.number().int().min(1).max(attachmentAiTextCap),
      truncated: z.boolean(),
      extractor: z.string().min(1).max(255),
      extractedAt: z.iso.datetime({ offset: true }),
    }).strict(),
  }).strict(),
}).strict();

export type RequestAttachment = z.output<typeof requestAttachmentSchema>;
export type RequestAttachmentListMeta = z.output<typeof requestAttachmentListMetaSchema>;
export type RequestAttachmentAddFacts = z.output<typeof requestAttachmentAddFactsSchema>;
export type RequestAttachmentAi = z.output<typeof requestAttachmentAiSchema>;
export type RequestAttachmentAiPolicy = z.output<typeof requestAttachmentAiPolicySchema>;
export type RequestAttachmentAiText = z.output<typeof requestAttachmentAiTextResponseSchema>['data'];
export type RequestAttachmentsPage = { attachments: RequestAttachment[]; meta: RequestAttachmentListMeta };

const requestId = z.string().min(1).max(255);

/** The list's input: the request. */
export const listAttachmentsInputSchema = z.object({ requestId }).strict();

/** The upload's input: the request, one file, and after submission the caller's note (`RequestAttachmentUploadRequest`). */
export const uploadAttachmentInputSchema = z.object({
  requestId,
  file: z.instanceof(File),
  noteId: z.string().min(1).max(255).optional(),
}).strict();

const attachmentId = z.string().min(1).max(255);

/**
 * The download's input: the request and the file. What the bytes must be is what Strapi serves for the record (its name
 * and type), never a type the caller names (IN-402).
 */
export const downloadAttachmentInputSchema = z.object({ requestId, attachmentId }).strict();

/** The removal's input: the request, the file, and whether to remove (true) or restore (false) it. */
export const attachmentRemovalInputSchema = z.object({ requestId, attachmentId, removed: z.boolean() }).strict();

/** The removal's body, exactly `RequestAttachmentRemovalRequest`: the only key the removal accepts (D-20). */
export const attachmentRemovalRequestSchema = z.object({ data: z.object({ removed: z.boolean() }).strict() }).strict();

/** The AI inclusion's input: the request, the file, and whether to include (true) or exclude (false) its text. */
export const attachmentAiInputInputSchema = z.object({ requestId, attachmentId, included: z.boolean() }).strict();

/** The AI inclusion's body, exactly `RequestAttachmentAiInputRequest`: the only key the inclusion accepts (D-30). */
export const attachmentAiInputRequestSchema = z.object({ data: z.object({ included: z.boolean() }).strict() }).strict();

/** The preview's input: the request and the file. */
export const attachmentAiTextInputSchema = z.object({ requestId, attachmentId }).strict();
