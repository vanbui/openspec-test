import { factories } from '@strapi/strapi';

// D-36: IdamBox administers its IAM records, so none of the default CRUD
// routes is mounted on this API surface and the full-access API token cannot
// read or write Functions over HTTP. The authorization policy and the seeds
// reach the content type through the Document Service.
export default factories.createCoreRouter('api::function.function', { only: [] });
