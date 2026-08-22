import "server-only";

export type TrustedRequestActor = {
  email: string;
};

/** Production receives no development identity until the OIDC resolver lands. */
export async function resolveCurrentActor(): Promise<TrustedRequestActor | undefined> {
  return undefined;
}
