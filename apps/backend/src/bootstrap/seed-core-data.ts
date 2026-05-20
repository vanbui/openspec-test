import type { Core } from '@strapi/strapi';

type ApplicationSeed = {
  name: string;
  description: string;
  roles?: Array<{
    name: string;
    description: string;
  }>;
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
    roles: [
      {
        name: 'STUDENT',
        description: 'Learner role for IdamBox LMS.',
      },
      {
        name: 'TUTOR',
        description: 'Tutor role for IdamBox LMS.',
      },
    ],
  },
  {
    name: 'IdamBox Cyber Risk Manager',
    description: 'Cyber risk management module.',
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

  for (const appSeed of applications) {
    const applicationService = strapi.documents('api::application.application');
    const existingApplications = await applicationService.findMany({
      filters: {
        slug: {
          $eq: slugify(appSeed.name),
        },
      },
      limit: 1,
    });

    const application =
      existingApplications[0] ??
      (await applicationService.create({
        data: {
          name: appSeed.name,
          slug: slugify(appSeed.name),
          description: appSeed.description,
          status: 'active',
        },
      }));

    for (const roleSeed of appSeed.roles ?? []) {
      const applicationRoleService = strapi.documents('api::application-role.application-role');
      const existingRoles = await applicationRoleService.findMany({
        filters: {
          name: {
            $eq: roleSeed.name,
          },
          application: {
            documentId: {
              $eq: application.documentId,
            },
          },
        },
        limit: 1,
      });

      if (existingRoles.length === 0) {
        await applicationRoleService.create({
          data: {
            name: roleSeed.name,
            description: roleSeed.description,
            application: application.documentId,
          },
        });
      }
    }
  }

  strapi.log.info('IdamBox core sample data seed complete');
}
