import { unlink } from "node:fs/promises";

/*
 * Removes every multipart temporary file after every request (14-04; D-11, D-25; 14-RESEARCH Pitfalls 2 and 3).
 *
 * strapi::body parses multipart bodies into formidable temporary files before any route runs, and removes only the
 * part named `files`, without waiting, and not at all when a later middleware throws. A route's own middlewares never
 * run for a refused caller. This global middleware sits directly after strapi::body (config/middlewares.ts), so in its
 * `finally` it removes the temporary file of every part under every name, arrays included, whatever the outcome:
 * accepted, refused by a policy, unmounted, or failed. Removal errors are swallowed; a file already gone is fine.
 */

type MultipartFile = { filepath?: unknown; path?: unknown };

type MultipartContext = { request: { files?: Record<string, MultipartFile | MultipartFile[] | undefined> | null } };

function temporaryPaths(files: MultipartContext["request"]["files"]): string[] {
  if (!files || typeof files !== "object") return [];
  const paths: string[] = [];
  for (const entry of Object.values(files)) {
    for (const file of Array.isArray(entry) ? entry : [entry]) {
      if (!file || typeof file !== "object") continue;
      const location = typeof file.filepath === "string" ? file.filepath : typeof file.path === "string" ? file.path : null;
      if (location) paths.push(location);
    }
  }
  return paths;
}

export default function csrmMultipartCleanup() {
  return async (context: MultipartContext, next: () => Promise<unknown>): Promise<void> => {
    try {
      await next();
    } finally {
      await Promise.all(temporaryPaths(context.request.files).map((location) => unlink(location).catch(() => undefined)));
    }
  };
}
