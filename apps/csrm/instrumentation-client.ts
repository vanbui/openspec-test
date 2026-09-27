import { config } from 'zod/v4/core';

/*
 * Runs in the browser after the document loads and before the application's own modules and
 * hydration (Next's instrumentation-client convention), so it is the one place that can configure
 * zod before any client module builds a schema.
 *
 * Zod compiles object parsers with `new Function` when it can, and finds out by trying once, when
 * the first object schema is built. The production Content-Security-Policy allows no eval, so the
 * browser reported that caught attempt as a securitypolicyviolation on every page whose client code
 * builds a schema (the request form and the Risk Register). Jitless parsing skips the attempt and
 * parses and rejects the same way without generated code (docs/security/web-headers.md). The server
 * never runs this file and keeps compiled parsers.
 *
 * `config` comes from zod's core, not the `z` namespace: this file loads on every page, and the
 * namespace would bring zod's whole API into that first load. Both share one configuration object.
 */
config({ jitless: true });
