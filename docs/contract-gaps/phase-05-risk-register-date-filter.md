# Phase 05 Risk Register date-filter contract resolution

## Status

Resolved in Plans 05-10 through 05-12. RISK-01 and the Phase 5 roadmap criterion are implemented without narrowing: authorised Security Analysts can filter contextual Risks by an inclusive Target date range in addition to the existing search, categorical, relationship, mitigation, sort, and pagination dimensions.

## Resolved contract

The canonical optional parameters are `targetDateFrom` and `targetDateTo`. Each is a date-only `YYYY-MM-DD` value and is inclusive. Either bound may be supplied independently, equal bounds select Risks on that exact date, and a range with the lower bound after the upper bound is rejected. Blank, repeated, overlong, datetime, malformed, and impossible calendar values are rejected rather than normalised.

The contract is implemented at every required boundary:

- The Strapi query parser validates a closed scalar date contract and rejects inverted ranges.
- Exact human Security Analyst authorization is resolved before query parsing, so denied callers receive the same safe response regardless of supplied date state.
- The SQLite repository applies both bounds in the shared predicate used by distinct totals and page selection, before pagination and Strapi hydration.
- The canonical OpenAPI operation declares both optional `format: date` parameters, and the generated web types plus typed service transport preserve them.
- The browser schema canonicalizes valid ranges, discards unknown state, and drops both bounds when either supplied bound is invalid or the range is inverted.
- The responsive Risk Register UI exposes persistent **Target date from** and **Target date to** labels in the desktop popover and mobile Sheet. Each bound has an independent chip/count contribution and removal action; **Clear target dates** removes the pair, while **Clear filters** removes all filters and retains sort and page size.
- `targetDate` remains projected, displayed in UTC `en-AU` format, and globally sortable in both directions with null values last. Overdue treatment continues to use icon plus text rather than colour alone.

## Executable evidence

Mounted Strapi tests cover authorization-before-parsing, exact and one-sided bounds, closed ranges, invalid and inverted inputs, composed filters, zero matches, and honest pagination totals. Contract tests cover canonical OpenAPI placement and generated types. Web schema, service, and component tests cover canonical URLs, transport, responsive controls, loading persistence, chips, counts, and individual, paired, and global clearing.

The isolated Playwright journey on ports 1338/3100 proves equal-bound inclusivity for the stable mutable Risk, authoritative totals, composition with every existing filter family, canonical URL persistence, a valid zero-result range, individual/paired/global clearing, responsive keyboard operation, no horizontal overflow, and unchanged non-enumerating Requestor denial for existing and random Risk identifiers.
