/*
 * The export pipeline's two refusals (19-04; D-16, D-17), in a module of their own so the pipeline, the views and the
 * file response can all name them without importing one another. run-export.ts re-exports both.
 */

/** A refused export query: a 400 with a safe message and no reason (the log records `INVALID_QUERY`). */
export class ExportQueryError extends Error {
  readonly status = 400;

  constructor(message = "CSRM export query is invalid.") {
    super(message);
    this.name = "ExportQueryError";
  }
}

/** No resolved IdamBox User to name as the exporter: a 403, never an export event. */
export class ExportForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("CSRM export access is denied.");
    this.name = "ExportForbiddenError";
  }
}

export type ExportRefusalReason = "EXPORT_ROW_LIMIT" | "ASSESSMENT_NOT_RELEASED" | "EXPORT_CELL_TOO_LONG";

/**
 * A refused export with a closed reason: 422 `EXPORT_ROW_LIMIT` with the count and the cap, 409 `ASSESSMENT_NOT_RELEASED`,
 * or 422 `EXPORT_CELL_TOO_LONG` with the column key and the cell limit (the Phase 19 review amendment, BE1-02).
 */
export class ExportRefusalError extends Error {
  readonly reason: ExportRefusalReason;
  readonly status: number;
  readonly rowCount?: number;
  readonly rowCap?: number;
  readonly column?: string;
  readonly cellLimit?: number;

  constructor(input: {
    reason: ExportRefusalReason;
    status: number;
    message: string;
    rowCount?: number;
    rowCap?: number;
    column?: string;
    cellLimit?: number;
  }) {
    super(input.message);
    this.name = "ExportRefusalError";
    this.reason = input.reason;
    this.status = input.status;
    if (input.rowCount !== undefined) this.rowCount = input.rowCount;
    if (input.rowCap !== undefined) this.rowCap = input.rowCap;
    if (input.column !== undefined) this.column = input.column;
    if (input.cellLimit !== undefined) this.cellLimit = input.cellLimit;
  }
}
