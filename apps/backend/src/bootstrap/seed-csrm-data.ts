import type { Core } from '@strapi/strapi';

const SECURITY_ANALYST_ROLE_NAME = 'Security Analyst';

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

  const roleService = strapi.documents('api::role.role');
  const userService = strapi.documents('api::idambox-user.idambox-user');

  const existingSecurityAnalystRoles = await roleService.findMany({
    filters: {
      name: {
        $eq: SECURITY_ANALYST_ROLE_NAME,
      },
    },
    limit: 1,
  });

  const securityAnalystRole = existingSecurityAnalystRoles[0];

  if (!securityAnalystRole) {
    throw new Error(
      `Security Analyst role was not found. Enable IDAMBOX_SEED_CORE=true to seed core data before CSRM users.`,
    );
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
