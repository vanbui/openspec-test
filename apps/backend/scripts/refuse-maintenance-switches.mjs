/*
 * The everyday Strapi test run refuses the two maintenance switches (review finding SR-07). Each
 * turns a central server guard into a recorder: AUTHORIZATION_MATRIX_OBSERVE=1 records every matrix
 * status instead of asserting it, and SERVED_OPERATIONS_WRITE=1 rewrites
 * docs/references/served-operations.json instead of checking it for drift. Exported in a shell, a CI
 * job or an env file, either would leave the suite green whatever Strapi does. They belong to the
 * dedicated scripts, which do not run this check:
 *
 *   AUTHORIZATION_MATRIX_OBSERVE=1 pnpm --filter @csrm/strapi authorization-matrix:observe
 *   SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write
 */
const switches = ["AUTHORIZATION_MATRIX_OBSERVE", "SERVED_OPERATIONS_WRITE"];
const set = switches.filter((name) => (process.env[name] ?? "") !== "");

if (set.length > 0) {
  console.error(
    `MAINTENANCE_SWITCH_SET: ${set.join(" and ")} ${set.length === 1 ? "is" : "are"} set, which would turn the matrix `
    + "or the served-operations drift check into a recorder. Unset it for the test run; observe or regenerate only through "
    + "`pnpm --filter @csrm/strapi authorization-matrix:observe` or `pnpm --filter @csrm/strapi served-operations:write`.",
  );
  process.exit(1);
}
