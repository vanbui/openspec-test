---
phase: 16
review: 16-REVIEW.md
recorded: 2026-10-16
open: 0
total: 54
fixed: 46
skipped: 4
deferred: 4
---

# Phase 16 code review disposition

Every Critical and Warning was confirmed by a failing test before its fix (a RED commit, then a GREEN commit), except where the row says otherwise. Each Info item is fixed, skipped with evidence, or deferred with a route to a named later phase. Each deferral is recorded in `deferred-items.md` and as a dated "Carried from Phase 16" section in that phase's CONTEXT (`bf4e765a`). The G-6 rulings are in `b264ccc6` (BE2-01, BE2-03 and BE1-03, both records approved on 2026-10-16). The pilot's rulings on the copy, Note 1, FE4-09 and FE4-11 are dated 2026-10-16.

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| BE1-01 | warning | fixed | `6b924c4c`, `1c071058`: `created` rows list each starting value with `from: null`, as the approved record requires. 16-UI-SPEC §8.3 shows no lines for a `created` entry, so the values are recorded for audit only; their display is routed to Phase 18. |
| BE1-02 | warning | fixed | `21369878`, `b137d942`: a withdrawn Risk is never served `accepted: true`. Its `treatmentDueState` is deferred to Phase 20, which owns treatment tracking and the overdue rule (pilot ruling). |
| BE1-03 | warning | fixed | G-6 `4ac7d1f5` proposed, `b264ccc6` approved. `020c3e50`, `97955808`: a curation Undo applies only to the actor's own latest act; otherwise the whole batch is 409 `RISK_CURATION_UNDO_UNAVAILABLE` with nothing written. The reason is in both closed lists, `specification.json` and the regenerated `schema.d.ts`. Copy: `96096d02` (16-UI-SPEC R1), `35e1c35d`, `f9a47210` (web). |
| BE1-04 | info | deferred: Phase 18 | The history read serves `kind`, `sourceKind` and `reason` unchecked. Phase 18's S-9 opens the history vocabulary for bulk curation; hiding audit rows is not acceptable (pilot ruling). |
| BE1-05 | info | fixed | `1f09fadc`, `b258eec9`: the append-only guard also flags history updates and the `service(...)` accessor. |
| BE1-06 | info | fixed | `f4cae269`, `11e6f1cd`: the register's Withdrawn branch reads `withdrawnRiskSql` from `active-risk.ts`, with its alias check. |
| BE1-07 | info | skipped | The fail-closed projection of damaged withdrawal facts is deliberate: a withdrawn Risk stays withdrawn even when its facts cannot be read (pilot ruling). |
| BE1-08 | info | deferred: Phase 18 | Security Analyst Agent edits are recorded with source `analyst`. Telling them apart needs a G-6 change to the closed source values, alongside Phase 18's batch source. |
| BE1-09 | info | fixed | `9d12ce2c`: the unrouted `listAssessmentRisks` handler and its service read are removed. No test: nothing routed it, and the served-operations proof is unchanged. |
| BE2-01 | critical | fixed | G-6 `4ac7d1f5` proposed, `b264ccc6` approved. `2afea46b`, `e18a8322`: a `risk-rewrite` run takes Phase 12's v1 field events for its own Risk and unit fields, so a hand-written Risk with a confirmed rewrite can be edited and reviewed again. Every other v1 event on a rewrite run, and every v2 event on a Phase 12 run, stays refused. |
| BE2-02 | critical | fixed | `6f930976`, `fb2f41c4`: an Undo of a confirmed residual unit is a residual change for the Accept rule, so under an AI-confirmed Accept a High result is 409 `AI_ACCEPT_NOT_PERMITTED`. An Accept a person typed still restores. |
| BE2-03 | warning | fixed | With BE2-01 (`2afea46b`, `e18a8322`): each Phase 12 field event goes to the run that proposed the field's value (`fieldRunId`), split one event per run. |
| BE2-04 | warning | fixed | `e5ad6732`, `3bac3e5a`: a rewrite's AI Accept is checked against the target's own residual when the ratings are outside the focus. |
| BE2-05 | warning | fixed | `5082d12a`, `0703ff6f`: the AI data policy of a risk proposal weighs every Risk the context lists and their linked assets, reusing `AI_CLASSIFICATION_ABOVE_CEILING`. |
| BE2-06 | warning | fixed | `614a2b9a`, `841898dc`: a rewrite reads one more active Risk, so more than 200 others are refused, never truncated. |
| BE2-07 | warning | fixed | `27a951ba`, `8f1572d5`: a rejected change's Undo is offered only while its Risk is active. |
| BE2-08 | warning | fixed | `6f89485a`, `2ac05108`: a failure that a later job on its key replaced leaves the read and is not retried. This is fixed in the risk layer; the shared registry's `mayRetry` is unchanged because a Phase 15 test pins its questionnaire behaviour. |
| BE2-09 | info | skipped | The damaged-run log is once per process, and the integration test "a run whose stored decisions do not read … logs it once" pins that across two reads. Only the record's wording ("once per read") differs; the behaviour is the intended one. |
| BE2-10 | info | fixed | `090875ae`: a registry refusal at a risk proposal start answers its 400 or 409, not a 500. No test: the path cannot be reached over HTTP. |
| BE2-11 | info | deferred: Phase 17.1 | Every risk-workflow 400 on an AI decision reads as `AI_PROPOSAL_STALE`. It joins the carried W-1 assessment-side reason codes there. |
| BE2-12 | info | fixed | `ec0c7ce3`, `91c24b38`: a control implementation with no control still counts for the Accept check. |
| BE2-13 | info | deferred: Phase 22 | No limit on concurrent provider calls in one process. Outside T-16-27; it is routed to Phase 22's configuration hardening (S-13). |
| BE2-14 | info | fixed | `24ee80d3`, `3d440064`: each proposal target's decision parsers accept only the causes its runs record. |
| BE2-15 | info | fixed | `05ba619b`: the Requestor-text corpus takes no questionnaire instead of a made-up documentId. A refactor with no behaviour change, so there is no RED; the existing instruction tests pass unchanged. |
| BE2-16 | info | fixed | `5ed00748`, `5a424fff`: a risk proposal retry whose admission fails puts the failed job back. The questionnaire retry had the same pattern (pilot asked): `7d479e9e`, `10dd0168`. |
| FE3-01 | critical | fixed | `d7703400`, `8f101a86`: both Show lists stay mounted and the one not chosen is `hidden`, keeping the pilot's `router.replace` ruling. Note 1: `7d53af1a`, `a98d6408`, `fd4a7420`: a failed later read keeps the editor with its unsaved input, and shows WR-302's "Assessment not refreshed" toast with Try again (pilot accepted the toast in place of an inline retry). |
| FE3-02 | warning | fixed | `2737b0aa`, `2ad91d75`: the withdraw form moves focus only when it opens. |
| FE3-03 | warning | fixed | `24817e44`, `d11bff9e`: a form reopened by a refusal returns focus to its opener on Keep. |
| FE3-04 | warning | fixed | `59810522`, `cc5736ed`: an already-withdrawn or already-reinstated outcome warns and keeps the typed reason. The copy was approved by the pilot and recorded in 16-UI-SPEC R1 (`c6d46bbe`). |
| FE3-05 | warning | fixed | `be024ce4`, `d5fe848f`: a `RISK_WITHDRAWN` refusal on an edit carries its reason, and the editor reads the Risks again. |
| FE3-06 | warning | fixed | `7992eb5a`, `d2bb1ba2`: a link to a Risk card in the other Show list chooses that list, then lands. |
| FE3-07 | warning | fixed | `709eaad3`, `3c99873a`, `39f9f853`: Show in AI proposals closes the history sheet and lands on the section; released cards use the editor's single history dialog. |
| FE3-08 | warning | fixed | `9f7c0861`, `506aa972`: history paging drops repeated entries and focuses the first new one. |
| FE3-09 | info | fixed | `1998e7e5`, `1ca67ba8`: the withdrawn notice starts with "A Security Analyst" (0 bytes on `/app/risks/{documentId}`). |
| FE3-10 | info | fixed | `b050e08b`, `a0b2be94`: a kept reason is restored when the field first shows. |
| FE3-11 | info | fixed | `8d97a855`, `4ee9fcd1`: one trimmed length everywhere; the 500 bound named by its constant. |
| FE3-12 | info | fixed | `eeb89a17`, `e06525c8`: Risk card ids and hash links come from one helper (raw id, encoded link). |
| FE3-13 | info | skipped | `next/dynamic` in render works here because the body is `ssr: false` and needs no preload. Restructuring it risks bytes on `/app/risks/{documentId}`, which has 152 bytes of headroom. |
| FE3-14 | info | skipped | No change needed: the `risk` status family is within budget on every route (pilot accepted). |
| FE3-15 | info | fixed | `5fd77f71`: the register proofs read within a `q=` search for their own fixtures instead of bounding the shared register (pilot ruling). This is a test-only change; the Playwright gate below proves it. |
| FE3-16 | info | fixed | `ab9713e5`, `231dd3cc`: opening a new Add Risk form withdraws the discard's Undo toast. |
| FE4-01 | warning | fixed | `aa929ee4`, `136d75bd`: a followed job that fails, or is gone (404), leaves the running state and the start form returns. |
| FE4-02 | warning | fixed | `34eed052`, `504dd5b5`: phones follow the job with the proposals sheet closed, and no focus mover stays armed. |
| FE4-03 | warning | fixed | `c540a382`, `51fa955b`: the card's AI rewrite section focuses the started rewrite's status line at both widths (not the unmounted form's close handler). |
| FE4-04 | warning | fixed | `c1781018`, `8899e1fe`: Rewrite this risk is withheld while that Risk's rewrite is queued or running. |
| FE4-05 | warning | fixed | `889bd6f4`, `6dc692e1`: each rewrite job is followed as last seen, and a finished rewrite's section stays for its no-change outcome. |
| FE4-06 | warning | fixed | `4e5b40f3`, `36c44770`: a decision settles against the items held when it resolves. |
| FE4-07 | warning | fixed | `1c14c08b`, `2b5b83a2`: the web pre-checks the server's second Accept rule (a residual change under an AI-confirmed Accept). |
| FE4-08 | warning | fixed | `e96aa652`, `a3a76a31`: focus held by a job status line moves on when the job completes or fails. |
| FE4-09 | info | fixed | `9549a581`, `2a7a9667`: the decision and rewrite inputs are closed to the contract. The R2 sentence on malformed rewrite input is skipped with evidence: the form never sends that input, only a tampered client could, and the server's refusal stands. No new copy (pilot ruling). |
| FE4-10 | info | fixed | `c6507ae3`, `780bfc8d`: a rejection's kept reason clears once the rejection is recorded. |
| FE4-11 | info | fixed | `ccc3faa4`, `a24bd68b`, `fe9ac9fe`: a start refusal names its field; the duplicated strings are in one place; the unreachable `interrupted` option is dropped. 16-UI-SPEC R4's "Interrupted by a restart" row is retired (`969ff57f`, pilot ruling). |
| FE4-12 | info | fixed | `6024f5e5`, `aa5f0f5a`: a handed-over job that no section takes in time is discarded. |
| FE4-13 | info | fixed | `8b2d99f3`: the unrelated-Requestor negative fails instead of skipping, Compare and both Reject remaining are asserted, and `cardsOf` reads only the shown Show list. Test-only; the Playwright gate below proves it. |

## Regression gate

Run after every fix (code at `f9a47210`; the one later change is the test-only `aa276042`), on Node 24.19.0, with Keycloak off (`CSRM_AUTH_OIDC_ENABLED=false`, `CSRM_DEV_IDENTITY=true`, both Strapi Keycloak flags false).

| Check | Result |
|-------|--------|
| `pnpm --dir apps/csrm api:check` | clean: `schema.d.ts` regenerates identical to the committed one (it changed only in BE1-03's contract commit `97955808`) |
| `pnpm --dir apps/csrm typecheck` | clean |
| `pnpm --dir apps/csrm lint` | clean |
| `pnpm --dir apps/csrm test` | 5,842 passed, 0 failed (235 files), 66 s |
| `pnpm --dir apps/backend test` | 2,022 passed, 0 failed, 1 skipped of 2,023, 31.6 min |
| `pnpm --dir apps/csrm test:e2e` (full, desktop 1440 and mobile 375) | 242 passed, 4 failed, 2 did not run (248), 33.3 min. The 4 failures were `risk-curation.spec.ts`'s `PH16_SC1_WITHDRAW_LEAVES_READINESS` and `PH16_NEG_REQUESTING_ANALYST` at both widths: test drift from FE3-01 (a withdrawn card now stays in the DOM, in the hidden Withdrawn list, so a page-wide id never counted 0). Fixed test-side in `aa276042`, which scopes those two assertions to the Active list. |
| `pnpm --dir apps/csrm test:e2e e2e/risk-curation.spec.ts` (after `aa276042`, both widths) | 8 passed, 0 failed, 4.1 min. With the full run's 242, all 248 pass. |
| Route budgets (desktop delivered JS, full run) | `/app/requests/{documentId}` 299,574 (426 bytes of headroom, was 419); `/app/risks/{documentId}` 299,843 (157 bytes, was 152); every route within its budget (`performance.spec.ts` passed at both widths) |
| `git status --short` after the runs | only ` M .planning/workstreams/csrm/.verification-ledger.json` (left uncommitted, brief §2) |

FE3-15's and FE4-13's spec edits (`5fd77f71`, `8b2d99f3`) ran for the first time in this gate and pass: `risk-register-workflow.spec.ts` in the full run, `risk-curation.spec.ts` in the re-run.
