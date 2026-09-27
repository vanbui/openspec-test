import reportCopyJson from './report-copy.json';

/*
 * The canonical report copy (UI-D19). report-copy.json holds the title,
 * description and metadata title of each report, in display order. The web
 * renders a report header from it before any data resolves, and the Strapi
 * report definitions must serve the same key, title and description; the
 * mounted report test reads this JSON and asserts they are equal.
 */

/** The closed report keys, in display order. */
export const reportKeys = [
  'risk-exposure',
  'treatment-performance',
  'assessment-throughput',
  'control-effectiveness',
] as const;
export type ReportKey = (typeof reportKeys)[number];

export type ReportCopy = {
  readonly key: ReportKey;
  readonly title: string;
  readonly description: string;
  readonly metadataTitle: string;
};

const reportKeySet: ReadonlySet<string> = new Set(reportKeys);

export function isReportKey(value: unknown): value is ReportKey {
  return typeof value === 'string' && reportKeySet.has(value);
}

/** Every entry of the JSON, typed. A key outside the closed set is a defect in the copy map itself. */
export const reportCopyEntries: readonly ReportCopy[] = Object.freeze(reportCopyJson.map((entry) => {
  if (!isReportKey(entry.key)) throw new Error(`The report copy map names an unknown report key: ${entry.key}`);
  return Object.freeze({
    key: entry.key,
    title: entry.title,
    description: entry.description,
    metadataTitle: entry.metadataTitle,
  });
}));

const reportCopyByKey: ReadonlyMap<ReportKey, ReportCopy> = new Map(reportCopyEntries.map((entry) => [entry.key, entry]));

/** The title, description and metadata title of one report. */
export function reportCopy(key: ReportKey): ReportCopy {
  const copy = reportCopyByKey.get(key);
  if (!copy) throw new Error(`The report copy map has no entry for ${key}.`);
  return copy;
}
