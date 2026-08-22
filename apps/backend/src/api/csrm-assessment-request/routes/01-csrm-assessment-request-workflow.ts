const protectedPolicies = [
  "global::csrm-app-enabled",
  "api::csrm-assessment-request.internal-csrm-caller",
];

export default {
  routes: [
    { method: "GET", path: "/csrm-assessment-requests/dashboard", handler: "csrm-assessment-request.dashboard", config: { auth: false, policies: protectedPolicies } },
    { method: "POST", path: "/csrm-assessment-requests/:id/submit", handler: "csrm-assessment-request.submit", config: { auth: false, policies: protectedPolicies } },
    { method: "POST", path: "/csrm-assessment-requests/:id/withdraw", handler: "csrm-assessment-request.withdraw", config: { auth: false, policies: protectedPolicies } },
  ],
};
