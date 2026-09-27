import { z } from 'zod';

import type { components } from '../../lib/api/generated/schema';
import { riskRegisterRatings } from '../risks/risk-schema';

type Schemas = components['schemas'];

/** True only when two unions hold exactly the same members. */
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/*
 * The alert vocabularies (D-10, D-11). The server derives every alert and every
 * value below; the client renders what it is given and never re-derives a kind,
 * an urgency or a date. Each tuple is checked against its published union in
 * both directions, so a contract change fails the typecheck until it is mirrored.
 * The identifier bounds below (documentIds and the source identifier: min(1)
 * and max(255); the alert id: min(1) and max(512)) mirror the minLength and
 * maxLength the contract declares on AlertSource, AlertLink and AlertItem, so
 * they narrow nothing; the max(65_535) cap on the free-text source title is
 * the one client narrowing, registered beside each parser that reads alert
 * rows (alert-service.ts, report-service.ts).
 */
export const alertKinds = [
  'risk-treatment-overdue',
  'risk-treatment-due-soon',
  'request-overdue',
  'request-due-soon',
  'control-implementation-overdue',
  'assessment-review-due',
  'critical-residual-risk-untreated',
  'ineffective-control',
] as const satisfies readonly Schemas['AlertKind'][];
export type AlertKind = (typeof alertKinds)[number];

export const alertUrgencies = ['overdue', 'due-soon', 'attention'] as const satisfies readonly Schemas['AlertUrgency'][];
export type AlertUrgency = (typeof alertUrgencies)[number];

export const alertSourceTypes = [
  'risk',
  'assessment-request',
  'assessment',
  'control-implementation',
] as const satisfies readonly Schemas['AlertSourceType'][];
export type AlertSourceType = (typeof alertSourceTypes)[number];

/** A Control Implementation alert links to its parent Risk, so there is no Control Implementation link. */
export const alertLinkTypes = ['risk', 'assessment-request', 'assessment'] as const satisfies readonly Schemas['AlertLinkType'][];
export type AlertLinkType = (typeof alertLinkTypes)[number];

/** The page sizes the alert operation accepts. */
export const alertPageSizes = [5, 10, 25, 50] as const satisfies readonly Schemas['AlertPagination']['pageSize'][];
export type AlertPageSize = (typeof alertPageSizes)[number];

const alertVocabulariesMatchTheContract = {
  kinds: true satisfies SameUnion<AlertKind, Schemas['AlertKind']>,
  urgencies: true satisfies SameUnion<AlertUrgency, Schemas['AlertUrgency']>,
  sourceTypes: true satisfies SameUnion<AlertSourceType, Schemas['AlertSourceType']>,
  linkTypes: true satisfies SameUnion<AlertLinkType, Schemas['AlertLinkType']>,
  pageSizes: true satisfies SameUnion<AlertPageSize, Schemas['AlertPagination']['pageSize']>,
} as const;
void alertVocabulariesMatchTheContract;

const MAX_ALERT_PAGE = 1_000_000;
const documentIdSchema = z.string().min(1).max(255);
const countSchema = z.number().int().nonnegative();
const pageSizeSchema = z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]);

const alertSourceSchema = z.object({
  type: z.enum(alertSourceTypes),
  documentId: documentIdSchema,
  identifier: z.string().min(1).max(255),
  title: z.string().max(65_535).nullable(),
  released: z.boolean(),
}).strict();

const alertLinkSchema = z.object({
  type: z.enum(alertLinkTypes),
  documentId: documentIdSchema,
}).strict();

export const alertItemSchema = z.object({
  id: z.string().min(1).max(512),
  kind: z.enum(alertKinds),
  urgency: z.enum(alertUrgencies),
  governingDate: z.iso.date().nullable(),
  dayOffset: z.number().int().nullable(),
  source: alertSourceSchema,
  link: alertLinkSchema,
  residualRating: z.enum(riskRegisterRatings).nullable(),
}).strict();

export const alertListResponseSchema = z.object({
  data: z.array(alertItemSchema).max(50),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().min(1).max(MAX_ALERT_PAGE),
      pageSize: pageSizeSchema,
      pageCount: countSchema,
      total: countSchema,
    }).strict(),
    today: z.iso.date(),
    dueSoonWindowDays: z.number().int().min(1),
  }).strict(),
}).strict();

const alertCountsByKindShape = {
  'risk-treatment-overdue': countSchema,
  'risk-treatment-due-soon': countSchema,
  'request-overdue': countSchema,
  'request-due-soon': countSchema,
  'control-implementation-overdue': countSchema,
  'assessment-review-due': countSchema,
  'critical-residual-risk-untreated': countSchema,
  'ineffective-control': countSchema,
} satisfies Record<AlertKind, typeof countSchema>;

const alertCountsByUrgencyShape = {
  overdue: countSchema,
  'due-soon': countSchema,
  attention: countSchema,
} satisfies Record<AlertUrgency, typeof countSchema>;

const alertSummarySchema = z.object({
  byKind: z.object(alertCountsByKindShape).strict(),
  byUrgency: z.object(alertCountsByUrgencyShape).strict(),
  total: countSchema,
  today: z.iso.date(),
  dueSoonWindowDays: z.number().int().min(1),
}).strict();

export const alertSummaryResponseSchema = z.object({ data: alertSummarySchema }).strict();

export type AlertItem = z.infer<typeof alertItemSchema>;
export type AlertListPayload = z.infer<typeof alertListResponseSchema>;
export type AlertSummary = z.infer<typeof alertSummarySchema>;

export function parseAlertListPayload(payload: unknown): AlertListPayload {
  return alertListResponseSchema.parse(payload);
}

export function parseAlertSummaryPayload(payload: unknown): AlertSummary {
  return alertSummaryResponseSchema.parse(payload).data;
}

/**
 * One read of the alert list: one to eight distinct kinds (absent reads every
 * kind), at most one urgency, and a page. It is validated before any request.
 */
export const alertListQuerySchema = z.object({
  kinds: z.array(z.enum(alertKinds)).min(1).max(alertKinds.length)
    .refine((kinds) => new Set(kinds).size === kinds.length, 'Alert kinds must be distinct.')
    .readonly()
    .optional(),
  urgency: z.enum(alertUrgencies).optional(),
  page: z.number().int().min(1).max(MAX_ALERT_PAGE),
  pageSize: pageSizeSchema,
}).strict();
export type AlertListQuery = z.input<typeof alertListQuerySchema>;

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;

/**
 * The Alerts screen's URL (`?kind=`, `?urgency=`, `?page=`, `?pageSize=`). The
 * screen filters by one kind at a time. An unknown kind or urgency reads as all,
 * and any page size other than 10, 25 or 50 reads as the default, as the other
 * list filters do.
 */
export const alertListUrlQuerySchema = z.object({
  kind: z.preprocess(firstValue, z.enum(alertKinds).optional().catch(undefined)),
  urgency: z.preprocess(firstValue, z.enum(alertUrgencies).optional().catch(undefined)),
  page: z.preprocess((value) => {
    const parsed = Number(firstValue(value));
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_ALERT_PAGE ? parsed : 1;
  }, z.number().int().min(1).max(MAX_ALERT_PAGE)),
  pageSize: z.preprocess((value) => {
    const parsed = Number(firstValue(value));
    return parsed === 10 || parsed === 25 || parsed === 50 ? parsed : 25;
  }, z.union([z.literal(10), z.literal(25), z.literal(50)])),
}).strip();
export type AlertListUrlQuery = z.infer<typeof alertListUrlQuerySchema>;
