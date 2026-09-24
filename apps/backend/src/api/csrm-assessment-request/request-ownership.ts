type IdamBoxIdentity = { documentId: string };

type CreateContext = {
  state?: { idamboxUser?: IdamBoxIdentity };
  request?: { body?: { data?: Record<string, unknown> } };
};

function hasDocumentId(value: unknown): value is IdamBoxIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { documentId?: unknown }).documentId === "string" &&
    (value as { documentId: string }).documentId.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function applyTrustedRequestorOwnership(context: CreateContext): void {
  const identity = context.state?.idamboxUser;
  const body = context.request?.body;
  const data = body?.data;

  if (!hasDocumentId(identity) || !body || !isRecord(data)) {
    throw new Error("CSRM assessment request ownership is denied.");
  }

  body.data = {
    ...data,
    requestor: identity.documentId,
  };
}
