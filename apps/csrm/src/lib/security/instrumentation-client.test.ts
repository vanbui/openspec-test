import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

/*
 * The production Content-Security-Policy allows no eval (D-19). Zod compiles object parsers with
 * `new Function` when it can, and finds out by trying once, when the first object schema is built;
 * the browser reports that caught attempt as a securitypolicyviolation. instrumentation-client.ts
 * runs in the browser before the application's modules and switches zod to jitless parsing, which
 * skips the attempt and parses the same way without generated code.
 */

const jitlessBefore = z.config().jitless;

afterEach(() => {
  z.config({ jitless: jitlessBefore });
});

describe('the client instrumentation', () => {
  it('switches zod to jitless parsing', async () => {
    z.config({ jitless: false });

    await import('../../../instrumentation-client');

    expect(z.config().jitless).toBe(true);
  });

  it("imports only zod's config, so every page's first load stays the same size", () => {
    // The file loads on every page. Importing the `z` namespace here added zod's whole API to the
    // root chunks (about 64 KB gzipped); the core `config` adds a few hundred bytes.
    const source = readFileSync(resolve(process.cwd(), 'instrumentation-client.ts'), 'utf8');

    expect(source).toMatch(/^import \{ config \} from 'zod\/v4\/core';$/m);
    expect(source).not.toMatch(/from 'zod';/);
  });

  it('leaves parsing and rejection unchanged', () => {
    z.config({ jitless: true });
    const schema = z.object({ title: z.string().min(1), count: z.number().int() }).strict();

    expect(schema.parse({ title: 'Customer portal', count: 2 })).toEqual({ title: 'Customer portal', count: 2 });
    expect(schema.safeParse({ title: '', count: 2 }).success).toBe(false);
    expect(schema.safeParse({ title: 'Customer portal', count: 1.5 }).success).toBe(false);
    expect(schema.safeParse({ title: 'Customer portal', count: 2, extra: true }).success).toBe(false);
  });
});
