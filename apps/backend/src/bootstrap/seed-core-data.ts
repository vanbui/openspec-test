import type { Core } from '@strapi/strapi';

const IDAMBOX_NAME_PREFIX = 'IdamBox ';

export function getApplicationNamePrefix(applicationName: string): string {
  return applicationName.startsWith(IDAMBOX_NAME_PREFIX)
    ? applicationName.slice(IDAMBOX_NAME_PREFIX.length)
    : applicationName;
}

export function buildPrefixedEntitlementName(
  applicationName: string,
  entitlementName: string,
): string {
  return `${getApplicationNamePrefix(applicationName)} ${entitlementName}`;
}

export const CSRM_SECURITY_ANALYST_ROLE_NAME = buildPrefixedEntitlementName(
  'IdamBox CSRM',
  'Security Analyst',
);

type EntitlementSeed = {
  name: string;
  description: string;
  createReusableRole?: boolean;
};

type ApplicationSeed = {
  name: string;
  slug?: string;
  description: string;
  entitlements?: EntitlementSeed[];
};

const applications: ApplicationSeed[] = [
  {
    name: 'IdamBox IAM',
    description: 'Identity and access management module.',
  },
  {
    name: 'IdamBox Compliance',
    description: 'Compliance management module.',
  },
  {
    name: 'IdamBox Automation',
    description: 'Automation workflow module.',
  },
  {
    name: 'IdamBox Crypto Manager',
    description: 'Cryptographic asset management module.',
  },
  {
    name: 'IdamBox LMS',
    description: 'Learning management module.',
    entitlements: [
      {
        name: 'STUDENT',
        description: 'Learner entitlement for IdamBox LMS.',
      },
      {
        name: 'TUTOR',
        description: 'Tutor entitlement for IdamBox LMS.',
      },
    ],
  },
  {
    name: 'IdamBox CSRM',
    slug: 'idambox-csrm',
    description: 'Cybersecurity Risk Manager module for automating cybersecurity risk management processes.',
    entitlements: [
      {
        name: 'Security Analyst',
        description: 'Security Analyst entitlement IdamBox CSRM.',
        createReusableRole: true,
      },
      {
        name: 'Security Analyst Agent',
        description: 'Security Analyst Agentic entitlement for automated CSRM security analysis workflows.',
        createReusableRole: true,
      },
    ],
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export async function seedCoreData(strapi: Core.Strapi) {
  if (process.env.IDAMBOX_SEED_CORE !== 'true') {
    return;
  }

  const applicationService = strapi.documents('api::application.application');
  const entitlementService = strapi.documents('api::entitlement.entitlement');
  const roleService = strapi.documents('api::role.role');

  for (const appSeed of applications) {
    const slug = appSeed.slug ?? slugify(appSeed.name);

    const existingApplications = await applicationService.findMany({
      filters: {
        slug: {
          $eq: slug,
        },
      },
      limit: 1,
    });

    const application =
      existingApplications[0] ??
      (await applicationService.create({
        data: {
          name: appSeed.name,
          slug,
          description: appSeed.description,
          status: 'active',
        },
      }));

    for (const entitlementSeed of appSeed.entitlements ?? []) {
      const entitlementName = buildPrefixedEntitlementName(appSeed.name, entitlementSeed.name);

      const existingEntitlements = await entitlementService.findMany({
        filters: {
          name: {
            $eq: entitlementName,
          },
          application: {
            documentId: {
              $eq: application.documentId,
            },
          },
        },
        limit: 1,
      });

      const entitlement =
        existingEntitlements[0] ??
        (await entitlementService.create({
          data: {
            name: entitlementName,
            description: entitlementSeed.description,
            application: application.documentId,
          },
        }));

      if (!entitlementSeed.createReusableRole) {
        continue;
      }

      const existingReusableRoles = await roleService.findMany({
        filters: {
          name: {
            $eq: entitlementName,
          },
        },
        limit: 1,
      });

      const reusableRole =
        existingReusableRoles[0] ??
        (await roleService.create({
          data: {
            name: entitlementName,
            description: entitlementSeed.description,
            entitlements: [entitlement.documentId],
          },
        }));

      if (existingReusableRoles.length > 0) {
        await roleService.update({
          documentId: reusableRole.documentId,
          data: {
            entitlements: [entitlement.documentId],
          },
        });
      }
    }
  }

  strapi.log.info('IdamBox core sample data seed complete');
}
