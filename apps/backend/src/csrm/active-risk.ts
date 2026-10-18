/*
 * The one active-risk rule (Phase 16 D-05, D-13; the approved record "Readers and the Active-Risk Rule").
 *
 * A Risk is active exactly when its `withdrawnAt` fact is null or absent. Withdrawal is a current fact on the Risk,
 * not a status, so every reader that lists, counts or rates an assessment's Risks applies this rule through one of
 * its three forms below rather than restating it:
 *
 * - `isActiveRisk` / `activeRisks`, the in-memory predicate over loaded Risks (release readiness, relationship
 *   counts, proposal contexts, the overall-rating hint);
 * - `ACTIVE_RISK_FILTER` / `WITHDRAWN_RISK_FILTER`, the Document Service filters;
 * - `activeRiskSql(alias)` / `withdrawnRiskSql(alias)`, the SQL fragments beside the Risk Register's disclosure predicate.
 *
 * Gates read this current fact directly and never the Risk history, which is narrative only (D-18). The module is
 * pure: it imports nothing from Strapi.
 */

type WithdrawalFact = { withdrawnAt?: unknown };

/** True for a record whose `withdrawnAt` is null or absent; false for any other value and for a non-object. */
export function isActiveRisk(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const withdrawnAt = (value as WithdrawalFact).withdrawnAt;
  return withdrawnAt === null || withdrawnAt === undefined;
}

/** The active Risks of `risks`, in their order, as a new array. */
export function activeRisks<T>(risks: readonly T[]): T[] {
  return risks.filter((risk) => isActiveRisk(risk));
}

/** The Document Service filter selecting active Risks; spread it into a Risk query's `filters`. */
export const ACTIVE_RISK_FILTER: { readonly withdrawnAt: { readonly $null: true } } = Object.freeze({
  withdrawnAt: Object.freeze({ $null: true as const }),
});

/** The Document Service filter selecting withdrawn Risks only (the reviewed exempt readers). */
export const WITHDRAWN_RISK_FILTER: { readonly withdrawnAt: { readonly $notNull: true } } = Object.freeze({
  withdrawnAt: Object.freeze({ $notNull: true as const }),
});

const SQL_ALIAS = /^[a-z_][a-z0-9_]{0,30}$/;

/**
 * The SQL fragment selecting active Risks of the `csrm_risks` table under `alias`. The alias is interpolated, so it
 * must be a plain lower-case identifier; anything else throws.
 */
export function activeRiskSql(alias: string): string {
  return `${checkedAlias(alias)}.withdrawn_at IS NULL`;
}

/** The SQL fragment selecting withdrawn Risks only (the register's explicit Withdrawn filter), with the same alias rule. */
export function withdrawnRiskSql(alias: string): string {
  return `${checkedAlias(alias)}.withdrawn_at IS NOT NULL`;
}

function checkedAlias(alias: string): string {
  if (typeof alias !== "string" || !SQL_ALIAS.test(alias)) {
    throw new Error("The active-risk SQL alias is invalid.");
  }
  return alias;
}
