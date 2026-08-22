import type { CapabilityId } from "./capabilities";

export const navigationGroupIds = [
  "dashboard",
  "risk-assessment-requests",
  "questionnaires",
  "risk-assessments",
  "risk-register",
  "administration",
  "reports",
] as const;

export type NavigationGroupId = (typeof navigationGroupIds)[number];
export type IconKey =
  | "layout-dashboard"
  | "clipboard-list"
  | "file-question"
  | "shield-check"
  | "triangle-alert"
  | "settings"
  | "chart-no-axes-combined";
export type RouteStatus = "enabled" | "planned";

export interface RouteDefinition {
  id: string;
  href: string;
  title: string;
  group: NavigationGroupId;
  icon: IconKey;
  capability: CapabilityId;
  status: RouteStatus;
}

/** UI labels intentionally differ from source menuPath display strings. */
export const navigationGroupLabels: Readonly<Record<NavigationGroupId, string>> = {
  dashboard: "Dashboard",
  "risk-assessment-requests": "Risk Assessment Requests",
  questionnaires: "Questionnaires",
  "risk-assessments": "Risk Assessments",
  "risk-register": "Risk Register",
  administration: "Administration",
  reports: "Reports",
};

/**
 * The central route/navigation registry. Only implemented routes are enabled;
 * future entries remain intentional metadata for their owning delivery phase.
 */
export const routeDefinitions = [
  {
    id: "dashboard",
    href: "/",
    title: "Dashboard",
    group: "dashboard",
    icon: "layout-dashboard",
    capability: "function.dashboard.dashboard",
    status: "enabled",
  },
  {
    id: "my-requests",
    href: "/requests",
    title: "My Requests",
    group: "risk-assessment-requests",
    icon: "clipboard-list",
    capability: "function.risk_assessment_requests.my_requests",
    status: "enabled",
  },
  {
    id: "new-request",
    href: "/requests/new",
    title: "New Request",
    group: "risk-assessment-requests",
    icon: "clipboard-list",
    capability: "function.risk_assessment_requests.new_request",
    status: "enabled",
  },
  {
    id: "request-details",
    href: "/requests/[requestId]",
    title: "Request Details",
    group: "risk-assessment-requests",
    icon: "clipboard-list",
    capability: "function.risk_assessment_requests.request_details",
    status: "enabled",
  },
  {
    id: "analyst-requests",
    href: "/requests/all",
    title: "Requests",
    group: "risk-assessment-requests",
    icon: "clipboard-list",
    capability: "function.risk_assessment_requests.requests",
    status: "planned",
  },
  {
    id: "my-questionnaires",
    href: "/questionnaires",
    title: "My Questionnaires",
    group: "questionnaires",
    icon: "file-question",
    capability: "function.questionnaire.my_questionnaires",
    status: "planned",
  },
  {
    id: "questionnaire-details",
    href: "/questionnaires/[questionnaireId]",
    title: "Questionnaire Details",
    group: "questionnaires",
    icon: "file-question",
    capability: "function.questionnaire.questionnaire_details",
    status: "planned",
  },
  {
    id: "analyst-questionnaires",
    href: "/questionnaires/review",
    title: "Questionnaires",
    group: "questionnaires",
    icon: "file-question",
    capability: "function.questionnaires.questionnaires",
    status: "planned",
  },
  {
    id: "analyst-questionnaire-details",
    href: "/questionnaires/[questionnaireId]/review",
    title: "Questionnaire Details",
    group: "questionnaires",
    icon: "file-question",
    capability: "function.questionnaires.questionnaire_details",
    status: "planned",
  },
  {
    id: "my-risk-assessments",
    href: "/assessments",
    title: "My Risk Assessments",
    group: "risk-assessments",
    icon: "shield-check",
    capability: "function.risk_assessments.my_risk_assessments",
    status: "planned",
  },
  {
    id: "read-only-risk-assessment-details",
    href: "/assessments/[assessmentId]",
    title: "Risk Assessment Details",
    group: "risk-assessments",
    icon: "shield-check",
    capability: "function.risk_assessments.risk_assessment_details_read_only",
    status: "planned",
  },
  {
    id: "analyst-risk-assessments",
    href: "/assessments/review",
    title: "Risk Assessments",
    group: "risk-assessments",
    icon: "shield-check",
    capability: "function.risk_assessments.risk_assessments",
    status: "planned",
  },
  {
    id: "analyst-risk-assessment-details",
    href: "/assessments/[assessmentId]/review",
    title: "Risk Assessment Details",
    group: "risk-assessments",
    icon: "shield-check",
    capability: "function.risk_assessments.risk_assessment_details",
    status: "planned",
  },
  {
    id: "risk-register",
    href: "/risk-register",
    title: "Risk Register",
    group: "risk-register",
    icon: "triangle-alert",
    capability: "function.risk_register.risk_register",
    status: "planned",
  },
  {
    id: "risk-details",
    href: "/risk-register/[riskId]",
    title: "Risk Details",
    group: "risk-register",
    icon: "triangle-alert",
    capability: "function.risk_register.risk_details",
    status: "planned",
  },
  {
    id: "mitigation-controls",
    href: "/risk-register/mitigation-controls",
    title: "Mitigation Controls",
    group: "risk-register",
    icon: "triangle-alert",
    capability: "function.risk_register.mitigation_controls",
    status: "planned",
  },
  {
    id: "mitigation-control-details",
    href: "/risk-register/mitigation-controls/[implementationId]",
    title: "Mitigation Control Details",
    group: "risk-register",
    icon: "triangle-alert",
    capability: "function.risk_register.mitigation_control_details",
    status: "planned",
  },
  {
    id: "risk-types",
    href: "/administration/risk-types",
    title: "Risk Types",
    group: "administration",
    icon: "settings",
    capability: "function.administration.risk_types",
    status: "planned",
  },
  {
    id: "risk-type-details",
    href: "/administration/risk-types/[riskTypeId]",
    title: "Risk Type Details",
    group: "administration",
    icon: "settings",
    capability: "function.administration.risk_type_details",
    status: "planned",
  },
  {
    id: "controls",
    href: "/administration/controls",
    title: "Controls",
    group: "administration",
    icon: "settings",
    capability: "function.administration.controls",
    status: "planned",
  },
  {
    id: "control-details",
    href: "/administration/controls/[controlId]",
    title: "Control Details",
    group: "administration",
    icon: "settings",
    capability: "function.administration.control_details",
    status: "planned",
  },
  {
    id: "reports",
    href: "/reports",
    title: "Reports",
    group: "reports",
    icon: "chart-no-axes-combined",
    capability: "function.reports.reports",
    status: "planned",
  },
  {
    id: "alerts",
    href: "/reports/alerts",
    title: "Alerts",
    group: "reports",
    icon: "chart-no-axes-combined",
    capability: "function.reports.alerts",
    status: "planned",
  },
] as const satisfies readonly RouteDefinition[];

export function visibleRoutes(
  capabilities: readonly CapabilityId[],
): readonly RouteDefinition[] {
  const effectiveCapabilities = new Set(capabilities);

  return routeDefinitions.filter(
    (route) =>
      route.status === "enabled" && effectiveCapabilities.has(route.capability),
  );
}
