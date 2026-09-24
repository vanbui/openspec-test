import { factories } from "@strapi/strapi";

// Question definitions and answers are available only through the authorised,
// questionnaire-scoped workflow routes. No generic CRUD route is mounted.
export default factories.createCoreRouter("api::csrm-question.csrm-question", { only: [] });
