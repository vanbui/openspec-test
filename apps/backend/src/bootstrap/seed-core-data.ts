import type { Core } from '@strapi/strapi';

type ApplicationRoleSeed = {
  name: string;
  description: string;
  createReusableRole?: boolean;
};

type ApplicationSeed = {
  name: string;
  slug?: string;
  description: string;
  applicationRoles?: ApplicationRoleSeed[];
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
    applicationRoles: [
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
    name: 'IdamBox CSRM',
    slug: 'idambox-csrm',
    description: 'Cybersecurity Risk Manager application for assessment request workflows.',
    applicationRoles: [
      {
        name: 'Security Analyst',
        description: 'Security analyst role for reviewing and releasing CSRM assessments.',
        createReusableRole: true,
      },
      {
        name: 'Security Analyst Agent',
        description: 'Agent role for automated CSRM security analysis workflows.',
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
  const applicationRoleService = strapi.documents('api::application-role.application-role');
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

    for (const roleSeed of appSeed.applicationRoles ?? []) {
      const existingApplicationRoles = await applicationRoleService.findMany({
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

      const applicationRole =
        existingApplicationRoles[0] ??
        (await applicationRoleService.create({
          data: {
            name: roleSeed.name,
            description: roleSeed.description,
            application: application.documentId,
          },
        }));

      if (!roleSeed.createReusableRole) {
        continue;
      }

      const existingReusableRoles = await roleService.findMany({
        filters: {
          name: {
            $eq: roleSeed.name,
          },
        },
        limit: 1,
      });

      const reusableRole =
        existingReusableRoles[0] ??
        (await roleService.create({
          data: {
            name: roleSeed.name,
            description: roleSeed.description,
            applicationRoles: [applicationRole.documentId],
          },
        }));

      if (existingReusableRoles.length > 0) {
        await roleService.update({
          documentId: reusableRole.documentId,
          data: {
            applicationRoles: [applicationRole.documentId],
          },
        });
      }
    }
  }

  strapi.log.info('IdamBox core sample data seed complete');
}
