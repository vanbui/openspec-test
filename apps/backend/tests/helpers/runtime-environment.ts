/*
 * The AI data policy (D-26) and the completion transcript (D-30) read NODE_ENV and CSRM_ENVIRONMENT when they run, and
 * only both set to `development` is the development runtime (`isDevelopmentRuntime`). These helpers set the two for one
 * action and put them back after it, whatever it does.
 */
type RuntimeVariable = "NODE_ENV" | "CSRM_ENVIRONMENT";

function assign(name: RuntimeVariable, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

export async function withRuntimeEnvironment<T>(nodeEnv: string | undefined, csrmEnvironment: string | undefined, action: () => Promise<T> | T): Promise<T> {
  const prior = { nodeEnv: process.env.NODE_ENV, csrmEnvironment: process.env.CSRM_ENVIRONMENT };
  assign("NODE_ENV", nodeEnv);
  assign("CSRM_ENVIRONMENT", csrmEnvironment);
  try {
    return await action();
  } finally {
    assign("NODE_ENV", prior.nodeEnv);
    assign("CSRM_ENVIRONMENT", prior.csrmEnvironment);
  }
}

/* Every runtime that is not development: either variable production, both production, and both unset. */
export const RUNTIMES_OUTSIDE_DEVELOPMENT: ReadonlyArray<readonly [string | undefined, string | undefined]> = [
  ["development", "production"],
  ["production", "development"],
  ["production", "production"],
  [undefined, undefined],
];
