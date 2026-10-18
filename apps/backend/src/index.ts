import type { Core } from '@strapi/strapi';
import { registerScimRoutes } from './iam/scim/routes';
import { isAdministrationBoot } from './bootstrap/boot-mode';
import { seedCsrmData } from './bootstrap/seed-csrm-data';
import { seedIamData } from './bootstrap/seed-iam-data';
import { disableUsersPermissionsRegistration } from './bootstrap/disable-users-permissions-registration';
import { seedCoreData } from './bootstrap/seed-core-data';
import { reconcileDevelopmentPublicPermissions } from './bootstrap/reconcile-development-public-permissions';
import { seedQuestionnaireWorkflow } from './bootstrap/seed-questionnaire-workflow';
import { seedAssessmentWorkflow } from './bootstrap/seed-assessment-workflow';
import { seedAssessmentNavigationLifecycle } from './bootstrap/seed-assessment-navigation-lifecycle';
import { seedRiskRegisterWorkflow } from './bootstrap/seed-risk-register-workflow';
import { seedAnalystInsights } from './bootstrap/seed-analyst-insights';
import { seedRequestAttachmentStates } from './bootstrap/seed-request-attachment-states';
import { seedDevelopmentApiToken } from './bootstrap/seed-development-api-token';
import { assertCsrmAiConfiguration } from './csrm/ai-config-validation';
import { assertAttachmentConfiguration } from './csrm/files/attachment-config';
import { registerAttachmentStorage } from './csrm/files/register-attachment-storage';
import { reconcileInterruptedAiRuns, scheduleDeferredAiRunReconciliation, type DeferredAiRunReconciliation } from './api/csrm-ai-run/services/ai-run-record';
import { startAttachmentRescans, stopAttachmentRescans } from './api/csrm-request-attachment/services/request-attachments';
import { registerIdamboxUserProvisioning } from './keycloak/register-idambox-user-provisioning';
import { readKeycloakTokenVerificationConfig } from './keycloak/token-verification-config';
import { ensureIdentityDatabaseInvariants } from './iam/identity/database-invariants';
import { registerIdentityWrites } from './iam/identity/register-identity-writes';
import { readKeycloakSyncConfig } from './iam/keycloak-sync/config';
import { startKeycloakSyncWorker, stopKeycloakSyncWorker } from './iam/keycloak-sync/worker';
import { startPasswordSetupDispatcher, stopPasswordSetupDispatcher } from './iam/password-setup/dispatcher';

// The deferred AI run sweep each booted instance scheduled, stopped when that instance is destroyed (WR-01).
const deferredAiRunReconciliations = new WeakMap<object, DeferredAiRunReconciliation>();

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    assertCsrmAiConfiguration(strapi);
    // D-15: development defaults to local private storage and the development scanner; elsewhere unset settings turn
    // attachments off, and an invalid or incomplete setting, or the development scanner outside development, stops the boot.
    assertAttachmentConfiguration(strapi);
    // D-06: attachment bytes, and the Media Library's, are kept privately through the upload plugin's provider.
    registerAttachmentStorage(strapi);
    registerIdentityWrites(strapi);
    // Inert unless IDAMBOX_KEYCLOAK_PROVISIONING=true; incomplete Keycloak config stops the boot.
    registerIdamboxUserProvisioning(strapi);
    if (!isAdministrationBoot()) startPasswordSetupDispatcher(strapi);
    readKeycloakSyncConfig();
    // Inert unless IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true; incomplete config stops the boot (docs/adr/0004).
    const tokenVerification = readKeycloakTokenVerificationConfig();
    if (tokenVerification) {
      strapi.log.info(`Keycloak access-token verification is enabled for issuer ${tokenVerification.issuer}; the development identity header is ignored.`);
    }
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    registerScimRoutes(strapi);
    await ensureIdentityDatabaseInvariants(strapi);
    // D-37: unconditional, before any seed, so no boot leaves registration open.
    await disableUsersPermissionsRegistration(strapi);
    // Administration commands keep the invariants above and skip seeds, fixtures and workers (boot-mode.ts).
    if (isAdministrationBoot()) return;
    // D-20 and WR-01: runs a previous process left `running` are marked interrupted once they are past the AI request
    // bound, now and once more when the bound has passed since this boot. A younger run may be live in another
    // process; proving otherwise needs the shared job store (R-08-36).
    await reconcileInterruptedAiRuns(strapi);
    deferredAiRunReconciliations.set(strapi, scheduleDeferredAiRunReconciliation(strapi));
    await seedCoreData(strapi);
    await seedCsrmData(strapi);
    await seedIamData(strapi);
    // Phase 14 (WR-605): the request files no browser journey can reach (waiting, blocked, and on a released request),
    // seeded first among Jane's fixtures so its requests are her least recently updated and displace none of theirs.
    await seedRequestAttachmentStates(strapi);
    // The Phase 7 fixture runs before the other development fixtures Jane owns,
    // so its requests are her least recently updated and never displace theirs
    // from her default list, which sorts by last update.
    await seedAnalystInsights(strapi);
    await seedQuestionnaireWorkflow(strapi);
    await seedAssessmentWorkflow(strapi);
    await seedAssessmentNavigationLifecycle(strapi);
    await seedRiskRegisterWorkflow(strapi);
    await reconcileDevelopmentPublicPermissions(strapi);
    await seedDevelopmentApiToken(strapi);
    startKeycloakSyncWorker(strapi);
    // D-13: every start re-scans every quarantined attachment once, then on the backoff. It runs after the boot rather
    // than holding it up, so a scanner that is down never delays a start; destroy() stops it. WR-102: nothing it does
    // can end the process, so a failure is one error line and the files wait for the next start.
    void startAttachmentRescans(strapi).catch(() => {
      strapi.log.error("csrm.attachment_rescan: the start of the attachment re-scans failed; each quarantined attachment is re-scanned at the next start.");
    });
  },

  async destroy({ strapi }: { strapi: Core.Strapi }) {
    await stopPasswordSetupDispatcher(strapi);
    await stopKeycloakSyncWorker(strapi);
    await deferredAiRunReconciliations.get(strapi)?.stop();
    deferredAiRunReconciliations.delete(strapi);
    // D-13, Pitfall 11: no re-scan timer, and no re-scan in flight, outlives this instance.
    await stopAttachmentRescans(strapi);
  },
};
