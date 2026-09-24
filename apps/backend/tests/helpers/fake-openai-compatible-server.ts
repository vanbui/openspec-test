import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

type ResponseDescriptor = { status?: number; body?: string; rawBody?: string; delayMs?: number };
type RequestRecord = { method?: string; path?: string; headers: Record<string, string | string[] | undefined>; body: unknown };

export async function startFakeOpenAiCompatibleServer(options: { response?: ResponseDescriptor; responses?: ResponseDescriptor[] } = {}) {
  const responses = [...(options.responses ?? [options.response ?? {}])];
  const requests: RequestRecord[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    let body: unknown = null;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { body = null; }
    requests.push({ method: request.method, path: request.url, headers: request.headers, body });
    const descriptor = responses.shift() ?? {};
    if (descriptor.delayMs) await new Promise((resolve) => setTimeout(resolve, descriptor.delayMs));
    response.statusCode = descriptor.status ?? 200;
    response.setHeader("content-type", "application/json");
    response.end(descriptor.rawBody ?? JSON.stringify({ id: "completion-1", object: "chat.completion", created: 0, model: "test", choices: [{ index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content: descriptor.body ?? "{}", refusal: null } }] }));
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address() as AddressInfo;
  return { baseURL: `http://127.0.0.1:${address.port}/v1`, requests, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
