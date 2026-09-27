import { createServer } from 'node:net';

/*
 * A server a spec spawns takes a port from its band in src/lib/testing/e2e-harness-ports.ts. The
 * bands avoid the ephemeral ranges, but any other process could still hold the port, and a spawned
 * server that cannot listen only shows up as a two-minute readiness timeout. This check binds the
 * port for a moment first, so a taken port fails at once and says which.
 */
export async function expectPortFree(port: number, label: string): Promise<void> {
  const free = await new Promise<boolean>((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
  if (!free) throw new Error(`HARNESS_PORT_IN_USE: ${label} needs 127.0.0.1:${port}, which another process already holds`);
}
