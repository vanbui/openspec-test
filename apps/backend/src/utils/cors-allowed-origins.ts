/**
 * The browser origins strapi::cors may grant a cross-origin read to (R-08-11).
 *
 * No browser needs cross-origin access to Strapi: the web calls it server-side and the admin panel is
 * served from Strapi's own origin. So the default, an empty or unset CSRM_CORS_ALLOWED_ORIGINS, grants
 * no origin at all. Listing an origin is an operator's deployment decision, for example an admin panel
 * served from another origin. Each comma-separated entry must be an exact http or https origin: a
 * wildcard, `null`, a path, a query or credentials refuse the whole value, so a mistake stops the boot
 * rather than quietly re-opening access. Entries are returned as browsers send them in `Origin`
 * (lower-case host, default port dropped, no trailing slash).
 */
export const CORS_ALLOWED_ORIGINS_VARIABLE = "CSRM_CORS_ALLOWED_ORIGINS";

export class CorsAllowedOriginsError extends Error {
  constructor(entry: number) {
    super(
      `${CORS_ALLOWED_ORIGINS_VARIABLE} entry ${entry} is not an exact http or https origin such as https://csrm.example.com; `
        + "wildcards, null, paths, queries and credentials are refused.",
    );
    this.name = "CorsAllowedOriginsError";
  }
}

function exactOrigin(entry: string, position: number): string {
  if (entry.includes("*")) throw new CorsAllowedOriginsError(position);
  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    throw new CorsAllowedOriginsError(position);
  }
  const isHttp = url.protocol === "https:" || url.protocol === "http:";
  const originOnly = url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "" && url.password === "";
  if (!isHttp || !originOnly || url.hostname === "") throw new CorsAllowedOriginsError(position);
  return url.origin;
}

export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  const entries = (value ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return [...new Set(entries.map((entry, index) => exactOrigin(entry, index + 1)))];
}
