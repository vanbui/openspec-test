import { factories } from '@strapi/strapi';

// D-36: IdamBox administers its applications, so none of the default CRUD
// routes is mounted on this API surface. GET /applications stays documented
// as an intentionally unserved operation; the web shell's read of it is
// removed rather than kept alive by a route.
export default factories.createCoreRouter('api::application.application', { only: [] });
