export function developmentIdentityEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.CSRM_ENVIRONMENT === "development" &&
    process.env.CSRM_DEV_IDENTITY === "true"
  );
}
