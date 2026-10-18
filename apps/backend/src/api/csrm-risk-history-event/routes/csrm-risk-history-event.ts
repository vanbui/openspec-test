import { factories } from '@strapi/strapi';

/* D-18: the history is append-only and served only through the Risk history read; no core route is mounted. */
export default factories.createCoreRouter('api::csrm-risk-history-event.csrm-risk-history-event' as Parameters<typeof factories.createCoreRouter>[0], { only: [] });
