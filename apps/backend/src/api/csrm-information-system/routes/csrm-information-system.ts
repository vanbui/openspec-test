import { factories } from '@strapi/strapi';

// D-44: the generic reference-data read is unmounted. The served
// GET /v1/information_systems selector and its /selected hydration
// (routes/selected.ts) are the only read surface; the catalogue keeps the
// generic read's grant for traceability and served-operations.json records
// it as unserved.
export default factories.createCoreRouter('api::csrm-information-system.csrm-information-system', { only: [] });
