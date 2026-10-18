import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

/*
 * A fake S3-compatible object store for the private S3 storage tests (14-04; D-06; 14-RESEARCH Pitfall 6). It speaks
 * just enough path-style S3 for @strapi/provider-upload-aws-s3: PUT, GET and DELETE on /{bucket}/{key}. It stores each
 * body (decoding `aws-chunked` framing when the SDK sends it), answers a GET only when the query carries
 * X-Amz-Signature (a presigned read), and records every request's method, path and the headers a private
 * configuration must or must not send. Tests keep files under 5 MiB, so the SDK never switches to multipart.
 *
 * IN-301: it never verifies a signature (any X-Amz-Signature value is accepted) and never enforces an expiry. It
 * records a presigned URL's X-Amz-Expires and X-Amz-Credential, so a test can check the expiry the SDK signed and the
 * access key it signed with.
 *
 * No real endpoint is contacted: the server listens on 127.0.0.1 and the harness points the S3 client at it.
 */

export type FakeObjectStoreRequest = {
  method: string;
  /** The decoded path, `/{bucket}/{key}`. */
  path: string;
  /** Whether the query carried X-Amz-Signature (a presigned URL). */
  presigned: boolean;
  /** IN-301: a presigned URL's X-Amz-Expires, in seconds as sent, or undefined. */
  expires?: string;
  /** IN-301: a presigned URL's X-Amz-Credential, `{access key id}/{date}/{region}/s3/aws4_request`, or undefined. */
  credential?: string;
  /** The headers that decide privacy and encryption, as received (absent ones are undefined). */
  headers: {
    "x-amz-acl"?: string;
    "x-amz-server-side-encryption"?: string;
    "x-amz-server-side-encryption-aws-kms-key-id"?: string;
  };
  status: number;
};

export type FakeObjectStore = {
  /** The endpoint to configure, `http://127.0.0.1:{port}`. */
  endpoint: string;
  requests: FakeObjectStoreRequest[];
  /** Stored objects by `{bucket}/{key}`. */
  objects: Map<string, Buffer>;
  close: () => Promise<void>;
};

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value.join(",") : value;
}

/** Decodes `aws-chunked` framing: `{hex size}[;chunk-signature=…]\r\n{bytes}\r\n`, ending with a zero-size chunk. */
export function decodeAwsChunked(body: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < body.length) {
    const lineEnd = body.indexOf("\r\n", offset);
    if (lineEnd < 0) throw new Error("FAKE_OBJECT_STORE_CHUNK_FRAMING");
    const size = Number.parseInt(body.subarray(offset, lineEnd).toString("latin1").split(";")[0] ?? "", 16);
    if (!Number.isFinite(size)) throw new Error("FAKE_OBJECT_STORE_CHUNK_SIZE");
    if (size === 0) break;
    chunks.push(body.subarray(lineEnd + 2, lineEnd + 2 + size));
    offset = lineEnd + 2 + size + 2;
  }
  return Buffer.concat(chunks);
}

export async function startFakeObjectStore(): Promise<FakeObjectStore> {
  const requests: FakeObjectStoreRequest[] = [];
  const objects = new Map<string, Buffer>();
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const url = new URL(request.url ?? "/", "http://fake-object-store");
    const objectPath = decodeURIComponent(url.pathname);
    const key = objectPath.replace(/^\/+/, "");
    const presigned = url.searchParams.has("X-Amz-Signature");
    const record = (status: number) => requests.push({
      method: request.method ?? "",
      path: objectPath,
      presigned,
      expires: url.searchParams.get("X-Amz-Expires") ?? undefined,
      credential: url.searchParams.get("X-Amz-Credential") ?? undefined,
      headers: {
        "x-amz-acl": header(request.headers, "x-amz-acl"),
        "x-amz-server-side-encryption": header(request.headers, "x-amz-server-side-encryption"),
        "x-amz-server-side-encryption-aws-kms-key-id": header(request.headers, "x-amz-server-side-encryption-aws-kms-key-id"),
      },
      status,
    });
    const answer = (status: number, body?: Buffer, headers: Record<string, string> = {}) => {
      record(status);
      response.writeHead(status, { ...headers, ...(body ? { "content-length": String(body.length) } : { "content-length": "0" }) });
      response.end(body);
    };
    if (request.method === "PUT") {
      const raw = Buffer.concat(chunks);
      const chunked = (header(request.headers, "content-encoding") ?? "").includes("aws-chunked")
        || (header(request.headers, "x-amz-content-sha256") ?? "").startsWith("STREAMING-");
      objects.set(key, chunked ? decodeAwsChunked(raw) : raw);
      answer(200, undefined, { etag: `"${key.length.toString(16)}"` });
      return;
    }
    if (request.method === "GET") {
      const stored = objects.get(key);
      if (!presigned) return answer(403);
      if (!stored) return answer(404);
      answer(200, stored, { "content-type": "application/octet-stream" });
      return;
    }
    if (request.method === "DELETE") {
      objects.delete(key);
      answer(204);
      return;
    }
    answer(405);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    requests,
    objects,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
