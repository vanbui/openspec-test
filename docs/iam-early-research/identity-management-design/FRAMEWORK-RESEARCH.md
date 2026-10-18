# Connector and synchronization framework research

Research date: 2026-10-11. Preliminary evidence for the design interview; no framework selection. Pilot assumptions supplied by the interview: SIMS source, Keycloak target, roughly 10,000 identities, 2–5 systems, hundreds of daily changes, 5–15 minute polling, Java service acceptable, copyleft candidates included. The subsequent interview confirmed an internally operated organizational pilot; customer hosting/distribution is outside that assumption.

## Decision boundary

| Candidate | What the community supplies | What this project still owns |
|---|---|---|
| ConnId in a custom Java service | Connector API, bundles, isolated connector loading, optional remote connector server | Identity/account model, correlation, attribute authority, desired-state calculation, scheduling/checkpoints, durable delivery/recovery, reconciliation, audit, application API |
| midPoint | Identity repository, mappings, correlation and synchronization reactions, assignments/roles, provisioning consistency and tasks; ConnId connectors | SIMS semantics and dependencies, resource/mapping configuration, entitlement policy, Strapi/Next.js API integration and data ownership |
| Apache Syncope | Identity repository, configurable resource mappings, pull/push/propagation, correlation/remediation, scheduled tasks; ConnId connectors | SIMS semantics and dependencies, resource/mapping configuration, Keycloak connector validation, entitlement policy, Strapi/Next.js integration and data ownership |
| Keycloak User Storage SPI | Custom external-user federation/import and scheduled import synchronization inside Keycloak | Custom source provider plus the separate cross-system provisioning, policy, recovery, and audit solution |

ConnId explicitly describes itself as the exchange layer between identity managers and repositories. The responsibilities listed for a custom engine are architectural inference, not a claim that ConnId is a complete IDM engine. [ConnId project](https://connid.tirasa.net/)

midPoint uses common synchronization policies across provisioning, change polling, reconciliation and discovery. Communication failures can be stored as pending operations and retried; a refresh/reconciliation task is needed to ensure retries occur. [Synchronization introduction](https://docs.evolveum.com/midpoint/reference/support-4.10/synchronization/introduction/), [Provisioning consistency](https://docs.evolveum.com/midpoint/reference/master/synchronization/consistency/)

Syncope uses ConnId bundles, including Database, Scripted REST and SCIM; extra bundles can be installed. Pull supports full/filtered reconciliation and incremental mode. Incremental mode requires connector SYNC support and is the documented mode for pulling delete events. Propagation policies provide attempts/backoff; task persistence depends on trace configuration. Its REST interface exposes core operations; SCIM extension provides an additional inbound /scim endpoint. Its term “entitlements” denotes administrative privileges, so business target permissions must not be blindly equated with that term. [Syncope 4.1.3 reference](https://syncope.apache.org/docs/reference-guide.html)

## SIMS / Oracle choices

1. **Existing custom SIMS ConnId bundle:** closest reuse of current SQL, relationships and trigger handling. Existing ConnId 1.4.2.18 and UNSW JCA dependencies are interview context from previous local analysis; no compatibility build performed in this research. Both engines use ConnId, but sharing an API does not prove the old bundle loads or behaves correctly in a chosen current engine. Resource configuration and engine-side policies are not portable unchanged.
2. **DatabaseTable:** community JDBC connector for one generic table; supported/active according to Evolveum. Live synchronization uses modification timestamps. A flattened SIMS view could make it viable, but joins, relationship semantics and reliable deletion/trigger acknowledgement still require design. [Connector capabilities](https://docs.evolveum.com/connectors/connectors/org.identityconnectors.databasetable.DatabaseTableConnector/)
3. **ScriptedSQL:** JDBC wrapper implementing operations through custom scripts; unrestricted joins/procedures are possible. Evolveum marks it stable, dormant and supportable. Version 2.3 upgrades to Groovy 4 for midPoint 4.8. SQL knowledge is reusable, but the operation scripts and checkpoint/delete semantics are implementation work. [Connector](https://docs.evolveum.com/connectors/connectors/com.evolveum.polygon.connector.scripted.sql.ScriptedSQLConnector/), [JDBC scripting example](https://docs.evolveum.com/connectors/resources/sql/)

Do not assume a connector named Oracle or PeopleSoft HCM implements this custom SIMS schema and trigger protocol. Exact fit requires inspecting its managed object model and operations.

## Keycloak target

Openstandia supplies a ConnId connector documented by Evolveum: Admin REST API with OIDC authentication, one managed realm per resource. Provisioning, activation, passwords and paging are supported; live synchronization is not. Managed entities include users, clients, client roles, realm roles and groups; user memberships are modeled through simulated references. Evolveum labels it community-supported. [Capabilities](https://docs.evolveum.com/connectors/connectors/jp.openstandia.connector.keycloak.KeycloakConnector/)

Its repository reports automated connector tests against Keycloak 15.0.2, 24.0.5, 26.0.8 and 26.6.1, and midPoint deployment tests against 4.0.4, 4.4.11, 4.8.11 and 4.10.2. These are the published CI matrix, not a guarantee for the user's unspecified installed versions. Syncope deployment is not listed in that matrix: validate object classes, role/group membership behavior and bundle dependencies there before claiming reuse. [Connector repository](https://github.com/openstandia/connector-keycloak)

Keycloak directly provides user/group/role administration through its Admin REST API. Its User Storage SPI ImportSynchronization enables full and since-last-sync import with scheduling; this serves external-user federation, not documented general downstream provisioning. No native SCIM capability was established from the examined official developer/API docs; a SCIM connector does not establish that a target exposes SCIM. Treat Keycloak SCIM as an extension-specific choice requiring separate evidence. [Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html), [User Storage SPI](https://www.keycloak.org/docs/latest/server_development/index.html)

## Application integration and licensing

midPoint REST supports JSON operations over its repository/model. Syncope exposes REST for its Core. A Next.js/Strapi facade is consequently feasible (inference), but both full engines own repositories and operational state; replacing that persistence with Strapi is not established. Choose one writer for lifecycle decisions and make any Strapi copy/projection explicit. [midPoint REST](https://docs.evolveum.com/midpoint/reference/support-4.9/interfaces/rest/), [Syncope architecture](https://syncope.apache.org/docs/reference-guide.html#architecture)

| Component | Documented license |
|---|---|
| ConnId original/derived code | CDDL 1.0; independently developed connectors may use Apache 2.0; inspect each selected bundle |
| midPoint 4.10 onward | EUPL only; 4.8 and 4.9 remain dual EUPL/Apache 2.0 |
| Apache Syncope | Apache 2.0 |
| Openstandia Keycloak connector | Apache 2.0 |
| Keycloak | Apache 2.0 |

Sources: [ConnId licensing](https://connid.tirasa.net/), [midPoint change announcement, September 2025](https://evolveum.com/midpoint-adopting-eupl/), [Syncope reference](https://syncope.apache.org/docs/reference-guide.html), [connector license](https://github.com/openstandia/connector-keycloak/blob/master/LICENSE), [Keycloak license](https://github.com/keycloak/keycloak/blob/main/LICENSE.txt). Old midPoint dual-licensing documentation predates and conflicts with the 4.10 announcement. This records license facts, not a legal interpretation of the deployment.

## Next interview decisions

- Will an engine own canonical identities, links and provisioning state while Strapi owns application data/projections?
- Is preserving the existing SIMS connector/dependencies desirable, or is rebuilding extraction into a flatter source acceptable?
- What immutable correlation key joins SIMS and future sources; what happens on ambiguous matches?
- Which source owns each attribute and affiliation, and who may edit them through the console?
- Should manual downstream changes be overwritten, adopted or flagged; do users have multiple affiliations?
- Define leaver/deletion behavior, outage recovery, acknowledgement point and acceptable replay; decide whether Keycloak role/group creation is managed or membership-only.
- Confirm exact engine/connector/Keycloak/JDBC versions and distribution model before a pilot recommendation becomes an ADR.
