import { factories } from "@strapi/strapi";

/*
 * The core service still has to be this file's default export: the core
 * controller's `find` resolves it by name, and without it the inherited
 * collection route answers 500. The bounded selector helpers below are named
 * exports, which Strapi's service loader ignores.
 */
export default factories.createCoreService("api::csrm-information-system.csrm-information-system");

type RecordValue = Record<string, unknown>;

export const SELECTOR_PAGE_SIZES = [10, 25, 50] as const;
export const SELECTOR_MAX_IDS = 50;
export class InformationSystemSelectorError extends Error {}
const record = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
function scope(state: unknown): void { if (!record(state) || !record(state.csrmAuthorization) || state.csrmAuthorization.referenceDataCollectionScope !== "all") throw new InformationSystemSelectorError("CSRM reference data access is denied."); }
function parseQuery(value: unknown): { q: string; page: number; pageSize: typeof SELECTOR_PAGE_SIZES[number] } {
  if (!record(value) || Object.keys(value).some((key) => !["q", "page", "pageSize"].includes(key)) || (value.q !== undefined && typeof value.q !== "string")) throw new InformationSystemSelectorError("CSRM selector query is invalid.");
  const number = (entry: unknown, fallback: number) => { if (entry === undefined) return fallback; if (typeof entry !== "string" || !/^[1-9]\d*$/.test(entry) || !Number.isSafeInteger(Number(entry))) throw new InformationSystemSelectorError("CSRM selector query is invalid."); return Number(entry); };
  const q = (value.q ?? "").trim(); const page = number(value.page, 1); const pageSize = number(value.pageSize, 25);
  if (q.length > 100 || page > 1_000_000 || !SELECTOR_PAGE_SIZES.includes(pageSize as typeof SELECTOR_PAGE_SIZES[number])) throw new InformationSystemSelectorError("CSRM selector query is invalid.");
  return { q, page, pageSize: pageSize as typeof SELECTOR_PAGE_SIZES[number] };
}
function ids(value: unknown): string[] {
  if (!record(value) || Object.keys(value).length !== 1 || !Array.isArray(value.selectedIds) || value.selectedIds.length > SELECTOR_MAX_IDS) throw new InformationSystemSelectorError("CSRM selected identifiers are invalid.");
  const result = value.selectedIds.map((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(id) ? id : null);
  if (result.some((id) => id === null) || new Set(result).size !== result.length) throw new InformationSystemSelectorError("CSRM selected identifiers are invalid."); return result as string[];
}
function project(input: RecordValue): RecordValue { if (typeof input.documentId !== "string" || typeof input.name !== "string") throw new InformationSystemSelectorError("CSRM selector data is unavailable."); return { documentId: input.documentId, name: input.name, systemType: typeof input.systemType === "string" ? input.systemType : null }; }
function service(strapi: unknown) { if (!record(strapi) || typeof strapi.documents !== "function") throw new InformationSystemSelectorError("CSRM selector data is unavailable."); return strapi.documents("api::csrm-information-system.csrm-information-system") as { findMany: (input: RecordValue) => Promise<RecordValue[]>; count: (input: RecordValue) => Promise<number> }; }
export async function searchInformationSystems(input: { strapi: unknown; state: unknown; query: unknown }): Promise<RecordValue> {
  scope(input.state); const parsed = parseQuery(input.query); const filters = parsed.q ? { name: { $containsi: parsed.q } } : {}; const documents = service(input.strapi); const [rows, total] = await Promise.all([documents.findMany({ filters, fields: ["documentId", "name", "systemType"], sort: ["name:asc", "documentId:asc"], start: (parsed.page - 1) * parsed.pageSize, limit: parsed.pageSize }), documents.count({ filters })]);
  return { data: rows.map(project), meta: { pagination: { page: parsed.page, pageSize: parsed.pageSize, pageCount: Math.ceil(total / parsed.pageSize), total } } };
}
export async function hydrateInformationSystems(input: { strapi: unknown; state: unknown; body: unknown }): Promise<RecordValue[]> {
  scope(input.state); const selected = ids(input.body); if (selected.length === 0) return []; const rows = await service(input.strapi).findMany({ filters: { documentId: { $in: selected } }, fields: ["documentId", "name", "systemType"], limit: selected.length }); const found = new Map(rows.map((row) => [row.documentId, row])); if (found.size !== selected.length || selected.some((id) => !found.has(id))) throw new InformationSystemSelectorError("CSRM selected identifiers are unavailable."); return selected.map((id) => project(found.get(id)!));
}
