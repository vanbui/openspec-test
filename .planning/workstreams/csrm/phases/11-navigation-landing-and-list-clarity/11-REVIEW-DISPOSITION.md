---
phase: 11-navigation-landing-and-list-clarity
review_base: 9f95575
status: complete
original_findings: 48
supplemental_findings: 15
---

# Phase 11 review disposition

The four original lanes and three supplements are evidence, not an approval. Each original finding is adjudicated below; aliases are listed separately. Confirmed functional defects are fixed test-first. The supplements add two independent findings (identity cache and unscrollable filters) and promote the name bound and snapshot invariant to functional defects. The final regression and browser gate ran green after every fix (2026-10-05: web 3,328/3,328, Strapi 710/710, Playwright 159/159 with 0 flaky; `11-21-SUMMARY.md`, "Phase gate (final run, after the code review)"), so this disposition is complete.

| Finding | Disposition | Evidence or reason |
|---|---|---|
| CR-101 | Fixed, 260c97c | Off-ladder rating/status values project to null; served none-page shape and closed-parser cases added. |
| WR-101 | Not a confirmed Phase 11 defect | D-45 uses the existing boot-relative analyst-insights fixture reconciliation. Date-anchored fixture reconciliation deliberately predates Phase 11; no edit-preservation promise is made for this fixture. The separate seedRiskRegisterWorkflow preserves operator edits. No seed policy changed. |
| WR-102 | Fixed, 8abc903 | Strapi serves accepted from released+open+Accept, including closed and open Complete cases. Contract, generated type and closed parser agree. |
| WR-103 | Not a supported-write failure | Normal writes validate the treatment-action enumeration; rejecting a corrupt stored action is deliberate. No ordinary supported path producing the invalid value was established. Safe refusal is retained. |
| WR-104 | Accepted maintenance observation | Four bound placeholders match all three current four-value vocabularies. Future enum edits must update their predicates and equality tests; no present binding defect. |
| WR-105 | Claim rejected | The seed comment promises alert figures stay unchanged, which the undated Moderate Accept Risk satisfies. The D-43 treatment population includes open Risks without target dates; redefining it would contradict the locked population. |
| IN-101 | Accepted naming observation | Operation identifier and service function have explicit module imports and different types; no wrong import or broken route found. Avoid renaming a published operation solely for a potential editor mistake. |
| IN-102 | Accepted contract wording observation | Reachable release writes set approved atomically with the full release facts. Malformed legacy states are outside the served lifecycle guarantee; mounted holder-equals-lifecycle tests cover every reachable step. |
| IN-103 | Accepted intersection semantics | No mitigation controls intersected with an effectiveness filter correctly yields an empty list. No API promise requires rejection of this pair; no figure link emits it. |
| IN-104 | Fixed, 082e1ef | Status and holder counts execute as one UNION ALL statement, sharing a snapshot even under PostgreSQL READ COMMITTED. Real SQLite controller test proves one statement and exact owner totals. |
| IN-105 | Fixed, 7372cf7 and 260c97c | Queue requestorName returns null above255; boundary test covers255/256. Joined assessment labels allow513, the valid255+separator+255 bound. |
| WR-201 | Fixed, 260c97c | Each result receives a new announcement identity even when result text repeats; repeated zero and populated searches covered. |
| WR-202 | Fixed, 33d3fb4 | All seven route boundaries use Next16 retry, which refreshes before recovery; mounted boundary harness covers the RSC recovery contract. |
| WR-203 | Fixed, 94265f4 | Shell-wide refusal offers sign-in with accurate unavailable-access copy, avoiding the refused Home loop. |
| WR-204 | Fixed, cef424b | Shared analyst route gate runs before all three list reads; Requestor direct URLs cause no analyst service calls. |
| WR-205 | Fixed, a971f8a | Home header, first-use and own-request actions receive creation permission; new-request route refuses before selector reads. Read-only capability cases covered. |
| WR-206 | Fixed, bc0ddec | A changed searchable term immediately marks retained results pending throughout debounce, as UI-SPEC4.4 permits; Enter regression covers retained-result policy. |
| IN-201 | Accepted unused-override observation | No caller supplies RequestHubHrefs.nextAction. Current hub and compact stepper share the actual served next action. Any future override must update both presentations. |
| IN-202 | Fixed, 260c97c | Shortcut excludes Shift/composition229 and accepts physical KeyK or literal k; non-Latin/modified-key tests added. |
| IN-203 | Fixed, 88b1be1 | Cold loading frame bounds typed-ahead input to100, including a delayed-loader101-character regression. |
| IN-204 | Accepted limited-height observation | The specified375×812/1440×900 frames and current supported viewport proofs remain usable. The256px-tall landscape arrangement is a future layout improvement, distinct from the confirmed1148px desktop filter overflow fixed below. |
| IN-205 | Accepted copy/cleanup observation | Existing review-boundary copy is understandable; page headings and recovery destinations remain covered by the canonical mapping. Optional apostrophe/dead-prop cleanup is not a workflow gap. |
| IN-206 | Accepted defensive fallback observation | Closed served status vocabularies do not return null/empty values to badges on these workflows. No new valid payload producing Null was found. |
| IN-207 | Fixed, 260c97c | Invalid returned instant uses a readable fallback; tests cover unreadable return dates. |
| WR-301 | Fixed, 2170c4a | Date chips identify UTC range boundaries; throughput description identifies UTC month buckets and explains that list row dates use the viewer zone. SQL population preserved. |
| WR-302 | Clarified, 629132b | Locked D-41 marker retained. Canonical glossary explicitly identifies interim released action, not owner decision; Phase17.1 refines the predicate. No competing entity introduced. |
| WR-303 | Existing forgiving-URL policy retained | parseAssessmentCollectionQuery intentionally drops malformed/inverted range values, with explicit unit cases. Plans require valid range links, not refusal of manually malformed URLs. No generated figure link has inverted bounds; changing this behavior is unnecessary scope. |
| IN-301 | Accepted loading-state observation | Repeated alert parameters differ between skeleton and final parser; final validated server data governs the list. No wrong record read or persistent final chip found. |
| IN-302 | Accepted explicit-link policy | These links intentionally let a reader open the Critical/High lists from the no-system note, even when empty; they are navigation options, not nonzero figures. |
| IN-303 | Accepted type-design observation | Generated URLs are covered by the figure-link audit and mounted/browser figure-equals-list proofs. General string typing is not evidence of a wrong current link. |
| IN-304 | Accepted maintenance observation | Current queue sort fields match the closed server tuple. No unsupported field is emitted; unifying future tuple ownership is optional cleanup. |
| IN-305 | Accepted naming observation | Parameter shadowing has no current incorrect call or behavior. |
| IN-306 | Fixed, 260c97c | status=approved list now requires the complete release triple, matching report population; partial-release mounted cases added. |
| IN-307 | Claim rejected for supported actors | Requestor is the required birthright role; service-only core_api is not a supported human shell identity. Backend route grants remain unchanged, and the six-actor authorization matrix is retained. |
| CR-401 | Coverage repaired, 1881cb9 | Reclassified as a test Warning. Seeded00:00Z submission under New York always differs from UTC; test asserts this difference before rendering equality. Triage additionally checks the synchronized zone cookie. |
| WR-401 | Fixed, fdd7440 | Count proof waits for explicit ready state and compares each Requestor identity with its own list; empty arrays cannot prove isolation. |
| WR-402 | Fixed, fdd7440 | Fresh-submission browser accepts the legitimate today/1-day boundary; deterministic age unit tests stay exact. |
| WR-403 | Fixed, bf798b9 | Reflow sweeps320 and305 and all previously omitted personal/review lists, including populated phone cards. |
| WR-404 | Fixed, df3acac | Recursive production-module discovery makes guard coverage complete; authorized/authorised spelling variants covered. |
| WR-405 | Repaired, 1881cb9 plus desktop-filter commit | No-system/any must strictly narrow and exclude a known system Risk; Existing excludes the known Planned-control Risk. Mounted backend tests separately prove positive and negative membership for every mitigation filter. |
| WR-406 | Fixed, fdd7440 | Ready/unavailable count markers distinguish real zero from missing/pending reads. Two drafts ensure decrement remains positive; drawer counts cannot agree vacuously. |
| WR-407 | Fixed, fdd7440 | Both Homes have fold checks at375 and1440. |
| IN-401 | Accepted guard limitation | Source guard is supplementary; expanded browser populated-card sweep covers named and inline cards at305/320. No uncovered current badge overflow established. |
| IN-402 | Accepted guard limitation | The existing CSS/key source guards cover their actual fixes; the production browser reflow sweep and full typecheck provide independent coverage. A broad future AST lint is optional. |
| IN-403 | Fixed, a971f8a | Assert capability call exists before comparing invocation order. |
| IN-404 | Fixed, bf798b9 | Navigation helper has three bounded attempts and an actionable error; trivial premeasurement scroll assertions removed. |
| IN-405 | Accepted historical test-label observation | Retired test names do not alter visible navigation; role/heading assertions already use canonical names. Naming cleanup is optional. |
| IN-406 | Accepted test-design observation | Current guard ordering is covered by navigation behavior; figure models and browser list-equality checks remain the agreed seams. Broader rendered-figure audit is future coverage work. |

## Supplements and aliases

| Finding | Disposition |
|---|---|
| BE-01 | IN-105 queue bound, fixed. Severity promoted from Info to functional parser defect. |
| BE-02 | WR-102, fixed. |
| BE-03 | IN-104, fixed as a response-consistency Warning. |
| SH-01 | New identity-cache defect fixed cf372e9: complete search owner keyed by opaque identity and capabilities. Supported Jane→Maya browser regression added. |
| SH-02 | WR-202, fixed. |
| SH-03 | WR-203, fixed. |
| SH-04 | WR-205, fixed. |
| SH-05 | WR-206, fixed. |
| SH-06 | IN-203, fixed as a robustness Warning. |
| SH-07 | WR-204, fixed. |
| FT-01 | Fixed e5c70a9; real-component Chromium GREEN with rebuilt application CSS: popup637px, scrollHeight1138px, overflowY auto, final control839–883px inside900px viewport, exit0 (`/private/tmp/csrm11-filter-component-green.log`). Independent reviewer browser RED measured1148px with no scrolling; the first actual-app test was blocked by a permission refusal and is not claimed as RED. Full production application regression remains part of the final gate. |
| FT-02 | WR-301, fixed. |
| FT-03 | CR-401, coverage repaired. |
| FT-04 | WR-402, fixed. |
| FT-05 | WR-405, coverage repaired. |

## Limits

The original48 findings are all dispositioned. Accepted observations above do not claim absent defects or future proofs; they record why no required current behavior is missing. Invalid claims are distinguished from fixed findings. None of the supported workflows is excused from the final gates. NVDA and macOS shortcut verification remain human-only and will not be fabricated.
