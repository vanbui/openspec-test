/**
 * One heading per navigation destination (D-09, UI-SPEC §2.1). The sidebar label, the page's
 * level-one heading, its loading and error boundaries and its route title all read this one string,
 * so a label cannot drift from the heading of the page it opens. The Reference data collections read
 * their `pluralLabel` from `administration-config.ts`, which their own headings already use.
 */
export const pageHeadings = {
  home: 'Home',
  myRequests: 'My requests',
  newRequest: 'New request',
  myQuestionnaires: 'My questionnaires',
  myRiskAssessments: 'My risk assessments',
  assignedToMe: 'Assigned to me',
  reviewRequests: 'Requests',
  reviewQuestionnaires: 'Questionnaires',
  reviewAssessments: 'Risk assessments',
  riskRegister: 'Risk register',
  alerts: 'Alerts',
  reports: 'Reports',
} as const;

export type PageHeadingKey = keyof typeof pageHeadings;

/** The document title of a page headed `heading`: `{heading} | IdamBox CSRM`. */
export function routeTitle(heading: string): string {
  return `${heading} | IdamBox CSRM`;
}
