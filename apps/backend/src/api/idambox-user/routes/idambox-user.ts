import { factories } from '@strapi/strapi';

// D-36: IdamBox administers its IAM records, so none of the default CRUD
// routes is mounted on this API surface and the full-access API token cannot
// read or write IdamBox users over HTTP. The development identity middleware,
// the authorization policy and the seeds reach the content type through the
// Document Service.
export default factories.createCoreRouter('api::idambox-user.idambox-user', { only: [] });
