/*
 * The descriptive content of every seeded Assessment Request, keyed by its
 * stable request number.
 *
 * Each entry is written to the level of detail a real requestor supplies (see
 * the BAU example the product demo is modelled on): what is planned, why it is
 * needed, how it works, and why a cyber risk assessment is being asked for.
 * The AI questionnaire generation reads the title, description, assessment
 * type, business purpose, criticality and third-party fields, so these are the
 * facts that exercise its quality.
 *
 * Workflow facts (status, dates, owner) and the titles the browser specs
 * duplicate by value stay in each fixture's own seed file.
 *
 * `businessPurpose` and `thirdPartyDetails` stay short: the deterministic
 * questionnaire provider quotes them inside a question.
 */

export type SeedRequestDetails = {
  description: string;
  assessmentType: "BAU" | "Project" | "Other";
  division: string;
  businessUnit: string;
  businessPurpose: string;
  thirdPartyInvolvement: boolean;
  thirdPartyDetails: string | null;
  regulatoryRequirements: string;
};

type Narrative = {
  plan: string;
  why: string;
  how: string;
  assessment: string;
  knownGaps: string;
};

function narrative(sections: Narrative): string {
  return [
    sections.plan,
    `Why we need it\n${sections.why}`,
    `How it works\n${sections.how}`,
    `Why a cyber assessment is needed\n${sections.assessment}`,
    `Known gaps and open questions\n${sections.knownGaps}`,
  ].join("\n\n");
}

const SEED_REQUEST_DETAILS = {
  "RAR-DEV-CROSS-001": {
    description: narrative({
      plan:
        "We plan to secure every Azure Pipeline in the organisation with an Azure Pipeline Decorator. A meeting is booked for next week to agree the implementation steps, and we would like the assessment under way before then.",
      why:
        "The DevSecOps team maintains the CI/CD pipeline templates used for application delivery. The templates include vulnerability scanning (JFrog Xray), code quality and coding standards checks (SonarQube). Some project teams create custom pipelines that do not extend the templates, which bypasses all of those checks. A custom pipeline has no vulnerability scan, and because pipelines run with elevated access on the application servers a project team can run any script there. We need a step in every pipeline that cannot be bypassed.",
      how:
        "A pipeline decorator is a private Azure DevOps extension that we author and install in our own Azure DevOps organisations. Once installed it injects the step we define into every pipeline in that organisation, existing and new, and a project team cannot remove it. The first version injects a script that raises a warning when a pipeline does not extend the enterprise template; a later version will fail the run. The DevSecOps team authors the decorator in a Git repository, the DevSecOps team lead reviews and publishes it, and an organisation administrator installs it in each Azure DevOps organisation. It has been proven in a personal Azure DevOps organisation only.",
      assessment:
        "There is an existing cyber assessment process for installing third-party Azure DevOps extensions, but it does not fit: this is our own code, it is private to our tenant, and we control its whole life cycle. The impact is organisation-wide, because one faulty or malicious change to the decorator runs in every pipeline, including those that deploy to production.",
      knownGaps:
        "The decorator is not environment specific, so it cannot be promoted from lower environments to production; we intend to trial it in a small Azure DevOps organisation first. Rollback is to uninstall the extension, and that procedure has not been tested or documented. There is no timeout or feature flag on the injected step yet. The data handled is classified Restricted Internal and stays in Azure DevOps Services. The risk owner and system owner is the Lead, Enterprise DevSecOps Services.",
    }),
    assessmentType: "BAU",
    division: "Technology",
    businessUnit: "Enterprise DevSecOps Services",
    businessPurpose: "enforcing mandatory security checks on every Azure DevOps pipeline through a pipeline decorator",
    thirdPartyInvolvement: false,
    thirdPartyDetails: null,
    regulatoryRequirements:
      "Internal Secure Development Standard (mandatory vulnerability and code quality scanning before release). Change management policy for shared delivery tooling. ISO/IEC 27001:2022 A.8.25 to A.8.32.",
  },
  "RAR-DEV-QUES-001": {
    description: narrative({
      plan:
        "Release 4.2 of the customer portal goes to production in the next quarter. It adds self-service change of bank account details, upload of identity documents for verification, and a new passkey sign-in option alongside the existing password and SMS one-time code.",
      why:
        "Around 38,000 customers use the portal each month and the contact centre handles roughly 2,500 bank detail changes a month by phone. Moving those changes online removes manual re-keying and shortens the change from three business days to same day. Identity document upload replaces email attachments, which are currently sent to a shared mailbox.",
      how:
        "The portal is a React single-page application served through Azure Front Door with the web application firewall in prevention mode. The API runs on Azure App Service in Australia East and stores data in Azure SQL Database; uploaded documents go to an Azure Storage account with a private endpoint and are scanned by Microsoft Defender for Storage. Customer sign-in uses Microsoft Entra External ID. A bank detail change triggers a step-up one-time code and a notification to the previous contact details. The managed support provider has production read access through just-in-time elevation and deploys releases through the enterprise pipeline templates.",
      assessment:
        "The release makes the portal the entry point for payment redirection fraud and brings identity documents into scope for the first time. The last penetration test was 14 months ago and did not cover file upload or the new sign-in flow.",
      knownGaps:
        "Retention for uploaded identity documents has not been agreed with Records Management. Passkey account recovery falls back to SMS. The support provider's offshore team can see customer contact details in application logs. A penetration test is booked but its scope is not final.",
    }),
    assessmentType: "Project",
    division: "Customer and Digital",
    businessUnit: "Digital Services",
    businessPurpose: "providing customers with secure self-service access to account, payment and identity verification services",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "Microsoft Azure (hosting, Australia East, with Entra External ID for customer identity) and a managed support provider with just-in-time production read access, part of whose team is offshore",
    regulatoryRequirements:
      "Privacy Act 1988 (Australian Privacy Principles 8 and 11) and the Notifiable Data Breaches scheme. PCI DSS is out of scope: card payments are redirected to the payment gateway. Internal Information Classification Standard: customer records are Restricted.",
  },
  "RAR-DEV-QUES-DRAFT-001": {
    description: narrative({
      plan:
        "We want to add a live chat and virtual assistant widget to the signed-in area of the customer portal, with a pilot for 10 per cent of customers for six weeks before full rollout.",
      why:
        "Forty per cent of contact centre calls are simple account questions that start in the portal. A virtual assistant that answers from the customer's own account context, with handover to a human agent, is expected to remove 9,000 calls a month.",
      how:
        "The vendor's JavaScript widget is loaded from the vendor's content delivery network into the portal page. After sign-in the portal passes a short-lived signed token so the assistant can call three read-only portal APIs (account summary, recent transactions, open service requests). Conversations are stored in the vendor's platform in its Sydney region for 90 days and are used by the vendor's large language model to draft answers. Human agents pick up handovers in the vendor's agent console using single sign-on from our workforce identity provider.",
      assessment:
        "This puts third-party script into an authenticated customer session and sends account data and free-text conversations, which customers may fill with personal information, to a vendor we have not used before.",
      knownGaps:
        "We have not confirmed whether conversation transcripts are used to train the vendor's models, nor which sub-processors the vendor uses. The portal content security policy would need to allow the vendor's domains. There is no agreed position on redacting card or identity numbers typed into chat. The vendor holds ISO 27001 certification; we have requested but not received a SOC 2 Type II report.",
    }),
    assessmentType: "Project",
    division: "Customer and Digital",
    businessUnit: "Digital Services",
    businessPurpose: "reducing contact centre demand with an in-portal virtual assistant and live chat",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "A new conversational AI vendor (software as a service, Sydney region) that hosts the chat widget, stores transcripts for 90 days and processes them with its own large language model",
    regulatoryRequirements:
      "Privacy Act 1988 (Australian Privacy Principles 5, 6, 8 and 11). Internal Third-Party Risk Standard: new suppliers handling Restricted data need a supplier security assessment. Internal position on generative AI use with customer data.",
  },
  "RAR-DEV-QUES-UNRELEASED-001": {
    description: narrative({
      plan:
        "We are building a native mobile app for iOS and Android that reuses the customer portal's services. To do that the portal API, which today is only called by the portal's own web front end, will be published to the internet through an API gateway.",
      why:
        "Sixty-eight per cent of portal sessions come from phones and the mobile web experience has the lowest satisfaction score of any channel. The app adds biometric unlock and push notifications for bill and outage alerts.",
      how:
        "The app signs customers in with OAuth 2.0 authorisation code flow with PKCE against the existing customer identity provider and holds refresh tokens in the device keychain or keystore. Azure API Management fronts the existing API with per-client rate limits and JSON schema validation. Push notifications go through Firebase Cloud Messaging and Apple Push Notification service. The app is built by an external digital agency in their own source repository and build pipeline, and handed over as signed release builds.",
      assessment:
        "The API was designed for a trusted first-party front end. Several endpoints rely on the web front end to hide fields and enforce limits, and object identifiers are sequential. Publishing the API and adding a third-party-built client changes the exposure of the whole portal.",
      knownGaps:
        "No authorisation review of the existing endpoints has been done. Refresh token lifetime is undecided: the product team wants 90 days. Jailbreak and root detection, certificate pinning and the agency's secure development practices have not been discussed. The agency would need access to a test environment containing production-like data.",
    }),
    assessmentType: "Project",
    division: "Customer and Digital",
    businessUnit: "Digital Services",
    businessPurpose: "giving customers a native mobile app built on the customer portal's services",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "An external digital agency builds the app in its own repository and pipeline; Google Firebase Cloud Messaging and Apple Push Notification service deliver notifications",
    regulatoryRequirements:
      "Privacy Act 1988 (Australian Privacy Principles 8 and 11). Apple App Store and Google Play data safety declarations. OWASP MASVS and the internal Secure Development Standard.",
  },
  "RAR-E2E-P7-OVERDUE-001": {
    description: narrative({
      plan:
        "We need to upgrade the privileged access management vault from the version that reaches end of vendor support in three months to the current long-term support release, and move it from two on-premises virtual machines to a three-node cluster across both data centres.",
      why:
        "The vault holds about 4,200 privileged credentials, including domain administrator, database and network device accounts, and brokers every administrator session to production. The current version no longer receives security patches after the support end date and the single-site design has caused two outages this year during which administrators used break-glass accounts.",
      how:
        "A new cluster is built alongside the old one, credentials are replicated with the vendor's migration tool, and session brokering is cut over system by system across four change windows. The vendor's professional services team runs the migration over a supervised remote session. During the migration both vaults can rotate the same credentials, so rotation is suspended on the old vault for each batch.",
      assessment:
        "The vault is the highest-value target in the environment and the migration creates a period in which credentials exist in two places, rotation is paused and an external party has administrative access to the vault.",
      knownGaps:
        "The break-glass procedure has not been exercised since the last outage. Replication between data centres crosses a link that is not encrypted at the network layer. The master key ceremony for the new cluster and who holds the recovery key shares have not been decided. Session recordings for the last 12 months must be retained but the migration tool does not move them.",
    }),
    assessmentType: "Project",
    division: "Technology",
    businessUnit: "Security Operations",
    businessPurpose: "keeping privileged access to production systems controlled, supported and resilient",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "The vault vendor's professional services team performs the migration over supervised remote sessions with temporary vault administrator rights",
    regulatoryRequirements:
      "Essential Eight (restrict administrative privileges, patch applications). ISO/IEC 27001:2022 A.5.15 to A.5.18 and A.8.2. Internal Privileged Access Standard: session recordings retained for 12 months.",
  },
  "RAR-E2E-P7-DUESOON-001": {
    description: narrative({
      plan:
        "We plan to move security log collection from the on-premises SIEM to Microsoft Sentinel, starting with identity, endpoint and firewall logs, and to decommission the on-premises collectors within two quarters.",
      why:
        "The current SIEM is licensed for 150 GB a day and we are ingesting 190 GB, so application and cloud audit logs are being dropped. Detection rules have not been tuned for two years and the hardware is due for replacement this financial year.",
      how:
        "Azure Monitor agents and a pair of syslog forwarders send logs to a Log Analytics workspace in Australia East. Interactive retention is 90 days with two years in archive. The managed security service provider that currently monitors the on-premises SIEM will be given access to the Sentinel workspace through Azure Lighthouse to triage incidents around the clock. Both systems run in parallel for eight weeks.",
      assessment:
        "Security logs contain usernames, IP addresses, device names and in some cases request payloads, and they will leave our data centre for the first time. The provider's access through Azure Lighthouse is standing access from another tenant, and during the parallel run there is a risk that neither system has complete coverage.",
      knownGaps:
        "We have not mapped which log sources the current detection rules depend on, so coverage after cutover is unknown. Some application logs are known to contain customer email addresses and there is no masking at ingestion. The provider's analysts are in three countries. Who can delete or change retention on the workspace has not been restricted.",
    }),
    assessmentType: "Project",
    division: "Technology",
    businessUnit: "Security Operations",
    businessPurpose: "restoring complete security monitoring coverage by moving log collection to a cloud SIEM",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "Microsoft Sentinel (Australia East) and the managed security service provider, which gets cross-tenant access through Azure Lighthouse with analysts in three countries",
    regulatoryRequirements:
      "Essential Eight and ISM event logging guidance. Privacy Act 1988 (Australian Privacy Principle 8) for offshore analyst access. Internal Logging and Monitoring Standard: security logs retained for two years.",
  },
  "RAR-E2E-P7-MUTABLE-001": {
    description: narrative({
      plan:
        "This is the annual BAU review of the operational reporting platform ahead of its operating system upgrade. We are asking for the current risks to be reassessed before we commit the upgrade budget.",
      why:
        "The platform produces the daily operational and regulatory reports used by Finance, Operations and the executive team. It was built eight years ago, has had no architecture change since, and the last assessment recorded findings that are still open.",
      how:
        "Six Windows Server 2016 virtual machines host the reporting database, the extract jobs and a web front end available on the corporate network. Nightly extracts arrive from the billing, asset and customer systems; two source systems still deliver over the legacy file transfer service. About 30 administrators and report developers have local administrator rights and sign in with a password only. Logs are kept on each server for 14 days and are not forwarded to the SIEM.",
      assessment:
        "The servers are several months behind on operating system patches because patching needs an outage that the business has declined three times. The platform holds a copy of customer and financial data from every major source system, so a compromise here exposes all of them.",
      knownGaps:
        "There is no multi-factor authentication for administrator sign-in. Service accounts for the extract jobs have not had their passwords changed since the platform was built. The legacy file transfer service is due for decommissioning but two extracts have no replacement path. No one has confirmed which reports are regulatory obligations.",
    }),
    assessmentType: "BAU",
    division: "Technology",
    businessUnit: "Data and Reporting",
    businessPurpose: "producing the daily operational and regulatory reports the business relies on",
    thirdPartyInvolvement: false,
    thirdPartyDetails: null,
    regulatoryRequirements:
      "Essential Eight (patch operating systems, multi-factor authentication, restrict administrative privileges). Regulatory reporting obligations to the industry regulator. Privacy Act 1988 (Australian Privacy Principle 11).",
  },
  "RAR-E2E-P7-RELEASED-001": {
    description: narrative({
      plan:
        "We moved backups of the tier 1 systems from tape to an immutable cloud backup service and asked for the design to be assessed before the tape contract was ended.",
      why:
        "Tape restores took up to four days because tapes are held off site, and the last ransomware exercise showed that the backup catalogue server sat in the same domain as the systems it protects.",
      how:
        "Backup proxies in each data centre send encrypted, deduplicated backups to object storage with a 35-day immutability lock. The backup console is in a separate management domain with its own administrator accounts and hardware security keys. Encryption keys are held in our own key vault. Tier 1 systems are backed up every four hours, everything else nightly.",
      assessment:
        "Backups are the last line of defence against ransomware and contain a full copy of every system, including the directory. The control plane for the backup service is reachable from the internet.",
      knownGaps:
        "Restores have been tested for single files and one virtual machine, but there has been no test against a recovery time target for a whole tier 1 system. Deleting the cloud account would remove all backups despite the immutability lock; the provider's account protection options have not been enabled. Key vault recovery depends on the directory that the backups are meant to restore.",
    }),
    assessmentType: "Project",
    division: "Technology",
    businessUnit: "Infrastructure Services",
    businessPurpose: "making backups of critical systems recoverable within target times after a ransomware attack",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "A cloud backup-as-a-service provider storing encrypted backups in Australian regions; the provider operates the control plane and cannot read backup contents",
    regulatoryRequirements:
      "Essential Eight (regular backups). APRA CPS 230 style recovery objectives adopted in the internal Business Continuity Standard. ISO/IEC 27001:2022 A.8.13.",
  },
  "RAR-E2E-NAV-OWNER-001": {
    description: narrative({
      plan:
        "We rolled out an enterprise password manager to all 2,400 staff, replacing browser-saved passwords and the spreadsheets several teams used for shared accounts.",
      why:
        "An internal audit found 310 shared credentials in spreadsheets and team chat, including social media, supplier portal and bank portal logins. Phishing simulations showed staff reusing their corporate password on external sites.",
      how:
        "The password manager is a software-as-a-service product with zero-knowledge encryption: vaults are encrypted on the device with a key derived from the user's master password. Staff sign in through single sign-on with the workforce identity provider and conditional access requires a managed device. Shared vaults are owned by a team and access follows group membership. A browser extension and mobile apps fill credentials; an offline copy is cached on each device.",
      assessment:
        "It concentrates every staff and shared credential in one supplier's service. A compromise of the supplier, the browser extension or the single sign-on integration would expose them all at once.",
      knownGaps:
        "Account recovery relies on three administrators who can reset any user's access. Shared vaults for the finance team hold bank portal credentials that do not support multi-factor authentication. Personal vaults are allowed and are not visible to the organisation when a staff member leaves.",
    }),
    assessmentType: "Project",
    division: "Technology",
    businessUnit: "Workplace Technology",
    businessPurpose: "removing shared and reused passwords by giving every staff member a managed password vault",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "A password manager vendor (software as a service, data stored in Australia) holding zero-knowledge encrypted vaults for all staff",
    regulatoryRequirements:
      "Internal Access Control Standard and Third-Party Risk Standard. ISO/IEC 27001:2022 A.5.17. Essential Eight (multi-factor authentication).",
  },
  "RAR-E2E-NAV-ANALYST-001": {
    description: narrative({
      plan:
        "We want to replace the remote access VPN with a zero trust network access service for staff and contractors, starting with the 180 external contractors who currently receive full network access.",
      why:
        "The VPN concentrators reach end of support next year and have had three critical vulnerabilities in 18 months, each needing an emergency patch. Contractors on the VPN can reach the whole corporate network, although most need two or three applications.",
      how:
        "A lightweight agent on each device connects to the vendor's cloud service, which brokers access to named applications through connectors we host in each data centre. Access is granted per application based on identity group, device compliance and location. Contractors on unmanaged devices use a browser-isolated session with clipboard and download disabled. The VPN stays in place for network and server administrators until phase 2.",
      assessment:
        "All remote access to internal applications will depend on, and pass through, a vendor's cloud service. The connectors make outbound connections that bypass the inbound firewall rules our current controls are built around.",
      knownGaps:
        "The vendor can terminate TLS for inspection and we have not decided whether to enable it. There is no fallback if the vendor's service is unavailable. Operational technology jump hosts are currently reached over the VPN and are out of scope, so the VPN cannot be fully retired. Contractor device compliance cannot be checked on unmanaged devices.",
    }),
    assessmentType: "Project",
    division: "Technology",
    businessUnit: "Network Services",
    businessPurpose: "giving staff and contractors remote access to only the applications they need",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "A zero trust network access vendor whose cloud service brokers all remote sessions, with points of presence in Sydney and Melbourne",
    regulatoryRequirements:
      "Internal Remote Access Standard. Essential Eight (multi-factor authentication, patch applications). Security of Critical Infrastructure Act risk management program obligations for systems reachable from the corporate network.",
  },
  "RAR-DEV-RISK-001": {
    description: narrative({
      plan:
        "This is a BAU reassessment of the customer portal's internet-facing components following the external penetration test completed last month. We are asking for the open findings to be rated and tracked in the Risk Register.",
      why:
        "The portal is the organisation's main customer channel and holds contact, identity and billing details for every active customer. The penetration test reported one high and four medium findings and the product owner needs an agreed treatment plan before the next release.",
      how:
        "The portal's web tier runs on Azure App Service behind Azure Front Door. The application framework and three third-party libraries are two major versions behind; the high finding is a known vulnerability in one of them that is reachable without signing in. Patching is done by the support provider in a monthly window. The web application firewall is in detection mode for two rule groups because they blocked legitimate uploads.",
      assessment:
        "A publicly reachable, known vulnerability on a system holding Restricted customer records needs a rated risk, an owner and a treatment date. The compensating control, the web application firewall, is not blocking the relevant rule group.",
      knownGaps:
        "No evidence has been supplied that last month's patch window was completed. The application has no software bill of materials, so the full list of outdated components is not known. Administrative access to the content management console is available from the internet with a password and one-time code.",
    }),
    assessmentType: "BAU",
    division: "Customer and Digital",
    businessUnit: "Digital Services",
    businessPurpose: "keeping the internet-facing customer portal patched and protected against unauthorised access",
    thirdPartyInvolvement: true,
    thirdPartyDetails:
      "Microsoft Azure hosts the portal; the managed support provider applies patches in a monthly window; an external firm performed the penetration test",
    regulatoryRequirements:
      "Essential Eight (patch applications: internet-facing vulnerabilities within two weeks, or 48 hours when an exploit exists). Privacy Act 1988 (Australian Privacy Principle 11). OWASP ASVS.",
  },
  "RAR-RELEASED-33SAEN": {
    description: narrative({
      plan:
        "We asked for an assessment of exposing the customer portal's outage map and service status pages to the internet without sign-in, so customers can check outages without an account.",
      why:
        "During the last major outage the contact centre received 14,000 calls in four hours, most asking for information the portal already shows to signed-in customers.",
      how:
        "The outage map and status pages are served from the existing portal through Azure Front Door with caching, rate limiting and the web application firewall in prevention mode. The pages read from a replica that contains outage areas and restoration estimates only; no customer records are reachable from the unauthenticated routes.",
      assessment:
        "Unauthenticated routes widen the portal's attack surface and share infrastructure with the signed-in application that holds Restricted customer records.",
      knownGaps:
        "The unauthenticated and authenticated routes share one application instance rather than being deployed separately. Load during a major outage has been modelled but not tested.",
    }),
    assessmentType: "BAU",
    division: "Customer and Digital",
    businessUnit: "Digital Services",
    businessPurpose: "letting customers check outage and service status without signing in",
    thirdPartyInvolvement: true,
    thirdPartyDetails: "Microsoft Azure hosts the portal and provides the content delivery and web application firewall services",
    regulatoryRequirements:
      "Privacy Act 1988 (Australian Privacy Principle 11). Internal Information Classification Standard: outage information is Public, customer records are Restricted.",
  },
} as const satisfies Record<string, SeedRequestDetails>;

export type SeedRequestNumber = keyof typeof SEED_REQUEST_DETAILS;

export function seedRequestDetails(requestNumber: SeedRequestNumber): SeedRequestDetails {
  return SEED_REQUEST_DETAILS[requestNumber];
}
