export const listStateTargets: readonly string[];

export function findSharedListStateViolations(sources: Record<string, string>): string[];

export function verifySharedListStates(rootDirectory: string): void;
