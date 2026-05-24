import type { Core } from '@strapi/strapi';

const CSRM_APPLICATION = {
  name: 'IdamBox CSRM',
  slug: 'idambox-csrm',
  description: 'Cybersecurity Risk Manager application for assessment request workflows.',
  status: 'active',
} as const;

const CSRM_ROLES = [
  {
    name: 'Security Analyst',
    description: 'Security analyst role for reviewing and releasing CSRM assessments.',
  },
  {
    name: 'Security Analyst Agent',
    description: 'Agent role for automated CSRM security analysis workflows.',
  },
] as const;

const CSRM_USERS = {
  jane: {
    email: 'jane.doe@idambox.com',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    status: 'active',
  },
  bob: {
    email: 'bob.doe@idambox.com',
    firstName: 'Bob',
    lastName: 'Doe',
    displayName: 'Bob Doe',
    status: 'active',
  },
} as const;

export async function seedCsrmData(strapi: Core.Strapi) {
  if (process.env.IDAMBOX_SEED_CSRM !== 'true') {
    return;
  }

  const applicationService = strapi.documents('api::application.application');
  const applicationRoleService = strapi.documents('api::application-role.application-role');
  const roleService = strapi.documents('api::role.role');
  const userService = strapi.documents('api::idambox-user.idambox-user');

  const existingApplications = await applicationService.findMany({
    filters: {
      slug: {
        $eq: CSRM_APPLICATION.slug,
      },
    },
    limit: 1,
  });

  const application =
    existingApplications[0] ??
    (await applicationService.create({
      data: CSRM_APPLICATION,
    }));

  const reusableRolesByName = new Map<string, { documentId: string }>();

  for (const roleSeed of CSRM_ROLES) {
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

    reusableRolesByName.set(roleSeed.name, reusableRole);
  }

  const existingJaneUsers = await userService.findMany({
    filters: {
      email: {
        $eq: CSRM_USERS.jane.email,
      },
    },
    limit: 1,
  });

  if (existingJaneUsers.length === 0) {
    await userService.create({
      data: CSRM_USERS.jane,
    });
  }

  const existingBobUsers = await userService.findMany({
    filters: {
      email: {
        $eq: CSRM_USERS.bob.email,
      },
    },
    limit: 1,
  });

  const securityAnalystRole = reusableRolesByName.get('Security Analyst');

  if (!securityAnalystRole) {
    throw new Error('Security Analyst role was not seeded');
  }

  if (existingBobUsers.length === 0) {
    await userService.create({
      data: {
        ...CSRM_USERS.bob,
        roles: [securityAnalystRole.documentId],
      },
    });
  } else {
    await userService.update({
      documentId: existingBobUsers[0].documentId,
      data: {
        roles: [securityAnalystRole.documentId],
      },
    });
  }

  strapi.log.info('IdamBox CSRM sample data seed complete');
}
