# Proposed framework decision

Status: awaiting user confirmation of shared understanding and selection.

## Recommendation

Adopt midPoint as the identity synchronization and provisioning engine, with ConnId connectors for target/source integration. Retain Keycloak for authentication/SSO, Next.js for the administration console, and Strapi for application-specific data and explicit projections. Identity state mutations and policies go through midPoint; Strapi is not a second canonical identity or provisioning store.

## Why this fits the accepted requirements

The pilot needs stable person/account correlation, authority per attribute, full and incremental reconciliation, multiple affiliations, managed group/role provisioning, drift repair, retries and lifecycle handling. midPoint supplies these engine responsibilities and already uses ConnId, offering the shortest evidenced route to reuse the custom SIMS connector. A community Keycloak connector covers user/group/role provisioning and activation. Framework sharing is a reuse opportunity, not a compatibility guarantee for the old SIMS dependencies.

## Alternatives

- ConnId alone: useful connector ecosystem but leaves identity policy/state, scheduling, durable operations, reconciliation and application APIs for this project to implement.
- Apache Syncope: credible engine alternative using ConnId; consider if midPoint validation fails or deployment/licensing constraints favor it. The researched Keycloak connector documents midPoint deployment tests; equivalent Syncope fit needs separate validation.
- Keycloak User Storage SPI alone: handles user federation/import into Keycloak, but does not supply the required general downstream identity provisioning engine.

## Pilot boundaries

SIMS -> one Keycloak pilot integration; about 10,000 identities, 2–5 systems in the initial planning envelope, hundreds of changes daily; scheduled changes within 5–15 minutes plus complete initial import/periodic reconciliation. Internal organizational deployment; Java service acceptable; copyleft candidates allowed for assessment. Selected Keycloak groups/roles and memberships are managed; other access is preserved. Keycloak owns credentials/MFA and onboarding. Account deletion and password synchronization are outside the pilot.

Person IDs are stable and explicit source/account links are maintained. Email does not automatically merge people. Source-owned fields reject ordinary local edits. Affiliation-specific departure removes that access; person-level suspension or no remaining qualifying affiliation disables the account. Missing source records are flagged rather than treated automatically as departures.

## Evidence checks before implementation choice is treated as validated

1. Choose supported midPoint, Keycloak, connector, Java and JDBC/JCA versions; verify applicable component licenses for this deployment.
2. Verify existing SIMS connector loading/upgrading and external UNSW dependencies. Recover five absent trigger-write XML definitions.
3. Establish complete SIMS enumeration for initial/recovery reconciliation; trigger polling alone is insufficient.
4. Test stable matching, overlapping affiliations, field ownership, Keycloak account/group/role provisioning and managed drift repair.
5. Test transient source/target failures and process crashes. Demonstrate durable target-operation recovery, safe source acknowledgment and replay without duplicate identities/accounts. Do not infer persistence success from an API callback alone.
6. Validate engine REST integration with the custom console and Strapi data ownership boundary. midPoint-specific resource mappings do not port automatically to other engines.

## Sources

- [ConnId in midPoint](https://docs.evolveum.com/connectors/connid/)
- [midPoint synchronization](https://docs.evolveum.com/midpoint/reference/support-4.10/synchronization/introduction/)
- [Provisioning consistency](https://docs.evolveum.com/midpoint/reference/master/synchronization/consistency/)
- [Community Keycloak connector](https://docs.evolveum.com/connectors/connectors/jp.openstandia.connector.keycloak.KeycloakConnector/)
- [Connector implementation/CI evidence](https://github.com/openstandia/connector-keycloak)
- [Syncope reference](https://syncope.apache.org/docs/reference-guide.html)

See FRAMEWORK-RESEARCH.md for source boundaries, connector status and license facts. This is a design recommendation; no compatibility or live provisioning test has run.
