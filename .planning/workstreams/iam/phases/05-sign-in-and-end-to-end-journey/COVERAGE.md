# Phase 5 external capability coverage

Status: bounded project scope for planning; all live facts/evidence pending. This inventory scopes dependencies to SIGN-01/SIGN-02 and P5-01–P5-25. It is not an attempt to implement each vendor's full administration API.

| System / capability | Decision and plan | Reason / proof obligation |
|---|---|---|
| Keycloak26.6.1 execute-actions-email PUT + UPDATE_PASSWORD | Required, 01/09/11/12 | Stored subject only; exact body; endpoint acceptance is distinct from Mailpit receipt. |
| client_id / redirect_uri / lifespan query contract | Probe mandatory, omit initially, 09/11 | Verify units/defaults/client/redirect validation from pinned local source and controlled observations; fresh CSRM sign-in needs no action redirect. |
| SMTP configured versus absent | Required probe + local seed, 04/09/11 | Only existing Mailpit internal1025, no public SMTP; requiredActions alone is not accepted delivery proof. |
| Existing UPDATE_PASSWORD and resend behavior | Required, 03/09/11 | Observe mail, actual consumption and resulting actions; do not promise old-link invalidation beyond observations. |
| Password form and OIDC browser auth | Required, 07/08/12 | Actual private action URL, runtime password choice then independent fresh Auth.js sign-in. |
| Admin reset-password / direct grant happy path | Opt out | Contradicts P5-02/P5-15; existing manual behavior is preserved, never used as journey proof. |
| Arbitrary-subject/email resend, invitation UI/public endpoint | Opt out | P5-07 limits recovery to local documentId administration command; no authority expansion. |
| Remote disable/end sessions and user state | Reuse, 06/08/12 | Existing durable outbox remains disableAndEndSessions-only; prove after immediate local refusal. |
| Group/role federation, corporate IdP, client upgrades | Opt out | Explicit phase boundary; Requestor birthright derives from Strapi catalogue, no HR-granted roles. |
| Mailpit message search/detail bounded polling | Required, 07/12 | Exact run recipient/time/unseen ID; stale/ambiguous match refuses. |
| Mailpit body/action URL export, mailbox browsing UI, deletion of unrelated mail | Opt out | Secrets stay memory/private; gate uses only controlled messages and no broad mailbox-management feature. |
| Mailpit version/API uncertainty | Check actual local runtime in probe, 09/11 | Pin existing deployment/config; use installed/local version evidence and safe controlled observations, no network lookup/install. |
| midPoint4.8.14 + connectorV1.2.9 persistent objects100/110/140/150/300–340 | Reuse, 06/12 | Delivered production configuration, no simulated main lifecycle/direct shadow creation. |
| Whole snapshot publisher, validation and native task REST run/status | Required, 06/12 | Exact existing header; validated publish only; freshness/native result after trigger; schedules suspended to avoid races. |
| Paging and five-minute cycle / retryLater5/15 | Preserve, 06/09/12 | On-demand proof makes no elapsed-cadence claim; IN-03 recovery uses genuine scanner/trigger. |
| Native audit/SCIM correlation | Required, 05/06/09/12 | Distinguish connector requests and direct negative probes; missing observations cannot be fabricated. |
| IN-03 remote-only email conflict | Required, 09/12 | 503 Retry-After30/local rollback/unchanged binding/no invitation, controlled correction and eventual retry recovery. |
| New retry engine/status reclassification, scheduling acceleration | Opt out | Phase4 A5 is authoritative; preserve actual connector semantics and bounded recovery budget. |
| Claims/reconciliation/existing capture history | Preserve, 02/06/10 | Exclusions prevent claim invites; no new claim workflow; recapture only if request/mapping contract changes. |
| Schema/JDL/new dependency/full vendor API coverage | Opt out | Frozen model and explicit bounded scope; existing packages/harnesses suffice. |

All required new remote work is behind a fake-client/offline adapter seam with explicit orchestrator live checkpoints for acceptance. A fake response, offline --check, historical connector envelope or plan review never establishes these server facts.

