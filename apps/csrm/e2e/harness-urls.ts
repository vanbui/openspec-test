function readLoopbackHttpOrigin(name: 'CSRM_E2E_STRAPI_ORIGIN' | 'CSRM_E2E_WEB_ORIGIN'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`E2E_HARNESS_ORIGIN_MISSING:${name}`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`E2E_HARNESS_ORIGIN_INVALID:${name}`);
  }

  const port = Number(url.port);
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || !url.port
    || !Number.isInteger(port)
    || port < 1
    || port > 65_535
    || url.origin !== value
  ) {
    throw new Error(`E2E_HARNESS_ORIGIN_INVALID:${name}`);
  }

  return url.origin;
}

const strapiOrigin = readLoopbackHttpOrigin('CSRM_E2E_STRAPI_ORIGIN');

export const strapiHealthUrl = `${strapiOrigin}/_health`;
export const webOrigin = readLoopbackHttpOrigin('CSRM_E2E_WEB_ORIGIN');
