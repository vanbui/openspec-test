# Connector and synchronization framework interview

## Stated stack and scope

- Strapi backend store, Next.js administration console and Keycloak authentication/SSO.
- Import identities from external sources and keep their records synchronized.
- Provision accounts and entitlements into downstream systems.

## Accepted working direction — round 1

The user answered yes to the recommendations as a group.

- Distinguish an identity from its source records and connected-system accounts.
- Anchor evaluation in one real source and one real target, with mandatory follow-on systems identified.
- Keep Strapi's ownership of authoritative identity/provisioning state open pending comparison with an existing engine.
- Allow a separate Java service when its benefits justify the operating cost.
- Prefer an open-source foundation; commercial acceptability and exact license restrictions remain unanswered.
- Start with scheduled synchronization within 5–15 minutes, durable retries and periodic reconciliation. A stricter disabling deadline remains to be established.

## Unresolved prerequisites

- Actual pilot source and target, supported operations and interfaces.
- Approximate identity/system/change volumes.
- Source authority, correlation and conflict policy.
- Provisioning failure, acknowledgment and deletion semantics.
- License constraints and supported deployment environment.

No connector framework or engine has been selected. No ADR is justified yet.

## Accepted working direction — round 2

The user answered yes to the recommendations as a group.

- Pilot: SIMS source -> Keycloak target; import people/relationships, create/update/disable accounts and assign groups/roles.
- Provisional scale: up to 10,000 identities, 2–5 systems and hundreds of changes per day. This is a planning estimate, not a measured dataset.
- Include copyleft frameworks in evaluation and assess obligations once the deployment/distribution model is known.
- Internal use vs hosted customer service vs distributed software remains unanswered.

Next frontier: stable identity correlation, attribute ownership, initial/full reconciliation requirements and deployment/distribution model.

## Accepted working direction — round 3

The user answered yes to all four recommendations.

- Correlate SIMS records by stable source person identifier such as EMPLID, with a distinct internal identity ID and explicit account/source links. Email is supporting information, not an automatic merge key.
- Declare attribute ownership. SIMS owns imported fields; administration owns separately defined local fields/access. Reject ordinary edits to source-owned fields; overrides remain outside the initial scope.
- Require full initial import and periodic complete reconciliation, plus incremental synchronization between runs. Complete source enumeration needs to be verified/implemented for SIMS.
- Pilot is an internally operated organizational system. Hosted service or customer distribution is outside this pilot assumption.

No engine selected. Next frontier: engine ownership of identity/operational state, confirmed departure vs missing-source behavior, and repair of target drift for managed attributes/memberships.

## Accepted working direction — round 4

The user answered yes to Q13–Q16.

- Existing engine owns canonical identities, account/source links, checkpoints and provisioning state. Strapi owns application data and explicit projections; identity mutations go through engine APIs. Keycloak owns authentication/SSO.
- Confirmed SIMS departure/inactive lifecycle signals disable managed accounts on next successful sync; unexplained missing records are flagged for review. Source failure/incomplete exports do not imply departures. Permanent account deletion is outside the pilot. Affiliation-specific inactivity still needs clarification.
- Evaluate upgrading/testing the existing SIMS ConnId connector first. Pilot checks include loading, full enumeration, incremental changes and trigger acknowledgment; replacement remains possible if maintenance is more expensive.
- Manage a limited, explicitly declared set of Keycloak groups/roles and memberships, including definition creation. Other application roles remain separately administered.

Next frontier: policy location, overlapping affiliations, managed target drift, and initial authentication/bootstrap. Engine selection remains provisional; midPoint is the leading candidate, Syncope the alternative.

## Accepted working direction — round 5

The user answered yes to Q17–Q20.

- Identity engine evaluates lifecycle/access rules and desired state; Next.js administers those policies and Strapi supplies application-specific inputs. Do not implement a second provisioning authority in Strapi.
- Preserve active affiliations when another ends. Remove affiliation-derived access individually; disable the account when no qualifying affiliations remain or an explicit person-level suspension applies. This qualifies the earlier departure rule.
- Reconcile managed target attributes/memberships to desired state while preserving separately administered access. Intentional exceptions go through the engine.
- Keycloak owns credentials, password reset, MFA and login setup. Password synchronization is outside the pilot; first-login flow configuration is separate.

The substantive pilot interview is complete. Framework recommendation and shared-understanding confirmation are pending.
