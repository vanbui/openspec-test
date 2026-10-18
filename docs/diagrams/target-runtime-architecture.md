# IdamBox platform target runtime

Open [the interactive diagram](target-runtime-architecture.html). Its editable source is [target-runtime.architecture.json](target-runtime.architecture.json).

This is the intended platform architecture, grounded in the repository and the accepted IAM decisions. CSRM is shown as the first Generally Available product as requested; IdamBox LMS and IdamBox Compliance are planned products. This diagram does not certify release readiness or claim that the target integrations are all deployed.

## Component responsibilities

| Component | Core capabilities and responsibility |
|---|---|
| IdamBox product runtimes | Each product owns its user experience and uses the shared backend through a typed server API client. CSRM supplies risk requests, questionnaires, assessments, controls and analyst release. LMS and Compliance are future products; their detailed domain contracts remain to be defined. |
| Strapi backend | Shared IdamBox Users, Applications, Roles, Functions and FunctionAPI grants; identity/source ownership checks; product domain APIs; record access; validation and workflow enforcement. Strapi remains the production API boundary for every product. |
| Strapi SCIM interface | Target RFC 7643/7644 `/scim/v2/Users` operations and discovery endpoints. A source-specific service identity and bearer token permit only that source's identity operations. Groups cannot grant IdamBox roles; the current target contract returns an empty Group list and rejects Group writes. |
| Keycloak | Reference Access Management (AM): OIDC sign-in, SSO, MFA capability, token issuance and session management. Strapi owns the IdamBox authorization decision. |
| midPoint | Reference Identity Management / Governance (IGA): source correlation, attribute mappings, joiner/mover/leaver decisions, synchronization, reconciliation, retry and audit. Its reference deployment has its own PostgreSQL repository and audit data, separate from the platform database. |
| ConnId connectors | Common open source connector SPI and protocol adapters, including CSV, LDAP and DatabaseTable source connectors and the selected SCIM2 target connector. These execute within the reference midPoint runtime; the separate diagram box expresses their responsibility, not an additional network service. |
| Private platform database | Shared identity, application/grant and product records, including durable deactivation outbox work. Products and identity engines access these records through Strapi. |

Private file storage, malware scanning and AI assistance are product workflow capabilities supported by the backend. Existing CSRM adapters support private local or S3 storage, ClamAV scanning and deterministic or OpenAI-compatible draft providers. They are summarized in the cards rather than promoted into universal dependencies of every future product. Storage URLs remain private; external AI processing is controlled by the configured data policy. Human review governs CSRM assessment release.

## Customer IAM replacement contracts

**Replace midPoint:** a customer's IGA can use its own native source connectors and push identities through the same Strapi SCIM contract. ConnId is part of the reference midPoint implementation; replacement products do not have to implement ConnId. Source identity attributes and active status remain separate from IdamBox-owned roles. The IGA never writes the platform database or provisions the reference Keycloak directly.

**Replace Keycloak:** a customer's AM must supply compatible OIDC authentication, issuer/JWKS verification, audience and claim rules, stable subject mapping, logout/session handling and an identity synchronization/revocation adapter. Strapi must retain immediate refusal of inactive users and durable downstream revocation. This is a target integration seam: today's authentication configuration, verification claims, endpoint paths and Admin API client contain Keycloak-specific behavior. Provider replacement therefore requires adapter work and conformance checks; it is not currently a provider-name setting. Keycloak identity brokering to an existing IdP is another deployment option.

The security boundaries in the diagram are logical authority boundaries, not claims about a particular customer's networks, hosting provider, clusters or tenancy model. Identity sources and IAM assertions are external input; Strapi authenticates, validates and authorizes every request. Product session secrets and platform credentials stay on the server. SCIM sources cannot access another source's restricted identities, modify protected users or grant product roles.

## Standards and connector support

OIDC and SCIM are the open interoperability standards at the IdamBox integration boundaries. ConnId provides an open source common Java SPI; individual connector bundles have independent maintainers and support arrangements. Prefer maintained bundles with an explicit vendor or partner support path where the deployment requires support. [Evolveum's ConnId documentation](https://docs.evolveum.com/connectors/connid/) describes this separation.

The pinned reference SCIM2 connector, Provision IAM `V1.2.9`, is community-supported and has no Evolveum support guarantee. Its discovery compatibility was proved by the repository's spike; that result is narrower than full provisioning conformance. This qualification follows [ADR 0006](../adr/0006-midpoint-lts-and-community-scim2-connector.md) and [Evolveum's SCIM2 catalogue entry](https://docs.evolveum.com/connectors/connectors/com.exclamationlabs.connid.base.scim2.Scim2Connector/). Open source availability and a common SPI do not imply a support guarantee for every connector.

## Repository evidence and target status

The diagram pins source evidence to the revision in its JSON specification. Architecture acceptance and execution status come from different records:

- [Platform project guide](../../.planning/PROJECT.md): one shared backend with independently developed product applications.
- [ADR 0005](../adr/0005-midpoint-identity-engine-and-strapi-scim.md): identity engine, SCIM boundary, field ownership and sole reference Keycloak writer.
- [IAM roadmap](../../.planning/workstreams/iam/ROADMAP.md): phases for the Strapi SCIM service, midPoint resource configuration and the end-to-end journey. Those planned capabilities are included here because this is the target state.
- [Backend runtime](../../apps/backend/src/index.ts), [Application model](../../apps/backend/src/api/application/content-types/application/schema.json) and [identity service](../../apps/backend/src/iam/identity/identity-service.ts): shared backend and source-ownership foundations.
- [OIDC verification](../../apps/backend/src/keycloak/access-token-verifier.ts) and [AM revocation worker](../../apps/backend/src/iam/keycloak-sync/worker.ts): current Keycloak coupling and local deactivation with downstream retry.

Rebuild with Archify `deliver architecture`, passing this specification, the HTML path, `--repo-root` for the matching checkout, and `--quality showcase`. The [delivery receipt](target-runtime-architecture.delivery.json) binds the exact specification and HTML bytes; the [browser receipt](target-runtime-architecture.visual-check.json) records viewport evidence separately.
