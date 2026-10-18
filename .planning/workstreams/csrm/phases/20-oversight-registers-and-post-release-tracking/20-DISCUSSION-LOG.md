# Phase 20: Oversight registers and post-release tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 20-oversight-registers-and-post-release-tracking
**Mode:** `--auto`, one pass. Every area was selected and took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 monitoring and review; ISO/IEC 27001:2022 clauses 6.1.3 f, 8.3 and 9.1) at the G-4 bar, within `NEXT-WAVE-DECISIONS.md` and the ROADMAP entry. No todo matched, and no discuss hook was active.
**Areas discussed:** the released record; Overdue and the stored status; which risks have a due state; who acts after release; participants without a part; notes and history; evidence files; decision reviews; control implementations after release; registers and views; division and business-unit suggestions; reminder delivery facts; the email channel; when the run happens; the fallback recipient; the journey's treatment owner; the number of records.

---

## The released record (decision 9)

| Option | Description | Selected |
|---|---|---|
| A baseline written once, by the first post-release change, in Phase 16's history; released reads overlay it | No migration; covers earlier releases; the risk row stays lean | ✓ |
| A snapshot written at release by release and close | Misses every assessment released before this phase | |
| Rebuild released values from the history's old values | Fragile, and every released read walks the history | |
| Show live values in the released view | Breaks "the released assessment is unchanged" (SC2) | |

**Choice:** D-05, D-06.

## Overdue and the stored status (G-16)

| Option | Description | Selected |
|---|---|---|
| A progress fact set by people; the status derived from it by the one rule and written by the server | "Returns to its last progress status" by construction; reads never stale | ✓ |
| People write `treatmentStatus`; the server overwrites it with Overdue | Loses the progress status, or makes writes read the history | |
| Derive Overdue on read only (Phase 7 D-04) | Rejected by G-16 | |

**Choice:** D-08.

## Which risks have a due state

| Option | Description | Selected |
|---|---|---|
| Tracked treatments only (released, open, Treat); everything else reads `not-tracked` | Tracking starts at release (RISK-04 criterion 3); a recommendation is not a commitment, and the server never writes Overdue onto a fingerprinted pre-release risk | ✓ |
| Every open risk with a date, as Phase 11 D-43 keeps today | Due markers on the analyst's recommendations, which 17.1 and 18 already avoid | |

**Choice:** D-09. **Notes:** this narrows Phase 11 D-43 for due figures only, and is named in the return.

## Who acts after release (G-16, G-1, G-11)

| Option | Description | Selected |
|---|---|---|
| One "risk's people" predicate (risk owner, executive approver, treatment owner, control owners) with a per-part act table; analysts do everything except decision reviews, never on their own request or their own risk | One rule for reads, acts, readability and destinations | ✓ |
| Separate rules per surface | Rules drift between the owner page, the reminders and the exports | |

**Choice:** D-13.

## Participants without a part on a risk

| Option | Description | Selected |
|---|---|---|
| They keep the released record; tracking routes give 403 `NOT_RISK_PERSON` | Need to know; a 404 would be untrue (17 D-24, 19 D-15) | ✓ |
| They also read current tracking | Widens G-12 beyond "the released record" | |
| 404 | Untrue for someone who reads the risk | |

**Choice:** D-21.

## Notes and history

| Option | Description | Selected |
|---|---|---|
| Progress notes and every change as rows in Phase 16's history; owners read the post-release rows | One timeline and one store (Phase 18's "rather than a second history") | ✓ |
| A separate progress-note entity | A second timeline beside the history | |

**Choice:** D-11, D-19.

## Evidence files (decision 2)

| Option | Description | Selected |
|---|---|---|
| Its own entity on Phase 14's pipeline | Different readers from a request's, as 14-CONTEXT recommends | ✓ |
| A second holder on `CsrmRequestAttachment` | Two audiences in one table | |

**Choice:** D-18.

## Decision reviews (decision 8, NOTIFY-02, RISK-05)

| Option | Description | Selected |
|---|---|---|
| One review act by whoever holds the current authority (owner for Low and Moderate, executive approver for High and Critical): confirm (renews the date or the exception) or do not confirm (the analyst is told) | "Due for review" items and reminders resolve; the decision rows stay frozen | ✓ |
| Reminders only | A due item nobody can clear, and weekly nagging | |
| The analyst's residual review clears it | An analyst would renew an acceptance for the owner (against G-14) | |

**Choice:** D-17.

## Control implementations after release

| Option | Description | Selected |
|---|---|---|
| A Security Analyst records delivery (status, implemented date, effectiveness, evidence, review date) | UAT-046 expects "control status"; "Used in" by status stays true; Phase 7's stuck alert clears | ✓ |
| Frozen at release | Planned controls read Planned forever | |
| Control owners record delivery too | First-line claims without second-line verification; deferred | |

**Choice:** D-16.

## Registers and views (RISK-03)

| Option | Description | Selected |
|---|---|---|
| Built-in "Project", "BAU" and "Accepted risks" views plus personal and shared views on Phase 18's entity under a `risk-register` key | One view entity (18 D-09); the views export through the list (19 D-05) | ✓ |
| A register-only view mechanism | A second entity for the same job | |

**Choice:** D-22, D-23.

## Division and business-unit suggestions

| Option | Description | Selected |
|---|---|---|
| Distinct values in use: all of them for analysts, and only their own for everyone else | Consistent values for filters, and no Requestor learns of another's request | ✓ |
| Every value for everyone | Discloses free text from other people's requests | |
| A fixed list now | Phase 22's Admin list | |

**Choice:** D-22.

## Reminder delivery facts

| Option | Description | Selected |
|---|---|---|
| A `CsrmReminderDelivery` entity with a unique key and the email facts, in its own record | Idempotent across repeated and concurrent runs; `CsrmNotification` unchanged (19.1 D-33) | ✓ |
| Delivery fields on `CsrmNotification` | Forbidden by 19.1 D-33 | |
| Dedupe by querying notifications | No unique constraint, so it races | |

**Choice:** D-27.

## The email channel (G-7)

| Option | Description | Selected |
|---|---|---|
| An in-repo capture provider under Phase 14's double development key; SMTP through the official nodemailer provider; plain text with the record number only | Nothing leaves the machine in development; the test double never runs in production; data minimisation | ✓ |
| A local SMTP capture server (Mailpit) | Installs something on the build host | |
| The plugin's `sendmail` default | Would try to send real mail | |
| Emails with titles and statements | Content leaves CSRM's access control | |

**Choice:** D-28.

## When the run happens

| Option | Description | Selected |
|---|---|---|
| A daily timer just after the UTC day turns, plus a run at every start, plus an evaluation inside each treatment act | Matches the rule's UTC calendar, catches up after downtime, and tells people at once when a date moves | ✓ |
| Daily only | A date moved into the lead waits up to a day | |
| A Sydney-morning timer | Runs before the UTC day turns, so reminders arrive a day late | |

**Choice:** D-26.

## The fallback recipient (13 D-11)

| Option | Description | Selected |
|---|---|---|
| The releasing analyst (`approvedBy`) while eligible, otherwise nobody (the alerts show the work) | Phase 13's suggested default; no fan-out | ✓ |
| Every analyst | Team fan-out, which 19.1 D-06 rejects | |

**Choice:** D-25.

## The journey's treatment owner

| Option | Description | Selected |
|---|---|---|
| Jane, named in 17.1's Treat step, so the final slice also shows the treatment owner's refusals | No new persona; realistic for a Requestor | ✓ |
| The risk owner persona (the default) | The refusals move to the phase spec | |
| A new persona | More fixtures, and a new Keycloak subject | |

**Choice:** D-30. **Notes:** a seam for 17.1's planner, named in the return.

## Records

| Option | Description | Selected |
|---|---|---|
| Two records: treatment tracking, and reminders and email | Each reviewable on its own topic; the ROADMAP lets delivery facts "get their own" | ✓ |
| One record for everything | Mixes the email channel with the risk model | |

**Choice:** `<contract_gaps>`.

---

## Claude's Discretion

Paths, names, bounds, module placement, batch and retry sizes, the capture file format, whether the owner history is a sibling read, and the copy and layouts are left to research, the planner and the UI-SPEC (CONTEXT, "Planner's Discretion", "Open for research", "Open for the UI-SPEC").

## Deferred Ideas

- Decisions and re-assessments after release.
- Changing the risk owner or executive approver after release.
- Approval of date or plan changes, and exceptions granted after a re-rating.
- Control owners recording delivery; control implementations added after release.
- Escalation and alerts for overdue reviews; reminders for responses and contest points.
- Digests, preferences and further channels (NOTIFY-03); email for events; a delivery report.
- Breakdowns by division and business unit (Phase 22); persisted run history (Phase 21).
