import { isCsrmAppEnabled } from '../csrm/config';

type PolicyContext = {
  forbidden?: (message: string) => unknown;
};

export default (policyContext: PolicyContext) => {
  if (isCsrmAppEnabled()) {
    return true;
  }

  return policyContext.forbidden
    ? policyContext.forbidden('CSRM application behavior is disabled. Set csrmAppIsEnabled=true to enable CSRM routes.')
    : false;
};
