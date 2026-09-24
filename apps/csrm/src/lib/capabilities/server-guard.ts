import 'server-only';

import type { Capability } from './capability-adapter';

/**
 * Applies presentation-layer route gating. Strapi remains authoritative for
 * FunctionAPI and record-level authorization.
 */
export class CapabilityDeniedError extends Error {
  constructor() {
    super('Capability access is not available.');
    this.name = 'CapabilityDeniedError';
  }
}

export function requireCapability(
  capability: Capability,
  granted: ReadonlySet<Capability>,
): void {
  if (!granted.has(capability)) {
    throw new CapabilityDeniedError();
  }
}
